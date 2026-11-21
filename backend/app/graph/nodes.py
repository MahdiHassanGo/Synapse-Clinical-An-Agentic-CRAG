"""
Upgraded LangGraph Nodes for Synapse Clinical.
Implements properly separated nodes for:
1. intent_router_node
2. query_planner_node
3. patient_context_node (Strictly parameterized, NO P101 fallback)
4. clinical_calculators_node (Deterministic Python only)
5. pharmacovigilance_node (Deterministic rule engine only)
6. hybrid_retriever_node
7. cross_encoder_reranker_node (Neural FlashRank)
8. crag_evaluator_node (Relevance scoring + contradiction check)
9. query_rewriter_node (Fallback reformulation)
10. clinical_synthesis_node (Model Orchestrator clinical model)
11. claim_level_verifier_node (Claim-level Self-RAG verification)
12. safety_policy_node (Regulatory checks & black-box alerts)
13. hitl_interrupt_node (Real LangGraph pause/interrupt)
14. final_response_node
"""
import re
import time
from typing import Dict, Any, List, Optional

from app.graph.state import SynapseState
from app.core.models import (
    QueryRoute, ClinicalSeverity, HITLInterrupt,
    SelfRAGCritique, AgentExecutionStep, GuidelineChunk
)
from app.core.providers.base import LLMMessage
from app.core.orchestrator.models import OrchestratorTask, ModelRoutingDecision
from app.core.orchestrator.orchestrator import model_orchestrator
from app.ehr.database import ehr_db
from app.ehr.calculators import (
    calculate_egfr_ckd_epi_2021,
    calculate_creatinine_clearance_cockcroft_gault,
    calculate_bmi_and_bsa
)
from app.pharmacovigilance.engine import pharmacovigilance_engine
from app.retrieval.hybrid import hybrid_retriever
from app.retrieval.reranker import cross_encoder_reranker
from app.evaluation.crag import crag_evaluator
from app.evaluation.verifier import self_rag_verifier


async def intent_router_node(state: SynapseState) -> Dict[str, Any]:
    """1. Intent Router: Classifies clinical intent and extracts patient ID."""
    start_time = time.time()
    query = state["query"]
    pid = state.get("patient_id")

    # If patient ID is not provided, attempt exact regex match
    if not pid:
        match = re.search(r'\b(P10[1-4]|MRN-\d+)\b', query, re.IGNORECASE)
        if match:
            pid = match.group(1).upper()

    # Detect proposed medications mentioned in the query
    proposed = list(state.get("proposed_medications") or [])
    known_drug_names = [
        "metformin", "lisinopril", "warfarin", "ibuprofen", "naproxen",
        "aspirin", "spironolactone", "enalapril", "sildenafil", "nitroglycerin",
        "clopidogrel", "omeprazole", "dapagliflozin", "empagliflozin", "amoxicillin",
        "cephalexin", "levofloxacin", "morphine", "fentanyl", "doxorubicin"
    ]
    for drug in known_drug_names:
        if drug in query.lower() and drug not in [p.lower() for p in proposed]:
            proposed.append(drug.capitalize())

    # Call fast model for intent routing
    messages = [
        LLMMessage(role="system", content="Classify the clinical query intent into one or more: EHR_QUERY, LITERATURE_GUIDELINE, CONTRAINDICATION_CHECK, CLINICAL_CALCULATION, COMBINED_TRIAGE. Return plain comma-separated values."),
        LLMMessage(role="user", content=query)
    ]
    
    routes = [
        QueryRoute.EHR_QUERY,
        QueryRoute.CLINICAL_CALCULATION,
        QueryRoute.CONTRAINDICATION_CHECK,
        QueryRoute.LITERATURE_GUIDELINE
    ]

    try:
        resp = await model_orchestrator.execute_task(
            task=OrchestratorTask.INTENT_ROUTING,
            messages=messages
        )
        parsed_routes = []
        for r_str in resp.content.split(","):
            clean_r = r_str.strip().upper()
            if clean_r in QueryRoute.__members__:
                parsed_routes.append(QueryRoute(clean_r))
        if parsed_routes:
            routes = parsed_routes
    except Exception:
        pass

    step = AgentExecutionStep(
        step_name="Intent Router",
        description="Autonomous Query Intent Classification & Patient Target Resolution",
        status="COMPLETED",
        latency_ms=round((time.time() - start_time) * 1000.0, 2),
        metadata={"patient_id": pid, "routes": [r.value for r in routes], "proposed_drugs": proposed}
    )
    trace = list(state.get("execution_trace", []))
    trace.append(step)

    return {
        "patient_id": pid,
        "proposed_medications": proposed,
        "routes": routes,
        "execution_trace": trace,
        "iteration_count": state.get("iteration_count", 0),
        "rewritten_queries": state.get("rewritten_queries", [])
    }


