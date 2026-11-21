"""
Test Suite for Upgraded Features:
- Model Orchestrator and Circuit Breaker
- Neural Cross-Encoder Reranking
- Claim-Level Self-RAG Factual Entailment
- Knowledge Base Document Ingestion
- Reproducible RAG Evaluation Suite
- Genuine Run Manager & HITL Resumption
"""
import pytest
import asyncio
from app.core.orchestrator.models import OrchestratorTask
from app.core.orchestrator.orchestrator import model_orchestrator, CircuitBreaker
from app.retrieval.reranker import cross_encoder_reranker
from app.evaluation.verifier import self_rag_verifier
from app.core.models import GuidelineChunk
from app.ingestion.manager import knowledge_base_manager
from app.retrieval.embeddings import embedding_engine
from app.graph.workflow import execute_triage_flow
from app.evaluation.benchmark import rag_evaluation_runner
from app.graph.run_manager import run_manager


def test_circuit_breaker_logic():
    cb = CircuitBreaker(failure_threshold=2, cooldown_seconds=1.0)
    assert cb.is_open("test:model") is False
    cb.record_failure("test:model")
    assert cb.is_open("test:model") is False
    cb.record_failure("test:model")
    assert cb.is_open("test:model") is True
    cb.record_success("test:model")
    assert cb.is_open("test:model") is False


def test_deterministic_task_guards():
    """Confirms clinical calculators and drug safety rules can NEVER be routed to an LLM."""
    with pytest.raises(ValueError):
        model_orchestrator.get_task_routing_plan(OrchestratorTask.DETERMINISTIC_CALCULATION)
    with pytest.raises(ValueError):
        model_orchestrator.get_task_routing_plan(OrchestratorTask.DRUG_SAFETY_CHECK)


def test_neural_cross_encoder_rerank():
    query = "Metformin lactic acidosis in CKD"
    passages = [
        {"chunk_id": "C1", "content": "Metformin is contraindicated in severe kidney disease due to risk of fatal lactic acidosis.", "title": "NICE NG28"},
        {"chunk_id": "C2", "content": "Topical hydrocortisone is used for minor skin irritation.", "title": "Dermatology"},
        {"chunk_id": "C3", "content": "Amoxicillin is a broad-spectrum penicillin antibiotic.", "title": "Infectious Disease"}
    ]
    reranked = cross_encoder_reranker.rerank(query, passages, top_n=2)
    assert len(reranked) == 2
    assert reranked[0]["chunk_id"] == "C1"
    assert reranked[0]["cross_encoder_score"] > reranked[1]["cross_encoder_score"]


def test_claim_level_entailment_and_contradiction():
    evidence_chunks = [
        GuidelineChunk(
            chunk_id="CHUNK_NICE_01",
            doc_id="NICE_NG28",
            title="Diabetes",
            source_organization="NICE",
            section="Renal Thresholds",
            content="Stop metformin immediately if eGFR falls below 30 mL/min due to fatal lactic acidosis.",
            relevance_score=0.9
        )
    ]

    # 1. Supported Claim
    text_supported = "In patients with severe CKD, discontinue metformin immediately. ([Guideline:NICE_NG28#CHUNK_NICE_01])"
    critique_s, claims_s = self_rag_verifier.verify_synthesis(text_supported, evidence_chunks)
    assert any(c.verdict == "SUPPORTED" for c in claims_s)

    # 2. Contradictory Claim
    text_contradictory = "It is safe to continue metformin even if eGFR is very low. ([Guideline:NICE_NG28#CHUNK_NICE_01])"
    critique_c, claims_c = self_rag_verifier.verify_synthesis(text_contradictory, evidence_chunks)
    assert any(c.verdict in ["CONTRADICTORY", "CONTRADICTED"] for c in claims_c)

    # 3. Unresolved Citation
    text_unresolved = "Take medication as directed. ([Guideline:UNKNOWN_DOC#CHUNK_999])"
    critique_u, claims_u = self_rag_verifier.verify_synthesis(text_unresolved, evidence_chunks)
    assert any(c.verdict == "UNSUPPORTED" for c in claims_u)


