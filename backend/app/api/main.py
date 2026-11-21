"""
FastAPI Application for Synapse Clinical.
Provides REST and genuine SSE streaming endpoints for:
- Clinical Triage Runs & Genuine HITL Resumption
- Knowledge Base Ingestion (PDF, HTML/URL) & Chunk Inspection
- Model Orchestrator Telemetry & Provider Status
- RAG Evaluation & Benchmarking
- Persistent Audit Event Logging
"""
import json
import asyncio
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.core.config import settings
from app.core.models import TriageResponse, ClinicalSeverity
from app.core.providers.registry import provider_registry
from app.core.orchestrator.orchestrator import model_orchestrator
from app.core.orchestrator.models import OrchestratorTask
from app.ehr.database import ehr_db
from app.ehr.fhir import fhir_manager
from app.ingestion.manager import knowledge_base_manager
from app.ingestion.models import IngestedDocument, DocumentChunkRecord
from app.evaluation.benchmark import rag_evaluation_runner, AggregateBenchmarkReport
from app.graph.run_manager import run_manager, TriageRun
from app.graph.workflow import synapse_graph_agent
from app.graph.state import SynapseState

from app.api.patient_routes import router as patient_router
from app.api.handoff_routes import router as handoff_router
from app.api.tenant_routes import router as tenant_router


app = FastAPI(
    title="Synapse Clinical — Multi-Model Agentic Clinical Intelligence & Decision Support Platform",
    version="4.1.0",
    description="Multi-Model Agentic RAG Healthcare Intelligence Platform with Patient Conversational AI & Clinician Copilot."
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patient_router)
app.include_router(handoff_router)
app.include_router(tenant_router)


# Request schemas
class CreateRunRequest(BaseModel):
    query: str = Field(..., json_schema_extra={"example": "Can I prescribe Ibuprofen 600mg for acute knee arthritis in Arthur Pendleton (P102)?"})
    patient_id: Optional[str] = Field(None, json_schema_extra={"example": "P102"})
    proposed_medications: List[str] = Field(default_factory=list, json_schema_extra={"example": ["Ibuprofen"]})
    session_id: Optional[str] = None


class ReviewRequest(BaseModel):
    clinician_id: str = Field(..., json_schema_extra={"example": "DR_8821"})
    approved: bool
    override_rationale: str = Field(..., json_schema_extra={"example": "Co-prescribed high-dose PPI, scheduled 48h coagulation labs, patient counseled on GI risks."})


class URLIngestRequest(BaseModel):
    url: str
    title: str
    organization: str = "Medical Authority"
    access_level: str = "CLINICIAN_ONLY"


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Synapse Clinical Copilot",
        "app_title": "Synapse Clinical",
        "version": "4.0.0",
        "environment": settings.ENVIRONMENT,
        "disclaimer": "RESEARCH & PORTFOLIO DEMO ONLY. Not a medical device. Autonomous prescribing prohibited."
    }


# ==========================================
# 1. CLINICAL RUNS & STREAMING (GENUINE HITL)
# ==========================================

@app.post("/api/triage/runs")
async def create_triage_run(request: CreateRunRequest):
    """Creates an asynchronous Agentic RAG execution run."""
    run = await run_manager.create_run_async(
        query=request.query,
        patient_id=request.patient_id,
        proposed_medications=request.proposed_medications,
        session_id=request.session_id
    )
    return {
        "run_id": run.run_id,
        "session_id": run.session_id,
        "status": run.status,
        "created_at": run.created_at
    }


@app.get("/api/triage/runs")
def list_triage_runs():
    """Lists all active and historical Agentic RAG execution runs."""
    runs = run_manager.list_runs()
    return {"count": len(runs), "runs": runs}


@app.get("/api/triage/runs/{run_id}")
def get_triage_run(run_id: str):
    """Fetches the state and result of a run."""
    run = run_manager.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    
    return {
        "run_id": run.run_id,
        "session_id": run.session_id,
        "status": run.status,
        "created_at": run.created_at,
        "completed_at": run.completed_at,
        "response": run.response_payload.model_dump() if run.response_payload else None
    }


