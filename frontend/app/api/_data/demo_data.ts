// Persistent in-memory demo data for Synapse Clinical on Vercel

export interface Patient {
  patient_id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  age: number;
  gender: string;
  primary_diagnosis: string;
}

export interface PatientDetail {
  patient: Patient & { weight_kg: number; height_cm: number };
  latest_vitals: {
    systolic_bp: number;
    diastolic_bp: number;
    heart_rate: number;
    o2_saturation: number;
    temperature_c: number;
  };
  labs: Array<{
    test_name: string;
    value: number;
    unit: string;
    flag: string;
  }>;
  active_medications: Array<{
    drug_name: string;
    dosage: string;
    frequency: string;
    indication: string;
  }>;
  allergies: Array<{
    allergen: string;
    reaction: string;
    severity: string;
  }>;
  renal_status: {
    serum_creatinine_mg_dl: number;
    egfr_value: number;
    crcl_value: number;
    kdigo_stage: string;
  };
}

export const PATIENTS_LIST: Patient[] = [
  {
    patient_id: "P101",
    mrn: "MRN-882190",
    first_name: "Eleanor",
    last_name: "Vance",
    age: 72,
    gender: "Female",
    primary_diagnosis: "Type 2 Diabetes Mellitus, CKD Stage 4",
  },
  {
    patient_id: "P102",
    mrn: "MRN-991203",
    first_name: "Arthur",
    last_name: "Pendleton",
    age: 75,
    gender: "Male",
    primary_diagnosis: "Permanent Atrial Fibrillation, Hypertension",
  },
  {
    patient_id: "P103",
    mrn: "MRN-773411",
    first_name: "Marcus",
    last_name: "Holloway",
    age: 60,
    gender: "Male",
    primary_diagnosis: "Congestive Heart Failure (HFrEF), CKD Stage 3b",
  },
  {
    patient_id: "P104",
    mrn: "MRN-664129",
    first_name: "Sarah",
    last_name: "Chen",
    age: 38,
    gender: "Female",
    primary_diagnosis: "Severe Community-Acquired Pneumonia, History of Asthma",
  },
];

