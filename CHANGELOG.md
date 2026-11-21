# Changelog — Synapse Clinical

All notable changes to the Synapse Clinical project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [4.0.0] - 2026-11-21

### 🌟 Major Platform Milestone: Dual AI Experience
- **Patient Conversational AI Agent (`backend/app/patient/`)**: Public-facing website chatbot providing patient-safe health education, symptom collection, medication information, and clinic appointment routing.
- **Dedicated LangGraph Patient Workflow (`patient_graph.py` & `workflow.py`)**: 8-node state machine separating language detection, emergency screening, intent classification, policy enforcement, patient-approved retrieval, bilingual synthesis, and statutory disclaimer attachment.
- **Bilingual Bengali (বাংলা) & English Comprehension**: Deterministic Unicode detection (`\u0980-\u09FF`) enabling immediate localized responses in formal Bengali (`আপনি`) and plain English (6th-grade reading level). Localized emergency numbers converted to Bengali script (`৯৯৯` for Bangladesh national emergency hotline).
- **Red-Flag Emergency Detection & Hotline Dispatch**: Captures acute cardiovascular symptoms, respiratory failure, stroke signs, and anaphylaxis, branching directly to emergency instructions and localized hotlines (911 / 999).
- **Strict Non-Diagnostic & Non-Prescribing Policy**: Mathematical and prompt-level policy guards prevent the patient agent from diagnosing conditions, prescribing drugs, or modifying dosages. Every response appends a mandatory statutory disclaimer.

### 🏢 Multi-Tenant Architecture & Domain Allowlisting
- **Multi-Hospital Configuration (`backend/app/tenants/`)**: Built `TenantManager` with default tenants: `DEFAULT_HOSPITAL` (Synapse University Hospital, US, 911) and `CLINIC_DHAKA` (Dhaka Metropolitan Health Center, Bangladesh, 999).
- **Domain Verification & CORS Embedding Security**: Enforces HTTP `Origin` verification against tenant allowed domains (`domains` list) to prevent clickjacking and unauthorized widget embedding.
- **Access Level Knowledge Classification**: Document and chunk tables upgraded with `access_level` (`PATIENT_APPROVED` vs `CLINICIAN_ONLY`). Patient searches strictly isolate and filter candidate pools to approved public education sources.

### 🔌 Standalone Embeddable Chat Widget (`widget.js`)
- **Zero-Dependency Vanilla JavaScript Loader (`frontend/public/widget.js`)**: Can be embedded into any HTML, WordPress, Webflow, or Next.js website with a single `<script>` tag.
- **Features**: Floating responsive bubble, bilingual toggle (EN / বাংলা), 1-click emergency call button, nurse handoff request button, and privacy consent banner.

### 👩‍⚕️ Human Handoff Queue & Clinical Escalation
- **Stateful Lifecycle Management (`backend/app/patient/handoff_manager.py`)**: Tracks escalation tickets through `REQUESTED` $\rightarrow$ `WAITING` $\rightarrow$ `ASSIGNED` $\rightarrow$ `IN_REVIEW` $\rightarrow$ `RESOLVED` / `CANCELLED`.
- **Triage Dashboard (`HumanHandoffView.tsx`)**: Allows clinic triage staff and clinicians to search, filter by urgency, assign practitioners, and record clinical notes.

### 🖥️ Complete 12-Subsystem Frontend Platform
- **12 Integrated Navigation Views**:
  1. **Overview Dashboard** (`OverviewDashboard.tsx`): Real-time platform KPI metrics and quick-launch clinical benchmark scenarios.
  2. **Patient AI Agent** (`PatientChatView.tsx`): Interactive live demo with bilingual toggle, test prompts, auth modal, and operational telemetry.
  3. **Clinician Copilot** (`workspace`): 14-node LangGraph clinical decision workspace with EHR sidebar and DDI pharmacovigilance.
  4. **Knowledge Base** (`KnowledgeBaseView.tsx`): Document management with `PATIENT_APPROVED` vs `CLINICIAN_ONLY` badges.
  5. **Agent Runs** (`AgentRunsView.tsx`): Trace inspection and execution telemetry.
  6. **Model Orchestrator** (`SettingsView.tsx`): Routing plans, circuit breakers, and provider telemetry.
  7. **Human Support / Handoff** (`HumanHandoffView.tsx`): Staff queue for escalated inquiries.
  8. **RAG Evaluation** (`RAGEvaluationView.tsx`): Quantitative benchmarks (Recall@K, MRR, nDCG, Groundedness).
  9. **Tenant Management** (`TenantManagementView.tsx`): Multi-hospital configurations and emergency phone setup.
  10. **User & Role Management** (`UserManagementView.tsx`): RBAC for Admins, Clinicians, Nurses, and Patients.
  11. **Regulatory Audit Logs** (`AuditLogsView.tsx`): Immutable regulatory audit trail.
  12. **System Settings** (`SettingsView.tsx`): Platform configuration and API keys.

---

## [3.1.0] - 2026-11-21

