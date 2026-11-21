"""
Patient Conversational AI Data Models for Synapse Clinical v4.1.
"""
from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class HandoffStatus(str, Enum):
    REQUESTED = "REQUESTED"
    WAITING = "WAITING"
    ASSIGNED = "ASSIGNED"
    IN_REVIEW = "IN_REVIEW"
    RESOLVED = "RESOLVED"
    CANCELLED = "CANCELLED"


class HandoffUrgency(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class PatientMessage(BaseModel):
    id: str
    role: str  # "user", "assistant", "system"
    content: str
    timestamp: str
    language: str = "en"  # "en" or "bn"
    intent: Optional[str] = None
    is_emergency: bool = False
    disclaimer_appended: bool = True
    recommended_specialists: Optional[List[Dict[str, Any]]] = None
    agentic_trace: Optional[Dict[str, Any]] = None


class PatientSession(BaseModel):
    session_id: str
    tenant_id: str = "DEFAULT_HOSPITAL"
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    is_authenticated: bool = False
    consent_given: bool = True
    language: str = "en"
    messages: List[PatientMessage] = Field(default_factory=list)
    created_at: str
    updated_at: str
    handoff_requested: bool = False
    escalation_status: Optional[str] = None


class HandoffRequest(BaseModel):
    request_id: str
    tenant_id: str
    session_id: str
    patient_id: Optional[str] = None
    patient_name: Optional[str] = "Anonymous Visitor"
    user_query: str
    status: HandoffStatus = HandoffStatus.REQUESTED
    urgency: HandoffUrgency = HandoffUrgency.MEDIUM
    reason: str
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    resolved_at: Optional[str] = None


class CreateSessionRequest(BaseModel):
    tenant_id: Optional[str] = "DEFAULT_HOSPITAL"
    language: Optional[str] = "en"
    consent_given: bool = True


class SendPatientMessageRequest(BaseModel):
    message: str
    language: Optional[str] = None  # None for auto-detect


class PatientAuthRequest(BaseModel):
    patient_id: str
    mrn: str
    consent_confirmed: bool = True


class PatientAuthResponse(BaseModel):
    success: bool
    session_id: str
    patient_id: str
    patient_name: str
    primary_diagnosis: Optional[str] = None
    consent_recorded: bool = True