def query_planner_node(state: SynapseState) -> Dict[str, Any]:
    """2. Query Planner: Decomposes inquiry into sub-plans for parallel operations."""
    start_time = time.time()
    query = state["query"]
    pid = state.get("patient_id")
    
    plan = {
        "needs_ehr": bool(pid),
        "needs_calculations": any(term in query.lower() for term in ["egfr", "crcl", "bmi", "renal", "kidney", "dose"]),
        "needs_safety_check": bool(state.get("proposed_medications") or pid),
        "needs_literature": True
    }

    step = AgentExecutionStep(
        step_name="Query Planner",
        description="Decomposing query into parallel tool execution strategy",
        status="COMPLETED",
        latency_ms=round((time.time() - start_time) * 1000.0, 2),
        metadata=plan
    )
    trace = list(state.get("execution_trace", []))
    trace.append(step)
    return {"query_plan": plan, "execution_trace": trace}


def patient_context_node(state: SynapseState) -> Dict[str, Any]:
    """3. Patient Context: Typed retrieval without defaulting to P101."""
    start_time = time.time()
    pid = state.get("patient_id")
    
    patient_summary = None
    missing_data = []
    patient_error = None

    if pid:
        patient_summary = ehr_db.fetch_patient_summary(pid)
        if not patient_summary:
            patient_error = f"Patient identifier '{pid}' was not found in the EHR repository."
        else:
            missing_data = patient_summary.get("missing_measurements", [])
    else:
        # General question with no patient context
        pass

    step = AgentExecutionStep(
        step_name="Patient Context",
        description="Parameterized EHR Context Lookup with Missing-Data Auditing",
        status="COMPLETED" if not patient_error else "FAILED",
        latency_ms=round((time.time() - start_time) * 1000.0, 2),
        metadata={
            "patient_found": bool(patient_summary),
            "missing_measurements": missing_data,
            "error": patient_error
        }
    )
    trace = list(state.get("execution_trace", []))
    trace.append(step)

    return {
        "patient_summary": patient_summary,
        "missing_patient_data": missing_data,
        "patient_error": patient_error,
        "execution_trace": trace
    }


def clinical_calculators_node(state: SynapseState) -> Dict[str, Any]:
    """4. Clinical Calculators: Strictly deterministic Python functions."""
    start_time = time.time()
    summary = state.get("patient_summary")
    calculations = []

    if summary and isinstance(summary, dict) and summary.get("patient"):
        pat = summary["patient"]
        age = pat.get("age")
        gender = pat.get("gender")
        weight = pat.get("weight_kg")
        height = pat.get("height_cm")

        # Extract serum creatinine
        scr = None
        for lab in summary.get("labs", []):
            if "CREAT" in lab.get("test_code", "").upper() or "CREATININE" in lab.get("test_name", "").upper():
                scr = lab.get("value")
                break

        # Compute eGFR only if required inputs are present (NEVER invent default values)
        if scr is not None and age is not None and gender is not None:
            egfr_res = calculate_egfr_ckd_epi_2021(scr, age, gender)
            calculations.append(egfr_res)

        # Compute CrCl only if weight is present
        if scr is not None and age is not None and gender is not None and weight is not None:
            crcl_res = calculate_creatinine_clearance_cockcroft_gault(scr, age, weight, gender)
            calculations.append(crcl_res)

        # Compute BMI only if weight and height are present
        if weight is not None and height is not None:
            bmi_res = calculate_bmi_and_bsa(weight, height)
            calculations.append(bmi_res)

    step = AgentExecutionStep(
        step_name="Clinical Calculators",
        description="Deterministic CKD-EPI 2021 eGFR, CrCl, and Mosteller BSA Execution",
        status="COMPLETED",
        latency_ms=round((time.time() - start_time) * 1000.0, 2),
        metadata={"computed_count": len(calculations)}
    )
    trace = list(state.get("execution_trace", []))
    trace.append(step)
    return {"calculations": calculations, "execution_trace": trace}


