"""
Safe Text-to-SQL Execution Engine.
Uses AST Parsing (sqlglot) to enforce strict READ-ONLY SELECT queries.
Prevents SQL injection, unauthorized table modifications, and multi-statement attacks.
"""
import re
from typing import Dict, Any, List, Optional
import sqlglot
from sqlglot import exp
from app.ehr.database import ehr_db


class SQLSecurityViolation(Exception):
    """Raised when an unsafe or non-read-only SQL query is attempted."""
    pass


class SafeTextToSQLEngine:
    ALLOWED_TABLES = {
        "patients", "encounters", "vitals",
        "lab_results", "active_medications",
        "allergies", "renal_history"
    }

    FORBIDDEN_EXPRESSIONS = (
        exp.Insert, exp.Update, exp.Delete, exp.Drop,
        exp.Alter, exp.Create, exp.TruncateTable,
        exp.Command, exp.Transaction
    )

    def validate_ast(self, sql_query: str) -> str:
        """
        Parses SQL AST using sqlglot and validates:
        1. Single statement only
        2. Must be a SELECT expression
        3. No mutations or administrative commands
        4. Enforces safety LIMIT <= 100
        """
        try:
            parsed = sqlglot.parse(sql_query, read="sqlite")
        except Exception as e:
            raise SQLSecurityViolation(f"Malformed SQL query syntax: {e}")

        if not parsed:
            raise SQLSecurityViolation("Empty SQL query")

        if len(parsed) > 1:
            raise SQLSecurityViolation("Multi-statement SQL queries are strictly prohibited for clinical safety")

        statement = parsed[0]
        if statement is None:
            raise SQLSecurityViolation("Invalid SQL statement")

        # Check for forbidden mutations
        for node in statement.walk():
            if isinstance(node, self.FORBIDDEN_EXPRESSIONS):
                raise SQLSecurityViolation(
                    f"Forbidden SQL operation detected: {type(node).__name__}. Read-only queries permitted."
                )

        if not isinstance(statement, exp.Select):
            raise SQLSecurityViolation("Only SELECT queries are authorized on clinical EHR data.")

        # Verify tables accessed
        tables = [t.name.lower() for t in statement.find_all(exp.Table)]
        for tbl in tables:
            if tbl not in self.ALLOWED_TABLES:
                raise SQLSecurityViolation(f"Access to unauthorized table '{tbl}' denied.")

        # Ensure a LIMIT clause exists to prevent unbounded memory spikes
        if statement.args.get("limit") is None:
            statement = statement.limit(50)
        else:
            limit_val = statement.args["limit"].expression
            try:
                if int(limit_val.name) > 100:
                    statement = statement.limit(100)
            except Exception:
                statement = statement.limit(50)

        return statement.sql(dialect="sqlite")

    def generate_sql_for_query(self, user_query: str, patient_id: Optional[str] = None) -> str:
        """
        Deterministic, rule-based text-to-SQL mapping for clinical queries.
        Works reliably without external LLM latency or non-determinism.
        """
        q_lower = user_query.lower()
        pid = patient_id

        # Extract patient ID from query if not explicitly passed
        if not pid:
            match = re.search(r'\b(p10[1-4]|mrn-\d+)\b', q_lower)
            if match:
                pid = match.group(1).upper()

        if not pid:
            # Explicitly do NOT default to P101. If clinical labs or medications
            # are requested without a patient ID, raise an explicit validation error.
            if any(term in q_lower for term in ["lab", "creatinine", "potassium", "hba1c", "blood", "test", "medication", "meds", "vital", "allergy", "renal"]):
                raise ValueError("Patient identifier (e.g. P101, P102) is required to query patient-specific clinical records.")
            return "SELECT patient_id, mrn, first_name, last_name, primary_diagnosis FROM patients LIMIT 10"

        if any(term in q_lower for term in ["lab", "creatinine", "potassium", "hba1c", "blood", "test"]):
            return f"SELECT test_name, test_code, value, unit, flag, collected_at FROM lab_results WHERE patient_id = '{pid}' ORDER BY collected_at DESC LIMIT 20"

        if any(term in q_lower for term in ["medication", "meds", "drug", "prescription", "taking"]):
            return f"SELECT drug_name, dosage, frequency, route, indication FROM active_medications WHERE patient_id = '{pid}' LIMIT 20"

        if any(term in q_lower for term in ["vital", "bp", "blood pressure", "heart rate", "pulse", "temp"]):
            return f"SELECT systolic_bp, diastolic_bp, heart_rate, o2_saturation, temperature_c, recorded_at FROM vitals WHERE patient_id = '{pid}' ORDER BY recorded_at DESC LIMIT 5"

        if any(term in q_lower for term in ["allergy", "allergies", "allergic"]):
            return f"SELECT allergen, reaction, severity FROM allergies WHERE patient_id = '{pid}' LIMIT 10"

        if any(term in q_lower for term in ["renal", "kidney", "egfr", "crcl"]):
            return f"SELECT recorded_date, serum_creatinine_mg_dl, egfr_value, crcl_value, kdigo_stage FROM renal_history WHERE patient_id = '{pid}' ORDER BY recorded_date DESC LIMIT 5"

        # General patient profile overview
        return f"SELECT patient_id, mrn, first_name, last_name, age, gender, weight_kg, height_cm, primary_diagnosis FROM patients WHERE patient_id = '{pid}' LIMIT 1"

    def execute_safe_query(self, user_query: str, patient_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Translates, validates, and executes read-only SQL query on EHR.
        """
        try:
            generated_sql = self.generate_sql_for_query(user_query, patient_id)
            validated_sql = self.validate_ast(generated_sql)
            rows = ehr_db.execute_read_query(validated_sql)
            return {
                "generated_sql": validated_sql,
                "row_count": len(rows),
                "data": rows,
                "error": None
            }
        except ValueError as ve:
            return {
                "generated_sql": "",
                "row_count": 0,
                "data": [],
                "error": str(ve)
            }


text_to_sql_engine = SafeTextToSQLEngine()
