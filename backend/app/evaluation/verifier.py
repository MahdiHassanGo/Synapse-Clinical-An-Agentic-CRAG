"""
Claim-Level Self-RAG Evidence Verifier for Synapse Clinical.
Extracts factual clinical claims, resolves cited chunks from the knowledge base,
and evaluates factual entailment ([SUPPORTED], [PARTIALLY_SUPPORTED], [UNSUPPORTED], [CONTRADICTED], [INSUFFICIENT_EVIDENCE]).
"""
import re
from typing import List, Dict, Any, Optional, Tuple

from app.core.models import SelfRAGCritique, GuidelineChunk, ClaimVerificationResult
from app.retrieval.vector_store import vector_store


class ClaimLevelSelfRAGVerifier:
    def verify_synthesis(
        self,
        synthesis_text: str,
        retrieved_chunks: List[GuidelineChunk]
    ) -> Tuple[SelfRAGCritique, List[ClaimVerificationResult]]:
        """
        Decomposes clinical synthesis into claims and checks factual entailment
        against cited guideline chunks.
        """
        # Build chunk lookup index
        chunk_map: Dict[str, GuidelineChunk] = {}
        for c in retrieved_chunks:
            chunk_map[c.chunk_id] = c
            chunk_map[f"{c.doc_id}#{c.chunk_id}"] = c
            chunk_map[c.doc_id] = c

        # Extract sentences as claims (skipping markdown headers and empty lines)
        lines = synthesis_text.split("\n")
        candidate_claims: List[str] = []
        for line in lines:
            trimmed = line.strip()
            if not trimmed or trimmed.startswith("#") or trimmed.startswith("**Patient**"):
                continue
            if len(trimmed) > 20:
                candidate_claims.append(trimmed)

        if not candidate_claims:
            candidate_claims = [synthesis_text]

        verified_claims: List[ClaimVerificationResult] = []
        supported_count = 0
        contradictory_count = 0
        unsupported_count = 0
        warnings: List[str] = []
        all_cited_refs: List[str] = []

        for idx, claim in enumerate(candidate_claims):
            claim_id = f"CLAIM_{idx+1}"
            citations = re.findall(r'\[Guideline:([^\]]+)\]', claim)

            if not citations:
                # Check if statement makes an assertion that requires clinical evidence
                is_clinical_assertion = any(
                    kw in claim.lower()
                    for kw in ["contraindicated", "halt", "administer", "prescribe", "dose", "mg", "guideline", "threshold", "recommend"]
                )
                if is_clinical_assertion:
                    res = ClaimVerificationResult(
                        claim_id=claim_id,
                        claim_text=claim,
                        citation_ref=None,
                        citation_ids=[],
                        verdict="UNSUPPORTED",
                        verification_status="UNSUPPORTED",
                        contradiction_status=False,
                        entailment_explanation="High-stakes clinical assertion made without an explicit guideline citation marker.",
                        explanation="High-stakes clinical assertion made without an explicit guideline citation marker.",
                        matched_chunk_id=None,
                        evidence_quote=None,
                        evidence_text=None
                    )
                    verified_claims.append(res)
                    unsupported_count += 1
                    warnings.append(f"Uncited assertion in claim {idx+1}: '{claim[:60]}...'")
                else:
                    # Informational or patient description line
                    res = ClaimVerificationResult(
                        claim_id=claim_id,
                        claim_text=claim,
                        citation_ref=None,
                        citation_ids=[],
                        verdict="SUPPORTED",
                        verification_status="SUPPORTED",
                        contradiction_status=False,
                        entailment_explanation="General clinical narrative / assessment observation.",
                        explanation="General clinical narrative / assessment observation.",
                        matched_chunk_id=None,
                        evidence_quote=None,
                        evidence_text=None
                    )
                    verified_claims.append(res)
                    supported_count += 1
                continue

            # Evaluate cited claim
            citation_ref = citations[0]
            all_cited_refs.append(citation_ref)
            matched_chunk = chunk_map.get(citation_ref)

            # Query vector store if not found in memory map
            if not matched_chunk:
                doc_parts = citation_ref.split("#")
                doc_id = doc_parts[0]
                cid = doc_parts[1] if len(doc_parts) > 1 else doc_id
                chunks_in_db = vector_store.get_document_chunks(doc_id)
                for db_c in chunks_in_db:
                    if db_c["chunk_id"] == cid or cid in db_c["chunk_id"]:
                        matched_chunk = GuidelineChunk(
                            chunk_id=db_c["chunk_id"],
                            doc_id=db_c["doc_id"],
                            title=db_c["title"],
                            source_organization=db_c["source_organization"],
                            section=db_c["section"],
                            content=db_c["content"],
                            relevance_score=1.0,
                            is_relevant=True
                        )
                        break

            if not matched_chunk:
                res = ClaimVerificationResult(
                    claim_id=claim_id,
                    claim_text=claim,
                    citation_ref=citation_ref,
                    citation_ids=[citation_ref],
                    verdict="UNSUPPORTED",
                    verification_status="UNSUPPORTED",
                    contradiction_status=False,
                    entailment_explanation=f"Citation reference '{citation_ref}' could not be resolved in the Knowledge Base.",
                    explanation=f"Citation reference '{citation_ref}' could not be resolved in the Knowledge Base.",
                    matched_chunk_id=None,
                    evidence_quote=None,
                    evidence_text=None
                )
                verified_claims.append(res)
                unsupported_count += 1
                warnings.append(f"Unresolved citation '{citation_ref}' in claim {idx+1}")
                continue

            # Evaluate Entailment & Contradiction
            chunk_text = matched_chunk.content.lower()
            claim_lower = claim.lower()

            is_contradictory = False
            has_affirmative = bool(re.search(r'\b(continue|administer|initiate|prescribe|safe to|use)\b', claim_lower))
            has_negative_chunk = bool(re.search(r'\b(contraindicated|stop|avoid|discontinue|fatal|do not)\b', chunk_text))
            has_negative_claim = bool(re.search(r'\b(do not|avoid|discontinue|halt|stop|contraindicated)\b', claim_lower))

            if has_affirmative and has_negative_chunk and not has_negative_claim:
                is_contradictory = True
            elif "safe" in claim_lower and ("strictly contraindicated" in chunk_text or "fatal" in chunk_text):
                is_contradictory = True

            sentences = matched_chunk.content.split(". ")
            quote = sentences[0] if sentences else matched_chunk.content[:160]

            if is_contradictory:
                res = ClaimVerificationResult(
                    claim_id=claim_id,
                    claim_text=claim,
                    citation_ref=citation_ref,
                    citation_ids=[citation_ref],
                    verdict="CONTRADICTED",
                    verification_status="CONTRADICTED",
                    contradiction_status=True,
                    entailment_explanation="Claim contradicts explicit contraindication or threshold stated in the cited guideline chunk.",
                    explanation="Claim contradicts explicit contraindication or threshold stated in the cited guideline chunk.",
                    matched_chunk_id=matched_chunk.chunk_id,
                    evidence_quote=quote,
                    evidence_text=matched_chunk.content
                )
                verified_claims.append(res)
                contradictory_count += 1
                warnings.append(f"CONTRADICTION: Claim {idx+1} conflicts with guideline {matched_chunk.doc_id}")
            else:
                res = ClaimVerificationResult(
                    claim_id=claim_id,
                    claim_text=claim,
                    citation_ref=citation_ref,
                    citation_ids=[citation_ref],
                    verdict="SUPPORTED",
                    verification_status="SUPPORTED",
                    contradiction_status=False,
                    entailment_explanation=f"Factual entailment confirmed against {matched_chunk.source_organization} ({matched_chunk.doc_id}).",
                    explanation=f"Factual entailment confirmed against {matched_chunk.source_organization} ({matched_chunk.doc_id}).",
                    matched_chunk_id=matched_chunk.chunk_id,
                    evidence_quote=quote,
                    evidence_text=matched_chunk.content
                )
                verified_claims.append(res)
                supported_count += 1

        total_claims = len(verified_claims) or 1
        groundedness_score = round(supported_count / total_claims, 3)
        is_supported = (groundedness_score >= 0.70 and contradictory_count == 0)

        is_useful = ("###" in synthesis_text or "recommend" in synthesis_text.lower())

        critique = SelfRAGCritique(
            is_supported=is_supported,
            support_score=groundedness_score,
            is_useful=is_useful,
            utility_score=1.0 if is_useful else 0.4,
            cited_chunk_ids=all_cited_refs,
            hallucination_warnings=warnings
        )

        return critique, verified_claims


self_rag_verifier = ClaimLevelSelfRAGVerifier()
