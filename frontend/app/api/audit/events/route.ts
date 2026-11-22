import { NextResponse } from "next/server";
import { DEMO_AUDIT_LOGS } from "@/app/api/_data/demo_data";

export async function GET() {
  const backendUrl = process.env.BACKEND_INTERNAL_URL;
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/audit/events`, { cache: "no-store" });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {
      // Fallback
    }
  }

  return NextResponse.json({
    total_events: DEMO_AUDIT_LOGS.length,
    audit_events: DEMO_AUDIT_LOGS,
  });
}
