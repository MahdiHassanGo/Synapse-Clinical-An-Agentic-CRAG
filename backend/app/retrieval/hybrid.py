"""
Hybrid Retrieval Engine for Synapse Clinical.
Orchestrates:
1. Dense semantic vector retrieval from persistent VectorStore.
2. Sparse BM25 ranking across all ingested knowledge chunks.
3. Reciprocal Rank Fusion (RRF) candidate blending (Top 20-30).
4. Genuine Neural Cross-Encoder Reranking (FlashRank) down to Top 5-8.
5. Parent chunk context hydration.
"""
import re
import math
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from rank_bm25 import BM25Okapi

from app.core.models import GuidelineChunk
from app.core.config import settings
from app.retrieval.vector_store import vector_store
from app.retrieval.reranker import cross_encoder_reranker
from app.ingestion.manager import knowledge_base_manager


def tokenize(text: str) -> List[str]:
    """Clinically aware tokenizer preserving decimals and medical terms."""
    clean = re.sub(r'[^\w\s\.<>-]', ' ', text.lower())
    return [t.strip() for t in clean.split() if len(t.strip()) > 1]


class ClinicalHybridRetriever:
    def __init__(self):
        self.bm25: Optional[BM25Okapi] = None
        self.indexed_chunk_ids: List[str] = []
        self.chunk_lookup: Dict[str, Dict[str, Any]] = {}
        self.rebuild_bm25_index()

    def rebuild_bm25_index(self):
        """Builds or refreshes the in-memory BM25 index from persistent VectorStore chunks."""
        docs = vector_store.list_documents()
        corpus_tokens = []
        chunk_ids = []
        lookup = {}

        for doc in docs:
            chunks = vector_store.get_document_chunks(doc["doc_id"])
            for c in chunks:
                cid = c["chunk_id"]
                chunk_ids.append(cid)
                lookup[cid] = c
                toks = tokenize(f"{c['title']} {c['section']} {c['content']}")
                corpus_tokens.append(toks if toks else ["clinical"])

        self.indexed_chunk_ids = chunk_ids
        self.chunk_lookup = lookup
        if corpus_tokens:
            self.bm25 = BM25Okapi(corpus_tokens)
        else:
            self.bm25 = None

    def search_hybrid(
        self,
        query: str,
        initial_k: int = 25,
        final_top_n: int = 5,
        rrf_k: int = 60,
        top_k: Optional[int] = None,
        access_level: Optional[str] = None
    ) -> List[GuidelineChunk]:
        if top_k is not None:
            final_top_n = top_k
        """
        Executes genuine hybrid retrieval:
        1. Dense Vector Search ($K=25$)
        2. Sparse BM25 Search ($K=25$)
        3. Reciprocal Rank Fusion (RRF)
        4. FlashRank Neural Cross-Encoder Reranker ($Top N=5-8$)
        5. Parent Context Hydration
        Optionally filters by access_level ('PATIENT_APPROVED' vs 'CLINICIAN_ONLY').
        """
        if not self.indexed_chunk_ids:
            self.rebuild_bm25_index()

        q_tokens = tokenize(query)
        if not q_tokens:
            return []

        # 1. Sparse BM25 candidate ranks
        bm25_candidates: Dict[str, int] = {}
        if self.bm25 and len(self.indexed_chunk_ids) > 0:
            scores = self.bm25.get_scores(q_tokens)
            ranked_indices = np.argsort(scores)[::-1][:initial_k * 2]
            rank_counter = 1
            for idx in ranked_indices:
                if idx < len(self.indexed_chunk_ids):
                    cid = self.indexed_chunk_ids[idx]
                    chunk_obj = self.chunk_lookup.get(cid)
                    if access_level and chunk_obj and chunk_obj.get("access_level") != access_level:
                        continue
                    bm25_candidates[cid] = rank_counter
                    rank_counter += 1
                    if rank_counter > initial_k:
                        break

        # 2. Dense Semantic Vector search
        q_vec = knowledge_base_manager.generate_embedding_sync(query)
        dense_results = vector_store.search_dense(q_vec, top_k=initial_k, access_level=access_level)
        dense_candidates: Dict[str, int] = {}
        for rank, (score, chunk_dict) in enumerate(dense_results):
            cid = chunk_dict["chunk_id"]
            dense_candidates[cid] = rank + 1
            if cid not in self.chunk_lookup:
                self.chunk_lookup[cid] = chunk_dict

        # 3. Reciprocal Rank Fusion (RRF)
        all_candidate_ids = set(bm25_candidates.keys()).union(set(dense_candidates.keys()))
        rrf_scores: List[Tuple[float, str]] = []

        for cid in all_candidate_ids:
            score = 0.0
            if cid in bm25_candidates:
                score += 1.0 / (rrf_k + bm25_candidates[cid])
            if cid in dense_candidates:
                score += 1.0 / (rrf_k + dense_candidates[cid])
            rrf_scores.append((score, cid))

        rrf_scores.sort(key=lambda x: x[0], reverse=True)
        top_candidates = [
            self.chunk_lookup[cid] for _, cid in rrf_scores[:initial_k]
            if cid in self.chunk_lookup and (not access_level or self.chunk_lookup[cid].get("access_level") == access_level)
        ]

        # 4. Neural Cross-Encoder Reranking
        passages_for_rerank = []
        for c in top_candidates:
            passages_for_rerank.append({
                "chunk_id": c["chunk_id"],
                "content": c["content"],
                "doc_id": c["doc_id"],
                "title": c["title"],
                "source_organization": c["source_organization"],
                "section": c["section"],
                "parent_chunk_id": c.get("parent_chunk_id")
            })

        reranked_results = cross_encoder_reranker.rerank(
            query=query,
            passages=passages_for_rerank,
            top_n=final_top_n
        )

        # 5. Format, calibrate scores, and hydrate parent context
        max_ce = max((float(r.get("cross_encoder_score", 0.0)) for r in reranked_results), default=1.0)
        final_chunks: List[GuidelineChunk] = []
        for r in reranked_results:
            cid = r["chunk_id"]
            parent_id = r.get("parent_chunk_id")
            hydrated_content = r["content"]

            # If parent chunk exists in lookup, attach section context
            if parent_id and parent_id in self.chunk_lookup:
                parent_content = self.chunk_lookup[parent_id]["content"]
                hydrated_content = f"{r['content']}\n[Full Guideline Section Context: {parent_content}]"

            ce_score = float(r.get("cross_encoder_score", 0.75))
            if max_ce >= 0.08:
                rel_ratio = ce_score / max_ce
                norm_score = round(min(1.0, max(0.0, 0.45 * rel_ratio + 0.55 * min(1.0, ce_score * 5.0))), 3)
            else:
                confidence_factor = max_ce / 0.08 if max_ce > 0 else 0.0
                rel_ratio = (ce_score / max_ce) if max_ce > 0 else 0.0
                norm_score = round(min(1.0, max(0.0, (0.45 * rel_ratio + 0.55 * ce_score) * confidence_factor)), 3)

            final_chunks.append(GuidelineChunk(
                chunk_id=cid,
                doc_id=r["doc_id"],
                title=r["title"],
                source_organization=r["source_organization"],
                section=r["section"],
                content=hydrated_content,
                parent_chunk_id=parent_id,
                relevance_score=norm_score,
                is_relevant=(norm_score >= 0.40)
            ))

        return final_chunks


hybrid_retriever = ClinicalHybridRetriever()
