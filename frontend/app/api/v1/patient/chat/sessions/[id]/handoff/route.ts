import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const handoffId = `HO_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return NextResponse.json({
      handoff_id: handoffId,
      session_id: id,
      status: "SUBMITTED",
      reason: body.reason || "Patient requested human clinician consultation",
      urgency: body.urgency || "MEDIUM",
      message: "A licensed triage nurse or clinical officer has been notified and will review your chart shortly.",
      created_at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Failed to submit handoff" }, { status: 400 });
  }
}