export const PATIENT_DETAILS: Record<string, PatientDetail> = {
  P101: {
    patient: {
      patient_id: "P101",
      mrn: "MRN-882190",
      first_name: "Eleanor",
      last_name: "Vance",
      age: 72,
      gender: "Female",
      primary_diagnosis: "Type 2 Diabetes Mellitus, CKD Stage 4",
      weight_kg: 68.0,
      height_cm: 162.0,
    },
    latest_vitals: {
      systolic_bp: 148,
      diastolic_bp: 88,
      heart_rate: 76,
      o2_saturation: 97.0,
      temperature_c: 36.8,
    },
    labs: [
      { test_name: "Serum Creatinine", value: 2.4, unit: "mg/dL", flag: "CRITICAL_HIGH" },
      { test_name: "HbA1c", value: 8.8, unit: "%", flag: "HIGH" },
      { test_name: "Serum Potassium", value: 4.8, unit: "mmol/L", flag: "NORMAL" },
    ],
    active_medications: [
      { drug_name: "Metformin", dosage: "1000 mg", frequency: "BID", indication: "Type 2 Diabetes" },
      { drug_name: "Lisinopril", dosage: "20 mg", frequency: "Daily", indication: "Hypertension & Renal Protection" },
      { drug_name: "Atorvastatin", dosage: "40 mg", frequency: "QHS", indication: "Dyslipidemia" },
    ],
    allergies: [
      { allergen: "Sulfa Drugs", reaction: "Urticaria and diffuse rash", severity: "MODERATE" },
    ],
    renal_status: {
      serum_creatinine_mg_dl: 2.4,
      egfr_value: 22.4,
      crcl_value: 23.1,
      kdigo_stage: "G4: Severely decreased (15-29 mL/min/1.73m²)",
    },
  },
  P102: {
    patient: {
      patient_id: "P102",
      mrn: "MRN-991203",
      first_name: "Arthur",
      last_name: "Pendleton",
      age: 75,
      gender: "Male",
      primary_diagnosis: "Permanent Atrial Fibrillation, Hypertension",
      weight_kg: 82.0,
      height_cm: 178.0,
    },
    latest_vitals: {
      systolic_bp: 132,
      diastolic_bp: 82,
      heart_rate: 84,
      o2_saturation: 98.0,
      temperature_c: 37.0,
    },
    labs: [
      { test_name: "INR (Prothrombin)", value: 2.8, unit: "ratio", flag: "NORMAL" },
      { test_name: "Serum Creatinine", value: 1.1, unit: "mg/dL", flag: "NORMAL" },
    ],
    active_medications: [
      { drug_name: "Warfarin", dosage: "5 mg", frequency: "Daily", indication: "Stroke prophylaxis in AFib" },
      { drug_name: "Metoprolol Succinate", dosage: "50 mg", frequency: "Daily", indication: "Rate control AFib" },
    ],
    allergies: [
      { allergen: "Codeine", reaction: "Nausea and lightheadedness", severity: "MILD" },
    ],
    renal_status: {
      serum_creatinine_mg_dl: 1.1,
      egfr_value: 68.4,
      crcl_value: 64.2,
      kdigo_stage: "G2: Mildly decreased (60-89 mL/min/1.73m²)",
    },
  },
  P103: {
    patient: {
      patient_id: "P103",
      mrn: "MRN-773411",
      first_name: "Marcus",
      last_name: "Holloway",
      age: 60,
      gender: "Male",
      primary_diagnosis: "Congestive Heart Failure (HFrEF), CKD Stage 3b",
      weight_kg: 94.0,
      height_cm: 175.0,
    },
    latest_vitals: {
      systolic_bp: 108,
      diastolic_bp: 68,
      heart_rate: 92,
      o2_saturation: 94.0,
      temperature_c: 37.2,
    },
    labs: [
      { test_name: "Serum Potassium", value: 5.8, unit: "mmol/L", flag: "CRITICAL_HIGH" },
      { test_name: "Serum Creatinine", value: 2.1, unit: "mg/dL", flag: "HIGH" },
      { test_name: "BNP", value: 890.0, unit: "pg/mL", flag: "CRITICAL_HIGH" },
    ],
    active_medications: [
      { drug_name: "Furosemide", dosage: "40 mg", frequency: "BID", indication: "Volume overload / CHF" },
      { drug_name: "Spironolactone", dosage: "25 mg", frequency: "Daily", indication: "HFrEF mortality reduction" },
      { drug_name: "Enalapril", dosage: "10 mg", frequency: "BID", indication: "HFrEF guideline therapy" },
    ],
    allergies: [
      { allergen: "Aspirin", reaction: "Bronchospasm / Wheezing", severity: "SEVERE" },
    ],
    renal_status: {
      serum_creatinine_mg_dl: 2.1,
      egfr_value: 33.5,
      crcl_value: 38.0,
      kdigo_stage: "G3b: Moderately to severely decreased (30-44 mL/min/1.73m²)",
    },
  },
  P104: {
    patient: {
      patient_id: "P104",
      mrn: "MRN-664129",
      first_name: "Sarah",
      last_name: "Chen",
      age: 38,
      gender: "Female",
      primary_diagnosis: "Severe Community-Acquired Pneumonia, History of Asthma",
      weight_kg: 57.0,
      height_cm: 165.0,
    },
    latest_vitals: {
      systolic_bp: 118,
      diastolic_bp: 74,
      heart_rate: 102,
      o2_saturation: 91.0,
      temperature_c: 38.6,
    },
    labs: [
      { test_name: "White Blood Cells", value: 16.4, unit: "10^3/uL", flag: "HIGH" },
      { test_name: "Serum Creatinine", value: 0.7, unit: "mg/dL", flag: "NORMAL" },
    ],
    active_medications: [
      { drug_name: "Albuterol Inhaler", dosage: "90 mcg", frequency: "Q4H PRN", indication: "Asthma exacerbation" },
    ],
    allergies: [
      { allergen: "Penicillin", reaction: "Anaphylaxis / Angioedema / Hypotension", severity: "ANAPHYLACTIC" },
    ],
    renal_status: {
      serum_creatinine_mg_dl: 0.7,
      egfr_value: 98.2,
      crcl_value: 92.5,
      kdigo_stage: "G1: Normal (>= 90 mL/min/1.73m²)",
    },
  },
};

