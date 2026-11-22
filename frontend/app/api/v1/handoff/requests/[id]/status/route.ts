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
      status: body.status || "RESOLVED",
      notes: body.notes || "",
      updated_at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Failed to update status" }, { status: 400 });
  }
}
