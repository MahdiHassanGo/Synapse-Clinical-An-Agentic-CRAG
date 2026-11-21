"""
Comprehensive Test Suite for Synapse Clinical v4.1:
Patient Conversational AI, Bilingual Bengali/English Processing, Red-Flag Emergency Screening,
Tenant Isolation, and Human Handoff Queue.
"""
import pytest
from app.patient.models import HandoffStatus, HandoffUrgency
from app.patient.session_manager import patient_session_manager
from app.patient.handoff_manager import handoff_manager
from app.patient.nodes import (
    PatientAgentState,
    language_detector_node,
    safety_screening_node,
    intent_classifier_node,
    patient_policy_guard_node
)
from app.patient.workflow import execute_patient_turn
from app.tenants.manager import tenant_manager
from app.retrieval.hybrid import hybrid_retriever


def test_bilingual_language_detection():
    # Test Bengali detection
    state_bn: PatientAgentState = {
        "session_id": "test_s1",
        "tenant_id": "DEFAULT_HOSPITAL",
        "user_query": "মেটফরমিন ওষুধটির কাজ কী এবং কীভাবে খেতে হয়?",
        "language": "en",
        "intent": "GENERAL_EDUCATION",
        "is_emergency": False,
        "is_authenticated": False,
        "consent_given": True,
        "patient_id": None,
        "handoff_requested": False,
        "retrieved_chunks": [],
        "response_text": "",
        "disclaimer": "",
        "execution_steps": [],
        "latency_ms": 0.0
    }
    out_bn = language_detector_node(state_bn)
    assert out_bn["language"] == "bn"

    # Test English detection
    state_en: PatientAgentState = {
        "session_id": "test_s2",
        "tenant_id": "DEFAULT_HOSPITAL",
        "user_query": "What are the common side effects of Metformin?",
        "language": "bn",
        "intent": "GENERAL_EDUCATION",
        "is_emergency": False,
        "is_authenticated": False,
        "consent_given": True,
        "patient_id": None,
        "handoff_requested": False,
        "retrieved_chunks": [],
        "response_text": "",
        "disclaimer": "",
        "execution_steps": [],
        "latency_ms": 0.0
    }
    out_en = language_detector_node(state_en)
    assert out_en["language"] == "en"


def test_emergency_screening_english():
    state: PatientAgentState = {
        "session_id": "test_s3",
        "tenant_id": "DEFAULT_HOSPITAL",
        "user_query": "I am having severe crushing chest pain and shortness of breath.",
        "language": "en",
        "intent": "GENERAL_EDUCATION",
        "is_emergency": False,
        "is_authenticated": False,
        "consent_given": True,
        "patient_id": None,
        "handoff_requested": False,
        "retrieved_chunks": [],
        "response_text": "",
        "disclaimer": "",
        "execution_steps": [],
        "latency_ms": 0.0
    }
    out = safety_screening_node(state)
    assert out["is_emergency"] is True
    assert out["intent"] == "EMERGENCY"


def test_emergency_screening_bengali():
    state: PatientAgentState = {
        "session_id": "test_s4",
        "tenant_id": "CLINIC_DHAKA",
        "user_query": "আমার বুকে তীব্র ব্যথা হচ্ছে এবং প্রচণ্ড শ্বাসকষ্ট লাগছে।",
        "language": "bn",
        "intent": "GENERAL_EDUCATION",
        "is_emergency": False,
        "is_authenticated": False,
        "consent_given": True,
        "patient_id": None,
        "handoff_requested": False,
        "retrieved_chunks": [],
        "response_text": "",
        "disclaimer": "",
        "execution_steps": [],
        "latency_ms": 0.0
    }
    out = safety_screening_node(state)
    assert out["is_emergency"] is True
    assert out["intent"] == "EMERGENCY"


def test_patient_workflow_e2e_emergency_dispatch():
    session = patient_session_manager.create_session(tenant_id="CLINIC_DHAKA", language="bn")
    res = execute_patient_turn(
        session_id=session.session_id,
        user_query="হঠাৎ বুকে চাপ ও প্রচণ্ড শ্বাসকষ্ট হচ্ছে",
        tenant_id="CLINIC_DHAKA"
    )
    assert res["is_emergency"] is True
    assert res["language"] == "bn"
    assert "৯৯৯" in res["response_text"]  # Emergency telephone for Dhaka clinic tenant
    assert "জরুরি" in res["response_text"]


def test_patient_workflow_e2e_education_metformin():
    session = patient_session_manager.create_session(tenant_id="DEFAULT_HOSPITAL", language="en")
    res = execute_patient_turn(
        session_id=session.session_id,
        user_query="Can you explain what Metformin is used for and if I should take it with meals?",
        tenant_id="DEFAULT_HOSPITAL"
    )
    assert res["is_emergency"] is False
    assert res["language"] == "en"
    assert len(res["response_text"]) > 20
    assert "Disclaimer" in res["response_text"]


def test_unauthenticated_records_request_blocked():
    state: PatientAgentState = {
        "session_id": "test_s5",
        "tenant_id": "DEFAULT_HOSPITAL",
        "user_query": "Can you show me my latest kidney blood lab results and eGFR?",
        "language": "en",
        "intent": "RECORDS_REQUEST",
        "is_emergency": False,
        "is_authenticated": False,
        "consent_given": True,
        "patient_id": None,
        "handoff_requested": False,
        "retrieved_chunks": [],
        "response_text": "",
        "disclaimer": "",
        "execution_steps": [],
        "latency_ms": 0.0
    }
    out = patient_policy_guard_node(state)
    assert "confidentiality requires verified patient authentication" in out["response_text"] or "sign in with your Patient ID" in out["response_text"]