export const GUIDELINES = [
  {
    doc_id: "NICE_NG28_DIABETES",
    title: "Type 2 Diabetes in Adults: Management (NICE NG28)",
    source_organization: "NICE (National Institute for Health and Care Excellence)",
    publication_date: "2024-06",
    version: "2.1",
    source_type: "CLINICAL_GUIDELINE",
    chunk_count: 8,
    status: "INDEXED",
    access_level: "CLINICIAN_ONLY",
  },
  {
    doc_id: "NICE_NG196_AFIB",
    title: "Atrial Fibrillation: Diagnosis and Management (NICE NG196)",
    source_organization: "NICE",
    publication_date: "2024-04",
    version: "1.4",
    source_type: "CLINICAL_GUIDELINE",
    chunk_count: 6,
    status: "INDEXED",
    access_level: "CLINICIAN_ONLY",
  },
  {
    doc_id: "KDIGO_CKD_2024",
    title: "KDIGO Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease",
    source_organization: "KDIGO",
    publication_date: "2024-03",
    version: "3.0",
    source_type: "CONSENSUS_GUIDELINE",
    chunk_count: 12,
    status: "INDEXED",
    access_level: "CLINICIAN_ONLY",
  },
  {
    doc_id: "BMDC_ETHICS_2023",
    title: "BMDC Code of Medical Ethics and Prescription Regulations",
    source_organization: "Bangladesh Medical and Dental Council (BMDC)",
    publication_date: "2023-11",
    version: "1.0",
    source_type: "REGULATORY_CODE",
    chunk_count: 5,
    status: "INDEXED",
    access_level: "CLINICIAN_ONLY",
  },
  {
    doc_id: "PATIENT_ED_DIABETES",
    title: "Understanding Your Diabetes Medications & Kidney Health",
    source_organization: "Synapse Patient Health Library",
    publication_date: "2024-01",
    version: "1.0",
    source_type: "PATIENT_EDUCATION",
    chunk_count: 4,
    status: "INDEXED",
    access_level: "PATIENT_APPROVED",
  },
];

