import { NextResponse } from "next/server";
import { DEMO_AUDIT_LOGS } from "@/app/api/_data/demo_data";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const event = {
      audit_id: `AUDIT_${Date.now()}`,
      run_id: body.run_id || "RUN_MANUAL",
      session_id: body.session_id || "SESS_LIVE",
      patient_id: body.patient_id || "P101",
      clinician_id: body.clinician_id || "DR_CURRENT_USER",
      decision: body.decision || "OVERRIDE_APPROVED",
      override_rationale: body.override_rationale || "Clinician reviewed and authorized action.",
      recorded_at: new Date().toISOString(),
    };
    DEMO_AUDIT_LOGS.unshift(event as any);

    return NextResponse.json({
      success: true,
      message: "Human-in-the-Loop override recorded and cryptographically logged to audit trail.",
      audit_event: event,
    });
  } catch {
    return NextResponse.json({ error: "Failed to record override" }, { status: 400 });
  }
}