def pharmacovigilance_node(state: SynapseState) -> Dict[str, Any]:
    """5. Pharmacovigilance Tools: Deterministic rule-backed contraindication screening."""
    start_time = time.time()
    summary = state.get("patient_summary")
    proposed = state.get("proposed_medications", [])
    alerts = []

    active_meds = []
    allergies = []
    conditions = []
    egfr_val = None

    # Get computed eGFR if available
    for calc in state.get("calculations", []):
        if "eGFR" in calc.calculator_name:
            egfr_val = calc.computed_value
            break

    if summary and isinstance(summary, dict) and summary.get("patient"):
        active_meds = [m["drug_name"] for m in summary.get("active_medications", []) if isinstance(m, dict) and "drug_name" in m]
        allergies = [a["allergen"] for a in summary.get("allergies", []) if isinstance(a, dict) and "allergen" in a]
        conditions = [summary["patient"].get("primary_diagnosis", "")]

    alerts = pharmacovigilance_engine.check_contraindications(
        proposed_drugs=proposed,
        active_medications=active_meds,
        known_allergies=allergies,
        conditions=conditions,
        egfr_value=egfr_val
    )

    step = AgentExecutionStep(
        step_name="Pharmacovigilance Tools",
        description="Deterministic DDI, Organ Thresholds, and Allergy Cross-Reactivity",
        status="COMPLETED",
        latency_ms=round((time.time() - start_time) * 1000.0, 2),
        metadata={"alerts_count": len(alerts)}
    )
    trace = list(state.get("execution_trace", []))
    trace.append(step)
    return {"interaction_alerts": alerts, "execution_trace": trace}


def get_cleaned_clinical_query(state: SynapseState) -> str:
    """Extracts and sanitizes clinical query for medical literature retrieval and cross-encoder reranking."""
    query = state["query"]
    rewritten = state.get("rewritten_queries", [])
    if rewritten:
        candidate_q = rewritten[-1]
        if len(candidate_q.split("\n")) <= 2 and len(candidate_q) < 300:
            query = candidate_q

    # Clean patient names and identifiers from literature query
    clean_q = re.sub(r'\b(p10[1-4]|mrn-\d+|eleanor vance|arthur pendleton|marcus holloway|sarah chen|patient\s+[a-z0-9_]+|patient)\b', ' ', query, flags=re.IGNORECASE)
    clean_q = re.sub(r'\s+', ' ', clean_q).strip()

    # Enrich with clinical terms (proposed meds, active meds, alert targets)
    summary = state.get("patient_summary")
    proposed = state.get("proposed_medications", [])
    active_drugs = []
    if summary and isinstance(summary, dict) and summary.get("active_medications"):
        active_drugs = [m["drug_name"] for m in summary.get("active_medications", []) if isinstance(m, dict) and "drug_name" in m]
    alert_drugs = [a.drug_a for a in state.get("interaction_alerts", [])] + [a.drug_b for a in state.get("interaction_alerts", []) if a.drug_b]

    extra_terms = [t for t in set(proposed + active_drugs[:3] + alert_drugs) if t.lower() not in clean_q.lower()]
    if extra_terms:
        clean_q += " " + " ".join(extra_terms)

    return clean_q or query


def hybrid_retriever_node(state: SynapseState) -> Dict[str, Any]:
    """6. Hybrid RAG Retrieval: Dense Vector + BM25 search."""
    start_time = time.time()
    clean_q = get_cleaned_clinical_query(state)

    retrieved = hybrid_retriever.search_hybrid(
        query=clean_q,
        initial_k=20,
        final_top_n=10
    )

    step = AgentExecutionStep(
        step_name="Hybrid Retrieval",
        description="Dense Cosine + Sparse BM25 Candidate Blending (Top 20)",
        status="COMPLETED",
        latency_ms=round((time.time() - start_time) * 1000.0, 2),
        metadata={"query_used": clean_q, "retrieved_count": len(retrieved)}
    )
    trace = list(state.get("execution_trace", []))
    trace.append(step)
    return {"retrieved_docs": retrieved, "execution_trace": trace}


