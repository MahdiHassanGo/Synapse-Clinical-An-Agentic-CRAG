"""
Deterministic tests for Pharmacovigilance and Contraindications Knowledge Engine.
"""
from app.core.models import ClinicalSeverity
from app.pharmacovigilance.engine import pharmacovigilance_engine


def test_detect_warfarin_nsaid_fatal_bleed():
    alerts = pharmacovigilance_engine.check_contraindications(
        proposed_drugs=["Ibuprofen"],
        active_medications=["Warfarin", "Metoprolol"],
        known_allergies=[],
        conditions=["Atrial Fibrillation"]
    )
    assert len(alerts) >= 1
    fatal_alert = next((a for a in alerts if a.severity == ClinicalSeverity.FATAL), None)
    assert fatal_alert is not None
    assert "Warfarin" in fatal_alert.drug_a or "Warfarin" in fatal_alert.drug_b
    assert fatal_alert.action_required == "HALT_PRESCRIPTION"


def test_detect_metformin_renal_contraindication():
    alerts = pharmacovigilance_engine.check_contraindications(
        proposed_drugs=[],
        active_medications=["Metformin", "Lisinopril"],
        known_allergies=[],
        conditions=["Type 2 Diabetes", "CKD Stage 4"],
        egfr_value=22.4
    )
    contra_alert = next((a for a in alerts if a.severity == ClinicalSeverity.CONTRAINDICATED), None)
    assert contra_alert is not None
    assert "Metformin" in contra_alert.drug_a
    assert "Lactic Acidosis" in contra_alert.mechanism


def test_detect_penicillin_anaphylaxis_cross_reactivity():
    alerts = pharmacovigilance_engine.check_contraindications(
        proposed_drugs=["Amoxicillin", "Cephalexin"],
        active_medications=[],
        known_allergies=["Penicillin (Anaphylaxis)"],
        conditions=["Pneumonia"]
    )
    assert len(alerts) >= 1
    anaph_alert = next((a for a in alerts if a.severity == ClinicalSeverity.FATAL), None)
    assert anaph_alert is not None
    assert "anaphylaxis" in anaph_alert.mechanism.lower()
