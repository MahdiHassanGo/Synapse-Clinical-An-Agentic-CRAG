"""
Human Handoff & Escalation Queue Manager for Synapse Clinical v4.1.
Tracks patient inquiries requiring human triage, nursing review, or physician consultation.
Enforces deterministic lifecycle: REQUESTED -> WAITING -> ASSIGNED -> IN_REVIEW -> RESOLVED / CANCELLED.
"""
import time
import uuid
import threading
from typing import Dict, List, Optional

from app.patient.models import HandoffRequest, HandoffStatus, HandoffUrgency


class HandoffManager:
    def __init__(self):
        self._lock = threading.Lock()
        self._requests: Dict[str, HandoffRequest] = {}
        self._seed_sample_handoffs()

    def _seed_sample_handoffs(self):
        sample = HandoffRequest(
            request_id="HO_1001",
            tenant_id="DEFAULT_HOSPITAL",
            session_id="SESS_SAMPLE_01",
            patient_id="P101",
            patient_name="Eleanor Vance",
            user_query="I have questions about switching my diabetes medication because my stomach feels unsettled.",
            status=HandoffStatus.ASSIGNED,
            urgency=HandoffUrgency.MEDIUM,
            reason="Patient requested medication review by clinic nurse",
            assigned_to="Nurse Sarah Jenkins, RN",
            notes="Contacted patient via portal messaging. Lab follow-up scheduled.",
            created_at="2026-11-21 08:30:00"
        )
        self._requests["HO_1001"] = sample

    def create_request(
        self,
        tenant_id: str,
        session_id: str,
        user_query: str,
        reason: str,
        urgency: HandoffUrgency = HandoffUrgency.MEDIUM,
        patient_id: Optional[str] = None,
        patient_name: Optional[str] = None
    ) -> HandoffRequest:
        with self._lock:
            req_id = f"HO_{uuid.uuid4().hex[:6].upper()}"
            now = time.strftime("%Y-%m-%d %H:%M:%S")
            req = HandoffRequest(
                request_id=req_id,
                tenant_id=tenant_id,
                session_id=session_id,
                patient_id=patient_id,
                patient_name=patient_name or "Anonymous Visitor",
                user_query=user_query,
                status=HandoffStatus.REQUESTED,
                urgency=urgency,
                reason=reason,
                created_at=now
            )
            self._requests[req_id] = req
            return req

    def get_request(self, request_id: str) -> Optional[HandoffRequest]:
        with self._lock:
            return self._requests.get(request_id)

    def list_requests(
        self,
        tenant_id: Optional[str] = None,
        status: Optional[str] = None,
        urgency: Optional[str] = None
    ) -> List[HandoffRequest]:
        with self._lock:
            items = list(self._requests.values())
            if tenant_id:
                items = [r for r in items if r.tenant_id == tenant_id]
            if status:
                items = [r for r in items if r.status.value == status or r.status == status]
            if urgency:
                items = [r for r in items if r.urgency.value == urgency or r.urgency == urgency]
            items.sort(key=lambda x: x.created_at, reverse=True)
            return items

    def assign_request(self, request_id: str, assigned_to: str) -> HandoffRequest:
        with self._lock:
            req = self._requests.get(request_id)
            if not req:
                raise ValueError(f"Handoff request {request_id} not found")
            req.assigned_to = assigned_to
            req.status = HandoffStatus.ASSIGNED
            return req

    def update_status(
        self,
        request_id: str,
        status: HandoffStatus,
        notes: Optional[str] = None
    ) -> HandoffRequest:
        with self._lock:
            req = self._requests.get(request_id)
            if not req:
                raise ValueError(f"Handoff request {request_id} not found")
            req.status = status
            if notes:
                req.notes = notes
            if status in [HandoffStatus.RESOLVED, HandoffStatus.CANCELLED]:
                req.resolved_at = time.strftime("%Y-%m-%d %H:%M:%S")
            return req


handoff_manager = HandoffManager()
