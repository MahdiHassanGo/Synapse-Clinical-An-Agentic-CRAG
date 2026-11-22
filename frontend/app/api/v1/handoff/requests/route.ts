import { NextResponse } from "next/server";
import { DEMO_HANDOFF_REQUESTS } from "@/app/api/_data/demo_data";

export async function GET() {
  const backendUrl = process.env.BACKEND_INTERNAL_URL;
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/v1/handoff/requests`, { cache: "no-store" });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {
      // Fallback
    }
  }

  return NextResponse.json(DEMO_HANDOFF_REQUESTS);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newReq = {
      request_id: `HO_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      tenant_id: body.tenant_id || "DEFAULT_HOSPITAL",
      session_id: body.session_id || "SESS_NEW",
      patient_id: body.patient_id || "P101",
      patient_name: body.patient_name || "Eleanor Vance",
      user_query: body.user_query || "Clinical consultation needed",
      status: "WAITING",
      urgency: body.urgency || "MEDIUM",
      reason: body.reason || "Patient request",
      assigned_to: null,
      notes: body.notes || "",
      created_at: new Date().toISOString(),
    };
    return NextResponse.json(newReq);
  } catch {
    return NextResponse.json({ error: "Failed to create handoff request" }, { status: 400 });
  }
}
