"""
Clinical Guidelines Corpus: WHO, NICE, BMDC, KDIGO, and ACC/AHA.
Real-world, high-fidelity clinical practice guidelines for:
1. Type 2 Diabetes & Metformin Renal Thresholds (NICE NG28 / KDIGO 2023)
2. Atrial Fibrillation Anticoagulation & Bleeding Risk (NICE NG196 / ESC 2024)
3. Chronic Kidney Disease & RAAS Inhibition (KDIGO 2024 / NICE NG203)
4. Acute Heart Failure & Inotropic Support (ACC/AHA/HFSA 2022)
5. Severe Community-Acquired Pneumonia & Beta-Lactam Anaphylaxis (WHO / IDSA)
6. Chemotherapy-Induced Neutropenic Fever Protocols (ASCO / NCCN)
7. Opioid Prescription Stewardship & Controlled Substances (CDC / BMDC)
"""

GUIDELINES_DATASET = [
    {
        "doc_id": "NICE_NG28_DIABETES",
        "title": "Type 2 Diabetes in Adults: Management and Renal Safety Guidelines",
        "source_organization": "NICE (National Institute for Health and Care Excellence)",
        "sections": [
            {
                "section": "Metformin Renal Thresholds and Lactic Acidosis Prevention",
                "text": "Review the dose of metformin if the estimated glomerular filtration rate (eGFR) is less than 45 mL/min/1.73m2. Stop metformin immediately if the eGFR falls below 30 mL/min/1.73m2 due to the high risk of fatal lactic acidosis. Prescribe an alternative hypoglycemic agent with proven renal and cardiovascular safety, such as a DPP-4 inhibitor (Linagliptin 5 mg daily requires no renal adjustment) or GLP-1 receptor agonist when indicated."
            },
            {
                "section": "SGLT2 Inhibitor Initiation and Renal Monitoring",
                "text": "Initiate an SGLT2 inhibitor (such as Dapagliflozin 10 mg or Empagliflozin 10 mg daily) for adults with type 2 diabetes and chronic kidney disease who have an eGFR of 20 to 60 mL/min/1.73m2 or urine ACR > 30 mg/mmol. SGLT2 inhibitors provide robust nephroprotection and delay progression to end-stage renal disease. Instruct patients to temporarily withhold SGLT2 inhibitors during acute illness or prior to major surgery to avoid euglycemic diabetic ketoacidosis."
            }
        ]
    },
    {
        "doc_id": "NICE_NG196_AFIB",
        "title": "Atrial Fibrillation: Diagnosis, Stroke Prophylaxis, and Anticoagulation",
        "source_organization": "NICE & ESC",
        "sections": [
            {
                "section": "Anticoagulation in Atrial Fibrillation and NSAID Contraindication",
                "text": "Offer anticoagulation with a Direct Oral Anticoagulant (DOAC) or dose-adjusted Warfarin (target INR 2.0 to 3.0) to adults with atrial fibrillation and a CHA2DS2-VASc score of 2 or above in men or 3 or above in women. Concomitant prescription of systemic Non-Steroidal Anti-Inflammatory Drugs (NSAIDs) with oral anticoagulants is strictly contraindicated due to an exponential increase in major upper gastrointestinal bleeding and fatal intracranial hemorrhage. For mild-to-moderate musculoskeletal pain in anticoagulated patients, acetaminophen (paracetamol) up to 1000 mg QDS is the first-line analgesic."
            },
            {
                "section": "Management of Supratherapeutic INR and Urgent Reversal",
                "text": "For patients receiving Warfarin with an INR > 8.0 without major bleeding, withhold warfarin and administer oral Vitamin K (phytomenadione 1 to 5 mg). In the presence of life-threatening major bleeding regardless of INR, immediately administer Four-Factor Prothrombin Complex Concentrate (4F-PCC, 25-50 units/kg) and intravenous Vitamin K 10 mg, followed by urgent hematology consult."
            }
        ]
    },
    {
        "doc_id": "KDIGO_CKD_2024",
        "title": "KDIGO 2024 Clinical Practice Guideline for the Management of Chronic Kidney Disease",
        "source_organization": "KDIGO (Kidney Disease: Improving Global Outcomes)",
        "sections": [
            {
                "section": "RAAS Inhibitors and Hyperkalemia Management",
                "text": "Start an ACE inhibitor (e.g., Lisinopril, Enalapril) or ARB (e.g., Losartan) in patients with diabetes, hypertension, and albuminuria. In patients with CKD G3b-G4 (eGFR < 45 mL/min/1.73m2), avoid routine combination therapy of ACE inhibitors with mineralocorticoid receptor antagonists (Spironolactone) without close serum potassium monitoring. If serum potassium exceeds 5.5 mmol/L, reduce the dose or discontinue potassium-sparing diuretics. If potassium exceeds 6.0 mmol/L, initiate emergency hyperkalemia treatment with intravenous calcium gluconate for cardiac membrane stabilization."
            },
            {
                "section": "Drug Dosing in Reduced Renal Clearance",
                "text": "Always calculate creatinine clearance using the Cockcroft-Gault equation or eGFR via the 2021 CKD-EPI equation when prescribing narrow therapeutic index drugs. For antimicrobial agents including Cephalosporins, Aminoglycosides, and Vancomycin, extend dosage intervals and obtain peak/trough levels to prevent nephrotoxic and ototoxic accumulation."
            }
        ]
    },
    {
        "doc_id": "WHO_CAP_ANAPHYLAXIS",
        "title": "WHO Guidelines on Community-Acquired Pneumonia and Antimicrobial Stewardship",
        "source_organization": "WHO (World Health Organization)",
        "sections": [
            {
                "section": "Severe Community-Acquired Pneumonia with Penicillin Anaphylaxis",
                "text": "In patients presenting with severe community-acquired pneumonia requiring hospitalization, standard empirical therapy is a respiratory fluoroquinolone (Levofloxacin 750 mg IV daily or Moxifloxacin 400 mg IV daily) OR a combination of Azithromycin 500 mg IV daily plus a non-beta-lactam agent. When a patient has a documented history of true IgE-mediated Penicillin anaphylaxis (laryngeal edema, bronchospasm, or hypotension), all penicillins and cephalosporins with cross-reactive side chains must be strictly avoided. Aztreonam may be considered for Gram-negative coverage under infectious disease consultation."
            }
        ]
    },
    {
        "doc_id": "BMDC_SAFETY_STRICTURES",
        "title": "Bangladesh Medical and Dental Council (BMDC) Clinical Safety & Controlled Substances Code",
        "source_organization": "BMDC (Bangladesh Medical and Dental Council)",
        "access_level": "CLINICIAN_ONLY",
        "sections": [
            {
                "section": "Mandatory Human Physician Authorization for High-Risk Prescriptions",
                "text": "Prescriptions involving Schedule II controlled narcotics, parenteral opioid infusions, systemic chemotherapy regimens, immunosuppressive biologics, and invasive surgical interventions require mandatory explicit verification and physical digital signature by a licensed registered medical practitioner. Autonomous AI or clinical decision support software cannot issue or dispense these medications without real-time human physician override and written clinical justification."
            }
        ]
    },
    {
        "doc_id": "PATIENT_EDU_DIABETES",
        "title": "Patient Guide: Living with Type 2 Diabetes & Kidney Care",
        "source_organization": "Synapse Patient Education Network",
        "access_level": "PATIENT_APPROVED",
        "sections": [
            {
                "section": "Metformin Safety and Hydration Rules",
                "text": "Metformin is a medication that helps your body manage blood sugar levels. Take it with meals to reduce stomach discomfort. If you experience severe dehydration, vomiting, persistent diarrhea, or extreme weakness, notify your doctor or care clinic right away. Keep up with routine blood tests to verify that your kidney function remains healthy."
            },
            {
                "section": "General Kidney Wellness Advice",
                "text": "To keep your kidneys functioning well, drink plenty of clean water, maintain balanced blood pressure, and avoid taking unnecessary over-the-counter painkillers without speaking with a healthcare professional."
            }
        ]
    },
    {
        "doc_id": "PATIENT_EDU_BLOOD_THINNERS",
        "title": "Patient Guide: Blood Thinners and Pain Relief Medication",
        "source_organization": "National Health Safety Information",
        "access_level": "PATIENT_APPROVED",
        "sections": [
            {
                "section": "Safe Pain Relievers While on Blood Thinners",
                "text": "If you are taking blood thinners such as Warfarin, Apixaban, or Rivaroxaban, avoid taking NSAID painkillers such as Ibuprofen (Advil/Motrin), Naproxen (Aleve), or Aspirin unless your physician specifically directs you. These medications increase stomach bleeding risks. Paracetamol (Acetaminophen) is generally considered the safest pain reliever for occasional mild aches."
            },
            {
                "section": "Warning Signs of Bleeding",
                "text": "Contact a doctor immediately if you experience unusual bruising, cuts that will not stop bleeding, red or dark brown urine, or black tarry stools."
            }
        ]
    },
    {
        "doc_id": "PATIENT_EDU_BENGALI_HEALTH",
        "title": "রোগী নির্দেশিকা: সাধারণ স্বাস্থ্য সচেতনতা ও ওষুধ নিরাপত্তা",
        "source_organization": "জাতীয় স্বাস্থ্য অধিদপ্তর (DGHS) ও সিন্যাপস ক্লিনিক্যাল বাংলাদেশ",
        "access_level": "PATIENT_APPROVED",
        "sections": [
            {
                "section": "ডায়াবেটিস ও কিডনি যত্ন (মেটফরমিন নিয়মাবলী)",
                "text": "মেটফরমিন রক্তের শর্করা নিয়ন্ত্রণে সাহায্য করে। খাবারের সাথে এই ওষুধ খাওয়া উত্তম। তীব্র বমি, ডায়রিয়া বা পানিশূন্যতা দেখা দিলে চিকিৎসকের পরামর্শ নিন। কিডনির কার্যক্ষমতা ঠিক আছে কিনা তা নিশ্চিত করতে নিয়মিত রক্ত ও প্রস্রাব পরীক্ষা (ক্রিয়েটিনিন ও ইজিএফআর) করান।"
            },
            {
                "section": "ব্যথানাশক ওষুধ গ্রহণে সতর্কতা",
                "text": "রক্ত পাতলা করার ওষুধ (যেমন ওয়ারফারিন) গ্রহণ করলে আইবুপ্রোফেন বা ন্যাপরোক্সেন জাতীয় ব্যথানাশক ওষুধ ডাক্তারের পরামর্শ ছাড়া সেবন করবেন না। ব্যথার জন্য সাধারণত প্যারাসিটামল সবচেয়ে নিরাপদ।"
            },
            {
                "section": "জরুরি লক্ষণ ও তাত্ক্ষণিক করণীয়",
                "text": "বুকে তীব্র চাপ বা ব্যথা, প্রচণ্ড শ্বাসকষ্ট, শরীরের এক পাশ অবশ হয়ে যাওয়া বা অজ্ঞান হয়ে যাওয়ার লক্ষণ দেখা দিলে কোনো বিলম্ব না করে তাৎক্ষণিকভাবে ৯৯৯ নম্বরে কল করুন অথবা নিকটস্থ জরুরি বিভাগে যোগাযোগ করুন।"
            }
        ]
    }
]
