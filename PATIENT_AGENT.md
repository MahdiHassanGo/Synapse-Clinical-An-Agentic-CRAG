# Synapse Patient AI — Patient Conversational Intelligence

Synapse Patient AI is a specialized, patient-facing conversational healthcare navigator designed for public health websites, hospital portals, and mobile clinics. It complements the **Clinician Copilot** by delivering empathetic, accessible, and strictly patient-safe medical guidance in both **English and Bengali (বাংলা)** while enforcing an impermeable boundary between public inquiries and confidential electronic health records.

---

## 1. Core Architecture & Dual-Agent Separation

```
                       [Public Healthcare Visitors]
                                    │
                                    ▼
                     ┌──────────────────────────────┐
                     │   Embeddable Chat Widget     │
                     │  (widget.js / Web Portal)    │
                     └──────────────┬───────────────┘
                                    │
                         HTTP REST & Live SSE
                                    │
                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │             Synapse Patient Agent Engine              │
       │                                                        │
       │  1. Language Detector (Bengali Unicode vs English)     │
       │  2. Safety Screening (Chest pain, stroke, emergency)   │
       │  3. Intent Classifier (Symptom, Meds, Routing, Handoff)│
       │  4. Policy Guard (Blocks unauthorized EHR inquiries)   │
       │  5. Patient-Approved Retrieval (PATIENT_APPROVED only) │
       │  6. Specialist Matcher (BMDC/MD directory + schedules) │
       │  7. Bilingual Response Generator (Polite, 6th-grade)   │
       │  8. Mandatory Statutory Disclaimer Enforcer            │
       └──────────────┬──────────────────────────┬──────────────┘
                      │                          │
                      ▼                          ▼
          [Patient Guidelines DB]       [Triage Handoff Queue]
        (access_level=PATIENT_APP)    (REQUESTED -> ASSIGNED -> MD)
                      │
     =================│==========================================
                      │ [IMPERMEABLE SECURITY BOUNDARY]
     =================│==========================================
                      ▼
        [Clinician Copilot & EHR]
          - text_to_sql engine
          - Patient EHR relational tables
          - Clinical calculators (eGFR, CrCl)
          - Internal clinician-only guidelines
          - Pharmacovigilance DDI engines
```

---

## 2. Bilingual Multilingual Engine (English & বাংলা)

### 2.1 Deterministic Language Detection
Instead of waiting for an external LLM roundtrip, Synapse employs deterministic Unicode range detection for Bengali script:
$$\text{Bengali Regex: } [\backslash\text{u0980}-\backslash\text{u09FF}]$$

- If Bengali characters are present in the inquiry $\rightarrow$ routes to **Bengali Language Pipeline (`bn`)**.
- If standard Latin characters are detected $\rightarrow$ routes to **English Language Pipeline (`en`)**.

### 2.2 Cultural & Linguistic Tone
- **Bengali Tone**: Adheres to polite formal Bengali (`আপনি`, `আপনার`), addresses symptoms with medical clarity, converts numeric telephone hotlines to Bengali script (`৯৯৯` for Bangladesh national emergency hotline), and avoids overly complex medical Latin jargon.
- **English Tone**: Calibrated to a 6th-grade reading level with clear bullet points, empathetic phrasing, and plain-English medical terminology explanations.

---

## 3. Red-Flag Emergency Detection & Hotline Routing

High-stakes patient queries are screened immediately by the `safety_screening` node before any general retrieval occurs.

### Monitored Emergency Signs
| Acute Condition | English Triggers | Bengali Triggers | Action Taken |
| :--- | :--- | :--- | :--- |
| **Cardiovascular Event** | chest pain, pressure, radiating pain, heart attack | বুকে ব্যথা, বুকে চাপ, হার্ট অ্যাটাক | Immediate Emergency Alert + Hotline Routing |
| **Respiratory Distress** | difficulty breathing, shortness of breath, suffocating | শ্বাসকষ্ট, দম বন্ধ হয়ে যাওয়া | Immediate Emergency Alert + Hotline Routing |
| **Anaphylaxis** | throat closing, tongue swelling, severe allergic reaction | গলা ফুলে যাওয়া, অ্যালার্জি, শ্বাস বন্ধ | Immediate Emergency Alert + Hotline Routing |
| **Acute Stroke** | facial droop, slurred speech, arm numbness | মুখের একপাশ বেঁকে যাওয়া, কথা জড়িয়ে যাওয়া | Immediate Emergency Alert + Hotline Routing |
| **Loss of Consciousness** | passed out, unconscious, fainted | অজ্ঞান, বেহুঁশ | Immediate Emergency Alert + Hotline Routing |
| **Self-Harm / Crisis** | suicide, overdose, poison | আত্মহত্যা, বিষপান | Immediate Crisis Hotline Escalation |

