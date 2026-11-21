"""
Clinical Calculators for Synapse Clinical Copilot.
Clinically verified deterministic implementations for:
1. eGFR (CKD-EPI 2021 Race-Free formula)
2. Cockcroft-Gault Creatinine Clearance (CrCl)
3. Body Mass Index (BMI) & Body Surface Area (BSA - Mosteller)
"""
import math
from typing import Dict, Any
from app.core.models import ClinicalCalculationResult


def calculate_egfr_ckd_epi_2021(
    serum_creatinine_mg_dl: float,
    age: int,
    gender: str
) -> ClinicalCalculationResult:
    """
    2021 CKD-EPI Creatinine Equation (Race-Free):
    eGFR = 142 * min(Scr/kappa, 1)^alpha * max(Scr/kappa, 1)^(-1.200) * 0.9938^Age * (1.012 if female)
    where:
    kappa = 0.7 (female), 0.9 (male)
    alpha = -0.241 (female), -0.302 (male)
    """
    if serum_creatinine_mg_dl <= 0:
        raise ValueError("Serum creatinine must be positive")
    if age <= 0:
        raise ValueError("Age must be positive")

    is_female = gender.strip().lower() in ["female", "f"]
    kappa = 0.7 if is_female else 0.9
    alpha = -0.241 if is_female else -0.302
    female_factor = 1.012 if is_female else 1.0

    scr_over_kappa = serum_creatinine_mg_dl / kappa
    min_term = min(scr_over_kappa, 1.0) ** alpha
    max_term = max(scr_over_kappa, 1.0) ** (-1.200)
    age_factor = 0.9938 ** age

    egfr = 142.0 * min_term * max_term * age_factor * female_factor
    rounded_egfr = round(egfr, 1)

    # KDIGO CKD Staging
    if rounded_egfr >= 90:
        stage = "G1: Normal or high kidney function"
    elif rounded_egfr >= 60:
        stage = "G2: Mildly decreased"
    elif rounded_egfr >= 45:
        stage = "G3a: Mildly to moderately decreased"
    elif rounded_egfr >= 30:
        stage = "G3b: Moderately to severely decreased"
    elif rounded_egfr >= 15:
        stage = "G4: Severely decreased (High risk for drug accumulation)"
    else:
        stage = "G5: Kidney failure / End-stage renal disease (Dialysis indicated)"

    return ClinicalCalculationResult(
        calculator_name="eGFR (CKD-EPI 2021 Race-Free)",
        computed_value=rounded_egfr,
        unit="mL/min/1.73m²",
        clinical_interpretation=stage,
        inputs_used={
            "serum_creatinine_mg_dl": serum_creatinine_mg_dl,
            "age": age,
            "gender": "Female" if is_female else "Male"
        }
    )


def calculate_creatinine_clearance_cockcroft_gault(
    serum_creatinine_mg_dl: float,
    age: int,
    weight_kg: float,
    gender: str
) -> ClinicalCalculationResult:
    """
    Cockcroft-Gault Equation for CrCl:
    CrCl = ((140 - Age) * Weight_kg) / (72 * Scr_mg_dl) * (0.85 if female)
    Standard guideline standard for renal drug dosage adjustments (FDA/EMA).
    """
    if serum_creatinine_mg_dl <= 0 or age <= 0 or weight_kg <= 0:
        raise ValueError("Invalid parameters for Cockcroft-Gault equation")

    is_female = gender.strip().lower() in ["female", "f"]
    crcl = ((140 - age) * weight_kg) / (72.0 * serum_creatinine_mg_dl)
    if is_female:
        crcl *= 0.85

    rounded_crcl = round(crcl, 1)

    if rounded_crcl >= 90:
        interp = "Normal renal clearance (No dosage adjustment required)"
    elif rounded_crcl >= 60:
        interp = "Mild impairment: monitor renally cleared medications"
    elif rounded_crcl >= 30:
        interp = "Moderate impairment: 50% dose reduction for renally cleared drugs"
    elif rounded_crcl >= 15:
        interp = "Severe impairment: strict dose adjustments or alternative agents required"
    else:
        interp = "End-stage renal disease: contraindicated for most renally cleared drugs"

    return ClinicalCalculationResult(
        calculator_name="Cockcroft-Gault Creatinine Clearance (CrCl)",
        computed_value=rounded_crcl,
        unit="mL/min",
        clinical_interpretation=interp,
        inputs_used={
            "serum_creatinine_mg_dl": serum_creatinine_mg_dl,
            "age": age,
            "weight_kg": weight_kg,
            "gender": "Female" if is_female else "Male"
        }
    )


def calculate_bmi_and_bsa(
    weight_kg: float,
    height_cm: float
) -> ClinicalCalculationResult:
    """
    BMI = weight_kg / (height_m^2)
    BSA (Mosteller) = sqrt((height_cm * weight_kg) / 3600)
    """
    if weight_kg <= 0 or height_cm <= 0:
        raise ValueError("Weight and height must be strictly positive")

    height_m = height_cm / 100.0
    bmi = round(weight_kg / (height_m * height_m), 1)
    bsa = round(math.sqrt((height_cm * weight_kg) / 3600.0), 2)

    if bmi < 18.5:
        status = "Underweight"
    elif bmi < 25.0:
        status = "Normal weight"
    elif bmi < 30.0:
        status = "Overweight"
    elif bmi < 35.0:
        status = "Class I Obesity"
    elif bmi < 40.0:
        status = "Class II Obesity"
    else:
        status = "Class III Obesity (Severe/Morbid)"

    interp = f"BMI: {bmi} ({status}) | BSA: {bsa} m² (Used for chemo/narrow therapeutic index dosing)"

    return ClinicalCalculationResult(
        calculator_name="BMI & BSA (Mosteller)",
        computed_value=bmi,
        unit="kg/m²",
        clinical_interpretation=interp,
        inputs_used={
            "weight_kg": weight_kg,
            "height_cm": height_cm,
            "bsa_m2": bsa
        }
    )