### 🛡️ P0 Security & Regulatory Guardrails
- **Zero Exposed Credentials**: Removed active secrets from release archives; strictly excluded `.env` via `.gitignore` and `.dockerignore`. Enforced `.env.example` as canonical configuration template.
- **SSRF Protection in Knowledge Base Ingestion**: Implemented strict IP and protocol validation in `validate_url_safe` within `backend/app/ingestion/manager.py`. Blocks loopback (`127.0.0.1`, `::1`), RFC1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local IPs, and cloud metadata endpoints (`169.254.169.254`).
- **Binary Magic Bytes & Size Limits**: Hardened PDF upload pipeline to verify `%PDF-` binary magic bytes and enforced a deterministic 25 MB file size boundary.
- **Deterministic SQL Guardrails**: Eliminated hardcoded fallback to patient `P101`. Disallowed synthetic patient substitution when an inquiry lacks an explicit patient identifier. Queries requesting patient labs/meds without a patient ID now yield clear, actionable error feedback.

### 🧠 Core Agentic RAG Upgrades
- **Genuine Dense Semantic Embeddings**: Implemented `EmbeddingEngine` in `backend/app/retrieval/embeddings.py` featuring local `all-MiniLM-L6-v2` Sentence-Transformers with LiteLLM cloud embeddings fallback. Completely eliminated fake hash vectors.
- **Dual-Storage Vector Engine**: Upgraded `VectorStore` in `backend/app/retrieval/vector_store.py` to natively support PostgreSQL 16 with `pgvector` (HNSW indexing, cosine distance `<=>`, connection pooling) while preserving deterministic SQLite fallback for local development.
- **Neural Cross-Encoder Calibration**: Integrated FlashRank ONNX cross-encoder reranker (`ms-marco-TinyBERT-L-2-v2`) in `backend/app/retrieval/hybrid.py` and `backend/app/graph/nodes.py`. Calibrated candidate softmax outputs against candidate-set maximums to guarantee high precision for relevant evidence while preventing artificial score inflation for irrelevant noise queries.
- **CRAG Abstention & Insufficient Evidence Refusal**: Implemented `insufficient_evidence_node` and dynamic routing in `backend/app/graph/workflow.py`. When evidence relevance remains below 0.50 after two query reformulation loops, the agent explicitly abstains from clinical synthesis with a safety warning.
- **Claim-Level Self-RAG Evidence Verifier**: Upgraded `ClaimLevelSelfRAGVerifier` in `backend/app/evaluation/verifier.py` with structured claim decomposition, citation reference resolution down to specific parent/child chunks, and bidirectional natural language inference evaluation (`SUPPORTED`, `CONTRADICTED`, `UNSUPPORTED`). Contradictory statements immediately trigger a safety gate.

### ⚡ LangGraph Orchestration & Real-Time Telemetry
- **14-Node StateGraph Sequencing**: Completed full LangGraph compilation (`intent_router` -> `query_planner` -> `patient_context` -> `clinical_calculators` -> `pharmacovigilance` -> `hybrid_retriever` -> `cross_encoder_reranker` -> `crag_evaluator` -> conditional query rewriter / insufficient evidence / synthesis -> `claim_level_verifier` -> `safety_policy` -> conditional `hitl_interrupt` / `final_response`).
- **Genuine Human-in-the-Loop Interruption & Resumption**: Powered by `MemorySaver` checkpoints and thread-safe `RunManager`. Interrupted high-risk orders pause until a licensed clinician reviews contraindications and supplies an authenticated override rationale.
- **Real-Time Server-Sent Events (SSE)**: Converted `/api/triage/runs/{run_id}/events` to genuine async event streaming yielding live node execution checkpoints, tool metrics, and HITL interrupt events.

### 🌐 Synthetic FHIR R4 Ingestion & Export
- **FHIR R4 Adapter**: Created `backend/app/ehr/fhir.py` with structured parsers and converters for `Patient`, `Condition`, `Observation` (vital signs & lab results), `MedicationRequest`, and `AllergyIntolerance`.
- **Bi-Directional FHIR Endpoints**: Added `POST /api/ehr/fhir/import` for loading FHIR R4 collection bundles into relational tables, and `GET /api/ehr/fhir/patient/{patient_id}` for exporting patient charts as FHIR R4 JSON bundles.

### 📊 50-Item Clinical RAG Benchmark
- **Quantitative RAG Evaluation Suite**: Implemented `backend/app/evaluation/benchmark.py` running 50 rigorous clinical scenarios across 10 disease categories. Measures real Recall@K, Precision@K, Mean Reciprocal Rank (MRR), Normalized Discounted Cumulative Gain (nDCG@K), and Claim Groundedness.
- **Ablation Comparison**: Computes empirical comparative metrics across Sparse BM25 Alone, Dense Semantic Alone, Hybrid (BM25 + Dense RRF), and Full Pipeline (Hybrid + FlashRank + CRAG).

### 🖥️ Frontend & UI Polish (Unslop Applied)
- **Resolved Runtime TypeErrors**: Protected numeric metric calculations in `RAGEvaluationView.tsx` with safe fallback handling for `mean_ndcg_at_k`, `mean_mrr`, and groundedness metrics.
- **Streamlined Empty States**: Upgraded `AgentRunsView.tsx` to display an interactive 1-click Quick Launch benchmark panel when 0 runs are recorded.
- **Rigorous Provenance Inspection**: Removed arbitrary default chunk fallbacks in `GuidelineDrawer.tsx`; displays explicit warning banners for unresolved or ungrounded citations.
- **Unified Schema Naming**: Harmonized `chunk_count` / `section_count` and `parent_chunk_id` / `parent_id` between backend models and frontend TypeScript interfaces.
