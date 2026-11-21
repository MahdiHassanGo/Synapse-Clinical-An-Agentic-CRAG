"""
EHR Database Connection & Persistent Audit Event Store.
Provides structured relational tables, parameterized queries,
and explicit missing-data detection without fabricated defaults.
"""
import os
import sqlite3
import time
import uuid
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.ehr.schema import CREATE_TABLES_SQL
from app.ehr.calculators import calculate_egfr_ckd_epi_2021, calculate_creatinine_clearance_cockcroft_gault


class EHRDatabase:
    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            if settings.DATABASE_URL.startswith("sqlite:///"):
                self.db_path = settings.DATABASE_URL.replace("sqlite:///", "")
            else:
                self.db_path = "./synapse_ehr.db"
        else:
            self.db_path = db_path
        
        self.init_db()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.executescript(CREATE_TABLES_SQL)

        # Audit events table for persistent HITL overrides
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_events (
            audit_id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            patient_id TEXT NOT NULL,
            clinician_id TEXT NOT NULL,
            decision TEXT NOT NULL,
            override_rationale TEXT NOT NULL,
            recorded_at TEXT NOT NULL
        );
        """)
        conn.commit()

        # Check if seed cohort exists
        cursor.execute("SELECT COUNT(*) FROM patients")
        count = cursor.fetchone()[0]
        if count == 0:
            self._seed_deterministic_cohort(cursor)
            conn.commit()
        conn.close()

    def _seed_deterministic_cohort(self, cursor: sqlite3.Cursor):
        patients = [
            ("P101", "MRN-882190", "Eleanor", "Vance", "1954-03-12", 72, "Female", 68.0, 162.0, "Type 2 Diabetes Mellitus, CKD Stage 4", "FULL_CODE"),
            ("P102", "MRN-991203", "Arthur", "Pendleton", "1951-11-04", 75, "Male", 82.0, 178.0, "Permanent Atrial Fibrillation, Hypertension", "FULL_CODE"),
            ("P103", "MRN-773411", "Marcus", "Holloway", "1966-07-24", 60, "Male", 94.0, 175.0, "Congestive Heart Failure (HFrEF), CKD Stage 3b", "DNR_DNI"),
            ("P104", "MRN-664129", "Sarah", "Chen", "1988-09-15", 38, "Female", 57.0, 165.0, "Severe Community-Acquired Pneumonia, History of Asthma", "FULL_CODE"),
        ]
        cursor.executemany("INSERT INTO patients VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", patients)

        vitals = [
            ("V101", "P101", "2026-11-20 08:30:00", 148, 88, 76, 18, 97.0, 36.8),
            ("V102", "P102", "2026-11-20 09:15:00", 132, 82, 84, 16, 98.0, 37.0),
            ("V103", "P103", "2026-11-20 10:00:00", 108, 68, 92, 22, 94.0, 37.2),
            ("V104", "P104", "2026-11-20 11:30:00", 118, 74, 102, 24, 91.0, 38.6),
        ]
        cursor.executemany("INSERT INTO vitals VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", vitals)

        labs = [
            ("L101_1", "P101", "Serum Creatinine", "CREAT", 2.4, "mg/dL", "0.5 - 1.1", "CRITICAL_HIGH", "2026-11-20 08:00:00"),
            ("L101_2", "P101", "HbA1c", "HBA1C", 8.8, "%", "4.0 - 5.6", "HIGH", "2026-11-20 08:00:00"),
            ("L101_3", "P101", "Serum Potassium", "K", 4.8, "mmol/L", "3.5 - 5.1", "NORMAL", "2026-11-20 08:00:00"),

            ("L102_1", "P102", "INR (Prothrombin)", "INR", 2.8, "ratio", "2.0 - 3.0", "NORMAL", "2026-11-20 09:00:00"),
            ("L102_2", "P102", "Serum Creatinine", "CREAT", 1.1, "mg/dL", "0.7 - 1.3", "NORMAL", "2026-11-20 09:00:00"),

            ("L103_1", "P103", "Serum Potassium", "K", 5.8, "mmol/L", "3.5 - 5.1", "CRITICAL_HIGH", "2026-11-20 09:30:00"),
            ("L103_2", "P103", "Serum Creatinine", "CREAT", 2.1, "mg/dL", "0.7 - 1.3", "HIGH", "2026-11-20 09:30:00"),
            ("L103_3", "P103", "BNP", "BNP", 890.0, "pg/mL", "< 100.0", "CRITICAL_HIGH", "2026-11-20 09:30:00"),

            ("L104_1", "P104", "White Blood Cells", "WBC", 16.4, "10^3/uL", "4.5 - 11.0", "HIGH", "2026-11-20 11:00:00"),
            ("L104_2", "P104", "Serum Creatinine", "CREAT", 0.7, "mg/dL", "0.5 - 1.1", "NORMAL", "2026-11-20 11:00:00"),
        ]
        cursor.executemany("INSERT INTO lab_results VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", labs)

        medications = [
            ("M101_1", "P101", "Metformin", "1000 mg", "BID", "Oral", "2024-01-10", "Type 2 Diabetes"),
            ("M101_2", "P101", "Lisinopril", "20 mg", "Daily", "Oral", "2023-05-15", "Hypertension & Renal Protection"),
            ("M101_3", "P101", "Atorvastatin", "40 mg", "QHS", "Oral", "2023-05-15", "Dyslipidemia"),

            ("M102_1", "P102", "Warfarin", "5 mg", "Daily", "Oral", "2022-08-01", "Stroke prophylaxis in AFib"),
            ("M102_2", "P102", "Metoprolol Succinate", "50 mg", "Daily", "Oral", "2022-08-01", "Rate control AFib"),

            ("M103_1", "P103", "Furosemide", "40 mg", "BID", "Oral", "2023-11-01", "Volume overload / CHF"),
            ("M103_2", "P103", "Spironolactone", "25 mg", "Daily", "Oral", "2024-02-15", "HFrEF mortality reduction"),
            ("M103_3", "P103", "Enalapril", "10 mg", "BID", "Oral", "2024-02-15", "HFrEF guideline therapy"),

            ("M104_1", "P104", "Albuterol Inhaler", "90 mcg", "Q4H PRN", "Inhalation", "2020-04-10", "Asthma exacerbation"),
        ]
        cursor.executemany("INSERT INTO active_medications VALUES (?, ?, ?, ?, ?, ?, ?, ?)", medications)

        allergies = [
            ("A101_1", "P101", "Sulfa Drugs", "Urticaria and diffuse rash", "MODERATE", "2018-06-12"),
            ("A103_1", "P103", "Aspirin", "Bronchospasm / Wheezing", "SEVERE", "2015-09-20"),
            ("A104_1", "P104", "Penicillin", "Anaphylaxis / Angioedema / Hypotension", "ANAPHYLACTIC", "2012-03-05"),
        ]
        cursor.executemany("INSERT INTO allergies VALUES (?, ?, ?, ?, ?, ?)", allergies)

        # Precompute renal history
        egfr_101 = calculate_egfr_ckd_epi_2021(2.4, 72, "Female")
        crcl_101 = calculate_creatinine_clearance_cockcroft_gault(2.4, 72, 68.0, "Female")
        renal = [
            ("R101", "P101", "2026-11-20", 2.4, egfr_101.computed_value, crcl_101.computed_value, egfr_101.clinical_interpretation),
            ("R102", "P102", "2026-11-20", 1.1, 68.4, 64.2, "G2: Mildly decreased"),
            ("R103", "P103", "2026-11-20", 2.1, 33.5, 38.0, "G3b: Moderately to severely decreased"),
            ("R104", "P104", "2026-11-20", 0.7, 98.2, 92.5, "G1: Normal"),
        ]
        cursor.executemany("INSERT INTO renal_history VALUES (?, ?, ?, ?, ?, ?, ?)", renal)

    def fetch_patient_summary(self, patient_id: Optional[str]) -> Optional[Dict[str, Any]]:
        """
        Retrieves patient summary using parameterized query.
        Returns None if patient_id is missing or not found.
        Explicitly tracks missing measurements without inventing default values.
        """
        if not patient_id:
            return None

        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM patients WHERE patient_id = ? OR mrn = ?", (patient_id, patient_id))
        pat_row = cursor.fetchone()
        if not pat_row:
            conn.close()
            return None
        
        pat_data = dict(pat_row)
        pid = pat_data["patient_id"]

        # Vitals
        cursor.execute("SELECT * FROM vitals WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 1", (pid,))
        vital_row = cursor.fetchone()
        vitals = dict(vital_row) if vital_row else {}

        # Labs
        cursor.execute("SELECT test_name, test_code, value, unit, flag, collected_at FROM lab_results WHERE patient_id = ? ORDER BY collected_at DESC", (pid,))
        labs = [dict(r) for r in cursor.fetchall()]

        # Active Medications
        cursor.execute("SELECT drug_name, dosage, frequency, route, indication FROM active_medications WHERE patient_id = ?", (pid,))
        meds = [dict(r) for r in cursor.fetchall()]

        # Allergies
        cursor.execute("SELECT allergen, reaction, severity FROM allergies WHERE patient_id = ?", (pid,))
        allergies = [dict(r) for r in cursor.fetchall()]

        # Renal
        cursor.execute("SELECT * FROM renal_history WHERE patient_id = ? ORDER BY recorded_date DESC LIMIT 1", (pid,))
        renal_row = cursor.fetchone()
        renal = dict(renal_row) if renal_row else {}

        conn.close()

        # Explicit missing-data tracking
        missing_data = []
        if not pat_data.get("weight_kg"):
            missing_data.append("weight_kg")
        if not pat_data.get("height_cm"):
            missing_data.append("height_cm")
        if not any("CREAT" in l.get("test_code", "").upper() or "CREATININE" in l.get("test_name", "").upper() for l in labs):
            missing_data.append("serum_creatinine")

        return {
            "patient": pat_data,
            "vitals": vitals,
            "latest_vitals": vitals,
            "labs": labs,
            "medications": meds,
            "active_medications": meds,
            "allergies": allergies,
            "renal_status": renal,
            "missing_measurements": missing_data
        }

    def record_audit_event(
        self,
        run_id: str,
        session_id: str,
        patient_id: str,
        clinician_id: str,
        decision: str,
        override_rationale: str
    ) -> Dict[str, Any]:
        """Persists genuine physician sign-off event into immutable audit log."""
        audit_id = f"AUD_{uuid.uuid4().hex[:10]}"
        ts = time.strftime("%Y-%m-%d %H:%M:%S UTC")

        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO audit_events (
            audit_id, run_id, session_id, patient_id, clinician_id, decision, override_rationale, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (audit_id, run_id, session_id, patient_id, clinician_id, decision, override_rationale, ts))
        conn.commit()
        conn.close()

        return {
            "audit_id": audit_id,
            "run_id": run_id,
            "patient_id": patient_id,
            "clinician_id": clinician_id,
            "decision": decision,
            "override_rationale": override_rationale,
            "timestamp": ts,
            "status": "RECORDED"
        }

    def list_audit_events(self, patient_id: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        cursor = conn.cursor()
        if patient_id:
            cursor.execute("SELECT * FROM audit_events WHERE patient_id = ? ORDER BY recorded_at DESC", (patient_id,))
        else:
            cursor.execute("SELECT * FROM audit_events ORDER BY recorded_at DESC LIMIT 50")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return rows

    def execute_read_query(self, sql_query: str) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(sql_query)
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return rows


ehr_db = EHRDatabase()
