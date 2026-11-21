# Build & Verification Report — Synapse Clinical v4.1

**Generated**: November 21, 2026  
**Version**: 3.1.0  
**Test Suite**: 43 Passed, 0 Failed, 0 Skipped (100% Pass Rate)  
**Execution Time**: 8.37 seconds  

---

## 1. System Environment & Toolchains

| Component | Target Version | Runtime Detected | Status |
| :--- | :--- | :--- | :--- |
| **Python** | 3.11+ / 3.13 | Python 3.13.5 | ✅ Verified |
| **Node.js / Bun** | Node 20+ / Bun 1.2+ | Bun 1.4.2 | ✅ Verified |
| **Next.js** | 15.5.29 | Next.js 15.5.29 | ✅ Verified |
| **PyTorch / SentenceTransformers** | 2.5+ / 3.4+ | PyTorch 2.5.1 / ST 3.4.1 | ✅ Verified |
| **FlashRank ONNX** | 0.2.9+ | FlashRank 0.2.9 | ✅ Verified |
| **PostgreSQL / pgvector** | PG 16 + pgvector | Configured & SQLite fallback verified | ✅ Verified |

---

## 2. Deterministic Automated Test Results

The backend test suite was executed using `pytest` in strict test isolation:

```bash
source .venv/bin/activate && PYTHONPATH=backend pytest backend/tests/ -v
```

### Full Test Execution Log

```
backend/tests/test_api.py::test_health_endpoint PASSED                           [  2%]
backend/tests/test_api.py::test_list_patients_endpoint PASSED                    [  4%]
backend/tests/test_api.py::test_get_patient_details PASSED                       [  6%]
backend/tests/test_api.py::test_guidelines_endpoint PASSED                       [  9%]
backend/tests/test_api.py::test_sync_triage_run_endpoint PASSED                  [ 11%]
backend/tests/test_api.py::test_hitl_override_endpoint PASSED                    [ 13%]
backend/tests/test_calculators.py::test_egfr_female_high_creatinine PASSED        [ 16%]
backend/tests/test_calculators.py::test_egfr_male_normal_creatinine PASSED        [ 18%]
backend/tests/test_calculators.py::test_egfr_invalid_inputs PASSED               [ 20%]
backend/tests/test_calculators.py::test_cockcroft_gault_crcl PASSED              [ 23%]
backend/tests/test_calculators.py::test_bmi_and_bsa_mosteller PASSED             [ 25%]
backend/tests/test_crag_self_rag.py::test_crag_grading_filters_irrelevant_chunks PASSED [ 27%]
backend/tests/test_crag_self_rag.py::test_query_rewriter_fallback PASSED         [ 30%]
backend/tests/test_crag_self_rag.py::test_self_rag_critique_evaluates_citations PASSED [ 32%]
backend/tests/test_fhir.py::test_fhir_parser PASSED                              [ 34%]
backend/tests/test_fhir.py::test_fhir_import_and_export PASSED                   [ 37%]
backend/tests/test_fhir.py::test_fhir_invalid_bundle PASSED                      [ 39%]
backend/tests/test_pharmacovigilance.py::test_detect_warfarin_nsaid_fatal_bleed PASSED [ 41%]
backend/tests/test_pharmacovigilance.py::test_detect_metformin_renal_contraindication PASSED [ 44%]
backend/tests/test_pharmacovigilance.py::test_detect_penicillin_anaphylaxis_cross_reactivity PASSED [ 46%]
backend/tests/test_retrieval.py::test_hierarchical_parent_child_chunking PASSED  [ 48%]
backend/tests/test_retrieval.py::test_hybrid_search_exact_keyword_and_semantic_boost PASSED [ 51%]
backend/tests/test_retrieval.py::test_hybrid_search_warfarin_bleeding PASSED     [ 53%]
backend/tests/test_sql_guard.py::test_valid_select_query PASSED                  [ 55%]
backend/tests/test_sql_guard.py::test_block_drop_table PASSED                    [ 58%]
backend/tests/test_sql_guard.py::test_block_insert_mutation PASSED               [ 60%]
backend/tests/test_sql_guard.py::test_block_unauthorized_system_table PASSED     [ 62%]
backend/tests/test_sql_guard.py::test_block_multi_statement_injection PASSED     [ 65%]
backend/tests/test_sql_guard.py::test_deterministic_text_to_sql_generation PASSED [ 67%]
backend/tests/test_upgraded_features.py::test_circuit_breaker_logic PASSED       [ 69%]
backend/tests/test_upgraded_features.py::test_deterministic_task_guards PASSED   [ 72%]
backend/tests/test_upgraded_features.py::test_neural_cross_encoder_rerank PASSED [ 74%]
backend/tests/test_upgraded_features.py::test_claim_level_entailment_and_contradiction PASSED [ 76%]
backend/tests/test_upgraded_features.py::test_knowledge_base_document_management PASSED [ 79%]
backend/tests/test_upgraded_features.py::test_rag_evaluation_benchmark_metrics PASSED [ 81%]
backend/tests/test_upgraded_features.py::test_run_manager_and_hitl_resumption PASSED [ 83%]
backend/tests/test_upgraded_features.py::test_ssrf_protection_in_url_ingest PASSED [ 86%]
backend/tests/test_upgraded_features.py::test_pdf_upload_validation PASSED       [ 88%]
backend/tests/test_upgraded_features.py::test_embedding_engine PASSED            [ 90%]
backend/tests/test_upgraded_features.py::test_crag_abstention_on_unsupported_interventions PASSED [ 93%]
backend/tests/test_workflow_e2e.py::test_e2e_scenario_eleanor_vance_metformin_lactic_acidosis PASSED [ 95%]
backend/tests/test_workflow_e2e.py::test_e2e_scenario_arthur_pendleton_warfarin_nsaid_fatal_bleed PASSED [ 97%]
backend/tests/test_workflow_e2e.py::test_e2e_scenario_chemotherapy_regulated_hitl_gate PASSED [100%]

======================= 43 passed, 13 warnings in 8.37s ========================
```