def test_patient_auth_with_synthetic_ehr():
    session = patient_session_manager.create_session()
    auth_res = patient_session_manager.authenticate_patient(
        session_id=session.session_id,
        patient_id="P101",
        mrn="MRN-882190",
        consent_confirmed=True
    )
    assert auth_res["success"] is True
    assert auth_res["patient_name"] == "Eleanor Vance"
    
    # Verify session is now marked authenticated
    sess_obj = patient_session_manager.get_session(session.session_id)
    assert sess_obj.is_authenticated is True
    assert sess_obj.patient_id == "P101"


def test_patient_auth_invalid_mrn_rejected():
    session = patient_session_manager.create_session()
    with pytest.raises(ValueError, match="MRN does not match"):
        patient_session_manager.authenticate_patient(
            session_id=session.session_id,
            patient_id="P101",
            mrn="WRONG_MRN_9999",
            consent_confirmed=True
        )


def test_human_handoff_lifecycle():
    # 1. Create handoff request
    req = handoff_manager.create_request(
        tenant_id="DEFAULT_HOSPITAL",
        session_id="SESS_TEST_HO",
        user_query="Patient having dizziness after starting blood pressure pill",
        reason="Dizziness review requested",
        urgency=HandoffUrgency.MEDIUM
    )
    assert req.status == HandoffStatus.REQUESTED

    # 2. Assign to clinician
    assigned = handoff_manager.assign_request(req.request_id, assigned_to="Dr. Marcus Bell, MD")
    assert assigned.status == HandoffStatus.ASSIGNED
    assert assigned.assigned_to == "Dr. Marcus Bell, MD"

    # 3. Transition to IN_REVIEW
    in_review = handoff_manager.update_status(req.request_id, status=HandoffStatus.IN_REVIEW, notes="Called patient.")
    assert in_review.status == HandoffStatus.IN_REVIEW
    assert in_review.notes == "Called patient."

    # 4. Resolve
    resolved = handoff_manager.update_status(req.request_id, status=HandoffStatus.RESOLVED)
    assert resolved.status == HandoffStatus.RESOLVED
    assert resolved.resolved_at is not None


def test_patient_session_consent_withdrawal_deletion():
    session = patient_session_manager.create_session()
    sid = session.session_id
    assert patient_session_manager.get_session(sid) is not None

    # Withdraw consent and delete
    deleted = patient_session_manager.delete_session(sid)
    assert deleted is True
    assert patient_session_manager.get_session(sid) is None


def test_tenant_domain_verification():
    # DEFAULT_HOSPITAL allows "*"
    assert tenant_manager.verify_origin("DEFAULT_HOSPITAL", "https://hospital.org") is True

    # Custom tenant with restricted domains
    tenant_manager.create_tenant({
        "tenant_id": "TEST_CLINIC",
        "name": "Strict Domain Clinic",
        "domains": ["strictclinic.com", "api.strictclinic.com"]
    })

    assert tenant_manager.verify_origin("TEST_CLINIC", "https://strictclinic.com/portal") is True
    assert tenant_manager.verify_origin("TEST_CLINIC", "https://unauthorized-attacker.com") is False


def test_patient_retrieval_isolation():
    # Search with access_level="PATIENT_APPROVED"
    patient_chunks = hybrid_retriever.search_hybrid(
        query="metformin kidney",
        top_k=5,
        access_level="PATIENT_APPROVED"
    )
    # Check that any retrieved chunk has access_level PATIENT_APPROVED
    for chunk in patient_chunks:
        assert chunk.access_level == "PATIENT_APPROVED"


def test_specialist_matching_and_crag_scoring():
    from app.patient.specialists import match_specialists_for_query

    # 1. Test Dermatology match
    derm_results = match_specialists_for_query(
        query="I have an itchy red rash on my arm for two weeks",
        tenant_id="CLINIC_DHAKA"
    )
    assert len(derm_results) > 0
    assert "Dermatology" in derm_results[0]["department"]
    assert derm_results[0]["consultation_fee"] == 1200
    assert derm_results[0]["currency"] == "BDT"
    assert derm_results[0]["relevance_score"] >= 0.70

    # 2. Test Neurology match
    neuro_results = match_specialists_for_query(
        query="Severe recurring migraines with vision sensitivity",
        tenant_id="DEFAULT_HOSPITAL"
    )
    assert len(neuro_results) > 0
    assert "Neurology" in neuro_results[0]["department"]
    assert neuro_results[0]["currency"] == "USD"
    assert neuro_results[0]["relevance_score"] >= 0.70

    # 3. Test Full Turn Integration with Specialist Routing
    session = patient_session_manager.create_session(tenant_id="CLINIC_DHAKA")
    turn_res = execute_patient_turn(
        session_id=session.session_id,
        user_query="I have an itchy red rash on my arm for two weeks",
        tenant_id="CLINIC_DHAKA",
        language="en"
    )
    assert len(turn_res.get("recommended_specialists", [])) > 0
    assert "Dermatology" in turn_res["recommended_specialists"][0]["department"]
    assert turn_res["agentic_trace"]["crag_specialist_match_count"] > 0
    assert turn_res["agentic_trace"]["emergency_screened"] is True
