"""
Domain models for Model Orchestrator.
Defines task routing types, telemetry decisions, and execution metadata.
"""
from enum import Enum
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

from app.core.providers.base import LLMTokenUsage


class OrchestratorTask(str, Enum):
    INTENT_ROUTING = "INTENT_ROUTING"
    QUERY_REWRITING = "QUERY_REWRITING"
    CLINICAL_SYNTHESIS = "CLINICAL_SYNTHESIS"
    EVIDENCE_VERIFICATION = "EVIDENCE_VERIFICATION"
    EMBEDDING = "EMBEDDING"
    DETERMINISTIC_CALCULATION = "DETERMINISTIC_CALCULATION"
    DRUG_SAFETY_CHECK = "DRUG_SAFETY_CHECK"


class ModelRoutingDecision(BaseModel):
    task: OrchestratorTask
    selected_provider: str
    selected_model: str
    selection_reason: str
    latency_ms: float = 0.0
    token_usage: LLMTokenUsage = Field(default_factory=LLMTokenUsage)
    estimated_cost_usd: float = 0.0
    fallback_applied: bool = False
    is_mock: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)