def cross_encoder_reranker_node(state: SynapseState) -> Dict[str, Any]:
    """7. Reranking: Neural Cross-Encoder (FlashRank) scores chunks."""
    start_time = time.time()
    clean_q = get_cleaned_clinical_query(state)
    retrieved = state.get("retrieved_docs", [])

    passages = []
    for c in retrieved:
        passages.append({
            "chunk_id": c.chunk_id,
            "content": c.content,
            "doc_id": c.doc_id,
            "title": c.title,
            "source_organization": c.source_organization,
            "section": c.section,
            "parent_chunk_id": c.parent_chunk_id
        })

    reranked = cross_encoder_reranker.rerank(
        query=clean_q,
        passages=passages,
        top_n=5
    )

    max_ce = max((float(r.get("cross_encoder_score", 0.0)) for r in reranked), default=1.0)
    final_chunks: List[GuidelineChunk] = []
    for r in reranked:
        ce_score = float(r.get("cross_encoder_score", 0.8))
        if max_ce >= 0.08:
            rel_ratio = ce_score / max_ce
            norm_score = round(min(1.0, max(0.0, 0.45 * rel_ratio + 0.55 * min(1.0, ce_score * 5.0))), 3)
        else:
            confidence_factor = max_ce / 0.08 if max_ce > 0 else 0.0
            rel_ratio = (ce_score / max_ce) if max_ce > 0 else 0.0
            norm_score = round(min(1.0, max(0.0, (0.45 * rel_ratio + 0.55 * ce_score) * confidence_factor)), 3)
        final_chunks.append(GuidelineChunk(
            chunk_id=r["chunk_id"],
            doc_id=r["doc_id"],
            title=r["title"],
            source_organization=r["source_organization"],
            section=r["section"],
            content=r["content"],
            parent_chunk_id=r.get("parent_chunk_id"),
            relevance_score=norm_score,
            cross_encoder_score=norm_score,
            is_relevant=(norm_score >= 0.40)
        ))

    step = AgentExecutionStep(
        step_name="Cross-Encoder Reranker",
        description="Neural Token Cross-Attention Reranking via FlashRank ONNX (Top 5)",
        status="COMPLETED",
        latency_ms=round((time.time() - start_time) * 1000.0, 2),
        metadata={"reranked_count": len(final_chunks)}
    )
    trace = list(state.get("execution_trace", []))
    trace.append(step)
    return {"reranked_docs": final_chunks, "execution_trace": trace}


def crag_evaluator_node(state: SynapseState) -> Dict[str, Any]:
    """8. CRAG Evaluation: Relevance grading & contradiction checks."""
    start_time = time.time()
    query = state["query"]
    docs = state.get("reranked_docs") or state.get("retrieved_docs", [])

    graded_docs, is_sufficient, contradictions = crag_evaluator.evaluate_retrieved_evidence(
        query=query,
        retrieved_chunks=docs
    )

    step = AgentExecutionStep(
        step_name="CRAG Evaluation",
        description="Evaluating Evidence Relevance (0.0-1.0) and Detecting Contradictions",
        status="COMPLETED",
        latency_ms=round((time.time() - start_time) * 1000.0, 2),
        metadata={
            "graded_count": len(graded_docs),
            "relevant_count": sum(1 for d in graded_docs if d.is_relevant),
            "is_context_sufficient": is_sufficient,
            "contradictions": contradictions
        }
    )
    trace = list(state.get("execution_trace", []))
    trace.append(step)
    return {
        "graded_docs": graded_docs,
        "is_context_sufficient": is_sufficient,
        "contradiction_warnings": contradictions,
        "execution_trace": trace
    }


async def query_rewriter_node(state: SynapseState) -> Dict[str, Any]:
    """9. Query Rewriter: Fallback loop when retrieved evidence is insufficient."""
    start_time = time.time()
    current_iter = state.get("iteration_count", 0) + 1
    query = state["query"]

    # Use fast model to expand clinical synonyms
    messages = [
        LLMMessage(
            role="system",
            content="You are a clinical query reformulator. Expand the user query with clinical guidelines nomenclature, international drug non-proprietary names (INN), and diagnostic criteria to maximize guideline document retrieval. Return ONLY the reformulated query string."
        ),
        LLMMessage(role="user", content=query)
    ]

    reformulated = f"{query} clinical guideline thresholds contraindications dosing"
    try:
        resp = await model_orchestrator.execute_task(
            task=OrchestratorTask.QUERY_REWRITING,
            messages=messages
        )
        if resp.content and len(resp.content) > 10:
            reformulated = resp.content.strip().replace('"', '')
    except Exception:
        pass

    rewritten_list = list(state.get("rewritten_queries", []))
    rewritten_list.append(reformulated)

    step = AgentExecutionStep(
        step_name="Query Rewriter (CRAG Fallback)",
        description=f"CRAG Reformulation with Clinical Guidelines Nomenclature (Attempt {current_iter})",
        status="COMPLETED",
        latency_ms=round((time.time() - start_time) * 1000.0, 2),
        metadata={"attempt": current_iter, "reformulated_query": reformulated}
    )
    trace = list(state.get("execution_trace", []))
    trace.append(step)
    return {
        "iteration_count": current_iter,
        "rewritten_queries": rewritten_list,
        "execution_trace": trace
    }


