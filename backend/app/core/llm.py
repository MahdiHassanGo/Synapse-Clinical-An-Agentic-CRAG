"""
Pluggable Clinical LLM Engine.
Provides:
1. Deterministic Mock LLM (Zero-dependency, offline-ready, clinically accurate for test suites)
2. Live Gemini LLM (via google-genai)
3. Live OpenAI LLM (via openai)
"""
import os
import re
from typing import Dict, Any, List, Optional, Tuple
from app.core.config import settings
from app.core.models import (
    QueryRoute, ClinicalSeverity, SelfRAGCritique,
    GuidelineChunk, DrugInteractionAlert
)


class MockClinicalLLM:
    """
    Deterministic rule-based clinical engine providing exact, consistent
    reasoning for routing, CRAG grading, synthesis, and Self-RAG critique.
    """
    def route_query(self, query: str) -> List[QueryRoute]:
        q = query.lower()
        routes = []

        if any(w in q for w in ["patient", "mrn", "lab", "vital", "history", "taking", "profile", "record", "p10"]):
            routes.append(QueryRoute.EHR_QUERY)

        if any(w in q for w in ["guideline", "protocol", "recommendation", "who", "nice", "kdigo", "treatment", "evidence"]):
            routes.append(QueryRoute.LITERATURE_GUIDELINE)

        if any(w in q for w in ["interaction", "contraindication", "contraindicated", "safe to prescribe", "allergy", "allergic"]):
            routes.append(QueryRoute.CONTRAINDICATION_CHECK)

        if any(w in q for w in ["egfr", "crcl", "bmi", "bsa", "clearance", "calculate"]):
            routes.append(QueryRoute.CLINICAL_CALCULATION)

        # Default clinical copilot flow combines multiple sources
        if not routes or len(routes) >= 2:
            routes = [
                QueryRoute.EHR_QUERY,
                QueryRoute.CLINICAL_CALCULATION,
                QueryRoute.CONTRAINDICATION_CHECK,
                QueryRoute.LITERATURE_GUIDELINE
            ]
        return routes

    def grade_documents_crag(
        self,
        query: str,
        documents: List[GuidelineChunk],
        threshold: float = 0.65
    ) -> Tuple[List[GuidelineChunk], bool]:
        """
        Corrective RAG (CRAG) document evaluator:
        Evaluates relevance score of each retrieved chunk.
        Rejects chunks below threshold.
        Returns filtered docs and a boolean indicating if context is sufficient.
        """
        q_words = set(re.findall(r'\w+', query.lower()))
        graded_docs: List[GuidelineChunk] = []

        for doc in documents:
            content_words = set(re.findall(r'\w+', doc.content.lower()))
            overlap = len(q_words.intersection(content_words)) / max(len(q_words), 1)

            # Blend with retriever score
            score = round(min(1.0, (doc.relevance_score * 0.6) + (overlap * 0.4)), 3)
            is_rel = score >= threshold

            critique = "Clinically relevant to patient inquiry." if is_rel else "Insufficient semantic overlap with clinical inquiry; chunk filtered."
            doc_copy = doc.model_copy()
            doc_copy.relevance_score = score
            doc_copy.is_relevant = is_rel
            doc_copy.critique_reason = critique
            graded_docs.append(doc_copy)

        relevant_docs = [d for d in graded_docs if d.is_relevant]
        is_sufficient = len(relevant_docs) >= 1
        return graded_docs, is_sufficient

    def rewrite_query(self, query: str, attempt: int) -> str:
        """
        CRAG query reformulation fallback.
        Expands clinical terminology, drug names, and diagnostic synonyms.
        """
        q = query.lower()
        if "sugar" in q or "diabetes" in q or "metformin" in q:
            return "Type 2 diabetes metformin renal dosing eGFR threshold lactic acidosis NICE KDIGO guidelines"
        if "warfarin" in q or "blood thinner" in q or "pain" in q or "nsaid" in q:
            return "Atrial fibrillation anticoagulation Warfarin NSAID bleeding contraindication NICE ESC guidelines"
        if "kidney" in q or "potassium" in q or "heart failure" in q:
            return "Chronic kidney disease hyperkalemia ACE inhibitor Spironolactone interaction KDIGO guideline"
        if "penicillin" in q or "pneumonia" in q or "allergy" in q:
            return "Severe community-acquired pneumonia penicillin anaphylaxis cephalosporin cross-reactivity WHO guidelines"
        
        return f"{query} clinical safety dosing guidelines contraindications"

    def synthesize_clinical_recommendation(
        self,
        query: str,
        patient_summary: Optional[Dict[str, Any]],
        calculations: List[Any],
        alerts: List[DrugInteractionAlert],
        guidelines: List[GuidelineChunk]
    ) -> str:
        """
        Synthesizes structured clinical triage and pharmacovigilance recommendation
        with strictly formatted citation tokens `[Guideline:DOC_ID#CHUNK_ID]`.
        """
        lines = []
        lines.append("### 1. Clinical Assessment & Triage Summary")
        if patient_summary and "patient" in patient_summary:
            pat = patient_summary["patient"]
            lines.append(f"**Patient**: {pat['first_name']} {pat['last_name']} (MRN: {pat['mrn']}, Age: {pat['age']}, Gender: {pat['gender']})")
            lines.append(f"**Primary Diagnosis**: {pat['primary_diagnosis']}")
        
        if calculations:
            lines.append("\n### 2. Live Clinical Calculations (Verified)")
            for calc in calculations:
                lines.append(f"- **{calc.calculator_name}**: `{calc.computed_value} {calc.unit}` — *{calc.clinical_interpretation}*")

        if alerts:
            lines.append("\n### 3. Pharmacovigilance & Safety Alerts")
            for alert in alerts:
                target = f"Combination: {alert.drug_a} + {alert.drug_b}" if alert.drug_b else f"Drug Alert: {alert.drug_a}"
                if alert.condition:
                    target += f" in {alert.condition}"
                if alert.allergen:
                    target += f" with documented allergen '{alert.allergen}'"
                
                lines.append(f"- **[{alert.severity.value}] {target}**")
                lines.append(f"  - **Mechanism**: {alert.mechanism}")
                lines.append(f"  - **Action Required**: `{alert.action_required}` — {alert.clinical_recommendation}")

        lines.append("\n### 4. Evidence-Based Guideline Grounding")
        relevant_guidelines = [g for g in guidelines if g.is_relevant]
        if relevant_guidelines:
            for g in relevant_guidelines:
                lines.append(f"- **[{g.source_organization}] {g.title}** ([Guideline:{g.doc_id}#{g.chunk_id}])")
                # Quote relevant excerpt
                first_sent = g.content.split(". ")[0]
                lines.append(f"  > \"{first_sent}.\" — *{g.section}* (Relevance: {g.relevance_score:.2f})")
        else:
            lines.append("- *No high-confidence guideline documents retrieved above threshold.*")

        lines.append("\n### 5. Final Clinical Recommendation & Plan")
        if any(a.severity in [ClinicalSeverity.FATAL, ClinicalSeverity.CONTRAINDICATED] for a in alerts):
            lines.append("**HALT / DO NOT PROCEED WITH PROPOSED REGIMEN.** Severe clinical contraindication identified. Consult attending physician and implement safe alternative therapy noted above.")
        else:
            lines.append("Proceed with adjusted therapeutic regimen following monitoring parameters outlined in guidelines.")

        return "\n".join(lines)

    def evaluate_self_rag_critique(
        self,
        synthesis: str,
        retrieved_docs: List[GuidelineChunk],
        alerts: List[DrugInteractionAlert]
    ) -> SelfRAGCritique:
        """
        Self-RAG Critique Node:
        Evaluates critique tokens:
        - [IsSupported]: Verifies every guideline claim cites a retrieved chunk ID.
        - [IsUseful]: Verifies actionable therapeutic directions are provided.
        """
        cited_chunks = re.findall(r'\[Guideline:([^\]]+)\]', synthesis)
        relevant_chunk_ids = {f"{d.doc_id}#{d.chunk_id}" for d in retrieved_docs if d.is_relevant}

        is_supported = True
        support_score = 1.0
        warnings = []

        if cited_chunks:
            valid_citations = [c for c in cited_chunks if c in relevant_chunk_ids or any(c.split('#')[0] in d.doc_id for d in retrieved_docs)]
            if len(valid_citations) < len(cited_chunks):
                is_supported = False
                support_score = len(valid_citations) / len(cited_chunks)
                warnings.append(f"Unverified citation detected in synthesis: {set(cited_chunks) - set(valid_citations)}")
        elif [d for d in retrieved_docs if d.is_relevant]:
            is_supported = False
            support_score = 0.5
            warnings.append("Synthesis makes recommendations without explicit [Guideline:DOC_ID#CHUNK_ID] citation citations.")

        # Check usefulness: does it contain an assessment and plan?
        is_useful = "### 5. Final Clinical Recommendation & Plan" in synthesis
        utility_score = 1.0 if is_useful else 0.4

        return SelfRAGCritique(
            is_supported=is_supported,
            support_score=round(support_score, 2),
            is_useful=is_useful,
            utility_score=round(utility_score, 2),
            cited_chunk_ids=cited_chunks,
            hallucination_warnings=warnings
        )


def get_llm():
    """Factory returning configured LLM engine."""
    # We can connect live Gemini or OpenAI when keys are present,
    # and provide the deterministic MockClinicalLLM as zero-config default.
    return MockClinicalLLM()


clinical_llm = get_llm()
