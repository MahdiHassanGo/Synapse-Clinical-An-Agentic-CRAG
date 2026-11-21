"""
Integration tests for FastAPI REST and SSE streaming endpoints.
"""
from fastapi.testclient import TestClient
from app.api.main import app

client = TestClient(app)


def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["service"] == "Synapse Clinical Copilot"


def test_list_patients_endpoint():
    res = client.get("/api/patients")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] >= 4
    patient_ids = [p["patient_id"] for p in data["patients"]]
    assert "P101" in patient_ids
    assert "P102" in patient_ids


def test_get_patient_details():
    res = client.get("/api/patients/P101")
    assert res.status_code == 200
    data = res.json()
    assert data["patient"]["first_name"] == "Eleanor"
    assert len(data["labs"]) > 0
    assert len(data["active_medications"]) > 0


def test_guidelines_endpoint():
    res = client.get("/api/guidelines")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] >= 4
    doc_ids = [g["doc_id"] for g in data["guidelines"]]
    assert "NICE_NG28_DIABETES" in doc_ids


def test_sync_triage_run_endpoint():
    payload = {
        "query": "Assess acute pain management and bleeding risk for patient P102",
        "patient_id": "P102",
        "proposed_medications": ["Ibuprofen"]
    }
    res = client.post("/api/triage/run", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["patient_id"] == "P102"
    assert len(data["interaction_alerts"]) > 0
    assert data["hitl_gate"]["is_required"] is True
    assert data["self_rag_critique"]["is_supported"] is True


def test_hitl_override_endpoint():
    payload = {
        "session_id": "test-session-123",
        "patient_id": "P102",
        "clinician_id": "MD-4401",
        "approved": False,
        "override_rationale": "High fatal GI bleed risk confirmed with Warfarin. Withheld NSAID."
    }
    res = client.post("/api/triage/hitl/override", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["decision"] == "REJECTED_BY_PHYSICIAN"
    assert data["status"] == "RECORDED"
