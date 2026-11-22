import { NextResponse } from "next/server";
import { PATIENT_DETAILS } from "@/app/api/_data/demo_data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const backendUrl = process.env.BACKEND_INTERNAL_URL;
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/patients/${id}`, { cache: "no-store" });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {
      // Fallback
    }
  }

  const detail = PATIENT_DETAILS[id.toUpperCase()];
  if (!detail) {
    return NextResponse.json({ detail: `Patient ${id} not found` }, { status: 404 });
  }

  return NextResponse.json(detail);
}
