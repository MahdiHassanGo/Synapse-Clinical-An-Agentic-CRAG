"""
Deterministic tests for clinical calculators.
Validates CKD-EPI 2021 race-free eGFR, Cockcroft-Gault CrCl, and BMI/BSA formulas.
"""
import pytest
from app.ehr.calculators import (
    calculate_egfr_ckd_epi_2021,
    calculate_creatinine_clearance_cockcroft_gault,
    calculate_bmi_and_bsa
)


def test_egfr_female_high_creatinine():
    """Eleanor Vance (P101): 72F, Scr = 2.4 mg/dL -> expected severe reduction (G4)."""
    res = calculate_egfr_ckd_epi_2021(serum_creatinine_mg_dl=2.4, age=72, gender="Female")
    assert 20.0 <= res.computed_value <= 26.0
    assert "G4" in res.clinical_interpretation
    assert res.unit == "mL/min/1.73m²"


def test_egfr_male_normal_creatinine():
    """Arthur Pendleton (P102): 75M, Scr = 1.1 mg/dL -> expected mild reduction (G2)."""
    res = calculate_egfr_ckd_epi_2021(serum_creatinine_mg_dl=1.1, age=75, gender="Male")
    assert 60.0 <= res.computed_value <= 75.0
    assert "G2" in res.clinical_interpretation


def test_egfr_invalid_inputs():
    with pytest.raises(ValueError):
        calculate_egfr_ckd_epi_2021(-1.0, 50, "Male")
    with pytest.raises(ValueError):
        calculate_egfr_ckd_epi_2021(1.0, -5, "Female")


def test_cockcroft_gault_crcl():
    """Verify standard Cockcroft-Gault formula and female 0.85 scaling."""
    # 72F, 68kg, Scr 2.4
    res = calculate_creatinine_clearance_cockcroft_gault(2.4, 72, 68.0, "Female")
    expected = ((140 - 72) * 68.0) / (72.0 * 2.4) * 0.85
    assert abs(res.computed_value - round(expected, 1)) < 0.1
    assert "Moderate" in res.clinical_interpretation or "Severe" in res.clinical_interpretation


def test_bmi_and_bsa_mosteller():
    """Verify BMI and Mosteller BSA."""
    res = calculate_bmi_and_bsa(weight_kg=80.0, height_cm=180.0)
    # 80 / (1.8^2) = 24.69
    assert res.computed_value == 24.7
    assert "Normal weight" in res.clinical_interpretation
    assert "bsa_m2" in res.inputs_used
    assert 1.9 <= res.inputs_used["bsa_m2"] <= 2.1