async def clinical_synthesis_node(state: SynapseState) -> Dict[str, Any]:
    """10. Clinical Synthesis: Uses Model Orchestrator tier-1 model with strict citation tokens."""
    start_time = time.time()
    query = state["query"]
    summary = state.get("patient_summary")
    calcs = state.get("calculations", [])
    alerts = state.get("interaction_alerts", [])
    guidelines = [g for g in (state.get("graded_docs") or state.get("reranked_docs", [])) if g.is_relevant]
    if not guidelines and state.get("reranked_docs"):
        guidelines = list(state.get("reranked_docs", []))[:3]

    # Construct clinical synthesis prompt
    context_blocks = []
    for g in guidelines:
        context_blocks.append(f"- [{g.source_organization}] {g.title} (Citation: [Guideline:{g.doc_id}#{g.chunk_id}])\n  Excerpt: {g.content}")

    calc_blocks = [f"- {c.calculator_name}: {c.computed_value} {c.unit} ({c.clinical_interpretation})" for c in calcs]
    alert_blocks = [f"- [{a.severity.value}] {a.drug_a} + {a.drug_b or a.condition}: {a.mechanism} -> Action: {a.clinical_recommendation}" for a in alerts]

    if summary and isinstance(summary, dict) and summary.get("patient"):
        pat = summary["patient"]
        patient_desc = f"{pat.get('first_name', '')} {pat.get('last_name', '')}, Age {pat.get('age', 'N/A')}, Gender: {pat.get('gender', 'N/A')}, Diagnosis: {pat.get('primary_diagnosis', 'None recorded')}"
    else:
        patient_desc = "No specific patient record requested (General Clinical Inquiry)."

    prompt = f"""Clinical Inquiry: {query}

Patient Context:
{patient_desc}

Calculated Deterministic Metrics:
{chr(10).join(calc_blocks) if calc_blocks else 'None calculated'}

Active Safety & Pharmacovigilance Alerts:
{chr(10).join(alert_blocks) if alert_blocks else 'No drug-drug or organ contraindications detected'}

Retrieved Clinical Practice Guidelines:
{chr(10).join(context_blocks) if context_blocks else 'No relevant guidelines found'}

Instructions:
1. Synthesize a structured, evidence-grounded clinical assessment in clean Markdown.
2. For EVERY clinical recommendation or threshold, you MUST attach the exact citation token in the format [Guideline:DOC_ID#CHUNK_ID].
3. If contraindications exist, explicitly instruct to HALT or substitute the medication.
4. Clearly state if any patient clinical measurements were missing."""

    messages = [
        LLMMessage(role="system", content="You are Synapse Clinical, an evidence-grounded clinical knowledge assistant. Synthesize actionable, strictly cited clinical decision recommendations."),
        LLMMessage(role="user", content=prompt)
    ]

    try:
        resp = await model_orchestrator.execute_task(
            task=OrchestratorTask.CLINICAL_SYNTHESIS,
            messages=messages
        )
        synthesis = resp.content or ""
        # Ensure guideline citation markers are present if the LLM omitted them
        if "[Guideline:" not in synthesis and guidelines:
            guideline_section = ["\n\n### Evidence-Based Guideline Grounding"]
            for g in guidelines:
                first_sentence = g.content.split(". ")[0].strip()
                guideline_section.append(f"- **[{g.source_organization}] {g.title}** ([Guideline:{g.doc_id}#{g.chunk_id}]): \"{first_sentence}.\"")
            synthesis += "\n".join(guideline_section)
    except Exception:
        # Fallback deterministic synthesis
        lines = ["### 1. Clinical Assessment & Triage Summary"]
        if summary and isinstance(summary, dict) and summary.get("patient"):
            pat = summary["patient"]
            lines.append(f"**Patient**: {pat.get('first_name', '')} {pat.get('last_name', '')} (MRN: {pat.get('mrn', 'N/A')}, Age: {pat.get('age', 'N/A')}) — *{pat.get('primary_diagnosis', 'N/A')}*")
        else:
            lines.append("**Patient**: General Clinical Inquiry (No specific patient context attached)")
        
        if calcs:
            lines.append("\n### 2. Live Clinical Calculations (Deterministic)")
            for c in calcs:
                lines.append(f"- **{c.calculator_name}**: `{c.computed_value} {c.unit}` — *{c.clinical_interpretation}*")

        if alerts:
            lines.append("\n### 3. Pharmacovigilance & Safety Alerts")
            for a in alerts:
                lines.append(f"- **[{a.severity.value}] {a.drug_a}**: {a.mechanism}\n  - **Recommendation**: `{a.action_required}` — {a.clinical_recommendation}")

        lines.append("\n### 4. Evidence-Based Guideline Grounding")
        for g in guidelines:
            lines.append(f"- **[{g.source_organization}] {g.title}** ([Guideline:{g.doc_id}#{g.chunk_id}])\n  > \"{g.content.split('. ')[0]}.\"")

        lines.append("\n### 5. Final Clinical Recommendation & Plan")
        if any(a.severity in [ClinicalSeverity.FATAL, ClinicalSeverity.CONTRAINDICATED] for a in alerts):
            lines.append("**HALT / DO NOT PROCEED WITH PROPOSED REGIMEN.** Severe clinical contraindication identified. Implement recommended alternative therapy noted above.")
        else:
            lines.append("Proceed with adjusted therapeutic regimen following monitoring parameters outlined in guidelines.")
        synthesis = "\n".join(lines)

    step = AgentExecutionStep(
        step_name="Clinical Synthesis",
        description="Generating Evidence-Grounded Markdown Assessment with Document Citations",
        status="COMPLETED",
        latency_ms=round((time.time() - start_time) * 1000.0, 2),
        metadata={"char_length": len(synthesis)}
    )
    trace = list(state.get("execution_trace", []))
    trace.append(step)
    return {
        "clinical_synthesis": synthesis,
        "model_routing_decisions": list(model_orchestrator.execution_decisions),
        "execution_trace": trace
    }


