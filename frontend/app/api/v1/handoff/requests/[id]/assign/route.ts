import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    return NextResponse.json({
      success: true,
      request_id: id,
      assigned_to: body.assigned_to || "Clinician",
      status: "ASSIGNED",
      message: `Handoff request ${id} assigned to ${body.assigned_to || "Clinician"}.`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to assign request" }, { status: 400 });
  }
}
