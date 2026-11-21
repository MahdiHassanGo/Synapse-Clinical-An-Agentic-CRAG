"""
Core Domain Models for Synapse Clinical.
Enforces strict type safety and eliminates ambiguous clinical data states.
"""
from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from app.core.orchestrator.models import ModelRoutingDecision


class ClaimVerificationResult(BaseModel):
    claim_id: str
    claim_text: str
    citation_ref: Optional[str] = None
    citation_ids: List[str] = Field(default_factory=list)
    verdict: str = "SUPPORTED"  # SUPPORTED, PARTIALLY_SUPPORTED, UNSUPPORTED, CONTRADICTED, INSUFFICIENT_EVIDENCE
    verification_status: str = "SUPPORTED"
    contradiction_status: bool = False
    entailment_explanation: str = ""
    explanation: Optional[str] = None
    matched_chunk_id: Optional[str] = None
    evidence_quote: Optional[str] = None
    evidence_text: Optional[str] = None


class ClinicalSeverity(str, Enum):
    INFO = "INFO"
    MINOR = "MINOR"
    MODERATE = "MODERATE"
    MAJOR = "MAJOR"
    CONTRAINDICATED = "CONTRAINDICATED"
    FATAL = "FATAL"


class TriageUrgency(str, Enum):
    ROUTINE = "ROUTINE"
    URGENT = "URGENT"
    EMERGENCY = "EMERGENCY"


class QueryRoute(str, Enum):
    EHR_QUERY = "EHR_QUERY"
    LITERATURE_GUIDELINE = "LITERATURE_GUIDELINE"
    CONTRAINDICATION_CHECK = "CONTRAINDICATION_CHECK"
    CLINICAL_CALCULATION = "CLINICAL_CALCULATION"
    COMBINED_TRIAGE = "COMBINED_TRIAGE"


class PatientProfile(BaseModel):
    patient_id: str
    mrn: str
    first_name: str
    last_name: str
    age: int
    gender: str
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    serum_creatinine_mg_dl: Optional[float] = None
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    heart_rate: Optional[int] = None
    known_allergies: List[str] = Field(default_factory=list)
    active_conditions: List[str] = Field(default_factory=list)
    active_medications: List[str] = Field(default_factory=list)


class GuidelineChunk(BaseModel):
    chunk_id: str
    doc_id: str
    title: str
    source_organization: str  # WHO, NICE, BMDC, KDIGO, ACC/AHA
    section: str
    content: str
    parent_chunk_id: Optional[str] = None
    relevance_score: float = 0.0
    cross_encoder_score: Optional[float] = None
    is_relevant: bool = True
    critique_reason: Optional[str] = None


class DrugInteractionAlert(BaseModel):
    drug_a: str
    drug_b: Optional[str] = None
    condition: Optional[str] = None
    allergen: Optional[str] = None
    severity: ClinicalSeverity
    mechanism: str
    clinical_recommendation: str
    action_required: str


class ClinicalCalculationResult(BaseModel):
    calculator_name: str
    computed_value: float
    unit: str
    clinical_interpretation: str
    inputs_used: Dict[str, Any]


class HITLInterrupt(BaseModel):
    is_required: bool = False
    requires_approval_for: Optional[str] = None
    risk_level: ClinicalSeverity = ClinicalSeverity.INFO
    reason: Optional[str] = None
    contraindications_detected: List[DrugInteractionAlert] = Field(default_factory=list)
    approved: Optional[bool] = None
    approved_by_clinician_id: Optional[str] = None
    override_rationale: Optional[str] = None
    timestamp: Optional[str] = None


class SelfRAGCritique(BaseModel):
    is_supported: bool = Field(description="Are all assertions grounded in retrieved clinical docs?")
    support_score: float = Field(ge=0.0, le=1.0)
    is_useful: bool = Field(description="Is the synthesis clinically actionable and safe?")
    utility_score: float = Field(ge=0.0, le=1.0)
    cited_chunk_ids: List[str] = Field(default_factory=list)
    hallucination_warnings: List[str] = Field(default_factory=list)


class AgentExecutionStep(BaseModel):
    step_name: str
    description: str
    status: str  # PENDING, IN_PROGRESS, COMPLETED, FAILED
    latency_ms: float = 0.0
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TriageResponse(BaseModel):
    run_id: str = "run-default"
    session_id: str
    patient_id: Optional[str] = None
    patient_summary: Optional[Dict[str, Any]] = None
    missing_patient_data: List[str] = Field(default_factory=list)
    query: str
    routes_executed: List[QueryRoute]
    retrieved_guidelines: List[GuidelineChunk] = Field(default_factory=list)
    crag_iterations: int = 0
    rewritten_queries: List[str] = Field(default_factory=list)
    calculations: List[ClinicalCalculationResult] = Field(default_factory=list)
    interaction_alerts: List[DrugInteractionAlert] = Field(default_factory=list)
    clinical_synthesis: str
    self_rag_critique: SelfRAGCritique
    claim_verifications: List[ClaimVerificationResult] = Field(default_factory=list)
    model_routing_decisions: List[ModelRoutingDecision] = Field(default_factory=list)
    hitl_gate: HITLInterrupt
    execution_trace: List[AgentExecutionStep] = Field(default_factory=list)
    total_latency_ms: float = 0.0
    status: str = "COMPLETED"