def claim_level_verifier_node(state: SynapseState) -> Dict[str, Any]:
    """11. Claim-Level Verification: Evaluates factual entailment of individual claims."""
    start_time = time.time()
    synthesis = state["clinical_synthesis"]
    guidelines = state.get("graded_docs") or state.get("reranked_docs", [])

    critique, verified_claims = self_rag_verifier.verify_synthesis(
        synthesis_text=synthesis,
        retrieved_chunks=guidelines
    )

    step = AgentExecutionStep(
        step_name="Claim-Level Self-RAG Verifier",
        description="Factual Entailment Auditing: [SUPPORTED], [UNSUPPORTED], [CONTRADICTORY]",
        status="COMPLETED",
        latency_ms=round((time.time() - start_time) * 1000.0, 2),
        metadata={
            "total_claims": len(verified_claims),
            "supported": sum(1 for c in verified_claims if c.verdict == "SUPPORTED"),
            "contradictory": sum(1 for c in verified_claims if c.verdict == "CONTRADICTORY"),
            "groundedness_score": critique.support_score
        }
    )
    trace = list(state.get("execution_trace", []))
    trace.append(step)
    return {
        "self_rag_critique": critique,
        "claim_verifications": verified_claims,
        "execution_trace": trace
    }


def safety_policy_node(state: SynapseState) -> Dict[str, Any]:
    """12. Safety Policy Evaluation: Evaluates regulatory checkpoints and high-risk actions."""
    start_time = time.time()
    alerts = state.get("interaction_alerts", [])
    query = state["query"].lower()
    proposed = [p.lower() for p in state.get("proposed_medications", [])]

    is_high_risk = False
    reasons = []
    highest_severity = ClinicalSeverity.INFO

    for a in alerts:
        if a.severity in [ClinicalSeverity.FATAL, ClinicalSeverity.CONTRAINDICATED]:
            is_high_risk = True
            highest_severity = a.severity
            target = f"{a.drug_a}" + (f" + {a.drug_b}" if a.drug_b else "")
            reasons.append(f"Severe Contraindication: {target} ({a.mechanism[:85]}...)")
        elif a.severity == ClinicalSeverity.MAJOR:
            if highest_severity != ClinicalSeverity.FATAL:
                highest_severity = ClinicalSeverity.MAJOR

    # Regulatory checks for chemotherapy / Schedule II narcotics
    for sub in ["chemotherapy", "chemo", "doxorubicin", "morphine", "fentanyl", "methotrexate"]:
        if sub in query or any(sub in p for p in proposed):
            is_high_risk = True
            highest_severity = ClinicalSeverity.MAJOR
            reasons.append(f"Regulated High-Risk Intervention: '{sub.capitalize()}' requires mandatory human physician authorization.")

    hitl = HITLInterrupt(
        is_required=is_high_risk,
        requires_approval_for=proposed[0].capitalize() if proposed else "Clinical Intervention Plan",
        risk_level=highest_severity,
        reason="; ".join(reasons) if reasons else "Routine clinical risk level.",
        contraindications_detected=alerts,
        approved=None if is_high_risk else True
    )

    step = AgentExecutionStep(
        step_name="Safety Policy Evaluation",
        description="Auditing Regulatory Checkpoints & Black-Box Thresholds",
        status="COMPLETED",
        latency_ms=round((time.time() - start_time) * 1000.0, 2),
        metadata={"is_high_risk": is_high_risk, "risk_level": highest_severity.value}
    )
    trace = list(state.get("execution_trace", []))
    trace.append(step)
    return {"hitl_gate": hitl, "execution_trace": trace}


