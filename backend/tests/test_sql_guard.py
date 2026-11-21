"""
Deterministic tests for SQL AST Security Guard.
Verifies sqlglot read-only enforcement, table access controls, and injection blocks.
"""
import pytest
from app.ehr.text_to_sql import text_to_sql_engine, SQLSecurityViolation


def test_valid_select_query():
    sql = "SELECT patient_id, mrn, first_name FROM patients WHERE age > 65"
    sanitized = text_to_sql_engine.validate_ast(sql)
    assert "SELECT" in sanitized
    assert "LIMIT" in sanitized


def test_block_drop_table():
    sql = "DROP TABLE patients"
    with pytest.raises(SQLSecurityViolation) as exc:
        text_to_sql_engine.validate_ast(sql)
    assert "Forbidden SQL operation detected" in str(exc.value)


def test_block_insert_mutation():
    sql = "INSERT INTO patients (patient_id, mrn) VALUES ('P999', 'HACK')"
    with pytest.raises(SQLSecurityViolation) as exc:
        text_to_sql_engine.validate_ast(sql)
    assert "Forbidden SQL operation detected" in str(exc.value)


def test_block_unauthorized_system_table():
    sql = "SELECT * FROM sqlite_master"
    with pytest.raises(SQLSecurityViolation) as exc:
        text_to_sql_engine.validate_ast(sql)
    assert "unauthorized table" in str(exc.value)


def test_block_multi_statement_injection():
    sql = "SELECT * FROM patients; DROP TABLE encounters;"
    with pytest.raises(SQLSecurityViolation) as exc:
        text_to_sql_engine.validate_ast(sql)
    assert "Multi-statement" in str(exc.value)


def test_deterministic_text_to_sql_generation():
    res = text_to_sql_engine.execute_safe_query("Check lab results for P101", patient_id="P101")
    assert res["row_count"] > 0
    assert any("CREAT" in str(row) for row in res["data"])
