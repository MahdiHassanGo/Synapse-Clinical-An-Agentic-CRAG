"""
Structured EHR Relational Schema.
Unified relational tables for:
- patients
- encounters
- vitals
- lab_results
- active_medications
- allergies
- renal_history
"""

CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS patients (
    patient_id TEXT PRIMARY KEY,
    mrn TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    height_cm REAL NOT NULL,
    primary_diagnosis TEXT NOT NULL,
    code_status TEXT DEFAULT 'FULL_CODE'
);

CREATE TABLE IF NOT EXISTS encounters (
    encounter_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    admission_date TEXT NOT NULL,
    department TEXT NOT NULL,
    attending_physician TEXT NOT NULL,
    chief_complaint TEXT NOT NULL,
    status TEXT NOT NULL,
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE IF NOT EXISTS vitals (
    vital_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    systolic_bp INTEGER NOT NULL,
    diastolic_bp INTEGER NOT NULL,
    heart_rate INTEGER NOT NULL,
    respiratory_rate INTEGER NOT NULL,
    o2_saturation REAL NOT NULL,
    temperature_c REAL NOT NULL,
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE IF NOT EXISTS lab_results (
    lab_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    test_name TEXT NOT NULL,
    test_code TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    reference_range TEXT NOT NULL,
    flag TEXT, -- NORMAL, HIGH, LOW, CRITICAL
    collected_at TEXT NOT NULL,
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE IF NOT EXISTS active_medications (
    med_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    drug_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    route TEXT NOT NULL,
    start_date TEXT NOT NULL,
    indication TEXT NOT NULL,
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE IF NOT EXISTS allergies (
    allergy_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    allergen TEXT NOT NULL,
    reaction TEXT NOT NULL,
    severity TEXT NOT NULL, -- MILD, MODERATE, SEVERE, ANAPHYLACTIC
    identified_date TEXT NOT NULL,
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE IF NOT EXISTS renal_history (
    record_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    recorded_date TEXT NOT NULL,
    serum_creatinine_mg_dl REAL NOT NULL,
    egfr_value REAL NOT NULL,
    crcl_value REAL NOT NULL,
    kdigo_stage TEXT NOT NULL,
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);
"""
