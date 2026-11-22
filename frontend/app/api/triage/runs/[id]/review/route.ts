import { NextResponse } from "next/server";
import { DEMO_AUDIT_LOGS } from "@/app/api/_data/demo_data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const approved = Boolean(body.approved);
    const clinicianId = body.clinician_id || "DR_CURRENT_USER";
    const rationale = body.override_rationale || (approved ? "Clinician authorized" : "Clinician rejected");

    DEMO_AUDIT_LOGS.unshift({
      audit_id: `AUDIT_${Date.now()}`,
      run_id: id,
      session_id: "SESS_LIVE",
      patient_id: body.patient_id || "P101",
      clinician_id: clinicianId,
      decision: approved ? "OVERRIDE_APPROVED" : "OVERRIDE_REJECTED",
      override_rationale: rationale,
      recorded_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      run_id: id,
      approved,
      clinician_id: clinicianId,
      message: approved
        ? `Run ${id} approved by ${clinicianId}. Safety audit record generated.`
        : `Run ${id} rejected by ${clinicianId}. Order cancelled.`,
    });
  } catch {
    return NextResponse.json({ error: "Review submission failed" }, { status: 400 });
  }
}
