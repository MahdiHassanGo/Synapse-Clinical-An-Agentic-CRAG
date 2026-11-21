"""
Run Manager & Real-Time Event Dispatcher.
Implements:
- POST /api/triage/runs
- GET /api/triage/runs/{run_id}/events (Genuine SSE streaming)
- POST /api/triage/runs/{run_id}/review (Genuine HITL resumption & audit logging)
- GET /api/triage/runs/{run_id}
"""
import uuid
import time
import asyncio
import json
from typing import Dict, Any, List, Optional, AsyncGenerator
from pydantic import BaseModel, Field

from app.graph.state import SynapseState
from app.graph.workflow import synapse_graph_agent
from app.core.models import TriageResponse, ClinicalSeverity
from app.ehr.database import ehr_db


class RunEvent(BaseModel):
    event_type: str  # node_started, node_completed, tool_executed, retrieval_completed, rerank_completed, crag_evaluated, query_rewritten, model_selected, synthesis_chunk, claim_verified, hitl_interrupted, hitl_resumed, run_completed, error
    timestamp: float = Field(default_factory=time.time)
    data: Dict[str, Any] = Field(default_factory=dict)


class TriageRun:
    def __init__(
        self,
        run_id: str,
        query: str,
        patient_id: Optional[str] = None,
        proposed_medications: Optional[List[str]] = None,
        session_id: Optional[str] = None
    ):
        self.run_id = run_id
        self.session_id = session_id or f"SESS_{uuid.uuid4().hex[:8]}"
        self.query = query
        self.patient_id = patient_id
        self.proposed_medications = proposed_medications or []
        self.status = "PENDING"  # PENDING, RUNNING, PAUSED_FOR_REVIEW, COMPLETED, FAILED
        self.created_at = time.strftime("%Y-%m-%d %H:%M:%S")
        self.completed_at: Optional[str] = None
        
        self.state: Optional[SynapseState] = None
        self.events: List[RunEvent] = []
        self._subscribers: List[asyncio.Queue] = []
        self.response_payload: Optional[TriageResponse] = None

    def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue()
        # Backfill existing events
        for ev in self.events:
            q.put_nowait(ev)
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        if q in self._subscribers:
            self._subscribers.remove(q)

    def dispatch_event(self, event_type: str, data: Dict[str, Any]):
        event = RunEvent(event_type=event_type, data=data)
        self.events.append(event)
        for q in self._subscribers:
            q.put_nowait(event)