### Emergency Dispatch
When an emergency is detected:
1. Graph immediately bypasses knowledge retrieval and branches directly to `emergency_node`.
2. Generates urgent advice: stop exertion, sit down, do not drive, and contact emergency services.
3. Automatically creates a `CRITICAL` urgency ticket in the clinic's **Human Handoff Queue**.
4. Provides localized hotlines: **911** for US tenants, **999** for Bangladesh clinics.

---

## 4. Patient Safety Policies (Zero Diagnosis, Zero Prescribing)

To ensure strict compliance with medical device and AI safety regulations:

1. **No Autonomous Diagnosis**: The agent never provides definitive diagnostic conclusions. When symptoms are discussed, it presents potential general educational categories and directs the user to in-person clinical assessment.
2. **No Autonomous Prescribing**: The agent strictly refuses requests to order, prescribe, or recommend changes to prescription medication doses (e.g. *"Can you prescribe me Xanax?"* $\rightarrow$ blocked by policy guard).
3. **No Fabrication of Records**: Inquiries regarding individual lab results or health history are blocked for unauthenticated visitors.
4. **Mandatory Statutory Disclaimer**: Every generated response concludes with a localized safety warning emphasizing that the assistant provides health education and is not a medical device.

---

## 5. Patient Authentication Modes

The platform supports two distinct visitor modes:

### Mode A: Anonymous Public Visitor
- No registration or login required.
- Access to public healthcare educational guidelines, symptom explanations, and clinic appointment routing.
- Zero access to personal health records or identifiable EHR data.

### Mode B: Authenticated Patient
- Patient logs in using **Patient ID** (e.g. `P101`) and **Medical Record Number (MRN)** (e.g. `MRN-882190`).
- Credentials verified against the synthetic EHR database.
- Explicit informed research consent recorded.
- Enables authorized review of personal medication schedules and lab records under patient-approved privacy protocols.

---

## 6. Human Handoff Queue Lifecycle

Patients may request human triage at any time, or the agent may automatically escalate complex inquiries. Escalations enter a state-managed queue:

$$\text{REQUESTED} \longrightarrow \text{WAITING} \longrightarrow \text{ASSIGNED} \longrightarrow \text{IN\_REVIEW} \longrightarrow \text{RESOLVED / CANCELLED}$$

- **Triage Nurse Assignment**: Clinic staff can assign tickets to specific practitioners (e.g., *Nurse Sarah Jenkins, RN* or *Dr. Marcus Bell, MD*).
- **Clinical Notes**: Practitioners record phone consultations, counseling summaries, or ER transfer notes.

---

## 7. Specialist Directory & Clinical Matching (Agentic RAG vs Traditional RAG)

Following the specialist doctor routing patterns seen in `HealthCare with RAG`, Synapse Clinical v4.1 elevates doctor-finding into an **Agentic RAG pipeline**:

| Capability | Traditional RAG (`HealthCare with RAG`) | Synapse Clinical Agentic RAG |
|---|---|---|
| **Symptom Routing** | Simple vector similarity over doctor bio strings | Decomposes symptom presentations into clinical departments (Cardiology, Dermatology, Neurology, Endocrinology, Nephrology) via `specialist_matching_node`. |
| **Relevance Grading** | Fixed Top-K retrieval without quality evaluation | Corrective RAG (CRAG) scores candidate specialists (0.65 to 0.98), rejecting out-of-domain consultants. |
| **Schedule & Fee Enrichment** | Single hospital static schedule | Multi-tenant dynamic schedule slots (e.g. *"Today 5:00 PM - 8:00 PM (4 slots left)"*) and localized currency (BDT for Dhaka clinic, USD for US hospital). |
| **Emergency Safety Gate** | Passive prompt instruction ("tell them to call...") | Deterministic LangGraph node (`safety_screening_node`) that intercepts life-threatening queries BEFORE specialist retrieval. |
| **Interactive UI Presentation** | Chat bubble doctor links | Rich interactive doctor cards in both `FloatingChatWidget.tsx` and `PatientChatView.tsx` with BMDC/MD verification badges, slot reservation, and CRAG trace indicators. |
| **Omnipresent Accessibility** | Per-page component | Omnipresent floating widget available across all 12 platform views with global `open-synapse-chat` custom event dispatcher. |

- **Regulatory Audit Trail**: Status changes and practitioner actions are permanently recorded.
