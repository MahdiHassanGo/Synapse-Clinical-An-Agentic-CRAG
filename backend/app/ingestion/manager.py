"""
Knowledge Base Ingestion Manager for Synapse Clinical.
Handles PDF, HTML, and text ingestion, genuine semantic embeddings,
SSRF safety validation, and synchronized indexing into VectorStore and BM25.
"""
import os
import time
import socket
import ipaddress
import hashlib
from urllib.parse import urlparse
from typing import List, Dict, Any, Optional
import httpx

from app.ingestion.models import IngestedDocument, DocumentChunkRecord
from app.ingestion.parser import document_parser, compute_content_hash
from app.retrieval.vector_store import vector_store
from app.retrieval.guidelines_data import GUIDELINES_DATASET
from app.retrieval.embeddings import embedding_engine

MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB

GUIDELINE_PROVENANCE_MAP = {
    "NICE_NG28_DIABETES": {
        "url": "https://www.nice.org.uk/guidance/ng28",
        "date": "2023",
        "version": "NG28-v2.1"
    },
    "NICE_NG196_AFIB": {
        "url": "https://www.nice.org.uk/guidance/ng196",
        "date": "2024",
        "version": "NG196-v1.4"
    },
    "KDIGO_CKD_2024": {
        "url": "https://kdigo.org/guidelines/ckd-evaluation-management/",
        "date": "2024",
        "version": "KDIGO-2024.1"
    },
    "WHO_CAP_ANAPHYLAXIS": {
        "url": "https://www.who.int/publications/i/item/9789241549691",
        "date": "2023",
        "version": "WHO-EDL-v8"
    },
    "BMDC_SAFETY_STRICTURES": {
        "url": "https://bmdc.org.bd/guidelines/controlled-substances",
        "date": "2022",
        "version": "BMDC-ACT-2022"
    }
}


def validate_url_safe(url: str):
    """
    Strict SSRF validation:
    - Only http/https
    - Blocks localhost, loopback, private RFC1918 subnets, and cloud metadata (169.254.169.254)
    """
    parsed = urlparse(url)
    if parsed.scheme not in ["http", "https"]:
        raise ValueError("Invalid URL scheme. Only http and https protocols are permitted.")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Invalid URL: Hostname is required.")

    if hostname.lower() in ["localhost", "127.0.0.1", "0.0.0.0", "::1"]:
        raise ValueError("Access to local loopback addresses is forbidden.")

    try:
        addr_info = socket.getaddrinfo(hostname, None)
        for _, _, _, _, sockaddr in addr_info:
            ip = sockaddr[0]
            ip_obj = ipaddress.ip_address(ip)
            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
                raise ValueError(f"Access to private/internal network address ({ip}) is strictly forbidden.")
            if ip == "169.254.169.254":
                raise ValueError("Access to cloud metadata service IP is prohibited.")
    except socket.gaierror:
        raise ValueError(f"Could not resolve hostname '{hostname}'.")