def test_knowledge_base_document_management():
    docs = knowledge_base_manager.list_documents()
    assert len(docs) >= 4
    sample_doc = docs[0]
    chunks = knowledge_base_manager.get_document_chunks(sample_doc.doc_id)
    assert len(chunks) > 0
    assert chunks[0].content_hash != ""


def test_rag_evaluation_benchmark_metrics():
    report = rag_evaluation_runner.run_benchmark(k=5)
    assert report.total_queries >= 40
    assert report.mean_recall_at_k >= 0.85
    assert report.mean_reciprocal_rank >= 0.80
    assert report.mean_ndcg >= 1.50


@pytest.mark.asyncio
async def test_run_manager_and_hitl_resumption():
    # Create run for high-risk scenario
    run = run_manager.create_run(
        query="Prescribe Ibuprofen 600mg for Arthur Pendleton (P102)",
        patient_id="P102",
        proposed_medications=["Ibuprofen"]
    )
    # Give background execution a moment to pause at HITL interrupt
    for _ in range(120):
        await asyncio.sleep(0.1)
        if run.status == "PAUSED_FOR_REVIEW":
            break

    assert run.status == "PAUSED_FOR_REVIEW"
    assert run.state["hitl_gate"].is_required is True

    # Test rejection / approval resume
    resumed_run = run_manager.submit_review(
        run_id=run.run_id,
        clinician_id="MD_7719",
        approved=False,
        override_rationale="Patient has severe AFib on Warfarin. Disapproved to prevent fatal bleed."
    )
    assert resumed_run is not None
    assert resumed_run.status == "HALTED"
    assert resumed_run.state["hitl_gate"].approved is False


def test_ssrf_protection_in_url_ingest():
    """Verifies that SSRF attack vectors are blocked deterministically."""
    from app.ingestion.manager import validate_url_safe
    with pytest.raises(ValueError, match="forbidden|prohibited|Invalid|Could not resolve"):
        validate_url_safe("http://127.0.0.1:8000/secret")
    with pytest.raises(ValueError, match="forbidden|prohibited|Invalid|Could not resolve"):
        validate_url_safe("http://localhost:3000/api")
    with pytest.raises(ValueError, match="forbidden|prohibited|Invalid|Could not resolve"):
        validate_url_safe("http://169.254.169.254/latest/meta-data")
    with pytest.raises(ValueError, match="forbidden|prohibited|Invalid|Could not resolve"):
        validate_url_safe("http://10.0.0.1/internal")


def test_pdf_upload_validation():
    """Verifies magic bytes and size validation for PDF ingestion."""
    # Invalid magic bytes
    with pytest.raises(ValueError, match="invalid magic bytes"):
        knowledge_base_manager.ingest_pdf(b"NOT_A_PDF_FILE_HEADER", filename="fake.pdf", title="Fake PDF", organization="Test")

    # Exceeds max size (simulated with 26MB threshold)
    large_header = b"%PDF-1.4 " + (b"0" * (26 * 1024 * 1024))
    with pytest.raises(ValueError, match="exceeds maximum limit"):
        knowledge_base_manager.ingest_pdf(large_header, filename="oversized.pdf", title="Oversized", organization="Test")


def test_embedding_engine():
    """Verifies real dense embeddings generation."""
    assert embedding_engine.is_available is True
    emb = embedding_engine.embed_text("Metformin dosage in renal impairment")
    assert isinstance(emb, list)
    assert len(emb) == embedding_engine.dimension
    assert all(isinstance(x, float) for x in emb)

    # Identical text produces identical embedding
    emb2 = embedding_engine.embed_text("Metformin dosage in renal impairment")
    assert emb == emb2


def test_crag_abstention_on_unsupported_interventions():
    """
    CRAG Abstention test:
    Queries referencing non-evidence homeopathic or unverified protocols
    must trigger an explicit abstention/insufficient evidence warning rather than fabricating advice.
    """
    response = execute_triage_flow(
        query="Recommend homeopathy crystal healing and diluted arnica water remedies for acute pain"
    )
    assert response is not None
    # Abstention or grounded insufficient evidence response
    assert response.self_rag_critique.is_supported is False or "INSUFFICIENT" in response.clinical_synthesis or "insufficient" in response.clinical_synthesis.lower()