@app.get("/api/triage/runs/{run_id}/events")
async def stream_run_events(run_id: str):
    """
    Genuine Server-Sent Events (SSE) stream for an active run.
    Yields live node execution steps, tool activities, claim-level audits, and HITL interrupts.
    """
    run = run_manager.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    queue = run.subscribe()

    async def event_generator():
        try:
            while True:
                # Wait for next actual LangGraph event
                event = await queue.get()
                yield {
                    "event": event.event_type,
                    "data": json.dumps(event.data)
                }
                # Terminate stream when run completes or fails
                if event.event_type in ["run_completed", "error"]:
                    break
        finally:
            run.unsubscribe(queue)

    return EventSourceResponse(event_generator())


@app.post("/api/triage/runs/{run_id}/review")
def submit_run_review(run_id: str, payload: ReviewRequest):
    """
    Genuine Human-in-the-Loop Resumption Endpoint.
    Records authenticated clinician approval or rejection, logs immutable audit entry,
    and resumes the LangGraph run.
    """
    try:
        run = run_manager.submit_review(
            run_id=run_id,
            clinician_id=payload.clinician_id,
            approved=payload.approved,
            override_rationale=payload.override_rationale
        )
        if not run:
            raise HTTPException(status_code=404, detail=f"Run {run_id} not paused for review")
        return {
            "run_id": run.run_id,
            "status": run.status,
            "decision": "APPROVED_WITH_OVERRIDE" if payload.approved else "HALTED_BY_PHYSICIAN",
            "completed_at": run.completed_at
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Backwards compatible sync run endpoint
@app.post("/api/triage/run", response_model=TriageResponse)
def run_triage_sync(request: CreateRunRequest):
    from app.graph.workflow import execute_triage_flow
    return execute_triage_flow(
        query=request.query,
        patient_id=request.patient_id,
        proposed_medications=request.proposed_medications,
        session_id=request.session_id
    )


@app.post("/api/triage/hitl/override")
def submit_hitl_override_legacy(payload: dict = Body(...)):
    """Backwards-compatible HITL override endpoint."""
    rec = ehr_db.record_audit_event(
        run_id=payload.get("session_id", "sess"),
        session_id=payload.get("session_id", "sess"),
        patient_id=payload.get("patient_id", "UNKNOWN"),
        clinician_id=payload.get("clinician_id", "MD"),
        decision="APPROVED_WITH_OVERRIDE" if payload.get("approved") else "REJECTED_BY_PHYSICIAN",
        override_rationale=payload.get("override_rationale", "")
    )
    return rec


@app.get("/api/guidelines")
def list_guidelines_legacy():
    """Backwards-compatible guidelines list endpoint."""
    docs = knowledge_base_manager.list_documents()
    return {"count": len(docs), "guidelines": [d.model_dump() for d in docs]}


# Backwards compatible stream endpoint
@app.get("/api/triage/stream")
async def stream_triage_legacy(
    query: str = Query(...),
    patient_id: Optional[str] = Query(None),
    proposed_medications: Optional[str] = Query(None)
):
    proposed_list = [m.strip() for m in proposed_medications.split(",") if m.strip()] if proposed_medications else []
    run = run_manager.create_run(
        query=query,
        patient_id=patient_id,
        proposed_medications=proposed_list
    )
    return await stream_run_events(run.run_id)


# ==========================================
# 2. PATIENTS & EHR
# ==========================================

@app.get("/api/patients")
def list_patients():
    conn = ehr_db.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT patient_id, mrn, first_name, last_name, age, gender, primary_diagnosis FROM patients")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"count": len(rows), "patients": rows}


@app.get("/api/patients/{patient_id}")
def get_patient_profile(patient_id: str):
    summary = ehr_db.fetch_patient_summary(patient_id)
    if not summary:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found in EHR database")
    return summary


@app.post("/api/ehr/fhir/import")
def import_fhir_bundle(bundle: dict = Body(...)):
    """Imports a synthetic FHIR R4 Bundle into the EHR relational tables."""
    try:
        return fhir_manager.import_bundle(bundle)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FHIR Import Failed: {str(e)}")


@app.get("/api/ehr/fhir/patient/{patient_id}")
def export_patient_fhir(patient_id: str):
    """Exports patient records as a valid synthetic FHIR R4 collection Bundle."""
    try:
        return fhir_manager.export_patient_to_fhir(patient_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FHIR Export Failed: {str(e)}")


# ==========================================
# 3. KNOWLEDGE BASE & DOCUMENT INGESTION
# ==========================================

@app.get("/api/knowledge/documents")
def list_knowledge_documents():
    docs = knowledge_base_manager.list_documents()
    return {"count": len(docs), "documents": docs}


@app.get("/api/knowledge/documents/{doc_id}")
def get_knowledge_document(doc_id: str):
    chunks = knowledge_base_manager.get_document_chunks(doc_id)
    return {"doc_id": doc_id, "chunk_count": len(chunks), "chunks": chunks}


@app.post("/api/knowledge/upload")
async def upload_pdf_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    organization: str = Form("Medical Authority"),
    publication_date: str = Form("2024"),
    access_level: str = Form("CLINICIAN_ONLY")
):
    """Accepts PDF upload, parses, hierarchical chunks, embeds, and indexes."""
    content = await file.read()
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported for upload.")
    
    doc = knowledge_base_manager.ingest_pdf(
        file_bytes=content,
        filename=file.filename,
        title=title,
        organization=organization,
        publication_date=publication_date,
        access_level=access_level
    )
    return doc


@app.post("/api/knowledge/url")
async def ingest_url_endpoint(payload: URLIngestRequest):
    """Fetches official HTML/URL guideline, extracts content, chunks, and indexes."""
    try:
        doc = await knowledge_base_manager.ingest_url(
            url=payload.url,
            title=payload.title,
            organization=payload.organization,
            access_level=payload.access_level
        )
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to ingest URL: {str(e)}")


@app.delete("/api/knowledge/documents/{doc_id}")
def delete_knowledge_document(doc_id: str):
    success = knowledge_base_manager.delete_document(doc_id)
    return {"doc_id": doc_id, "deleted": success}


# ==========================================
# 4. MODEL ORCHESTRATOR & EVALUATION
# ==========================================

@app.get("/api/orchestrator/status")
def get_orchestrator_status():
    """Returns available LLM providers, model routing configurations, and circuit breaker status."""
    providers = provider_registry.list_available_providers()
    routing_policies = {}
    for task in OrchestratorTask:
        if task not in [OrchestratorTask.DETERMINISTIC_CALCULATION, OrchestratorTask.DRUG_SAFETY_CHECK]:
            candidates = model_orchestrator.get_task_routing_plan(task)
            primary = candidates[0] if candidates else {"model": "default", "provider": "default"}
            fallbacks = [c["model"] for c in candidates[1:]] if len(candidates) > 1 else []
            routing_policies[task.value] = {
                "task": task.value,
                "primary_model": primary.get("model", "default"),
                "primary_provider": primary.get("provider", "default"),
                "fallback_chain": fallbacks,
                "max_cost_limit_usd": 0.05,
                "timeout_seconds": 15
            }
            
    return {
        "providers": providers,
        "routing_policies": routing_policies,
        "recent_decisions": model_orchestrator.execution_decisions[-15:]
    }


@app.get("/api/evaluation/benchmark")
def run_rag_benchmark():
    """Runs reproducible clinical RAG evaluation suite calculating Recall@K, MRR, nDCG, and Groundedness."""
    report = rag_evaluation_runner.run_benchmark(k=5)
    return report


@app.get("/api/audit/events")
def list_audit_events(patient_id: Optional[str] = Query(None)):
    """Fetches persistent regulatory audit events for clinician sign-offs."""
    events = ehr_db.list_audit_events(patient_id)
    harmonized = []
    for idx, e in enumerate(events):
        harmonized.append({
            "event_id": idx + 1,
            "audit_id": e.get("audit_id"),
            "timestamp": e.get("recorded_at") or e.get("timestamp", ""),
            "recorded_at": e.get("recorded_at") or e.get("timestamp", ""),
            "run_id": e.get("run_id"),
            "session_id": e.get("session_id"),
            "patient_id": e.get("patient_id"),
            "clinician_id": e.get("clinician_id"),
            "decision": e.get("decision"),
            "override_rationale": e.get("override_rationale")
        })
    return {"count": len(harmonized), "audit_events": harmonized}
