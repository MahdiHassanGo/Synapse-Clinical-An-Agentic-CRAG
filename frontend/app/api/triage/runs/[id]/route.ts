import { NextResponse } from "next/server";
import { PATIENT_DETAILS } from "@/app/api/_data/demo_data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const isP102 = id.includes("P102");
  const isP103 = id.includes("P103");
  const patientKey = isP102 ? "P102" : isP103 ? "P103" : "P101";
  const patient = PATIENT_DETAILS[patientKey];

  return NextResponse.json({
    run_id: id,
    session_id: "SESS_ACTIVE",
    patient_id: patientKey,
    patient_name: `${patient.patient.first_name} ${patient.patient.last_name}`,
    query: isP102
      ? "Can I prescribe Ibuprofen 600mg for acute knee arthritis in Arthur Pendleton (P102)?"
      : "Assess renal safety and lactic acidosis risk of continuing Metformin 1000mg BID in Eleanor Vance (P101).",
    status: isP102 ? "PAUSED_FOR_REVIEW" : "COMPLETED",
    created_at: "2026-11-22T10:14:00Z",
    hitl_required: true,
    hitl_gate: {
      is_required: true,
      reason: isP102
        ? "MAJOR DRUG INTERACTION: Concurrent Warfarin + NSAID (Ibuprofen) quadruples gastrointestinal hemorrhage risk. Clinician override or Paracetamol substitution required."
        : "CRITICAL RENAL HAZARD: Metformin is strictly contraindicated in CKD Stage G4 (eGFR < 30 mL/min).",
      severity: "CRITICAL",
      recommended_action: isP102 ? "SUBSTITUTE_PARACETAMOL" : "DISCONTINUE_METFORMIN",
    },
    clinical_synthesis: isP102
      ? "Arthur Pendleton is anticoagulated on Warfarin with an INR of 2.8. Co-administration of Ibuprofen (NSAID) carries an unacceptably high hazard ratio for life-threatening gastrointestinal hemorrhage. Recommend immediate substitution with Paracetamol 1000mg PO TID PRN."
      : "Eleanor Vance presents with CKD Stage 4 (eGFR 22.4 mL/min, Serum Creatinine 2.4 mg/dL). Metformin is contraindicated below 30 mL/min due to risk of fatal lactic acidosis. Discontinue immediately.",
    events_count: 18,
    metrics: {
      latency_ms: 780,
      tokens_used: 1240,
      cost_usd: 0.00045,
    },
  });
}
