"""
Deterministic tests for Hybrid Retrieval and Parent-Child Chunking.
"""
from app.retrieval.chunker import hierarchical_chunker
from app.retrieval.hybrid import hybrid_retriever


def test_hierarchical_parent_child_chunking():
    doc_id = "TEST_DOC_01"
    title = "Hypertension Protocol"
    section = "First-Line Antihypertensives"
    text = (
        "Initiate therapy with ACE inhibitors or ARBs for non-black patients under 55. "
        "For patients over 55 or black patients of any age, initiate a calcium channel blocker like Amlodipine. "
        "Monitor blood pressure and renal function within 4 weeks of initiation."
    )
    parent, children = hierarchical_chunker.chunk_guideline(
        doc_id=doc_id,
        title=title,
        source_organization="NICE",
        section_name=section,
        full_text=text
    )

    assert parent.chunk_id.startswith("TEST_DOC_01_P_")
    assert len(children) >= 1
    for child in children:
        assert child.parent_chunk_id == parent.chunk_id
        assert child.doc_id == doc_id


def test_hybrid_search_exact_keyword_and_semantic_boost():
    # Test recall for Dapagliflozin / SGLT2
    results = hybrid_retriever.search_hybrid("Dapagliflozin kidney CKD eGFR", top_k=3)
    assert len(results) > 0
    top_doc = results[0]
    assert "SGLT2" in top_doc.content or "Dapagliflozin" in top_doc.content
    assert top_doc.relevance_score > 0.5
    # Verify parent context is hydrated
    assert "Full Guideline Section Context" in top_doc.content


def test_hybrid_search_warfarin_bleeding():
    results = hybrid_retriever.search_hybrid("Warfarin NSAID gastrointestinal bleeding", top_k=2)
    assert len(results) > 0
    top = results[0]
    assert "Warfarin" in top.content or "NICE" in top.source_organization