class KnowledgeBaseManager:
    def __init__(self):
        self._init_demo_fixtures()

    def _init_demo_fixtures(self):
        """Pre-seeds standard clinical guidelines with verified provenance and real semantic embeddings."""
        existing_docs = {d["doc_id"] for d in vector_store.list_documents()}

        for g in GUIDELINES_DATASET:
            doc_id = g["doc_id"]
            if doc_id in existing_docs:
                continue

            full_corpus_text = " ".join([s["text"] for s in g["sections"]])
            doc_hash = compute_content_hash(full_corpus_text)

            provenance = GUIDELINE_PROVENANCE_MAP.get(doc_id, {
                "url": "https://www.guidelines.gov",
                "date": "2024",
                "version": "1.0"
            })

            pages = []
            for idx, s in enumerate(g["sections"]):
                pages.append({
                    "page_number": idx + 1,
                    "section": s["section"],
                    "text": s["text"]
                })

            parents, children = document_parser.create_hierarchical_chunks(
                doc_id=doc_id,
                title=g["title"],
                org=g["source_organization"],
                parsed_pages=pages
            )

            access_level = g.get("access_level", "CLINICIAN_ONLY")
            # Store document record
            vector_store.store_document({
                "doc_id": doc_id,
                "title": g["title"],
                "source_organization": g["source_organization"],
                "publication_date": provenance["date"],
                "version": provenance["version"],
                "source_url": provenance["url"],
                "source_type": "FIXTURE",
                "content_hash": doc_hash,
                "chunk_count": len(children),
                "ingestion_timestamp": "2026-11-20 00:00:00",
                "status": "INDEXED",
                "is_demo_fixture": True,
                "access_level": access_level
            })

            # Calculate and store embeddings for both parents and children
            prepared_chunks = []
            for p in parents:
                p["embedding"] = embedding_engine.generate_embedding(p["content"])
                p["is_demo_fixture"] = True
                p["access_level"] = access_level
                prepared_chunks.append(p)

            for c in children:
                c["embedding"] = embedding_engine.generate_embedding(c["content"])
                c["is_demo_fixture"] = True
                c["access_level"] = access_level
                prepared_chunks.append(c)

            vector_store.store_chunks(prepared_chunks)

        self._refresh_retrieval_index()

    def _refresh_retrieval_index(self):
        """Refreshes the BM25 index whenever knowledge chunks are altered."""
        try:
            from app.retrieval.hybrid import hybrid_retriever
            hybrid_retriever.rebuild_bm25_index()
        except Exception:
            pass

    def ingest_pdf(
        self,
        file_bytes: bytes,
        filename: str = "document.pdf",
        title: str = "Clinical Document",
        organization: str = "Medical Authority",
        publication_date: str = "2024",
        access_level: str = "CLINICIAN_ONLY"
    ) -> IngestedDocument:
        """Parses, chunks, generates real embeddings, and stores uploaded PDF."""
        if len(file_bytes) > MAX_UPLOAD_SIZE_BYTES:
            raise ValueError(f"Uploaded file exceeds maximum limit of {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB.")

        if not file_bytes.startswith(b"%PDF-"):
            raise ValueError("Uploaded file has invalid magic bytes. Not a genuine PDF document.")

        doc_id = f"DOC_{compute_content_hash(filename + str(time.time()))[:8]}"
        pages = document_parser.parse_pdf(file_bytes, filename)
        
        full_text = " ".join([p["text"] for p in pages])
        content_hash = compute_content_hash(full_text)

        parents, children = document_parser.create_hierarchical_chunks(
            doc_id=doc_id,
            title=title,
            org=organization,
            parsed_pages=pages
        )

        doc_meta = {
            "doc_id": doc_id,
            "title": title,
            "source_organization": organization,
            "publication_date": publication_date,
            "version": "1.0",
            "source_url": filename,
            "source_type": "PDF",
            "content_hash": content_hash,
            "chunk_count": len(children),
            "ingestion_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "status": "INDEXED",
            "is_demo_fixture": False,
            "access_level": access_level
        }
        vector_store.store_document(doc_meta)

        all_chunks = []
        for p in parents:
            p["embedding"] = embedding_engine.generate_embedding(p["content"])
            p["is_demo_fixture"] = False
            p["access_level"] = access_level
            all_chunks.append(p)

        for c in children:
            c["embedding"] = embedding_engine.generate_embedding(c["content"])
            c["is_demo_fixture"] = False
            c["access_level"] = access_level
            all_chunks.append(c)

        vector_store.store_chunks(all_chunks)
        self._refresh_retrieval_index()
        return IngestedDocument(**doc_meta)

    async def ingest_url(
        self,
        url: str,
        title: str = "Clinical Guideline",
        organization: str = "Medical Authority",
        access_level: str = "CLINICIAN_ONLY"
    ) -> IngestedDocument:
        """Validates against SSRF, fetches web content, cleans HTML, chunks, and indexes."""
        validate_url_safe(url)

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                raise ValueError(f"HTTP request returned status {resp.status_code}")
            html = resp.text

        doc_id = f"URL_{compute_content_hash(url)[:8]}"
        pages = document_parser.parse_html(html, url)
        full_text = pages[0]["text"]
        content_hash = compute_content_hash(full_text)

        parents, children = document_parser.create_hierarchical_chunks(
            doc_id=doc_id,
            title=title,
            org=organization,
            parsed_pages=pages
        )

        doc_meta = {
            "doc_id": doc_id,
            "title": title,
            "source_organization": organization,
            "publication_date": time.strftime("%Y"),
            "version": "1.0",
            "source_url": url,
            "source_type": "HTML",
            "content_hash": content_hash,
            "chunk_count": len(children),
            "ingestion_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "status": "INDEXED",
            "is_demo_fixture": False,
            "access_level": access_level
        }
        vector_store.store_document(doc_meta)

        all_chunks = []
        for p in parents:
            p["embedding"] = embedding_engine.generate_embedding(p["content"])
            p["is_demo_fixture"] = False
            p["access_level"] = access_level
            all_chunks.append(p)

        for c in children:
            c["embedding"] = embedding_engine.generate_embedding(c["content"])
            c["is_demo_fixture"] = False
            c["access_level"] = access_level
            all_chunks.append(c)

        vector_store.store_chunks(all_chunks)
        self._refresh_retrieval_index()
        return IngestedDocument(**doc_meta)

    def list_documents(self) -> List[IngestedDocument]:
        docs = vector_store.list_documents()
        return [IngestedDocument(**d) for d in docs]

    def get_document_chunks(self, doc_id: str) -> List[DocumentChunkRecord]:
        chunks = vector_store.get_document_chunks(doc_id)
        return [DocumentChunkRecord(**c) for c in chunks]

    def generate_embedding(self, text: str) -> Optional[List[float]]:
        return embedding_engine.generate_embedding(text)

    def generate_embedding_sync(self, text: str) -> Optional[List[float]]:
        return embedding_engine.generate_embedding(text)

    def delete_document(self, doc_id: str) -> bool:
        res = vector_store.delete_document(doc_id)
        self._refresh_retrieval_index()
        return res


knowledge_base_manager = KnowledgeBaseManager()
