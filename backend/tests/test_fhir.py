"""
Tests for Synthetic FHIR R4 Ingestion & Bi-Directional Export.
Validates:
- FHIR R4 Bundle parsing (Patient, Condition, Observation, MedicationRequest, AllergyIntolerance)
- Relational database ingestion
- Bi-directional FHIR R4 Bundle export
"""
import pytest
from app.ehr.fhir import FHIRParser, FHIRManager
from app.ehr.database import EHRDatabase


@pytest.fixture
def test_db(tmp_path):
    db_file = tmp_path / "test_fhir.db"
    return EHRDatabase(db_path=str(db_file))


@pytest.fixture
def sample_fhir_bundle():
    return {
        "resourceType": "Bundle",
        "type": "collection",
        "entry": [
            {
                "resource": {
                    "resourceType": "Patient",
                    "id": "P999",
                    "identifier": [
                        {"system": "http://hospital.example.org/mrn", "value": "MRN-999000"}
                    ],
                    "name": [
                        {"family": "Sinclair", "given": ["Julian"]}
                    ],
                    "gender": "male",
                    "birthDate": "1960-04-18",
                    "extension": [
                        {"url": "http://hl7.org/fhir/StructureDefinition/patient-weight", "valueQuantity": {"value": 85.5}},
                        {"url": "http://hl7.org/fhir/StructureDefinition/patient-height", "valueQuantity": {"value": 180.0}}
                    ]
                }
            },
            {
                "resource": {
                    "resourceType": "Condition",
                    "id": "COND_01",
                    "subject": {"reference": "Patient/P999"},
                    "code": {"text": "Non-ST-Elevation Myocardial Infarction"}
                }
            },
            {
                "resource": {
                    "resourceType": "Observation",
                    "id": "OBS_BP",
                    "subject": {"reference": "Patient/P999"},
                    "category": [{"coding": [{"code": "vital-signs"}]}],
                    "code": {"text": "Blood Pressure"},
                    "effectiveDateTime": "2026-11-20 14:00:00",
                    "component": [
                        {"code": {"coding": [{"code": "8480-6"}]}, "valueQuantity": {"value": 138}},
                        {"code": {"coding": [{"code": "8462-4"}]}, "valueQuantity": {"value": 86}}
                    ]
                }
            },
            {
                "resource": {
                    "resourceType": "Observation",
                    "id": "OBS_HR",
                    "subject": {"reference": "Patient/P999"},
                    "category": [{"coding": [{"code": "vital-signs"}]}],
                    "code": {"text": "Heart rate"},
                    "effectiveDateTime": "2026-11-20 14:00:00",
                    "valueQuantity": {"value": 78, "unit": "beats/min"}
                }
            },
            {
                "resource": {
                    "resourceType": "Observation",
                    "id": "OBS_CREAT",
                    "subject": {"reference": "Patient/P999"},
                    "category": [{"coding": [{"code": "laboratory"}]}],
                    "code": {"coding": [{"code": "CREAT"}], "text": "Serum Creatinine"},
                    "effectiveDateTime": "2026-11-20 14:00:00",
                    "valueQuantity": {"value": 1.4, "unit": "mg/dL"},
                    "referenceRange": [{"low": {"value": 0.7}, "high": {"value": 1.3}}],
                    "interpretation": [{"coding": [{"code": "HIGH"}]}]
                }
            },
            {
                "resource": {
                    "resourceType": "MedicationRequest",
                    "id": "MED_01",
                    "subject": {"reference": "Patient/P999"},
                    "medicationCodeableConcept": {"text": "Aspirin 81mg"},
                    "dosageInstruction": [{"text": "81 mg Once Daily", "route": {"coding": [{"display": "Oral"}]}}],
                    "reasonCode": [{"text": "Antiplatelet secondary prevention"}]
                }
            },
            {
                "resource": {
                    "resourceType": "AllergyIntolerance",
                    "id": "ALG_01",
                    "patient": {"reference": "Patient/P999"},
                    "code": {"text": "Penicillin V"},
                    "reaction": [{"manifestation": [{"text": "Urticaria"}], "severity": "severe"}]
                }
            }
        ]
    }


def test_fhir_parser(sample_fhir_bundle):
    parsed = FHIRParser.parse_bundle(sample_fhir_bundle)
    assert len(parsed["patients"]) == 1
    p = parsed["patients"][0]
    assert p["patient_id"] == "P999"
    assert p["first_name"] == "Julian"
    assert p["last_name"] == "Sinclair"
    assert p["weight_kg"] == 85.5
    assert p["height_cm"] == 180.0

    assert len(parsed["conditions"]) == 1
    assert "Myocardial Infarction" in parsed["conditions"][0]["diagnosis"]

    assert len(parsed["vitals"]) == 2
    assert len(parsed["labs"]) == 1
    assert parsed["labs"][0]["value"] == 1.4

    assert len(parsed["medications"]) == 1
    assert "Aspirin" in parsed["medications"][0]["drug_name"]

    assert len(parsed["allergies"]) == 1
    assert "Penicillin" in parsed["allergies"][0]["allergen"]


def test_fhir_import_and_export(test_db, sample_fhir_bundle):
    manager = FHIRManager(db=test_db)
    result = manager.import_bundle(sample_fhir_bundle)
    assert result["status"] == "success"
    assert result["imported_counts"]["patients"] == 1
    assert result["imported_counts"]["vitals"] >= 1
    assert result["imported_counts"]["labs"] == 1
    assert result["imported_counts"]["medications"] == 1
    assert result["imported_counts"]["allergies"] == 1

    # Verify queryable from DB
    summary = test_db.fetch_patient_summary("P999")
    assert summary is not None
    assert summary["patient"]["first_name"] == "Julian"
    assert summary["vitals"]["systolic_bp"] == 138
    assert summary["vitals"]["diastolic_bp"] == 86
    assert any(l["test_name"] == "Serum Creatinine" for l in summary["labs"])
    assert any("Aspirin" in m["drug_name"] for m in summary["medications"])
    assert any("Penicillin" in a["allergen"] for a in summary["allergies"])

    # Test export back to FHIR R4 Bundle
    exported_bundle = manager.export_patient_to_fhir("P999")
    assert exported_bundle["resourceType"] == "Bundle"
    assert exported_bundle["type"] == "collection"
    assert exported_bundle["total"] >= 5

    res_types = [e["resource"]["resourceType"] for e in exported_bundle["entry"]]
    assert "Patient" in res_types
    assert "Condition" in res_types
    assert "Observation" in res_types
    assert "MedicationRequest" in res_types
    assert "AllergyIntolerance" in res_types


def test_fhir_invalid_bundle():
    with pytest.raises(ValueError, match="resourceType must be 'Bundle'"):
        FHIRParser.parse_bundle({"resourceType": "Patient"})
