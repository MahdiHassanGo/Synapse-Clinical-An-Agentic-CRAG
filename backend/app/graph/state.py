"""
Upgraded LangGraph State Schema for Synapse Clinical.
Maintains state across separated nodes, multi-model orchestrator decisions,
claim-level Self-RAG verifications, and persistent HITL interrupts.
"""
from typing import List, Dict, Any, Optional
from typing_extensions import TypedDict

from app.core.models import (
    QueryRoute, GuidelineChunk, ClinicalCalculationResult,
    DrugInteractionAlert, SelfRAGCritique, HITLInterrupt,
    AgentExecutionStep
)
from app.core.orchestrator.models import ModelRoutingDecision
from app.evaluation.verifier import ClaimVerificationResult


class SynapseState(TypedDict):
    run_id: str
    session_id: str
    query: str
    patient_id: Optional[str]
    proposed_medications: List[str]
    
    # Intent Routing & Query Planning
    routes: List[QueryRoute]
    query_plan: Dict[str, Any]
    
    # EHR Context & Missing Data Handling (No fake default values)
    patient_summary: Optional[Dict[str, Any]]
    missing_patient_data: List[str]
    patient_error: Optional[str]
    
    # Clinical Calculations (Deterministic)
    calculations: List[ClinicalCalculationResult]
    
    # Pharmacovigilance (Deterministic rules)
    interaction_alerts: List[DrugInteractionAlert]
    
    # Hybrid Retrieval & Reranker
    retrieved_docs: List[GuidelineChunk]
    reranked_docs: List[GuidelineChunk]
    
    # CRAG Evaluation & Query Rewriting
    graded_docs: List[GuidelineChunk]
    is_context_sufficient: bool
    contradiction_warnings: List[str]
    iteration_count: int
    rewritten_queries: List[str]
    
    # Multi-Model Orchestration & Clinical Synthesis
    clinical_synthesis: str
    model_routing_decisions: List[ModelRoutingDecision]
    
    # Claim-Level Evidence Verification
    self_rag_critique: Optional[SelfRAGCritique]
    claim_verifications: List[ClaimVerificationResult]
    
    # Human-in-the-Loop Safety Gate & Audit Persistence
    hitl_gate: HITLInterrupt
    audit_events: List[Dict[str, Any]]
    
    # Observability & Latency
    execution_trace: List[AgentExecutionStep]
    total_latency_ms: float
    status: str


# Backwards compatibility alias
MedPulseState = SynapseState

