"""
Upgraded LangGraph Workflow Definition for Synapse Clinical.
Assembles the 14 separated nodes with parallel tool fan-out,
conditional CRAG loops, and persistent checkpointing.
"""
from typing import Dict, Any, List, Optional
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from app.core.models import TriageResponse

from app.graph.state import SynapseState
from app.graph.nodes import (
    intent_router_node, query_planner_node, patient_context_node,
    clinical_calculators_node, pharmacovigilance_node,
    hybrid_retriever_node, cross_encoder_reranker_node,
    crag_evaluator_node, query_rewriter_node,
    clinical_synthesis_node, claim_level_verifier_node,
    safety_policy_node, hitl_interrupt_node, final_response_node,
    insufficient_evidence_node
)
from app.core.config import settings


def decide_crag_flow(state: SynapseState) -> str:
    """
    Conditional Edge: evaluates if retrieved evidence is sufficient.
    IF sufficient: continue to clinical synthesis.
    IF insufficient and retries remain: rewrite query and retrieve again.
    IF insufficient after max retries: abstain to prevent clinical hallucination.
    """
    is_sufficient = state.get("is_context_sufficient", False)
    iter_count = state.get("iteration_count", 0)

    if is_sufficient:
        return "clinical_synthesis"
    if iter_count < settings.MAX_RETRY_COUNT:
        return "query_rewriter"
    return "insufficient_evidence"


def decide_hitl_flow(state: SynapseState) -> str:
    """Conditional Edge: halts graph if high-risk action requires human approval."""
    hitl = state.get("hitl_gate")
    if hitl and hitl.is_required and hitl.approved is None:
        return "hitl_interrupt"
    return "final_response"


def build_synapse_graph():
    """Assembles and compiles the full StateGraph."""
    workflow = StateGraph(SynapseState)

    # 14 Separated Nodes
    workflow.add_node("intent_router", intent_router_node)
    workflow.add_node("query_planner", query_planner_node)
    workflow.add_node("patient_context", patient_context_node)
    workflow.add_node("clinical_calculators", clinical_calculators_node)
    workflow.add_node("pharmacovigilance", pharmacovigilance_node)
    workflow.add_node("hybrid_retriever", hybrid_retriever_node)
    workflow.add_node("cross_encoder_reranker", cross_encoder_reranker_node)
    workflow.add_node("crag_evaluator", crag_evaluator_node)
    workflow.add_node("query_rewriter", query_rewriter_node)
    workflow.add_node("clinical_synthesis", clinical_synthesis_node)
    workflow.add_node("claim_level_verifier", claim_level_verifier_node)
    workflow.add_node("safety_policy", safety_policy_node)
    workflow.add_node("hitl_interrupt", hitl_interrupt_node)
    workflow.add_node("final_response", final_response_node)
    workflow.add_node("insufficient_evidence", insufficient_evidence_node)

    # Entry and Sequencing
    workflow.set_entry_point("intent_router")
    workflow.add_edge("intent_router", "query_planner")
    workflow.add_edge("query_planner", "patient_context")
    workflow.add_edge("patient_context", "clinical_calculators")
    workflow.add_edge("clinical_calculators", "pharmacovigilance")
    workflow.add_edge("pharmacovigilance", "hybrid_retriever")
    workflow.add_edge("hybrid_retriever", "cross_encoder_reranker")
    workflow.add_edge("cross_encoder_reranker", "crag_evaluator")

    # Conditional CRAG loop
    workflow.add_conditional_edges(
        "crag_evaluator",
        decide_crag_flow,
        {
            "clinical_synthesis": "clinical_synthesis",
            "query_rewriter": "query_rewriter",
            "insufficient_evidence": "insufficient_evidence"
        }
    )
    workflow.add_edge("query_rewriter", "hybrid_retriever")
    workflow.add_edge("insufficient_evidence", "safety_policy")

    # Post-synthesis verification
    workflow.add_edge("clinical_synthesis", "claim_level_verifier")
    workflow.add_edge("claim_level_verifier", "safety_policy")

    # Conditional HITL Interrupt
    workflow.add_conditional_edges(
        "safety_policy",
        decide_hitl_flow,
        {
            "hitl_interrupt": "hitl_interrupt",
            "final_response": "final_response"
        }
    )
    workflow.add_edge("hitl_interrupt", END)
    workflow.add_edge("final_response", END)

    checkpointer = MemorySaver()
    return workflow.compile(checkpointer=checkpointer)


