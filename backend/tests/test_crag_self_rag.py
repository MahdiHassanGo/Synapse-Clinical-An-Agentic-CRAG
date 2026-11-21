"""
Tests for CRAG (Corrective RAG) grading and Self-RAG Critique.
"""
from app.core.models import GuidelineChunk, ClinicalSeverity, DrugInteractionAlert
from app.core.llm import clinical_llm


def test_crag_grading_filters_irrelevant_chunks():
    relevant_chunk = GuidelineChunk(
        chunk_id="C1",
        doc_id="NICE_NG28",
        title="Metformin Guideline",
        source_organization="NICE",
        section="Renal Thresholds",
        content="Stop metformin immediately if eGFR falls below 30 mL/min due to fatal lactic acidosis.",
        relevance_score=0.8
    )
    irrelevant_chunk = GuidelineChunk(
        chunk_id="C2",
        doc_id="MISC_01",
        title="Dermatology Protocol",
        source_organization="WHO",
        section="Eczema Emollients",
        content="Apply topical hydrocortisone twice daily for mild skin flares.",
        relevance_score=0.1
    )

    graded, sufficient = clinical_llm.grade_documents_crag(
        query="Should we stop metformin for low eGFR?",
        documents=[relevant_chunk, irrelevant_chunk],
        threshold=0.65
    )

    assert len(graded) == 2
    assert graded[0].is_relevant is True
    assert graded[1].is_relevant is False
    assert sufficient is True


def test_query_rewriter_fallback():
    rewritten = clinical_llm.rewrite_query("sugar pills kidney", attempt=1)
    assert "metformin" in rewritten.lower()
    assert "egfr" in rewritten.lower()


def test_self_rag_critique_evaluates_citations():
    retrieved = [
        GuidelineChunk(
            chunk_id="CH_101",
            doc_id="NICE_NG28",
            title="Diabetes Guidelines",
            source_organization="NICE",
            section="Metformin Dosing",
            content="Metformin contraindication in renal impairment.",
            relevance_score=0.9,
            is_relevant=True
        )
    ]

    synthesis_with_valid_citation = (
        "Patient exhibits severe CKD. "
        "- [NICE] Diabetes Guidelines ([Guideline:NICE_NG28#CH_101])\n"
        "### 5. Final Clinical Recommendation & Plan\n"
        "Discontinue metformin."
    )

    critique = clinical_llm.evaluate_self_rag_critique(
        synthesis=synthesis_with_valid_citation,
        retrieved_docs=retrieved,
        alerts=[]
    )

    assert critique.is_supported is True
    assert critique.support_score >= 0.9
    assert critique.is_useful is True
    assert "NICE_NG28#CH_101" in critique.cited_chunk_ids
