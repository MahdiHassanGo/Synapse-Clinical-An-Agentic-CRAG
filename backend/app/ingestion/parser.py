"""
Structure-Aware Document Parser.
Extracts sections, headings, tables, and page numbers from PDFs, HTML/URLs, and text.
Generates stable hash-based chunk IDs.
"""
import io
import re
import hashlib
from typing import List, Dict, Any, Tuple, Optional
from bs4 import BeautifulSoup
from pypdf import PdfReader


def compute_content_hash(text: str) -> str:
    """Computes stable SHA-256 hash of text."""
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()[:12]


class DocumentParser:
    def parse_pdf(self, file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
        """Parses PDF page by page, extracting headings and page metadata."""
        reader = PdfReader(io.BytesIO(file_bytes))
        extracted_pages = []

        for idx, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            clean_text = self._clean_text(page_text)
            if clean_text:
                extracted_pages.append({
                    "page_number": idx + 1,
                    "text": clean_text
                })
        return extracted_pages

    def parse_html(self, html_content: str, url: str) -> List[Dict[str, Any]]:
        """Extracts article body, headings, and structure from HTML."""
        soup = BeautifulSoup(html_content, "html.parser")
        
        # Remove noisy tags
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()

        title = soup.title.string.strip() if soup.title and soup.title.string else url
        body_text = soup.get_text(separator="\n")
        clean_text = self._clean_text(body_text)

        return [{
            "page_number": 1,
            "section": title,
            "text": clean_text
        }]

    def _clean_text(self, text: str) -> str:
        # Normalize whitespace and strange linebreaks
        text = re.sub(r'\r\n|\r', '\n', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r'[ \t]+', ' ', text)
        return text.strip()

    def create_hierarchical_chunks(
        self,
        doc_id: str,
        title: str,
        org: str,
        parsed_pages: List[Dict[str, Any]],
        parent_chunk_size: int = 1000,
        child_chunk_size: int = 300
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Generates parent sections and linked child chunks with stable content-hash UIDs.
        """
        parent_records = []
        child_records = []

        for page in parsed_pages:
            page_num = page.get("page_number", 1)
            full_text = page["text"]
            
            # Split into parent sections (by double newlines or paragraph limits)
            paragraphs = [p.strip() for p in full_text.split("\n\n") if len(p.strip()) > 40]
            if not paragraphs:
                paragraphs = [full_text]

            for p_idx, para in enumerate(paragraphs):
                p_hash = compute_content_hash(para)
                parent_chunk_id = f"{doc_id}_P_{p_hash}"
                
                parent_record = {
                    "chunk_id": parent_chunk_id,
                    "doc_id": doc_id,
                    "parent_chunk_id": None,
                    "title": title,
                    "source_organization": org,
                    "section": f"Page {page_num} - Section {p_idx + 1}",
                    "page_number": page_num,
                    "content": para,
                    "token_count": len(para.split()),
                    "content_hash": p_hash
                }
                parent_records.append(parent_record)

                # Split parent into child recommendation statements
                sentences = [s.strip() for s in para.split(". ") if len(s.strip()) > 15]
                child_buffer = ""
                c_idx = 1

                for sent in sentences:
                    s_dot = sent if sent.endswith(".") else sent + "."
                    if len(child_buffer) + len(s_dot) > child_chunk_size and child_buffer:
                        c_hash = compute_content_hash(child_buffer)
                        child_records.append({
                            "chunk_id": f"{parent_chunk_id}_C{c_idx}_{c_hash[:6]}",
                            "doc_id": doc_id,
                            "parent_chunk_id": parent_chunk_id,
                            "title": title,
                            "source_organization": org,
                            "section": parent_record["section"],
                            "page_number": page_num,
                            "content": child_buffer.strip(),
                            "token_count": len(child_buffer.split()),
                            "content_hash": c_hash
                        })
                        c_idx += 1
                        child_buffer = s_dot
                    else:
                        child_buffer += (" " + s_dot) if child_buffer else s_dot

                if child_buffer:
                    c_hash = compute_content_hash(child_buffer)
                    child_records.append({
                        "chunk_id": f"{parent_chunk_id}_C{c_idx}_{c_hash[:6]}",
                        "doc_id": doc_id,
                        "parent_chunk_id": parent_chunk_id,
                        "title": title,
                        "source_organization": org,
                        "section": parent_record["section"],
                        "page_number": page_num,
                        "content": child_buffer.strip(),
                        "token_count": len(child_buffer.split()),
                        "content_hash": c_hash
                    })

        return parent_records, child_records


document_parser = DocumentParser()
