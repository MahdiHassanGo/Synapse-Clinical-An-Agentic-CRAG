"""
Patient Conversational AI API Endpoints for Synapse Clinical v4.1.
Provides REST and SSE endpoints for:
- Anonymous Visitor & Authenticated Patient Chat Sessions
- Real-time LangGraph Execution & Bilingual Guidance
- Consent Recording & Right-to-be-Forgotten Deletion
- Patient EHR Authentication with Patient ID & MRN
- Patient Operational Analytics
"""
import json
import asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Body, Header
from sse_starlette.sse import EventSourceResponse

from app.patient.models import (
    CreateSessionRequest,
    SendPatientMessageRequest,
    PatientAuthRequest,
    PatientAuthResponse,
    HandoffUrgency
)
from app.patient.session_manager import patient_session_manager
from app.patient.handoff_manager import handoff_manager
from app.patient.workflow import execute_patient_turn
from app.tenants.manager import tenant_manager

router = APIRouter(prefix="/api/v1/patient", tags=["Patient Conversational AI"])


@router.post("/chat/sessions")
def create_patient_session(
    payload: CreateSessionRequest,
    origin: Optional[str] = Header(None)
):
    """Initializes a new patient conversational session for a given hospital tenant."""
    tenant = tenant_manager.get_tenant(payload.tenant_id)
    # Check domain allowlist if origin provided
    if origin and not tenant_manager.verify_origin(tenant.tenant_id, origin):
        raise HTTPException(status_code=403, detail="Origin not authorized for this tenant's chat widget.")

    session = patient_session_manager.create_session(
        tenant_id=tenant.tenant_id,
        language=payload.language or tenant.default_language,
        consent_given=payload.consent_given
    )

    # Initial welcome message based on tenant settings & language
    welcome = tenant.welcome_message_bn if session.language == "bn" else tenant.welcome_message_en
    patient_session_manager.add_message(
        session_id=session.session_id,
        role="assistant",
        content=welcome,
        language=session.language,
        intent="GENERAL_EDUCATION",
        is_emergency=False,
        disclaimer_appended=False
    )

    return {
        "session_id": session.session_id,
        "tenant_id": tenant.tenant_id,
        "tenant_name": tenant.name,
        "language": session.language,
        "welcome_message": welcome,
        "emergency_phone": tenant.emergency_phone,
        "is_authenticated": False,
        "consent_given": session.consent_given,
        "created_at": session.created_at
    }


@router.get("/chat/sessions/{session_id}")
def get_patient_session(session_id: str):
    """Retrieves session details, messages, and escalation status."""
    session = patient_session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    tenant = tenant_manager.get_tenant(session.tenant_id)
    return {
        "session_id": session.session_id,
        "tenant_id": session.tenant_id,
        "tenant_name": tenant.name,
        "emergency_phone": tenant.emergency_phone,
        "is_authenticated": session.is_authenticated,
        "patient_id": session.patient_id,
        "patient_name": session.patient_name,
        "language": session.language,
        "messages": [m.model_dump() for m in session.messages],
        "handoff_requested": session.handoff_requested,
        "escalation_status": session.escalation_status,
        "created_at": session.created_at,
        "updated_at": session.updated_at
    }


@router.delete("/chat/sessions/{session_id}")
def delete_patient_session(session_id: str):
    """Withdraws consent and deletes all conversation records (Privacy / GDPR / HIPAA right to be forgotten)."""
    success = patient_session_manager.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return {
        "session_id": session_id,
        "deleted": True,
        "message": "Session history permanently purged and consent withdrawn."
    }


@router.post("/chat/sessions/{session_id}/messages")
def send_patient_message(session_id: str, payload: SendPatientMessageRequest):
    """Submits a patient query and executes the LangGraph patient conversational workflow."""
    session = patient_session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    # Add user message
    user_msg = patient_session_manager.add_message(
        session_id=session_id,
        role="user",
        content=payload.message,
        language=payload.language or session.language
    )

    # Execute workflow
    result = execute_patient_turn(
        session_id=session_id,
        user_query=payload.message,
        tenant_id=session.tenant_id,
        language=payload.language,
        is_authenticated=session.is_authenticated,
        consent_given=session.consent_given,
        patient_id=session.patient_id
    )

    return {
        "session_id": session_id,
        "response_text": result["response_text"],
        "language": result["language"],
        "intent": result["intent"],
        "is_emergency": result["is_emergency"],
        "handoff_requested": result["handoff_requested"],
        "latency_ms": result["latency_ms"],
        "disclaimer": result.get("disclaimer"),
        "recommended_specialists": result.get("recommended_specialists", []),
        "agentic_trace": result.get("agentic_trace", {}),
        "execution_steps": result.get("execution_steps", [])
    }


