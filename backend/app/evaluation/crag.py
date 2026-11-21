"""
Corrective RAG (CRAG) Evaluator.
Evaluates actual retrieved evidence chunks, filters irrelevant contexts,
detects contradictory evidence, and controls fallback query reformulation.
"""
from typing import List, Dict, Any, Tuple
from app.core.models import GuidelineChunk


class CRAGEvaluator:
    def __init__(self, relevance_threshold: float = 0.50):
        self.relevance_threshold = relevance_threshold

    def evaluate_retrieved_evidence(
        self,
        query: str,
        retrieved_chunks: List[GuidelineChunk]
    ) -> Tuple[List[GuidelineChunk], bool, List[str]]:
        """
        Evaluates relevance of each chunk, filters irrelevant entries,
        and checks for contradictions among retrieved guidelines.
        Returns:
            - graded_chunks: List with relevance scores and is_relevant flags
            - is_context_sufficient: bool (True if sufficient high-confidence evidence exists)
            - contradiction_notes: List of detected conflicting guidelines
        """
        q_tokens = set(query.lower().split())
        graded: List[GuidelineChunk] = []
        contradictions: List[str] = []

        for chunk in retrieved_chunks:
            chunk_copy = chunk.model_copy()
            content_lower = chunk.content.lower()

            # Cross-encoder score or hybrid relevance
            base_score = chunk.cross_encoder_score if chunk.cross_encoder_score is not None else chunk.relevance_score
            # Medical token overlap factor (ignore short tokens)
            med_tokens = [t for t in q_tokens if len(t) > 3 and t not in ["with", "for", "from", "that", "this", "patient"]]
            overlap = sum(1 for t in med_tokens if t in content_lower) / max(len(med_tokens), 1)
            blended_score = round(max(base_score, (base_score * 0.7) + (overlap * 0.3)), 3)

            is_rel = blended_score >= self.relevance_threshold or base_score >= 0.40
            chunk_copy.relevance_score = blended_score
            chunk_copy.is_relevant = is_rel
            chunk_copy.relevance_score = blended_score
            chunk_copy.is_relevant = is_rel
            chunk_copy.critique_reason = (
                "Verified relevant clinical evidence." if is_rel
                else f"Below relevance threshold ({blended_score:.2f} < {self.relevance_threshold:.2f}); filtered."
            )
            graded.append(chunk_copy)

        relevant_chunks = [c for c in graded if c.is_relevant]

        # Contradiction Detection across relevant guidelines
        has_contraindicated = any("contraindicated" in c.content.lower() or "avoid" in c.content.lower() for c in relevant_chunks)
        has_recommended = any("recommend" in c.content.lower() or "first-line" in c.content.lower() for c in relevant_chunks)
        if has_contraindicated and has_recommended:
            contradictions.append(
                "Differing recommendation thresholds detected across retrieved guidelines. Clinical caution required."
            )

        # Context sufficiency check
        is_sufficient = len(relevant_chunks) >= 1 and any(c.relevance_score >= 0.55 for c in relevant_chunks)

        return graded, is_sufficient, contradictions


crag_evaluator = CRAGEvaluator()
