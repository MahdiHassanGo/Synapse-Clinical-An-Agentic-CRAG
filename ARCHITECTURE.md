# System Architecture — Synapse Clinical v4.1

**Platform**: Synapse Clinical — Multi-Model Agentic RAG Healthcare Platform with Patient Conversational AI  
**Version**: 4.0.0  
**Compliance Standard**: Synthetic Healthcare Research & Portfolio Platform  

---

## 1. System Topology & Dual AI Experience

Synapse Clinical v4.1 operates two distinct AI environments with strict data, tool, and security isolation:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                             Next.js 15 Client Interface                                     │
│  [Overview] [Patient AI] [Clinician Copilot] [Knowledge] [Handoff Queue] [Agent Runs]       │
│  [Model Orchestrator] [RAG Evaluation] [Tenants] [User RBAC] [Audit Logs] [Settings]        │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                         HTTP REST / Live SSE  │ Embeddable widget.js
                                               │
┌──────────────────────────────────────────────▼──────────────────────────────────────────────┐
│                                   FastAPI Application Gateway                               │
│  Patient Routes (/api/v1/patient/*)   Clinician Routes (/api/triage/*)  Tenant Engine       │
│  Handoff Queue (/api/v1/handoff/*)    Knowledge Base (/api/knowledge/*) FHIR R4 Adapter     │
└───────────────────────┬──────────────────────────────────────────────┬──────────────────────┘
                        │                                              │
         [IMPERMEABLE SECURITY BOUNDARY]                [AUTHENTICATED ACCESS]
                        │                                              │
┌───────────────────────▼────────────────────────┐    ┌────────────────▼──────────────────────┐
│         Patient Conversational Agent           │    │          Clinician Copilot            │
│       (Public-Facing Website Chatbot)          │    │     (Decision Support Workspace)      │
│                                                │    │                                       │
│ 1. Language Detector (Bengali \u0980 vs EN)    │    │ 1. Intent Router & Query Planner      │
│ 2. Emergency Screening (Chest pain, stroke)    │    │ 2. Read-Only AST text_to_sql          │
│ 3. Intent Classifier (Meds, Clinic, Handoff)   │    │ 3. Deterministic Calculators (eGFR)   │
│ 4. Policy Guard (Blocks unauthorized EHR)      │    │ 4. Pharmacovigilance DDI Engine       │
│ 5. Patient-Approved Retrieval (PATIENT_APP)    │    │ 5. Hybrid Retrieval + FlashRank Rerank│
│ 6. Bilingual Generator (Polite, 6th-grade)     │    │ 6. Corrective RAG (CRAG) & Rewriter   │
│ 7. Statutory Safety Disclaimer                 │    │ 7. Claim-Level Self-RAG NLI Verifier  │
│ 8. Human Handoff Queue Integration             │    │ 8. Regulated HITL Interruption State  │
└───────────────────────┬────────────────────────┘    └────────────────┬──────────────────────┘
                        │                                              │
                        └───────────────────────┬──────────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────────────────────────────────┐
│                               Persistence & Multi-Tenancy                                   │
│  - Multi-Tenant Manager: DEFAULT_HOSPITAL (US 911) & CLINIC_DHAKA (BD 999)                  │
│  - Knowledge Base: access_level='PATIENT_APPROVED' vs 'CLINICIAN_ONLY'                      │
│  - Vector Store: PostgreSQL 16 + pgvector (HNSW cosine ops) & SQLite NumPy fallback         │
│  - Relational Storage: Synthea EHR tables (patients, vitals, labs, conditions, medications) │
│  - Regulatory Audit: Immutable HITL clinician sign-offs and patient consent logs            │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Dual LangGraph State Machines

### 2.1 Patient Conversational Agent (8 Nodes)
```
[User Inquiry]
      │
      ▼
1. language_detector ──────► Detects Bengali Unicode range (\u0980-\u09FF) or English
      │
      ▼
2. safety_screening ───────► Red-flag check (chest pain, severe dyspnea, stroke, anaphylaxis)
      │
      ├──────────────────► [If Acute Emergency] ──► emergency_router (911 / 999 hotline)
      ▼ [If Non-Emergency]                                   │
3. intent_classifier ──────► Classifies (Symptom, Medication, Clinic, Handoff, Records)
      │                                                       │
      ▼                                                       │
4. patient_policy_guard ───► Blocks unauthenticated EHR; queues human triage if requested
      │                                                       │
      ├──────────────────► [If Policy Override] ──────────────┤
      ▼ [If Educational Query]                                │
5. patient_retriever ──────► Retrieves strictly access_level='PATIENT_APPROVED' guidelines
      │                                                       │
      ▼                                                       │
6. patient_response_gen ───► Synthesizes empathetic 6th-grade educational answer
      │                                                       │
      ▼                                                       │
7. disclaimer_attachment ◄────────────────────────────────────┘
      │
      ▼ Appends localized statutory medical disclaimer
    [End]
```

### 2.2 Clinician Decision Support Copilot (14 Nodes)
```
[Clinician Inquiry]
      │
      ▼
1. intent_router ──────────► Decomposes inquiry into clinical routes (EHR, Literature, DDI, Calc)
      │
      ▼
2. query_planner ──────────► Parameterizes execution sequence and dependencies
      │
      ▼
3. patient_context ────────► Parameterized read-only AST text_to_sql against EHR tables
      │
      ▼
4. clinical_calculators ───► Deterministic formulas (CKD-EPI 2021 eGFR, Cockcroft-Gault, BSA, BMI)
      │
      ▼
5. pharmacovigilance ──────► Drug-drug, drug-disease, and drug-allergy contraindication checks
      │
      ▼
6. hybrid_retriever ───────► Dense vector search + Sparse BM25 + Reciprocal Rank Fusion
      │
      ▼
7. cross_encoder_rerank ───► FlashRank neural cross-encoder (prior threshold 0.08) + parent context
      │
      ▼
8. crag_evaluator ─────────► Evaluates evidence relevance ratio (0.0 to 1.0)
      │
      ├── [If Insufficient & retries remain] ──► 9. query_rewriter (Reformulates & re-retrieves)
      ├── [If Insufficient & retries exhausted]► 10. insufficient_evidence (Refuses to hallucinate)
      ▼ [If Evidence Confirmed]
11. clinical_synthesis ────► Synthesizes evidence-grounded recommendation
      │
      ▼
12. claim_level_verifier ──► Decomposes synthesis into claims; audits entailment vs citations
      │
      ▼
13. safety_policy ─────────► Flags regulated medications (Chemotherapy, Schedule II Narcotics)
      │
      ├── [If Regulated / High Risk] ──────────► 14. hitl_interrupt (Pauses until MD digital sign)
      ▼ [If Approved or Standard Care]
  [Final Response]
```

---

## 3. The 12 Frontend Platform Subsystems

| # | Subsystem | Component | Core Functionality |
| :---: | :--- | :--- | :--- |
| **1** | **Overview Dashboard** | `OverviewDashboard.tsx` | Platform executive view, KPI metrics, dual AI comparison, quick-launch benchmark scenarios. |
| **2** | **Patient Conversational AI** | `PatientChatView.tsx` | Live bilingual chatbot demo, emergency banner, patient auth modal, prompt presets, operational telemetry. |
| **3** | **Clinician Copilot** | `ClinicalSynthesisView.tsx` | Deep clinical workspace, EHR patient charts, multi-agent trace stream, DDI alerts, calculators. |
| **4** | **Knowledge Base** | `KnowledgeBaseView.tsx` | Document ingestion (PDF & URL), hierarchical chunk inspector, `PATIENT_APPROVED` vs `CLINICIAN_ONLY` badges. |
| **5** | **Agent Execution Runs** | `AgentRunsView.tsx` | Trace telemetry, node timing breakdowns, HITL resumption management. |
| **6** | **Model Orchestrator** | `SettingsView.tsx` | Provider registry, task-based routing policies, circuit breakers, live provider latencies. |
| **7** | **Human Support / Handoff**| `HumanHandoffView.tsx` | Staff triage escalation queue, urgency filters, nurse/physician assignment, clinical notes. |
| **8** | **RAG Evaluation** | `RAGEvaluationView.tsx` | Quantitative benchmarking (Recall@K, MRR, nDCG@K, Groundedness %, Ablation comparisons). |
| **9** | **Tenant Management** | `TenantManagementView.tsx` | Multi-tenant hospital administration, allowed domains, emergency hotlines, custom greetings. |
| **10** | **User & Role RBAC** | `UserManagementView.tsx` | Role-based access control (Admin, Clinician, Triage Nurse, Patient), permission matrix. |
| **11** | **Regulatory Audit Logs** | `AuditLogsView.tsx` | Persistent regulatory audit trail for clinician HITL sign-offs and patient consent records. |
| **12** | **System Settings** | `SettingsView.tsx` | Platform environment configuration, model keys, endpoints, and storage backend selection. |

---

## 4. Multi-Tenant Infrastructure & Security

### 4.1 Tenant Isolation
The platform provisions multi-tenant isolation via `TenantConfig`:
- `DEFAULT_HOSPITAL`: Synapse University Hospital (United States, Emergency 911, Language: English)
- `CLINIC_DHAKA`: Dhaka Metropolitan Health Center (Bangladesh, Emergency 999, Language: বাংলা)

### 4.2 Security Boundary Guarantee
- Public patient inquiries through `widget.js` cannot execute SQL queries, mutate database state, or read ungrounded internal clinician strictures.
- Clinician endpoints require explicit practitioner credentialing and log all overrides to the immutable audit database.
