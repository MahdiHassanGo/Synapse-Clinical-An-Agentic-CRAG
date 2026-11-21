# Synapse Clinical v4.1 — Master Remediation Plan & Platform Upgrade

This document establishes the exhaustive audit findings, vulnerability assessments, API contract synchronizations, architectural remediations, and verification protocols for **Synapse Clinical v4.1 — Multi-Model Agentic RAG Healthcare Platform with Patient Conversational AI**.

---

## 1. Executive Summary & Audit Matrix

| ID | Category | Affected File(s) | Severity | Core Defect / Requirement | Remediation & Upgrade Strategy | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Security / Secrets | `.env`, `.gitignore`, `.dockerignore` | **P0 (Critical)** | Risk of API keys in repository archives. | Exclude `.env` from git & zip archives, enforce `.env.example` placeholders, rotate sensitive keys. | Build script & archive inspection. |
| **SEC-02** | Security / SSRF | `backend/app/ingestion/manager.py` | **P0 (Critical)** | Risk of SSRF via URL ingestion targeting `localhost` / `169.254.169.254`. | Strict IP resolution check, block RFC 1918 private subnets and loopback addresses. | `test_ssrf_protection_in_url_ingest` unit tests. |
| **SEC-03** | Security / Isolation | `backend/app/retrieval/`, `backend/app/patient/` | **P0 (Critical)** | Patient queries could access confidential clinician strictures or EHR data. | Enforce `access_level="PATIENT_APPROVED"` filtering in dense & BM25 hybrid retrieval; isolate patient agent from EHR write/SQL tools. | `test_patient_retrieval_isolation` unit tests. |
| **BUG-01** | Runtime Crash | `backend/app/graph/nodes.py` | **P0 (Critical)** | Patientless queries crashed on missing `summary['patient']`. | Safe accessor utilities: `summary.get("patient") if summary else None`; patientless mode. | `test_sync_triage_run_endpoint` with `patient_id=None`. |
| **BUG-02** | Data Integrity | `backend/app/ehr/text_to_sql.py` | **P0 (Critical)** | Silent fallback to patient `P101` when patient unspecified. | Removed silent fallback. Return explicit validation messages when patient context is missing. | `test_deterministic_text_to_sql_generation`. |
| **BUG-03** | Agentic Workflow | `backend/app/graph/workflow.py` | **P0 (Critical)** | CRAG hallucinated on low-confidence evidence after max retries. | Added `insufficient_evidence_node` / abstention routing; recalibrated FlashRank prior threshold to 0.08. | `test_crag_abstention_on_unsupported_interventions`. |
| **PAT-01** | Multilingual AI | `backend/app/patient/nodes.py` | **P1 (High)** | English-only limitation; missing localized patient guidance for Bangladesh & US. | Built deterministic Unicode Bengali detection (`\u0980-\u09FF`) and bilingual prompts in pure Bengali and English. | `test_bilingual_language_detection`. |
| **PAT-02** | Clinical Safety | `backend/app/patient/nodes.py` | **P1 (High)** | Need for real-time emergency triage & localized hotlines. | Implemented red-flag keyword screening; branch to `emergency_node` with 911 / 999 hotline dispatch. | `test_emergency_screening_english` & `bengali`. |
| **PAT-03** | Privacy & Handoff | `backend/app/patient/` | **P1 (High)** | Need for right-to-be-forgotten and clinic triage escalation. | Implemented session deletion (`DELETE /chat/sessions/{id}`) and stateful handoff queue (`REQUESTED` -> `RESOLVED`). | `test_human_handoff_lifecycle` & `test_patient_session_consent_withdrawal_deletion`. |
| **WID-01** | Widget Integration| `frontend/public/widget.js` | **P1 (High)** | Need for 1-line embeddable widget on hospital websites & WordPress. | Built vanilla JS embeddable widget loader with bilingual switcher, emergency button, and consent banner. | Embedded widget test in browser / production build. |
| **TEN-01** | Multi-Tenancy | `backend/app/tenants/` | **P1 (High)** | Multi-hospital isolation, domain allowlisting, and custom branding. | Implemented `TenantManager`, default US/BD hospital configs, domain verification, and localized emergency hotlines. | `test_tenant_domain_verification`. |
| **UI-01**  | Frontend Platform | `frontend/app/page.tsx`, `components/` | **P1 (High)** | Navigation missing views for Patient Agent, Handoff Queue, Tenants, RBAC, and Audit Logs. | Expanded navigation to 12 platform subsystems with Overview Dashboard, Patient Agent, Handoff Queue, and Audit Logs. | Production build (`bun run build`) passed in 1820ms. |

