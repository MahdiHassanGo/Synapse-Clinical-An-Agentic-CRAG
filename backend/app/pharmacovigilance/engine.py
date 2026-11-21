"""
Clinical Pharmacovigilance & Contraindication Knowledge Engine.
Deterministic verification for:
1. Drug-Drug Interactions (DDI)
2. Drug-Disease/Condition Contraindications
3. Drug-Allergy Hypersensitivity
4. Renal / Hepatic Threshold Contraindications (e.g. Metformin in eGFR < 30)
"""
import re
from typing import List, Dict, Any, Optional
from app.core.models import ClinicalSeverity, DrugInteractionAlert


class PharmacovigilanceEngine:
    def __init__(self):
        # High-stakes clinical contraindications knowledge graph
        self.drug_drug_rules = [
            {
                "drugs": ("warfarin", "nsaid"),
                "aliases": {
                    "nsaid": ["ibuprofen", "naproxen", "ketorolac", "diclofenac", "indomethacin", "meloxicam", "aspirin"]
                },
                "severity": ClinicalSeverity.FATAL,
                "mechanism": "Synergistic inhibition of platelet COX-1 and vitamin K-dependent clotting factors exponentially escalates severe GI bleeding and intracranial hemorrhage.",
                "recommendation": "STRICTLY CONTRAINDICATED. Switch analgesic to Acetaminophen / Paracetamol (max 2g/day) or topical lidocaine.",
                "action": "HALT_PRESCRIPTION"
            },
            {
                "drugs": ("spironolactone", "ace_arb"),
                "aliases": {
                    "ace_arb": ["lisinopril", "enalapril", "ramipril", "losartan", "valsartan", "candesartan"]
                },
                "severity": ClinicalSeverity.MAJOR,
                "mechanism": "Dual blockade of aldosterone and renin-angiotensin-aldosterone axis severely impairs renal potassium excretion, inducing fatal hyperkalemia and ventricular arrhythmias.",
                "recommendation": "Monitor potassium and creatinine within 72 hours. Withhold or reduce potassium supplementation; adjust dose if baseline K+ > 5.0 mmol/L.",
                "action": "MONITOR_AND_OVERRIDE_REQUIRED"
            },
            {
                "drugs": ("methotrexate", "nsaid"),
                "aliases": {
                    "nsaid": ["ibuprofen", "naproxen", "aspirin", "diclofenac"]
                },
                "severity": ClinicalSeverity.MAJOR,
                "mechanism": "NSAIDs reduce renal tubular secretion of methotrexate and displace methotrexate from plasma proteins, triggering severe bone marrow suppression and hepatotoxicity.",
                "recommendation": "AVOID concurrent administration. Use acetaminophen or corticosteroids under rheumatology guidance.",
                "action": "HALT_PRESCRIPTION"
            },
            {
                "drugs": ("sildenafil", "nitrate"),
                "aliases": {
                    "nitrate": ["nitroglycerin", "isosorbide mononitrate", "isosorbide dinitrate", "nitroprusside"]
                },
                "severity": ClinicalSeverity.FATAL,
                "mechanism": "Excessive cyclic GMP accumulation causes profound systemic vasodilation, refractory hypotension, and myocardial infarction.",
                "recommendation": "ABSOLUTE CONTRAINDICATION. Nitrates must not be administered within 24-48 hours of PDE5 inhibitors.",
                "action": "HALT_PRESCRIPTION"
            },
            {
                "drugs": ("clopidogrel", "omeprazole"),
                "aliases": {},
                "severity": ClinicalSeverity.MODERATE,
                "mechanism": "Omeprazole inhibits CYP2C19 bioactivation of clopidogrel to its active thiol metabolite, reducing antiplatelet efficacy.",
                "recommendation": "Substitute omeprazole with pantoprazole or famotidine (H2 blocker), which exhibit minimal CYP2C19 inhibition.",
                "action": "SUBSTITUTE_MEDICATION"
            }
        ]

        self.drug_disease_rules = [
            {
                "drug": "metformin",
                "condition_terms": ["ckd", "renal", "kidney", "nephropathy"],
                "egfr_cutoff": 30.0,
                "severity": ClinicalSeverity.CONTRAINDICATED,
                "mechanism": "Accumulation of metformin in severe renal impairment (eGFR < 30 mL/min/1.73m²) inhibits hepatic gluconeogenesis and mitochondrial respiration, causing life-threatening Lactic Acidosis (mortality > 40%).",
                "recommendation": "Metformin is ABSOLUTELY CONTRAINDICATED in eGFR < 30 mL/min/1.73m² (KDIGO/ADA Guidelines). Discontinue immediately and transition to Linagliptin or Insulin.",
                "action": "DISCONTINUE_AND_TRANSITION"
            },
            {
                "drug": "nsaid",
                "aliases": ["ibuprofen", "naproxen", "ketorolac", "diclofenac", "meloxicam"],
                "condition_terms": ["heart failure", "hfref", "ckd stage 4", "renal failure"],
                "severity": ClinicalSeverity.CONTRAINDICATED,
                "mechanism": "Inhibition of renal prostaglandins causes sodium and water retention, blunts diuretic response, worsens volume overload in Heart Failure, and precipitates Acute Kidney Injury (AKI).",
                "recommendation": "Avoid NSAIDs in patients with heart failure or severe CKD. Use non-pharmacological modalities or topical analgesics.",
                "action": "HALT_PRESCRIPTION"
            },
            {
                "drug": "beta_blocker",
                "aliases": ["propranolol", "nadolol", "timolol", "carvedilol", "metoprolol"],
                "condition_terms": ["asthma", "bronchospasm", "severe copd"],
                "severity": ClinicalSeverity.MAJOR,
                "mechanism": "Non-selective beta-2 receptor blockade triggers severe bronchoconstriction and blunts rescue albuterol bronchodilation.",
                "recommendation": "Use cardioselective beta-1 agents (e.g. Bisoprolol, Metoprolol tartrate) with extreme caution, or alternative rate control agents.",
                "action": "CLINICAL_REVIEW_REQUIRED"
            }
        ]

        self.allergy_cross_reactivity = [
            {
                "allergen_group": "penicillin",
                "aliases": ["penicillin", "amoxicillin", "ampicillin", "augmentin", "piperacillin"],
                "cross_reactive_drugs": ["amoxicillin", "ampicillin", "augmentin", "cephalexin", "cefazolin", "ceftriaxone", "cefepime"],
                "severity": ClinicalSeverity.FATAL,
                "mechanism": "Beta-lactam ring IgE-mediated type I hypersensitivity reaction (anaphylaxis, laryngeal edema, cardiovascular collapse).",
                "recommendation": "STRICTLY AVOID. In documented penicillin anaphylaxis, cephalosporins with identical R1 side-chains are contraindicated. Use Fluoroquinolones, Macrolides, or Aztreonam.",
                "action": "HALT_PRESCRIPTION"
            },
            {
                "allergen_group": "sulfa",
                "aliases": ["sulfa", "sulfonamides", "bactrim", "septra"],
                "cross_reactive_drugs": ["sulfamethoxazole", "trimethoprim-sulfamethoxazole", "sulfasalazine"],
                "severity": ClinicalSeverity.MAJOR,
                "mechanism": "Sulfonamide arylamine group immune-mediated hypersensitivity (Stevens-Johnson syndrome / DRESS syndrome).",
                "recommendation": "Avoid sulfonamide antibiotics. Switch to Nitrofurantoin, Fosfomycin, or Ciprofloxacin.",
                "action": "HALT_PRESCRIPTION"
            }
        ]

    def check_contraindications(
        self,
        proposed_drugs: List[str],
        active_medications: List[str],
        known_allergies: List[str],
        conditions: List[str],
        egfr_value: Optional[float] = None
    ) -> List[DrugInteractionAlert]:
        alerts: List[DrugInteractionAlert] = []

        # Normalize strings
        prop_drugs_lower = [d.lower().strip() for d in proposed_drugs]
        active_meds_lower = [m.lower().strip() for m in active_medications]
        allergies_lower = [a.lower().strip() for a in known_allergies]
        conditions_lower = [c.lower().strip() for c in conditions]

        all_patient_meds = set(active_meds_lower + prop_drugs_lower)

        # 1. Check Drug-Allergy Cross-Reactivity
        for allergy in allergies_lower:
            for rule in self.allergy_cross_reactivity:
                matches_allergy = any(al in allergy for al in rule["aliases"])
                if matches_allergy:
                    for drug in prop_drugs_lower:
                        if any(crd in drug for crd in rule["cross_reactive_drugs"]):
                            alerts.append(DrugInteractionAlert(
                                drug_a=drug,
                                allergen=allergy,
                                severity=rule["severity"],
                                mechanism=rule["mechanism"],
                                clinical_recommendation=rule["recommendation"],
                                action_required=rule["action"]
                            ))

        # 2. Check Drug-Drug Interactions
        for rule in self.drug_drug_rules:
            d1_pattern = rule["drugs"][0]
            d2_pattern = rule["drugs"][1]
            d2_aliases = rule["aliases"].get(d2_pattern, [d2_pattern])

            has_d1 = any(d1_pattern in m for m in all_patient_meds)
            has_d2 = any(any(alias in m for alias in d2_aliases) for m in all_patient_meds)

            if has_d1 and has_d2:
                # Only alert if at least one is in proposed, or if evaluating current regimen
                alerts.append(DrugInteractionAlert(
                    drug_a=d1_pattern.capitalize(),
                    drug_b=d2_pattern.capitalize(),
                    severity=rule["severity"],
                    mechanism=rule["mechanism"],
                    clinical_recommendation=rule["recommendation"],
                    action_required=rule["action"]
                ))

        # 3. Check Drug-Disease & Organ Clearance Thresholds
        for rule in self.drug_disease_rules:
            drug_name = rule["drug"]
            aliases = rule.get("aliases", [drug_name])
            matches_drug = any(any(alias in m for alias in aliases) for m in all_patient_meds)

            if matches_drug:
                # Check condition terms
                has_condition = any(any(term in c for term in rule["condition_terms"]) for c in conditions_lower)
                
                # Check eGFR cutoff
                egfr_tripped = False
                if "egfr_cutoff" in rule and egfr_value is not None:
                    if egfr_value < rule["egfr_cutoff"]:
                        egfr_tripped = True

                if has_condition or egfr_tripped:
                    alerts.append(DrugInteractionAlert(
                        drug_a=drug_name.capitalize(),
                        condition=", ".join(rule["condition_terms"]),
                        severity=rule["severity"],
                        mechanism=rule["mechanism"],
                        clinical_recommendation=rule["recommendation"],
                        action_required=rule["action"]
                    ))

        return alerts


pharmacovigilance_engine = PharmacovigilanceEngine()
