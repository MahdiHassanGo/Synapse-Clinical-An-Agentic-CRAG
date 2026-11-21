# Synapse Clinical — Platform Security & Compliance Architecture

Synapse Clinical v4.1 is engineered with defense-in-depth security principles across its dual AI agents, multi-tenant databases, LLM orchestration pipeline, and web endpoints.

---

## 1. Security Architecture & Threat Boundaries

```
[Untrusted Public Internet / Webhook / Web Visitors]
                          │
                          ▼
            [WAF & Network Perimeter]
     - Strict SSRF filtering (blocks loopback, RFC1918, 169.254.169.254)
     - Tenant domain allowlist verification
     - Strict CORS headers & origin matching
                          │
                          ▼
             [FastAPI Application Gateway]
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
[Patient Agent Sandbox]        [Clinician Copilot (Auth)]
 ├─ access_level="PATIENT_APP"   ├─ JWT / Clinician Session
 ├─ Zero SQL / Zero Tools        ├─ Read-Only AST SQL Validator
 ├─ Emergency Red-Flag Router    ├─ HITL Regulatory Gate
 └─ Mandatory Disclaimers        └─ Immutable Audit Logger
         │                                 │
         └────────────────┬────────────────┘
                          ▼
             [Multi-Tenant Database]
```

---

## 2. Multi-Tenant Isolation & Domain Allowlisting

- **Tenant Boundary**: Every patient conversation session, escalation ticket, and guideline chunk is partitioned by `tenant_id` (e.g. `DEFAULT_HOSPITAL`, `CLINIC_DHAKA`).
- **Domain Verification**: Origin headers are matched against `TenantConfig.domains` at `/api/v1/patient/chat/sessions`. Unauthorized domains cannot embed widgets or consume clinic LLM quotas.
- **Resource Partitioning**: Patient queries cannot traverse across distinct hospital knowledge bases or patient cohorts.

---

## 3. Data & Knowledge Classification

Knowledge documents and vector chunks are strictly classified:
1. `PATIENT_APPROVED`: Educational guides, medication usage directions, public health FAQs, and symptom navigation in English and Bengali.
2. `CLINICIAN_ONLY`: High-potency therapeutic strictures, contraindication tables, chemotherapy protocols, narrow-therapeutic-index dosing formulas, and clinical research data.

When the **Patient Agent** executes hybrid retrieval, `access_level="PATIENT_APPROVED"` is strictly enforced at both the vector search layer (`vector_store.search_dense`) and the BM25 reciprocal rank fusion layer (`hybrid_retriever.search_hybrid`). Clinician-only data is mathematically excluded from candidate pools.

---

## 4. Input Validation & Prompt Injection Defense

1. **Deterministic Red-Flag Screening**: Emergency symptoms (chest pain, stroke, breathing failure) are captured via deterministic string matching and regex before prompt generation, preventing LLM prompt jailbreaks from bypassing life-saving escalations.
2. **Read-Only AST Text-to-SQL Guard**: Clinician queries using natural language EHR lookup pass through Python AST validation. Mutation statements (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `EXEC`) and multi-statement queries (`SELECT ...; DROP TABLE`) raise `SQLSecurityViolation` and are aborted immediately.
3. **SSRF Guard**: When ingesting medical documents via URL (`/api/knowledge/url`), hostnames are resolved and checked against RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopbacks (`127.0.0.1`, `::1`), and cloud metadata IP addresses (`169.254.169.254`).

---

## 5. HIPAA & GDPR Privacy Compliance

1. **Right to be Forgotten & Consent Withdrawal**: Patients can purge their conversation history and revoke consent via `DELETE /api/v1/patient/chat/sessions/{session_id}`.
2. **Anonymous by Default**: Public website visitors interact in an anonymous session without storing IP addresses, names, or identifiable medical record numbers.
3. **Zero Secrets in Repository**: API keys (`OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) are managed strictly via environment variables. `.env` is permanently excluded via `.gitignore` and `.dockerignore`.
4. **Synthetic Data Guarantee**: All included patient cohorts (Eleanor Vance, Arthur Pendleton, Marcus Holloway, Sarah Chen) are synthetic clinical fixtures developed for research and educational purposes. No Protected Health Information (PHI) is present.

---

## 6. Regulatory Audit Trail (HITL Compliance)

All high-risk clinical overrides (e.g. approving contraindicated medications or ordering chemotherapy regimens) require explicit physician credentialing (`clinician_id`), digital approval, and written clinical rationale. Every decision is immutably logged to the database with millisecond timestamps and exposed via `/api/audit/events` for compliance inspection.
