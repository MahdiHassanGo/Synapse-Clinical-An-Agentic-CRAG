import { NextResponse } from "next/server";

interface TriageRun {
  run_id: string;
  session_id: string;
  patient_id: string;
  query: string;
  status: "PENDING" | "RUNNING" | "PAUSED_FOR_REVIEW" | "COMPLETED" | "FAILED" | "HALTED";
  created_at: string;
  completed_at?: string;
  total_events: number;
  has_response: boolean;
  hitl_required: boolean;
}

const DEMO_RUNS: TriageRun[] = [
  {
    run_id: "RUN_P102_WARFARIN_HITL",
    session_id: "SESS_DEMO_01",
    patient_id: "P102",
    query: "Can I prescribe Ibuprofen 600mg for acute knee arthritis in Arthur Pendleton (P102)?",
    status: "PAUSED_FOR_REVIEW",
    created_at: "2026-11-22T10:14:00Z",
    total_events: 18,
    has_response: true,
    hitl_required: true,
  },
  {
    run_id: "RUN_P101_METFORMIN_CKD",
    session_id: "SESS_DEMO_02",
    patient_id: "P101",
    query: "Assess renal safety and lactic acidosis risk of continuing Metformin 1000mg BID in Eleanor Vance (P101).",
    status: "COMPLETED",
    created_at: "2026-11-22T09:30:00Z",
    completed_at: "2026-11-22T09:30:02Z",
    total_events: 22,
    has_response: true,
    hitl_required: true,
  },
  {
    run_id: "RUN_P103_HYPERKALEMIA",
    session_id: "SESS_DEMO_03",
    patient_id: "P103",
    query: "Evaluate hyperkalemia cardiac arrest risk for Marcus Holloway (P103) on Spironolactone + Enalapril with K+ 5.8 mmol/L.",
    status: "COMPLETED",
    created_at: "2026-11-22T08:45:00Z",
    completed_at: "2026-11-22T08:45:03Z",
    total_events: 20,
    has_response: true,
    hitl_required: true,
  },
];

export async function GET() {
  const backendUrl = process.env.BACKEND_INTERNAL_URL;
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/triage/runs`, { cache: "no-store" });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {
      // Fallback
    }
  }

  return NextResponse.json({
    count: DEMO_RUNS.length,
    runs: DEMO_RUNS,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const runId = `RUN_${Date.now().toString(36).toUpperCase()}`;
    const newRun: TriageRun = {
      run_id: runId,
      session_id: `SESS_${Date.now().toString(36).toUpperCase()}`,
      patient_id: body.patient_id || "P101",
      query: body.query || "Assessment request",
      status: "COMPLETED",
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      total_events: 16,
      has_response: true,
      hitl_required: true,
    };
    DEMO_RUNS.unshift(newRun);

    return NextResponse.json(newRun);
  } catch {
    return NextResponse.json({ error: "Failed to create run" }, { status: 400 });
  }
}