def hitl_interrupt_node(state: SynapseState) -> Dict[str, Any]:
    """13. HITL Interrupt: Pauses graph execution when high-risk review condition detected."""
    hitl = state["hitl_gate"]
    status = "PAUSED_FOR_REVIEW" if hitl.is_required and hitl.approved is None else "COMPLETED"
    return {"status": status}


def final_response_node(state: SynapseState) -> Dict[str, Any]:
    """14. Final Response: Assembles full auditable response payload."""
    return {"status": "COMPLETED"}


def insufficient_evidence_node(state: SynapseState) -> Dict[str, Any]:
    """
    CRAG Abstention Node: Safely halts clinical synthesis when retrieved evidence
    is insufficient after maximum query reformulation retries.
    Prevents hallucinating clinical guidance without authoritative guideline backing.
    """
    start_time = time.time()
    query = state["query"]
    iter_count = state.get("iteration_count", 0)

    abstention_text = f"""### ⚠️ Clinical Inquiry Abstention: Insufficient Guideline Evidence

**Clinical Safety Refusal**: Synapse Clinical has abstained from synthesizing therapeutic or dosing recommendations for this inquiry.

- **Reason**: The retrieved medical literature failed to meet minimum evidence relevance and grounding thresholds (relevance score < 0.65) after {iter_count} query reformulation attempts.
- **Inquiry Analyzed**: "{query}"
- **Regulatory Directive**: In strict accordance with medical decision support compliance, autonomous synthesis is halted to prevent hallucinated dosing or unsubstantiated clinical actions.
- **Recommended Action**: Consult official institutional clinical practice guidelines directly or submit a more specific inquiry specifying standard medical taxonomy (INN drug names, ICD-10 criteria)."""

    critique = SelfRAGCritique(
        is_supported=False,
        support_score=0.0,
        is_useful=False,
        utility_score=0.0,
        cited_chunk_ids=[],
        hallucination_warnings=[
            f"CRAG Abstention triggered: evidence relevance fell below threshold after {iter_count} query reformulation retries."
        ]
    )

    step = AgentExecutionStep(
        step_name="CRAG Abstention",
        description=f"Safely abstaining from synthesis: retrieved evidence insufficient after {iter_count} reformulation retries",
        status="COMPLETED",
        latency_ms=round((time.time() - start_time) * 1000.0, 2),
        metadata={"abstained": True, "reformulation_attempts": iter_count}
    )
    trace = list(state.get("execution_trace", []))
    trace.append(step)

    return {
        "clinical_synthesis": abstention_text,
        "self_rag_critique": critique,
        "claim_verifications": [],
        "execution_trace": trace,
        "status": "COMPLETED"
    }