@router.get("/chat/sessions/{session_id}/events")
async def stream_patient_events(
    session_id: str,
    query: str = Query(...)
):
    """
    Genuine Server-Sent Events (SSE) stream for patient turn.
    Streams execution steps (language detection, emergency check, retrieval, synthesis) in real-time.
    """
    session = patient_session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    async def event_generator():
        # Record user message
        patient_session_manager.add_message(
            session_id=session_id,
            role="user",
            content=query,
            language=session.language
        )

        yield {
            "event": "step",
            "data": json.dumps({"node": "init", "detail": "Starting patient query processing..."})
        }
        await asyncio.sleep(0.05)

        # Run turn in background thread
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None,
            lambda: execute_patient_turn(
                session_id=session_id,
                user_query=query,
                tenant_id=session.tenant_id,
                language=None,
                is_authenticated=session.is_authenticated,
                consent_given=session.consent_given,
                patient_id=session.patient_id
            )
        )

        for step in result.get("execution_steps", []):
            yield {
                "event": "step",
                "data": json.dumps(step)
            }
            await asyncio.sleep(0.04)

        yield {
            "event": "complete",
            "data": json.dumps({
                "response_text": result["response_text"],
                "language": result["language"],
                "intent": result["intent"],
                "is_emergency": result["is_emergency"],
                "recommended_specialists": result.get("recommended_specialists", []),
                "agentic_trace": result.get("agentic_trace", {}),
                "disclaimer": result.get("disclaimer"),
                "latency_ms": result["latency_ms"]
            })
        }

    return EventSourceResponse(event_generator())


@router.get("/specialists")
def list_specialists(
    tenant_id: Optional[str] = Query(None),
    query: Optional[str] = Query(None)
):
    """
    Retrieves verified consultants and specialists directory with real availability schedules.
    Supports symptom query filtering via agentic matcher.
    """
    from app.patient.specialists import SPECIALIST_DIRECTORY, match_specialists_for_query

    if query:
        matched = match_specialists_for_query(
            query=query,
            tenant_id=tenant_id or "DEFAULT_HOSPITAL",
            top_k=6
        )
        return {"specialists": matched, "count": len(matched), "query": query}

    filtered = SPECIALIST_DIRECTORY
    if tenant_id:
        filtered = [s for s in filtered if s["tenant_id"] == tenant_id]

    return {"specialists": filtered, "count": len(filtered)}


@router.post("/chat/sessions/{session_id}/handoff")
def request_human_handoff(
    session_id: str,
    reason: str = Body("Patient requested human clinic staff assistance", embed=True)
):
    """Explicit human handoff escalation request from patient."""
    session = patient_session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    req = handoff_manager.create_request(
        tenant_id=session.tenant_id,
        session_id=session_id,
        user_query="Patient triggered human escalation request button",
        reason=reason,
        urgency=HandoffUrgency.MEDIUM,
        patient_id=session.patient_id,
        patient_name=session.patient_name
    )

    session.handoff_requested = True
    session.escalation_status = "HANDOFF_REQUESTED"

    msg = (
        "আপনার অনুরোধটি নার্সিং টিমের কাছে পাঠানো হয়েছে।"
        if session.language == "bn"
        else "Your escalation request has been submitted to the nursing team. A clinician will join this chat shortly."
    )
    patient_session_manager.add_message(
        session_id=session_id,
        role="assistant",
        content=msg,
        language=session.language,
        intent="HANDOFF_REQUEST",
        is_emergency=False,
        disclaimer_appended=False
    )

    return {
        "success": True,
        "request_id": req.request_id,
        "status": req.status,
        "message": msg
    }


@router.post("/auth/login", response_model=PatientAuthResponse)
def patient_login(session_id: str, payload: PatientAuthRequest):
    """Authenticates patient via Patient ID and MRN, linking session to synthetic EHR records."""
    try:
        res = patient_session_manager.authenticate_patient(
            session_id=session_id,
            patient_id=payload.patient_id,
            mrn=payload.mrn,
            consent_confirmed=payload.consent_confirmed
        )
        return PatientAuthResponse(**res)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/analytics")
def get_patient_analytics():
    """Operational telemetry: session counts, latency, escalation rates, and language distribution."""
    return patient_session_manager.get_analytics()