synapse_graph_agent = build_synapse_graph()


async def execute_triage_flow_async(
    query: str,
    patient_id: Optional[str] = None,
    proposed_medications: Optional[list] = None,
    session_id: Optional[str] = None
) -> TriageResponse:
    import uuid
    import time
    from app.core.models import TriageResponse

    sess_id = session_id or str(uuid.uuid4())
    start_wall = time.time()

    initial_state: SynapseState = {
        "run_id": f"RUN_{sess_id[:8]}",
        "session_id": sess_id,
        "query": query,
        "patient_id": patient_id,
        "proposed_medications": proposed_medications or [],
        "routes": [],
        "query_plan": {},
        "patient_summary": None,
        "missing_patient_data": [],
        "patient_error": None,
        "calculations": [],
        "interaction_alerts": [],
        "retrieved_docs": [],
        "reranked_docs": [],
        "graded_docs": [],
        "is_context_sufficient": False,
        "contradiction_warnings": [],
        "iteration_count": 0,
        "rewritten_queries": [],
        "clinical_synthesis": "",
        "model_routing_decisions": [],
        "self_rag_critique": None,
        "claim_verifications": [],
        "hitl_gate": None,  # type: ignore
        "audit_events": [],
        "execution_trace": [],
        "total_latency_ms": 0.0,
        "status": "RUNNING"
    }

    config = {"configurable": {"thread_id": sess_id}}
    final_state = await synapse_graph_agent.ainvoke(initial_state, config)
    total_lat = round((time.time() - start_wall) * 1000.0, 2)

    return TriageResponse(
        run_id=initial_state["run_id"],
        session_id=sess_id,
        patient_id=final_state.get("patient_id"),
        patient_summary=final_state.get("patient_summary"),
        missing_patient_data=final_state.get("missing_patient_data", []),
        query=query,
        routes_executed=final_state.get("routes", []),
        retrieved_guidelines=final_state.get("graded_docs") or final_state.get("reranked_docs") or final_state.get("retrieved_docs", []),
        crag_iterations=final_state.get("iteration_count", 0),
        rewritten_queries=final_state.get("rewritten_queries", []),
        calculations=final_state.get("calculations", []),
        interaction_alerts=final_state.get("interaction_alerts", []),
        clinical_synthesis=final_state.get("clinical_synthesis", ""),
        self_rag_critique=final_state.get("self_rag_critique"),  # type: ignore
        claim_verifications=final_state.get("claim_verifications", []),
        model_routing_decisions=final_state.get("model_routing_decisions", []),
        hitl_gate=final_state.get("hitl_gate"),  # type: ignore
        execution_trace=final_state.get("execution_trace", []),
        total_latency_ms=total_lat,
        status=final_state.get("status", "COMPLETED")
    )


def execute_triage_flow(
    query: str,
    patient_id: Optional[str] = None,
    proposed_medications: Optional[list] = None,
    session_id: Optional[str] = None
) -> TriageResponse:
    import asyncio
    import concurrent.futures
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    if loop.is_running():
        with concurrent.futures.ThreadPoolExecutor() as pool:
            return pool.submit(asyncio.run, execute_triage_flow_async(query, patient_id, proposed_medications, session_id)).result()
    return loop.run_until_complete(execute_triage_flow_async(query, patient_id, proposed_medications, session_id))

