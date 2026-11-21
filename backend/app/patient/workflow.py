"""
LangGraph Workflow Engine for Synapse Patient AI v4.0.
Coordinates the patient-facing conversational state machine:
Language Detection -> Emergency Screening -> Intent Classification -> Policy Enforcement ->
Patient Retrieval (access_level='PATIENT_APPROVED') -> Bilingual Response Generation -> Statutory Disclaimer.
"""
import time
from typing import Dict, Any, Optional
from langgraph.graph import StateGraph, END

from app.patient.nodes import (
    PatientAgentState,
    language_detector_node,
    safety_screening_node,
    intent_classifier_node,
    patient_policy_guard_node,
    patient_knowledge_retriever_node,
    specialist_matching_node,
    emergency_node,
    patient_response_generator_node,
    disclaimer_attachment_node
)
from app.patient.session_manager import patient_session_manager


def decide_emergency_flow(state: PatientAgentState) -> str:
    """Conditional Edge: routes directly to emergency instructions if acute red flags detected."""
    if state.get("is_emergency"):
        return "emergency_router"
    return "intent_classifier"


def decide_policy_flow(state: PatientAgentState) -> str:
    """Conditional Edge: skips retrieval if policy guard already handled response (e.g. handoff queued or login needed)."""
    if state.get("response_text"):
        return "disclaimer_attachment"
    return "patient_retriever"


def build_patient_graph():
    """Assembles and compiles the Patient AI StateGraph."""
    workflow = StateGraph(PatientAgentState)

    workflow.add_node("language_detector", language_detector_node)
    workflow.add_node("safety_screening", safety_screening_node)
    workflow.add_node("emergency_router", emergency_node)
    workflow.add_node("intent_classifier", intent_classifier_node)
    workflow.add_node("patient_policy_guard", patient_policy_guard_node)
    workflow.add_node("patient_retriever", patient_knowledge_retriever_node)
    workflow.add_node("specialist_matcher", specialist_matching_node)
    workflow.add_node("patient_response_generator", patient_response_generator_node)
    workflow.add_node("disclaimer_attachment", disclaimer_attachment_node)

    # Define execution graph edges
    workflow.set_entry_point("language_detector")
    workflow.add_edge("language_detector", "safety_screening")

    workflow.add_conditional_edges(
        "safety_screening",
        decide_emergency_flow,
        {
            "emergency_router": "emergency_router",
            "intent_classifier": "intent_classifier"
        }
    )

    workflow.add_edge("emergency_router", "disclaimer_attachment")

    workflow.add_edge("intent_classifier", "patient_policy_guard")

    workflow.add_conditional_edges(
        "patient_policy_guard",
        decide_policy_flow,
        {
            "disclaimer_attachment": "disclaimer_attachment",
            "patient_retriever": "patient_retriever"
        }
    )

    workflow.add_edge("patient_retriever", "specialist_matcher")
    workflow.add_edge("specialist_matcher", "patient_response_generator")
    workflow.add_edge("patient_response_generator", "disclaimer_attachment")
    workflow.add_edge("disclaimer_attachment", END)

    return workflow.compile()


patient_graph_app = build_patient_graph()


def execute_patient_turn(
    session_id: str,
    user_query: str,
    tenant_id: str = "DEFAULT_HOSPITAL",
    language: Optional[str] = None,
    is_authenticated: bool = False,
    consent_given: bool = True,
    patient_id: Optional[str] = None
) -> Dict[str, Any]:
    """Synchronous execution of the patient conversational graph turn."""
    start_time = time.time()

    initial_state: PatientAgentState = {
        "session_id": session_id,
        "tenant_id": tenant_id,
        "user_query": user_query,
        "language": language or "en",
        "intent": "GENERAL_EDUCATION",
        "is_emergency": False,
        "is_authenticated": is_authenticated,
        "consent_given": consent_given,
        "patient_id": patient_id,
        "handoff_requested": False,
        "retrieved_chunks": [],
        "recommended_specialists": [],
        "agentic_trace": {},
        "response_text": "",
        "disclaimer": "",
        "execution_steps": [],
        "latency_ms": 0.0
    }

    final_state = patient_graph_app.invoke(initial_state)

    elapsed_ms = round((time.time() - start_time) * 1000, 1)
    final_state["latency_ms"] = elapsed_ms
    patient_session_manager.record_latency(elapsed_ms)

    # Persist assistant response into session
    patient_session_manager.add_message(
        session_id=session_id,
        role="assistant",
        content=final_state["response_text"],
        language=final_state["language"],
        intent=final_state["intent"],
        is_emergency=final_state["is_emergency"],
        disclaimer_appended=bool(final_state.get("disclaimer")),
        recommended_specialists=final_state.get("recommended_specialists"),
        agentic_trace=final_state.get("agentic_trace")
    )

    return final_state