---

## 3. Frontend Production Build Verification

The Next.js 15.5.29 production frontend was built using Bun:

```bash
cd frontend && bun run build
```

### Build Output Summary

```
$ next build
   ▲ Next.js 15.5.29

   Creating an optimized production build ...
 ✓ Compiled successfully in 1439ms
   Linting and checking validity of types     ✓ Linting and checking validity of types 
   Collecting page data                       ✓ Collecting page data 
 ✓ Generating static pages (4/4)
   Collecting build traces                    ✓ Collecting build traces 
   Finalizing page optimization               ✓ Finalizing page optimization 

Route (app)                                 Size  First Load JS
┌ ○ /                                    23.7 kB         126 kB
└ ○ /_not-found                            994 B         104 kB
+ First Load JS shared by all             103 kB
  ├ chunks/255-73938ce8a8eac1ad.js       46.6 kB
  ├ chunks/4bd1b696-c023c6e3521b1417.js  54.2 kB
  └ other shared chunks (total)           1.9 kB

○  (Static)  prerendered as static content
```

**Result**: 0 TypeScript compilation errors, 0 ESLint violations, all routes prerendered.

---

## 4. Key Security & Engineering Validations

1. **Compromised Secret Remediation**:
   - Released archive strictly omits `.env`.
   - `.gitignore` and `.dockerignore` updated to block `.env`, `.env.*` (except `.env.example`), `.venv`, `node_modules`, and local SQLite database files.
2. **SSRF Blocking**:
   - `validate_url_safe` unit tested against loopback (`127.0.0.1`), hostname alias (`localhost`), private RFC1918 subnets (`10.0.0.1`), and AWS metadata IP (`169.254.169.254`). All blocked deterministically.
3. **Deterministic Missing Data Protocol**:
   - Queries lacking patient identifiers return structured missing-patient validation errors rather than fabricating records or falling back to `P101`.
4. **Deterministic Arithmetic Enforcement**:
   - Clinical calculators (CKD-EPI, Cockcroft-Gault, Mosteller BSA, BMI) and drug contraindications are hard-coded in pure Python with zero LLM routing permitted.
5. **CRAG Evidence Sufficiency**:
   - Fully tested against unsupported/homeopathic inquiries (`crystal healing`, `arnica`). System abstains from synthesizing therapeutic orders when evidence relevance remains below threshold.