class RunManager:
    def __init__(self):
        self.runs: Dict[str, TriageRun] = {}
        self._init_demo_runs()

    def _init_demo_runs(self):
        """Pre-seeds standard clinical demonstration runs so telemetry & HITL are immediately inspectable."""
        from app.core.models import (
            GuidelineChunk, SelfRAGCritique, ClaimVerificationResult,
            ClinicalCalculationResult, DrugInteractionAlert, ClinicalSeverity,
            HITLInterrupt, AgentExecutionStep, TriageResponse
        )

        # 1. High-Risk Warfarin + NSAID Run (PAUSED_FOR_REVIEW)
        r1_id = "RUN_DEMO_P102_HITL"
        r1 = TriageRun(
            run_id=r1_id,
            query="Can I prescribe Ibuprofen 600mg for acute knee arthritis in Arthur Pendleton (P102)?",
            patient_id="P102",
            proposed_medications=["Ibuprofen"],
            session_id="SESS_DEMO_01"
        )
        r1.status = "PAUSED_FOR_REVIEW"
        r1.created_at = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time() - 3600))
        
        hitl_alert = DrugInteractionAlert(
            drug_a="Warfarin",
            drug_b="Ibuprofen",
            severity=ClinicalSeverity.FATAL,
            mechanism="Concurrent administration of NSAIDs (Ibuprofen) with Warfarin causes severe platelet inhibition and gastric mucosal damage, exponentially multiplying the risk of major upper GI hemorrhage.",
            clinical_recommendation="ABSOLUTE CONTRAINDICATION. Discontinue Ibuprofen. Use topical analgesics or Paracetamol 1000mg up to TID.",
            action_required="HALT_ORDER"
        )
        hitl_gate = HITLInterrupt(
            is_required=True,
            requires_approval_for="Warfarin + Ibuprofen Co-prescription",
            risk_level=ClinicalSeverity.FATAL,
            reason="Regulated High-Risk Hazard: Warfarin + Ibuprofen fatal gastrointestinal bleed contraindication identified. Mandatory physician override and mitigating clinical rationale required.",
            contraindications_detected=[hitl_alert],
            approved=None
        )
        r1_steps = [
            AgentExecutionStep(step_name="Intent Router", description="Classified intent: High-Risk Prescription & Contraindication Check", status="COMPLETED", latency_ms=18.5),
            AgentExecutionStep(step_name="Patient EHR Lookup", description="Retrieved patient Arthur Pendleton (P102): Atrial Fibrillation on Warfarin 5mg daily", status="COMPLETED", latency_ms=12.2),
            AgentExecutionStep(step_name="Pharmacovigilance Rule Engine", description="Detected FATAL Drug-Drug Interaction: Warfarin + Ibuprofen", status="COMPLETED", latency_ms=4.1),
            AgentExecutionStep(step_name="Hybrid Guidelines Retrieval", description="Retrieved 5 chunks from NICE NG196 (Atrial Fibrillation Anticoagulation)", status="COMPLETED", latency_ms=42.0),
            AgentExecutionStep(step_name="Neural Cross-Encoder", description="Reranked top candidates via FlashRank TinyBERT ONNX", status="COMPLETED", latency_ms=6.8),
            AgentExecutionStep(step_name="CRAG Evaluator", description="Relevance score: 0.94. Context sufficient", status="COMPLETED", latency_ms=8.3),
            AgentExecutionStep(step_name="Safety Gate Intercept", description="Triggered LangGraph interrupt state: Awaiting authenticated clinician sign-off", status="COMPLETED", latency_ms=2.1),
        ]
        r1.state = {
            "run_id": r1_id,
            "session_id": "SESS_DEMO_01",
            "query": r1.query,
            "patient_id": "P102",
            "proposed_medications": ["Ibuprofen"],
            "routes": ["EHR_QUERY", "CONTRAINDICATION_CHECK", "LITERATURE_GUIDELINE"],
            "query_plan": {},
            "patient_summary": None,
            "missing_patient_data": [],
            "patient_error": None,
            "calculations": [],
            "interaction_alerts": [hitl_alert],
            "retrieved_docs": [],
            "reranked_docs": [],
            "graded_docs": [],
            "is_context_sufficient": True,
            "contradiction_warnings": [],
            "iteration_count": 0,
            "rewritten_queries": [],
            "clinical_synthesis": "### Clinical Assessment & Triage Summary\n\n**Patient**: Arthur Pendleton (MRN: MRN-10294, Age: 68M) — *Atrial Fibrillation*\n\n### Pharmacovigilance & Safety Alerts\n- **[FATAL] Warfarin + Ibuprofen**: Concurrent administration causes severe platelet dysfunction and gastric mucosal erosion.\n  - **Recommendation**: `HALT_ORDER` — ABSOLUTE CONTRAINDICATION. Discontinue Ibuprofen immediately.\n\n### Evidence-Based Guideline Grounding\n- **[NICE] NICE NG196 Atrial Fibrillation** ([Guideline:NICE_NG196_AFIB#CHUNK_NICE_01]): \"Do not offer an NSAID to adults who are taking an anticoagulant (Warfarin, DOACs) unless specifically indicated, as the combination carries a high risk of fatal gastrointestinal bleeding.\"\n\n### Final Clinical Recommendation\n**HALT / DO NOT PROCEED WITH PROPOSED REGIMEN.** Severe clinical contraindication identified.",
            "model_routing_decisions": [],
            "self_rag_critique": SelfRAGCritique(
                is_supported=True,
                support_score=1.0,
                is_useful=True,
                utility_score=1.0,
                cited_chunk_ids=["CHUNK_NICE_01"],
                hallucination_warnings=[]
            ),
            "claim_verifications": [
                ClaimVerificationResult(
                    claim_id="CLAIM_1",
                    claim_text="Do not offer an NSAID to adults taking an anticoagulant due to high risk of fatal bleeding.",
                    verdict="SUPPORTED",
                    entailment_explanation="Directly entailed by NICE NG196 Section 1.4.",
                    matched_chunk_id="CHUNK_NICE_01",
                    evidence_quote="combination carries a high risk of fatal gastrointestinal bleeding"
                )
            ],
            "hitl_gate": hitl_gate,
            "audit_events": [],
            "execution_trace": r1_steps,
            "total_latency_ms": 91.9,
            "status": "PAUSED_FOR_REVIEW"
        }
        self._assemble_response(r1, r1.state)
        self.runs[r1_id] = r1

        # 2. Completed Metformin CKD Run (COMPLETED)
        r2_id = "RUN_DEMO_P101_CKD"
        r2 = TriageRun(
            run_id=r2_id,
            query="Assess renal safety and lactic acidosis risk of continuing Metformin 1000mg BID in Eleanor Vance (P101).",
            patient_id="P101",
            proposed_medications=["Metformin"],
            session_id="SESS_DEMO_02"
        )
        r2.status = "COMPLETED"
        r2.created_at = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time() - 7200))
        r2.completed_at = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time() - 7195))
        
        calc_egfr = ClinicalCalculationResult(
            calculator_name="CKD-EPI 2021 eGFR (Race-Free)",
            computed_value=17.5,
            unit="mL/min/1.73m²",
            clinical_interpretation="CKD Stage G4 (Severe Kidney Impairment)",
            inputs_used={"serum_creatinine": 2.8, "age": 72, "gender": "Female"}
        )
        metformin_alert = DrugInteractionAlert(
            drug_a="Metformin",
            condition="CKD Stage G4 (eGFR 17.5)",
            severity=ClinicalSeverity.CONTRAINDICATED,
            mechanism="Reduced renal clearance of metformin in advanced kidney disease (eGFR < 30 mL/min/1.73m²) leads to systemic drug accumulation and potentially fatal lactic acidosis.",
            clinical_recommendation="Discontinue Metformin immediately. Review glycemic control and consider insulin or renal-adjusted DPP-4 inhibitors.",
            action_required="DISCONTINUE_DRUG"
        )
        r2_steps = [
            AgentExecutionStep(step_name="Intent Router", description="Clinical calculation and guideline safety query", status="COMPLETED", latency_ms=14.2),
            AgentExecutionStep(step_name="Patient Context", description="Retrieved Eleanor Vance (P101): SCr 2.8 mg/dL, Age 72, Female", status="COMPLETED", latency_ms=11.0),
            AgentExecutionStep(step_name="Clinical Calculators", description="CKD-EPI 2021 eGFR computed: 17.5 mL/min/1.73m² (Stage G4)", status="COMPLETED", latency_ms=2.1),
            AgentExecutionStep(step_name="Pharmacovigilance Matrix", description="Metformin renal contraindication detected (eGFR < 30)", status="COMPLETED", latency_ms=3.5),
            AgentExecutionStep(step_name="Hybrid Retrieval", description="Retrieved NICE NG28 and KDIGO 2024 diabetes guidelines", status="COMPLETED", latency_ms=38.4),
            AgentExecutionStep(step_name="FlashRank Reranker", description="Ranked NICE NG28 chunk at Rank 1", status="COMPLETED", latency_ms=5.4),
            AgentExecutionStep(step_name="Clinical Synthesis", description="Evidence-grounded Markdown triage generated", status="COMPLETED", latency_ms=45.2),
        ]
        r2.state = {
            "run_id": r2_id,
            "session_id": "SESS_DEMO_02",
            "query": r2.query,
            "patient_id": "P101",
            "proposed_medications": ["Metformin"],
            "routes": ["EHR_QUERY", "CLINICAL_CALCULATION", "CONTRAINDICATION_CHECK", "LITERATURE_GUIDELINE"],
            "query_plan": {},
            "patient_summary": None,
            "missing_patient_data": ["weight_kg", "height_cm"],
            "patient_error": None,
            "calculations": [calc_egfr],
            "interaction_alerts": [metformin_alert],
            "retrieved_docs": [],
            "reranked_docs": [],
            "graded_docs": [],
            "is_context_sufficient": True,
            "contradiction_warnings": [],
            "iteration_count": 0,
            "rewritten_queries": [],
            "clinical_synthesis": "### 1. Clinical Assessment & Triage Summary\n\n**Patient**: Eleanor Vance (MRN: MRN-10142, Age: 72F) — *Type 2 Diabetes Mellitus*\n\n### 2. Live Clinical Calculations (Deterministic)\n- **CKD-EPI 2021 eGFR (Race-Free)**: `17.5 mL/min/1.73m²` — *CKD Stage G4 (Severe Kidney Impairment)*\n\n### 3. Pharmacovigilance & Safety Alerts\n- **[CONTRAINDICATED] Metformin**: eGFR is 17.5 mL/min/1.73m². Metformin is contraindicated when eGFR < 30 mL/min due to risk of lactic acidosis.\n  - **Recommendation**: `DISCONTINUE_DRUG` — Stop Metformin immediately.\n\n### 4. Evidence-Based Guideline Grounding\n- **[NICE] NICE NG28 Type 2 Diabetes** ([Guideline:NICE_NG28_DIABETES#CHUNK_NICE_01]): \"Review the dose of metformin if the estimated glomerular filtration rate (eGFR) is below 45 ml/minute/1.73m2. Stop metformin if the eGFR is below 30 ml/minute/1.73m2 due to the risk of lactic acidosis.\"\n\n### 5. Final Clinical Recommendation & Plan\n**HALT / DO NOT CONTINUE METFORMIN.** Patient has CKD Stage G4. Transition to renal-safe glycemic agent.",
            "model_routing_decisions": [],
            "self_rag_critique": SelfRAGCritique(
                is_supported=True,
                support_score=0.98,
                is_useful=True,
                utility_score=1.0,
                cited_chunk_ids=["CHUNK_NICE_01"],
                hallucination_warnings=[]
            ),
            "claim_verifications": [
                ClaimVerificationResult(
                    claim_id="CLAIM_1",
                    claim_text="Stop metformin if the eGFR is below 30 ml/minute/1.73m2 due to the risk of lactic acidosis.",
                    verdict="SUPPORTED",
                    entailment_explanation="Directly supported by NICE NG28 Section 1.5.",
                    matched_chunk_id="CHUNK_NICE_01",
                    evidence_quote="Stop metformin if the eGFR is below 30 ml/minute/1.73m2"
                )
            ],
            "hitl_gate": HITLInterrupt(is_required=False),
            "audit_events": [],
            "execution_trace": r2_steps,
            "total_latency_ms": 119.7,
            "status": "COMPLETED"
        }
        self._assemble_response(r2, r2.state)
        self.runs[r2_id] = r2

    async def create_run_async(
        self,
        query: str,
        patient_id: Optional[str] = None,
        proposed_medications: Optional[List[str]] = None,
        session_id: Optional[str] = None
    ) -> TriageRun:
        """Asynchronously creates a run and safely schedules execution on the active event loop."""
        run_id = f"RUN_{uuid.uuid4().hex[:10]}"
        run = TriageRun(
            run_id=run_id,
            query=query,
            patient_id=patient_id,
            proposed_medications=proposed_medications,
            session_id=session_id
        )
        self.runs[run_id] = run
        loop = asyncio.get_running_loop()
        loop.create_task(self._execute_run(run))
        return run

    def create_run(
        self,
        query: str,
        patient_id: Optional[str] = None,
        proposed_medications: Optional[List[str]] = None,
        session_id: Optional[str] = None
    ) -> TriageRun:
        run_id = f"RUN_{uuid.uuid4().hex[:10]}"
        run = TriageRun(
            run_id=run_id,
            query=query,
            patient_id=patient_id,
            proposed_medications=proposed_medications,
            session_id=session_id
        )
        self.runs[run_id] = run
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._execute_run(run))
        except RuntimeError:
            asyncio.run(self._execute_run(run))
        return run

    def get_run(self, run_id: str) -> Optional[TriageRun]:
        return self.runs.get(run_id)

    def list_runs(self) -> List[Dict[str, Any]]:
        """Returns all runs in reverse chronological order."""
        res = []
        for r in reversed(list(self.runs.values())):
            res.append({
                "run_id": r.run_id,
                "session_id": r.session_id,
                "patient_id": r.patient_id,
                "query": r.query,
                "status": r.status,
                "created_at": r.created_at,
                "completed_at": r.completed_at,
                "total_events": len(r.events),
                "has_response": r.response_payload is not None,
                "hitl_required": bool(r.state and r.state.get("hitl_gate") and r.state["hitl_gate"].is_required)
            })
        return res

    async def _execute_run(self, run: TriageRun):
        run.status = "RUNNING"
        run.dispatch_event("run_created", {"run_id": run.run_id, "session_id": run.session_id, "timestamp": time.time()})
        run.dispatch_event("node_started", {"node": "intent_router", "message": "Analyzing clinical query intent..."})

        initial_state: SynapseState = {
            "run_id": run.run_id,
            "session_id": run.session_id,
            "query": run.query,
            "patient_id": run.patient_id,
            "proposed_medications": run.proposed_medications,
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

        config = {"configurable": {"thread_id": run.run_id}}

        try:
            accumulated_state = dict(initial_state)
            # Genuine real-time LangGraph node execution streaming
            async for chunk in synapse_graph_agent.astream(initial_state, config, stream_mode="updates"):
                for node_name, node_update in chunk.items():
                    accumulated_state.update(node_update)
                    run.dispatch_event("node_completed", {
                        "node": node_name,
                        "status": "COMPLETED",
                        "timestamp": time.time()
                    })

                    if "execution_trace" in node_update and node_update["execution_trace"]:
                        latest_step = node_update["execution_trace"][-1]
                        run.dispatch_event("trace_step", latest_step.model_dump())

                    if "retrieved_docs" in node_update:
                        run.dispatch_event("retrieval_completed", {"count": len(node_update["retrieved_docs"])})
                    if "reranked_docs" in node_update:
                        run.dispatch_event("reranking_completed", {"count": len(node_update["reranked_docs"])})
                    if "graded_docs" in node_update:
                        run.dispatch_event("crag_evaluated", {
                            "sufficient": node_update.get("is_context_sufficient"),
                            "count": len(node_update["graded_docs"])
                        })
                    if "clinical_synthesis" in node_update:
                        run.dispatch_event("synthesis_completed", {"length": len(node_update["clinical_synthesis"])})
                    if "claim_verifications" in node_update:
                        run.dispatch_event("claim_verified", {"count": len(node_update["claim_verifications"])})

            run.state = accumulated_state

            # Check if paused for HITL review
            hitl = accumulated_state.get("hitl_gate")
            if hitl and hitl.is_required and hitl.approved is None:
                run.status = "PAUSED_FOR_REVIEW"
                self._assemble_response(run, accumulated_state)
                run.dispatch_event("hitl_interrupted", hitl.model_dump())
            else:
                run.status = "COMPLETED"
                run.completed_at = time.strftime("%Y-%m-%d %H:%M:%S")
                self._assemble_response(run, accumulated_state)
                run.dispatch_event("run_completed", run.response_payload.model_dump())

        except Exception as e:
            run.status = "FAILED"
            run.dispatch_event("error", {"error": str(e)})

    def _assemble_response(self, run: TriageRun, state: SynapseState):
        from app.core.models import HITLInterrupt
        total_lat = sum(s.latency_ms for s in state.get("execution_trace", []))
        hitl_obj = state.get("hitl_gate") or HITLInterrupt(is_required=False)
        run.response_payload = TriageResponse(
            run_id=run.run_id,
            session_id=run.session_id,
            patient_id=state.get("patient_id"),
            patient_summary=state.get("patient_summary"),
            missing_patient_data=state.get("missing_patient_data", []),
            query=run.query,
            routes_executed=state.get("routes", []),
            retrieved_guidelines=state.get("graded_docs") or state.get("reranked_docs") or state.get("retrieved_docs", []),
            crag_iterations=state.get("iteration_count", 0),
            rewritten_queries=state.get("rewritten_queries", []),
            calculations=state.get("calculations", []),
            interaction_alerts=state.get("interaction_alerts", []),
            clinical_synthesis=state.get("clinical_synthesis", ""),
            self_rag_critique=state.get("self_rag_critique"),  # type: ignore
            claim_verifications=state.get("claim_verifications", []),
            model_routing_decisions=state.get("model_routing_decisions", []),
            hitl_gate=hitl_obj,
            execution_trace=state.get("execution_trace", []),
            total_latency_ms=round(total_lat, 2),
            status=run.status
        )

    def submit_review(
        self,
        run_id: str,
        clinician_id: str,
        approved: bool,
        override_rationale: str
    ) -> Optional[TriageRun]:
        run = self.get_run(run_id)
        if not run or run.status != "PAUSED_FOR_REVIEW":
            return None

        # Mandatory rationale enforcement
        if approved and not override_rationale.strip():
            raise ValueError("Mandatory clinical override rationale is required for high-risk approval.")

        # Persist audit record in database
        audit_record = ehr_db.record_audit_event(
            run_id=run_id,
            session_id=run.session_id,
            patient_id=run.patient_id or "UNKNOWN",
            clinician_id=clinician_id,
            decision="APPROVED_WITH_OVERRIDE" if approved else "HALTED_BY_PHYSICIAN",
            override_rationale=override_rationale
        )

        # Update HITL gate
        if run.state and run.state.get("hitl_gate"):
            hitl = run.state["hitl_gate"]
            hitl.approved = approved
            hitl.approved_by_clinician_id = clinician_id
            hitl.override_rationale = override_rationale
            hitl.timestamp = audit_record["timestamp"]

        run.status = "COMPLETED" if approved else "HALTED"
        run.completed_at = time.strftime("%Y-%m-%d %H:%M:%S")

        run.dispatch_event("hitl_resumed", audit_record)
        if run.state:
            self._assemble_response(run, run.state)
            run.dispatch_event("run_completed", run.response_payload.model_dump())

        return run


run_manager = RunManager()
