import { NextRequest } from "next/server";
import { PATIENT_DETAILS } from "@/app/api/_data/demo_data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "Assess medication safety";
  const patientId = (searchParams.get("patient_id") || "P101").toUpperCase();

  const patient = PATIENT_DETAILS[patientId] || PATIENT_DETAILS["P101"];
  const isP101 = patientId === "P101";
  const isP102 = patientId === "P102";
  const isP103 = patientId === "P103";

  const runId = `RUN_${patientId}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: any) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      // 1. Patient Context Extraction
      sendEvent("step_update", {
        step: "PATIENT_CONTEXT_EXTRACTION",
        message: `Extracting EHR records, lab values, KDIGO renal stage, and allergy profile for ${patient.patient.first_name} ${patient.patient.last_name}...`,
      });
      await sleep(150);

      sendEvent("trace_step", {
        step_name: "PATIENT_CONTEXT_EXTRACTION",
        description: `EHR context retrieved: eGFR ${patient.renal_status.egfr_value} mL/min (${patient.renal_status.kdigo_stage}), active meds: ${patient.active_medications.map(m => m.drug_name).join(", ")}.`,
        status: "COMPLETED",
        latency_ms: 112,
      });

      // 2. CRAG Retrieval & Grading
      sendEvent("step_update", {
        step: "CRAG_RETRIEVAL_AND_GRADING",
        message: "Executing multi-stage vector retrieval and document relevance grading (CRAG)...",
      });
      await sleep(180);

      sendEvent("crag_status", {
        iterations: 1,
        rewritten_queries: [
          `NICE guideline management for ${patient.patient.primary_diagnosis}`,
          `Renal clearance threshold Cockcroft-Gault dosing for ${patientId}`,
        ],
      });

      sendEvent("trace_step", {
        step_name: "CRAG_RETRIEVAL_AND_GRADING",
        description: "CRAG graded 3 documents RELEVANT, 1 AMBIGUOUS. Rewrote query and augmented with KDIGO 2024 guidance.",
        status: "COMPLETED",
        latency_ms: 245,
      });

      // 3. Pharmacology Calculator & Safety Checks
      sendEvent("step_update", {
        step: "SAFETY_CALCULATOR",
        message: "Evaluating deterministic Cockcroft-Gault CrCl, drug-drug interactions, and contraindication matrix...",
      });
      await sleep(150);

      sendEvent("trace_step", {
        step_name: "SAFETY_CALCULATOR",
        description: `Cockcroft-Gault CrCl: ${patient.renal_status.crcl_value} mL/min. Flagged safety rules and allergen cross-checks computed.`,
        status: "COMPLETED",
        latency_ms: 88,
      });

      // 4. Self-RAG Reflection
      sendEvent("step_update", {
        step: "SELF_RAG_CRITIQUE",
        message: "Decomposing generated response into atomic clinical claims for NLI citation verification...",
      });
      await sleep(180);

      const selfRagCritique = {
        is_supported: true,
        support_score: 0.96,
        is_useful: true,
        utility_score: 0.95,
        cited_chunk_ids: [
          isP101 ? "NICE_NG28_DIABETES#1" : isP102 ? "NICE_NG196_AFIB#1" : "KDIGO_CKD_2024#1",
        ],
        hallucination_warnings: [],
      };
      sendEvent("self_rag_tokens", selfRagCritique);

      sendEvent("trace_step", {
        step_name: "SELF_RAG_CRITIQUE",
        description: "Self-RAG verification: 100% of claims grounded in retrieved NICE/KDIGO chunks (Support score: 0.96).",
        status: "COMPLETED",
        latency_ms: 195,
      });

      // 5. HITL Gate evaluation
      const hitlRequired = isP101 || isP102 || isP103;

      const contraindications = hitlRequired
        ? [
            {
              drug_a: isP101 ? "Metformin" : isP102 ? "Warfarin" : "Spironolactone",
              drug_b: isP101 ? "CKD G4 (eGFR 22.4)" : isP102 ? "Ibuprofen" : "Enalapril",
              condition: isP101 ? "CKD Stage 4" : undefined,
              severity: "CRITICAL",
              mechanism: isP101
                ? "Renal elimination failure leads to toxic accumulation and Metformin-Associated Lactic Acidosis (MALA)."
                : isP102
                ? "Synergistic hemostasis breakdown: platelet COX-1 inhibition combined with vitamin K antagonism quadruples GI bleeding hazard."
                : "Combined potassium-sparing diuretic with ACE inhibitor in renal impairment leads to severe cardiac arrhythmia.",
              clinical_recommendation: isP101
                ? "Discontinue Metformin immediately and consider insulin titration."
                : isP102
                ? "Substitute with Paracetamol 1000mg TID and avoid systemic NSAIDs."
                : "Hold Spironolactone, recheck serum K+, and obtain urgent ECG.",
              action_required: isP101 ? "DISCONTINUE_METFORMIN" : isP102 ? "SUBSTITUTE_PARACETAMOL" : "HOLD_MEDICATION",
            },
          ]
        : [];

      const hitlGate = {
        is_required: hitlRequired,
        risk_level: hitlRequired ? "CRITICAL" : "LOW",
        reason: isP101
          ? "CRITICAL RENAL HAZARD: Metformin is strictly contraindicated in CKD Stage G4 (eGFR < 30 mL/min) due to high risk of Metformin-Associated Lactic Acidosis (MALA)."
          : isP102
          ? "MAJOR DRUG INTERACTION: Concurrent Warfarin + NSAID (Ibuprofen) quadruples gastrointestinal hemorrhage risk. Clinician override or Paracetamol substitution required."
          : isP103
          ? "CRITICAL HYPERKALEMIA: Serum K+ is 5.8 mmol/L. Co-administration of Spironolactone + Enalapril poses acute cardiac arrest risk."
          : "Standard review complete. No critical gates tripped.",
        severity: hitlRequired ? "CRITICAL" : "LOW",
        contraindications_detected: contraindications,
        recommended_action: isP101
          ? "DISCONTINUE_METFORMIN"
          : isP102
          ? "SUBSTITUTE_PARACETAMOL"
          : "ADJUST_DOSE",
        approved: null,
      };

      if (hitlRequired) {
        sendEvent("hitl_interrupted", hitlGate);
        await sleep(100);
      }

      // Synthesis text
      let synthesisText = "";
      if (isP101) {
        synthesisText = `**Clinical Recommendation for Eleanor Vance (MRN-882190, 72yo F):**\n\n1. **Urgent Metformin Discontinuation:** Patient's current eGFR is 22.4 mL/min/1.73m² (KDIGO Stage G4), and serum creatinine is 2.4 mg/dL. In accordance with NICE NG28 (Section 1.4) and KDIGO 2024 guidelines, Metformin is contraindicated below 30 mL/min due to the risk of Metformin-Associated Lactic Acidosis (MALA). Continued administration of 1000 mg BID represents an unsafe clinical hazard.\n\n2. **Alternative Glycemic Strategy:** Consider initiating an SGLT2 inhibitor approved for CKD progression or insulin titration with frequent capillary glucose monitoring.\n\n3. **Renal Safety:** Retest serum creatinine and eGFR in 2 to 4 weeks. Maintain Lisinopril for renal protection with potassium surveillance.`;
      } else if (isP102) {
        synthesisText = `**Clinical Recommendation for Arthur Pendleton (MRN-991203, 75yo M):**\n\n1. **Avoid NSAIDs (Ibuprofen):** Patient is anticoagulated with Warfarin (INR 2.8). The addition of Ibuprofen significantly elevates the hazard ratio of severe upper gastrointestinal bleeding (NICE NG196).\n\n2. **Analgesic Substitution:** Recommend switching to Paracetamol (Acetaminophen) 1000 mg PO TID PRN, supplemented with topical capsaicin or short-course physical therapy.\n\n3. **Monitoring:** If an anti-inflammatory cannot be avoided under specialist override, co-prescribe a proton pump inhibitor (e.g., Omeprazole 20mg daily) and monitor INR within 3-5 days.`;
      } else {
        synthesisText = `**Clinical Assessment for ${patient.patient.first_name} ${patient.patient.last_name}:**\n\nBased on retrieved clinical guidelines and verified pharmacological parameters:\n- Query: "${query}"\n- Current Renal Stage: ${patient.renal_status.kdigo_stage}\n- Recommended protocol adherence confirmed against evidence base.`;
      }

      const completeData = {
        run_id: runId,
        query,
        patient_id: patientId,
        clinical_synthesis: synthesisText,
        retrieved_guidelines: [
          {
            chunk_id: isP101 ? "NICE_NG28_DIABETES#1" : isP102 ? "NICE_NG196_AFIB#1" : "KDIGO_CKD_2024#1",
            doc_id: isP101 ? "NICE_NG28_DIABETES" : isP102 ? "NICE_NG196_AFIB" : "KDIGO_CKD_2024",
            title: isP101
              ? "Type 2 Diabetes in Adults: Management (NICE NG28)"
              : isP102
              ? "Atrial Fibrillation: Diagnosis and Management (NICE NG196)"
              : "KDIGO Clinical Practice Guideline for CKD",
            source_organization: isP101 ? "NICE" : "KDIGO",
            section: isP101 ? "Section 1.4: Renal Thresholds" : "Section 2.1: Bleeding Risks",
            content: isP101
              ? "Metformin review: Review the dose if eGFR < 45 mL/min. Stop metformin if eGFR < 30 mL/min due to risk of lactic acidosis."
              : "Do not routinely offer aspirin or NSAIDs monotherapy or combination to prevent stroke in people with AF due to bleeding risk.",
            relevance_score: 0.94,
            similarity_score: 0.94,
            is_relevant: true,
          },
          {
            chunk_id: "KDIGO_CKD_2024#1",
            doc_id: "KDIGO_CKD_2024",
            title: "KDIGO Guideline for Chronic Kidney Disease",
            source_organization: "KDIGO",
            section: "Practice Point 1.2: Dosing in Renal Impairment",
            content: "Dosing of cleared drugs must be adjusted according to estimated GFR or CrCl.",
            relevance_score: 0.89,
            similarity_score: 0.89,
            is_relevant: true,
          },
        ],
        claim_verifications: [
          {
            claim_id: "CLM_01",
            claim_text: isP101
              ? "Metformin is strictly contraindicated when eGFR is below 30 mL/min/1.73m² due to lactic acidosis hazard."
              : "Warfarin combined with Ibuprofen increases upper GI bleeding hazard fourfold.",
            verdict: "SUPPORTED",
            entailment_explanation: "Directly entailed by NICE guideline safety standards and renal elimination parameters.",
            evidence_quote: isP101
              ? "Stop metformin if eGFR is less than 30 mL/min/1.73m²."
              : "Concurrent NSAID administration increases bleeding risk.",
            matched_chunk_id: isP101 ? "NICE_NG28_DIABETES#1" : "NICE_NG196_AFIB#1",
          },
          {
            claim_id: "CLM_02",
            claim_text: `Deterministic Cockcroft-Gault CrCl calculation indicates severe renal impairment (${patient.renal_status.crcl_value} mL/min).`,
            verdict: "SUPPORTED",
            entailment_explanation: "Mathematically validated using patient age, weight, and serum creatinine.",
            evidence_quote: `CrCl = ${patient.renal_status.crcl_value} mL/min`,
            matched_chunk_id: "KDIGO_CKD_2024#1",
          },
        ],
        calculations: [
          {
            calculator_name: "Cockcroft-Gault CrCl",
            computed_value: patient.renal_status.crcl_value,
            unit: "mL/min",
            clinical_interpretation: patient.renal_status.kdigo_stage,
            inputs_used: {
              age: patient.patient.age,
              weight_kg: patient.patient.weight_kg,
              gender: patient.patient.gender,
              serum_creatinine: patient.renal_status.serum_creatinine_mg_dl,
            },
          },
          {
            calculator_name: "CKD-EPI 2021 eGFR",
            computed_value: patient.renal_status.egfr_value,
            unit: "mL/min/1.73m²",
            clinical_interpretation: "KDIGO Category G4",
            inputs_used: {
              age: patient.patient.age,
              gender: patient.patient.gender,
              serum_creatinine: patient.renal_status.serum_creatinine_mg_dl,
            },
          },
        ],
        interaction_alerts: contraindications,
        model_routing_decisions: [
          {
            task: "CLINICAL_TRIAGE",
            selected_provider: "OpenRouter",
            selected_model: "google/gemini-2.5-flash",
            rationale: "Lowest latency for acute clinical triage safety screening",
            latency_ms: 245,
            tokens_used: 412,
            cost_usd: 0.00038,
            fallback_used: false,
          },
          {
            task: "CRAG_WEB_EXPANSION",
            selected_provider: "OpenRouter",
            selected_model: "meta-llama/llama-3.3-70b-instruct",
            rationale: "High-parameter reasoning for guideline reconciliation",
            latency_ms: 180,
            tokens_used: 288,
            cost_usd: 0.00021,
            fallback_used: false,
          },
        ],
        self_rag_critique: selfRagCritique,
        hitl_gate: hitlGate,
        total_latency_ms: 820,
      };

      sendEvent("complete", completeData);
      sendEvent("run_completed", completeData);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