---

## 2. Detailed Technical Remediation & Milestone Completion

### Milestone 1: P0 Security & Runtime Core
- [x] API key scrubbing and environment variable protection.
- [x] SSRF guard blocking RFC 1918, loopbacks, and AWS/GCP metadata (`169.254.169.254`).
- [x] Patientless query robustness and removal of silent `P101` fallbacks.
- [x] CRAG abstention protocol with calibrated neural cross-encoder thresholds.
- [x] Asynchronous run manager and SSE event streaming.

### Milestone 2: Multi-Tenant Architecture & Knowledge Classification
- [x] Implemented `TenantConfig` and `TenantManager` with default tenants: `DEFAULT_HOSPITAL` (US / 911) and `CLINIC_DHAKA` (BD / 999).
- [x] Origin allowlisting and CORS domain verification.
- [x] Added `access_level` (`CLINICIAN_ONLY` vs `PATIENT_APPROVED`) to `knowledge_documents` and `knowledge_chunks`.
- [x] Filtered dense semantic search and BM25 hybrid retrieval by `access_level`.

### Milestone 3: Patient Conversational AI & Safety State Machine
- [x] Dedicated LangGraph Patient Agent state machine (`PatientAgentState`).
- [x] Deterministic Bengali Unicode detection (`\u0980-\u09FF`) and pure Bengali / English generation.
- [x] Red-flag emergency screening for chest pain, dyspnea, stroke, and anaphylaxis with automatic hotline dispatch.
- [x] Strict non-diagnostic, non-prescribing policy guard appending mandatory statutory disclaimers.
- [x] Anonymous visitor mode vs authenticated patient mode with synthetic EHR credentialing.

### Milestone 4: Human Handoff Escalation Queue & Triage Dashboard
- [x] Stateful lifecycle transitions: `REQUESTED` -> `WAITING` -> `ASSIGNED` -> `IN_REVIEW` -> `RESOLVED` / `CANCELLED`.
- [x] Triage nurse & physician assignment with clinical notes.
- [x] REST endpoints for escalation filtering by status and urgency.

### Milestone 5: Standalone Embeddable Chat Widget (`widget.js`)
- [x] Standalone vanilla JavaScript widget in `frontend/public/widget.js`.
- [x] Configurable via `data-tenant-id`, `data-api-url`, `data-lang`, `data-theme`.
- [x] Responsive floating UI, bilingual toggle, emergency call button, and privacy consent banner.

### Milestone 6: Complete 12-Subsystem Frontend Architecture
- [x] Overview Dashboard (`OverviewDashboard.tsx`) with real-time KPI metrics and quick-launch scenarios.
- [x] Patient Conversational AI Demo (`PatientChatView.tsx`) with live chat, prompt presets, and telemetry.
- [x] Clinician Copilot Workspace (`ClinicalSynthesisView.tsx`, `PatientSidebar.tsx`, `AgentTraceStream.tsx`).
- [x] Knowledge Base with Access Policy badges (`KnowledgeBaseView.tsx`).
- [x] Human Handoff Queue Management (`HumanHandoffView.tsx`).
- [x] Multi-Tenant Administration (`TenantManagementView.tsx`).
- [x] Role-Based Access Control (`UserManagementView.tsx`).
- [x] Regulatory Audit Trail (`AuditLogsView.tsx`).
- [x] Model Orchestrator & Settings (`SettingsView.tsx`).
- [x] RAG Quantitative Benchmarking (`RAGEvaluationView.tsx`).

---

## 3. Definition of Done & Acceptance Gates
- [x] **100% of backend pytest test suites pass (55 / 55 tests in 11.26s)**.
- [x] **Frontend clean production build (`bun run build`) with zero TypeScript errors in 1820ms**.
- [x] **Zero secrets in repository, `.env` strictly quarantined**.
- [x] **Impermeable security boundary between public patient inquiries and private EHR records**.
- [x] **Clean release archive `Synapse_AI_v4.0.zip` ready for distribution**.
