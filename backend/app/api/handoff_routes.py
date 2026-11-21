"""
Human Handoff & Clinic Escalation API Endpoints for Synapse Clinical v4.1.
"""
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel

from app.patient.models import HandoffRequest, HandoffStatus, HandoffUrgency
from app.patient.handoff_manager import handoff_manager

router = APIRouter(prefix="/api/v1/handoff", tags=["Human Handoff & Escalations"])


class AssignHandoffRequest(BaseModel):
    assigned_to: str


class UpdateHandoffStatusRequest(BaseModel):
    status: HandoffStatus
    notes: Optional[str] = None


@router.get("/requests")
def list_handoff_requests(
    tenant_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None)
):
    """Lists escalated patient requests with optional filters."""
    requests = handoff_manager.list_requests(tenant_id=tenant_id, status=status, urgency=urgency)
    return {
        "count": len(requests),
        "requests": [r.model_dump() for r in requests]
    }


@router.get("/requests/{request_id}")
def get_handoff_request(request_id: str):
    """Retrieves details of an escalated request."""
    req = handoff_manager.get_request(request_id)
    if not req:
        raise HTTPException(status_code=404, detail=f"Request {request_id} not found")
    return req.model_dump()


@router.post("/requests/{request_id}/assign")
def assign_handoff_request(request_id: str, payload: AssignHandoffRequest):
    """Assigns an escalation ticket to a healthcare professional."""
    try:
        req = handoff_manager.assign_request(request_id, payload.assigned_to)
        return req.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/requests/{request_id}/status")
def update_handoff_status(request_id: str, payload: UpdateHandoffStatusRequest):
    """Updates status of an escalation ticket (IN_REVIEW, RESOLVED, CANCELLED)."""
    try:
        req = handoff_manager.update_status(request_id, payload.status, payload.notes)
        return req.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
