"""
End-to-End Integration Tests for LangGraph Workflow & Clinical Scenarios.
"""
from app.graph.workflow import execute_triage_flow
from app.core.models import ClinicalSeverity


def test_e2e_scenario_eleanor_vance_metformin_lactic_acidosis():
    """
    Patient P101 (Eleanor Vance, 72F):
    Diagnosed with T2DM and CKD Stage 4, taking Metformin 1000mg BID.
    Creatinine 2.4 mg/dL -> eGFR ~22 mL/min/1.73m².
    Expected:
    1. eGFR calculated as ~22 mL/min (CKD G4).
    2. Pharmacovigilance trips CONTRAINDICATED alert for Metformin.
    3. Hybrid retrieval returns NICE NG28 renal threshold chunk.
    4. CRAG verifies chunk relevance.
    5. Synthesis cites NICE_NG28 and mandates discontinuation.
    6. Self-RAG confirms [IsSupported] = True.
    7. HITL gate trips because alert is CONTRAINDICATED.
    """
    res = execute_triage_flow(
        query="Review diabetes medications and renal safety for Eleanor Vance P101",
        patient_id="P101"
    )

    assert res.patient_id == "P101"
    assert len(res.calculations) >= 2
    # Check eGFR
    egfr_res = next(c for c in res.calculations if "eGFR" in c.calculator_name)
    assert egfr_res.computed_value < 30.0

    # Check alert
    contra_alert = next((a for a in res.interaction_alerts if "Metformin" in a.drug_a), None)
    assert contra_alert is not None
    assert contra_alert.severity == ClinicalSeverity.CONTRAINDICATED

    # Check guidelines citation
    assert len(res.retrieved_guidelines) > 0
    assert any("NICE_NG28" in g.doc_id for g in res.retrieved_guidelines)

    # Check Self-RAG
    assert res.self_rag_critique.is_supported is True
    assert res.self_rag_critique.is_useful is True

    # Check HITL Gate
    assert res.hitl_gate.is_required is True
    assert res.hitl_gate.risk_level == ClinicalSeverity.CONTRAINDICATED


def test_e2e_scenario_arthur_pendleton_warfarin_nsaid_fatal_bleed():
    """
    Patient P102 (Arthur Pendleton, 75M):
    On Warfarin for AFib. Clinician queries if Ibuprofen is safe for knee pain.
    Expected:
    1. Trips FATAL bleeding interaction between Warfarin and NSAID.
    2. Recommends Acetaminophen alternative.
    3. Retrieves NICE NG196 AFib guideline.
    4. HITL gate triggers mandatory halt.
    """
    res = execute_triage_flow(
        query="Can I prescribe Ibuprofen 600mg for acute knee arthritis in Arthur Pendleton P102?",
        patient_id="P102",
        proposed_medications=["Ibuprofen"]
    )

    fatal_alert = next((a for a in res.interaction_alerts if a.severity == ClinicalSeverity.FATAL), None)
    assert fatal_alert is not None
    assert "Warfarin" in fatal_alert.drug_a or "Warfarin" in fatal_alert.drug_b
    assert res.hitl_gate.is_required is True
    assert res.hitl_gate.risk_level == ClinicalSeverity.FATAL
    assert "Acetaminophen" in fatal_alert.clinical_recommendation or "Paracetamol" in fatal_alert.clinical_recommendation


def test_e2e_scenario_chemotherapy_regulated_hitl_gate():
    """
    Testing BMDC safety code: Any query proposing Chemotherapy requires mandatory HITL override.
    """
    res = execute_triage_flow(
        query="Order systemic chemotherapy with Doxorubicin for patient P101",
        patient_id="P101",
        proposed_medications=["Doxorubicin"]
    )
    assert res.hitl_gate.is_required is True
    assert "Regulated High-Risk Substance" in res.hitl_gate.reason or "Chemotherapy" in res.hitl_gate.reason