export const TENANTS = [
  {
    tenant_id: "DEFAULT_HOSPITAL",
    name: "Synapse University Hospital",
    domains: ["*", "localhost", "127.0.0.1", "synapse.health"],
    logo_url: "/logo.png",
    primary_color: "#0EA5E9",
    default_language: "en",
    supported_languages: ["en", "bn"],
    emergency_phone: "911",
    emergency_message_en: "If you have severe chest pain, breathing difficulty, or a life-threatening emergency, call 911 immediately or visit the nearest ER.",
    emergency_message_bn: "জরুরি অবস্থায় অবিলম্বে ৯১১ অথবা নিকটস্থ জরুরি বিভাগে যোগাযোগ করুন।",
    welcome_message_en: "Welcome to Synapse University Hospital. I am your virtual health navigator. How may I assist you today?",
    welcome_message_bn: "মেডপালস জেনারেল হাসপাতালে আপনাকে স্বাগতম। আপনার স্বাস্থ্য বিষয়ক যেকোনো তথ্যের জন্য আমি উপস্থিত আছি।",
    handoff_enabled: true,
    organization_address: "742 Evergreen Terrace, Medical District, NY",
    created_at: "2026-11-20 00:00:00",
  },
  {
    tenant_id: "CLINIC_DHAKA",
    name: "Dhaka Metropolitan Health Center",
    domains: ["*", "localhost", "127.0.0.1", "dhakahealth.gov.bd"],
    logo_url: "/dhaka-logo.png",
    primary_color: "#10B981",
    default_language: "bn",
    supported_languages: ["bn", "en"],
    emergency_phone: "999",
    emergency_message_en: "For acute medical emergencies in Bangladesh, immediately dial 999 or go to the nearest hospital casualty department.",
    emergency_message_bn: "জরুরি চিকিৎসা প্রয়োজনে অবিলম্বে জাতীয় জরুরি সেবা ৯৯৯ নম্বরে ফোন করুন অথবা নিকটস্থ হাসপাতালের জরুরি বিভাগে যোগাযোগ করুন।",
    welcome_message_en: "Welcome to Dhaka Metropolitan Health Center. How can we help you with clinic guidance, appointment routing, or health questions today?",
    welcome_message_bn: "ঢাকা মেট্রোপলিটন হেলথ সেন্টারে আপনাকে স্বাগতম। সাধারণ স্বাস্থ্য পরামর্শ, চিকিৎসকের অ্যাপয়েন্টমেন্ট বা ওষুধের তথ্যের জন্য জিজ্ঞাসা করুন।",
    handoff_enabled: true,
    organization_address: "House 42, Road 7/A, Dhanmondi, Dhaka 1209, Bangladesh",
    created_at: "2026-11-20 00:00:00",
  },
];

export const DEMO_AUDIT_LOGS = [
  {
    audit_id: "AUDIT_101",
    run_id: "RUN_DEMO_P102_HITL",
    session_id: "SESS_DEMO_01",
    patient_id: "P102",
    clinician_id: "DR_M_ASIF_MD",
    decision: "OVERRIDE_APPROVED",
    override_rationale: "Approved transition from NSAID to Paracetamol 1000mg TID to prevent upper GI hemorrhage in patient on Warfarin.",
    recorded_at: "2026-11-22 10:15:32",
  },
  {
    audit_id: "AUDIT_102",
    run_id: "RUN_DEMO_P101_EVAL",
    session_id: "SESS_DEMO_02",
    patient_id: "P101",
    clinician_id: "DR_SARAH_MD",
    decision: "DISCONTINUE_DRUG",
    override_rationale: "Metformin discontinued due to CKD Stage G4 (eGFR 22.4 mL/min) and high risk of lactic acidosis.",
    recorded_at: "2026-11-22 11:42:19",
  },
];

export const DEMO_HANDOFF_REQUESTS = [
  {
    request_id: "HO_1001",
    tenant_id: "DEFAULT_HOSPITAL",
    session_id: "SESS_SAMPLE_01",
    patient_id: "P101",
    patient_name: "Eleanor Vance",
    user_query: "I have questions about switching my diabetes medication because my stomach feels unsettled.",
    status: "ASSIGNED",
    urgency: "MEDIUM",
    reason: "Patient requested medication review by clinic nurse",
    assigned_to: "Nurse Sarah Jenkins, RN",
    notes: "Contacted patient via portal messaging. Lab follow-up scheduled.",
    created_at: "2026-11-22 08:30:00",
  },
  {
    request_id: "HO_1002",
    tenant_id: "CLINIC_DHAKA",
    session_id: "SESS_SAMPLE_02",
    patient_id: "P103",
    patient_name: "Marcus Holloway",
    user_query: "আমার পায়ে পানি এসেছে এবং শ্বাস নিতে কিছুটা কষ্ট হচ্ছে।",
    status: "WAITING",
    urgency: "HIGH",
    reason: "Potential heart failure decompensation in CKD G3b patient",
    assigned_to: null,
    notes: "Triage flag: Urgent cardiologist review recommended.",
    created_at: "2026-11-22 09:15:00",
  },
];
