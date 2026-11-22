import { NextResponse } from "next/server";

export async function GET() {
  const backendUrl = process.env.BACKEND_INTERNAL_URL;
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/v1/patient/analytics`, { cache: "no-store" });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {
      // Fallback
    }
  }

  return NextResponse.json({
    active_sessions: 42,
    total_messages: 384,
    emergency_redirects: 14,
    language_breakdown: {
      en: 280,
      bn: 104,
    },
    avg_latency_ms: 38.2,
  });
}
