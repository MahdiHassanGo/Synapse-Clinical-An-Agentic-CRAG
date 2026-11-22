"use client";

import React, { useState, useEffect } from "react";
import {
  Terminal,
  Clock,
  CheckCircle2,
  AlertOctagon,
  XCircle,
  Cpu,
  RefreshCw,
  Send,
  UserCheck,
  ShieldAlert,
  ChevronRight,
  GitCommit,
  Play,
  Plus,
  ArrowRight,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface TriageRunSummary {
  run_id: string;
  session_id: string;
  patient_id?: string;
  query: string;
  status: "PENDING" | "RUNNING" | "PAUSED_FOR_REVIEW" | "COMPLETED" | "FAILED" | "HALTED";
  created_at: string;
  completed_at?: string;
  total_events: number;
  has_response: boolean;
  hitl_required: boolean;
}

interface RunEvent {
  event_type: string;
  timestamp: number;
  data: Record<string, any>;
}

const PRESET_RUNS = [
  {
    label: "Warfarin + Ibuprofen (HITL Gate)",
    patientId: "P102",
    query: "Can I prescribe Ibuprofen 600mg for acute knee arthritis in Arthur Pendleton (P102)?",
    proposedMeds: ["Ibuprofen"],
  },
  {
    label: "Metformin in CKD G4 (eGFR)",
    patientId: "P101",
    query: "Assess renal safety and lactic acidosis risk of continuing Metformin 1000mg BID in Eleanor Vance (P101).",
    proposedMeds: ["Metformin"],
  },
  {
    label: "Spironolactone Hyperkalemia",
    patientId: "P103",
    query: "Evaluate hyperkalemia cardiac arrest risk for Marcus Holloway (P103) on Spironolactone + Enalapril with K+ 5.8 mmol/L.",
    proposedMeds: ["Spironolactone", "Enalapril"],
  },
  {
    label: "Chemotherapy Order Gate",
    patientId: "P101",
    query: "Order systemic chemotherapy protocol with Doxorubicin 60mg/m2 for patient P101.",
    proposedMeds: ["Doxorubicin"],
  },
];

export function AgentRunsView() {
  const [runs, setRuns] = useState<TriageRunSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunDetail, setSelectedRunDetail] = useState<any | null>(null);
  const [eventTimeline, setEventTimeline] = useState<RunEvent[]>([]);
  const [showLaunchModal, setShowLaunchModal] = useState<boolean>(false);
  const [isLaunching, setIsLaunching] = useState<boolean>(false);

  // HITL signoff state
  const [clinicianId, setClinicianId] = useState<string>("DR_9821");
  const [approved, setApproved] = useState<boolean>(true);
  const [overrideRationale, setOverrideRationale] = useState<string>("");
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  const fetchRuns = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/triage/runs`);
      if (res.ok) {
        const data = await res.json();
        const runsList = data.runs || [];
        setRuns(runsList);
        if ((!selectedRunId || !runsList.some((r: any) => r.run_id === selectedRunId)) && runsList.length > 0) {
          setSelectedRunId(runsList[0].run_id);
        }
      }
    } catch (err) {
      console.error("Failed to load runs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 4000);
    return () => clearInterval(interval);
  }, []);

  // Launch a new agent run directly from this view
  const handleLaunchRun = async (query: string, patientId: string, proposedMeds: string[] = []) => {
    setIsLaunching(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/triage/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          patient_id: patientId,
          proposed_medications: proposedMeds,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowLaunchModal(false);
        setSelectedRunId(data.run_id);
        fetchRuns();
      }
    } catch (err) {
      console.error("Failed to launch run", err);
    } finally {
      setIsLaunching(false);
    }
  };

  // Fetch or stream details for selected run
  useEffect(() => {
    if (!selectedRunId) return;

    let isCancelled = false;

    async function loadRun() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/triage/runs/${selectedRunId}`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            setSelectedRunDetail(data);
          }
        }
      } catch (err) {
        console.error("Failed to load run detail", err);
      }
    }

    loadRun();

    // Connect to SSE stream for live updates
    const eventSource = new EventSource(
      `${BACKEND_URL}/api/triage/runs/${selectedRunId}/events`
    );

    eventSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        if (!isCancelled) {
          setEventTimeline((prev) => [...prev, { event_type: "message", timestamp: Date.now(), data: parsed }]);
        }
      } catch (err) {
        // ignore raw
      }
    };

    const listeners = [
      "node_started",
      "node_completed",
      "trace_step",
      "hitl_interrupted",
      "hitl_resumed",
      "run_completed",
      "error",
    ];

    listeners.forEach((type) => {
      eventSource.addEventListener(type, (e: any) => {
        try {
          const data = JSON.parse(e.data);
          if (!isCancelled) {
            setEventTimeline((prev) => [
              ...prev,
              { event_type: type, timestamp: Date.now(), data },
            ]);
            if (type === "run_completed" || type === "hitl_interrupted") {
              loadRun();
              fetchRuns();
            }
          }
        } catch (err) {
          console.error("Event parse error", err);
        }
      });
    });

    return () => {
      isCancelled = true;
      eventSource.close();
      setEventTimeline([]);
    };
  }, [selectedRunId]);

  // Submit HITL Review
  const handleSubmitReview = async () => {
    if (!selectedRunId) return;
    if (approved && !overrideRationale.trim()) {
      alert("Mandatory clinical override rationale is required by regulatory policy.");
      return;
    }

    setIsSubmittingReview(true);
    setReviewMessage(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/triage/runs/${selectedRunId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinician_id: clinicianId,
          approved,
          override_rationale: overrideRationale,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setReviewMessage(`Review successfully recorded: ${data.decision}`);
        setOverrideRationale("");
        fetchRuns();
        const detailRes = await fetch(`${BACKEND_URL}/api/triage/runs/${selectedRunId}`);
        if (detailRes.ok) {
          setSelectedRunDetail(await detailRes.json());
        }
      } else {
        const err = await res.json();
        setReviewMessage(`Review rejected: ${err.detail || "Error"}`);
      }
    } catch (err) {
      setReviewMessage(`Network error: ${err}`);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const selectedSummary = runs.find((r) => r.run_id === selectedRunId);

  return (
    <div className="flex-1 overflow-hidden flex flex-col font-sans">
      {/* Subheader */}
      <div className="h-14 border-b border-white/[0.08] px-6 flex items-center justify-between bg-graphite-900/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-clinical-blue" />
            <h1 className="text-sm font-semibold text-white">
              Agentic RAG Execution Runs & HITL Management
            </h1>
          </div>
          <span className="text-[11px] font-mono text-graphite-400 px-2 py-0.5 rounded bg-graphite-800 border border-white/[0.06]">
            {runs.length} runs recorded
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLaunchModal(true)}
            className="px-3 py-1.5 rounded-lg bg-clinical-blue hover:bg-clinical-blue/90 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Launch New Run</span>
          </button>

          <button
            onClick={fetchRuns}
            className="px-2.5 py-1.5 rounded-lg bg-graphite-800 hover:bg-graphite-750 border border-white/[0.06] text-graphite-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Quick Launch Modal / Popover */}
      {showLaunchModal && (
        <div className="bg-graphite-850 border-b border-white/[0.08] p-4 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div>
            <div className="text-xs font-semibold text-white">Select a Clinical Scenario to Execute:</div>
            <div className="text-[11px] text-graphite-400">Triggers full 14-node LangGraph execution with real-time SSE streaming.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_RUNS.map((p, idx) => (
              <button
                key={idx}
                disabled={isLaunching}
                onClick={() => handleLaunchRun(p.query, p.patientId, p.proposedMeds)}
                className="px-2.5 py-1.5 rounded-lg bg-graphite-800 hover:bg-graphite-750 border border-white/[0.08] text-xs text-graphite-200 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Play className="w-3 h-3 text-clinical-blue fill-clinical-blue" />
                <span>{p.label}</span>
              </button>
            ))}
            <button
              onClick={() => setShowLaunchModal(false)}
              className="px-2.5 py-1.5 rounded-lg bg-graphite-900 text-graphite-400 hover:text-white text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left List of Runs */}
        <div className="w-96 border-r border-white/[0.08] bg-graphite-950/60 overflow-y-auto divide-y divide-white/[0.04]">
          {loading ? (
            <div className="p-6 text-center text-xs font-mono text-graphite-400">
              Loading agent execution runs...
            </div>
          ) : runs.length === 0 ? (
            <div className="p-6 text-center text-xs text-graphite-400 space-y-3">
              <div>No triage runs initiated yet in this session.</div>
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] text-graphite-500 block">Launch a benchmark scenario:</span>
                {PRESET_RUNS.slice(0, 2).map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleLaunchRun(p.query, p.patientId, p.proposedMeds)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-graphite-900 hover:bg-graphite-850 border border-white/[0.06] text-[11px] text-graphite-300 hover:text-white flex items-center justify-between transition-colors"
                  >
                    <span>{p.label}</span>
                    <ArrowRight className="w-3 h-3 text-clinical-blue" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            runs.map((run) => {
              const isSelected = run.run_id === selectedRunId;
              const isPaused = run.status === "PAUSED_FOR_REVIEW";
              const isDone = run.status === "COMPLETED";
              const isFailed = run.status === "FAILED";

              return (
                <button
                  key={run.run_id}
                  onClick={() => setSelectedRunId(run.run_id)}
                  className={`w-full text-left p-4 transition-all block ${
                    isSelected
                      ? "bg-graphite-900 border-l-2 border-clinical-blue"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-clinical-blue font-semibold">
                      {run.run_id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                        isPaused
                          ? "bg-clinical-rose/20 text-clinical-rose border border-clinical-rose/30 animate-pulse"
                          : isDone
                          ? "bg-clinical-emerald/10 text-clinical-emerald border border-clinical-emerald/20"
                          : isFailed
                          ? "bg-clinical-rose/10 text-clinical-rose"
                          : "bg-clinical-blue/10 text-clinical-blue"
                      }`}
                    >
                      {run.status}
                    </span>
                  </div>

                  <div className="text-xs text-graphite-200 line-clamp-2 mt-1.5 leading-snug">
                    {run.query}
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-graphite-400 mt-2">
                    <span>Patient: {run.patient_id || "None"}</span>
                    <span>{run.created_at}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Detail Pane */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {selectedSummary ? (
            <>
              {/* Run Overview Header */}
              <div className="bg-graphite-900 border border-white/[0.08] rounded-2xl p-5 space-y-3 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                  <div>
                    <div className="text-[10px] uppercase font-mono text-graphite-500">
                      Run Lifecycle State
                    </div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{selectedSummary.run_id}</span>
                      <span className="text-xs font-mono font-normal text-graphite-400">
                        (Session: {selectedSummary.session_id})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-mono font-semibold ${
                        selectedSummary.status === "PAUSED_FOR_REVIEW"
                          ? "bg-clinical-rose/20 text-clinical-rose border border-clinical-rose/40 animate-pulse"
                          : selectedSummary.status === "COMPLETED"
                          ? "bg-clinical-emerald/15 text-clinical-emerald border border-clinical-emerald/30"
                          : "bg-graphite-800 text-graphite-300"
                      }`}
                    >
                      {selectedSummary.status}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-graphite-200 bg-graphite-850 p-3 rounded-xl border border-white/[0.04] leading-relaxed">
                  <span className="text-[10px] uppercase font-mono text-graphite-500 block mb-1">
                    Clinical Inquiry:
                  </span>
                  &ldquo;{selectedSummary.query}&rdquo;
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono text-graphite-400">
                  <div>
                    <span className="text-[10px] text-graphite-500 block">Patient Target</span>
                    <span className="text-white">{selectedSummary.patient_id || "Unspecified"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-graphite-500 block">Created At</span>
                    <span className="text-graphite-200">{selectedSummary.created_at}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-graphite-500 block">Completed At</span>
                    <span className="text-graphite-200">{selectedSummary.completed_at || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-graphite-500 block">Recorded Events</span>
                    <span className="text-clinical-teal">{selectedSummary.total_events}</span>
                  </div>
                </div>
              </div>

              {/* HITL Review Panel if PAUSED */}
              {selectedSummary.status === "PAUSED_FOR_REVIEW" && (
                <div className="bg-graphite-900 border border-clinical-rose/30 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center gap-2 text-clinical-rose pb-2 border-b border-clinical-rose/20">
                    <AlertOctagon className="w-5 h-5" />
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        Human-in-the-Loop Clinical Intercept Active
                      </h3>
                      <p className="text-[11px] text-clinical-rose/90 font-mono">
                        Regulated high-risk intervention paused awaiting authenticated clinician sign-off.
                      </p>
                    </div>
                  </div>

                  {reviewMessage && (
                    <div className="p-3 rounded-xl bg-graphite-850 border border-white/[0.08] text-xs text-white">
                      {reviewMessage}
                    </div>
                  )}

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-[11px] font-medium text-graphite-400 block mb-1">
                        Reviewing Clinician ID (Authenticated)
                      </label>
                      <input
                        type="text"
                        value={clinicianId}
                        onChange={(e) => setClinicianId(e.target.value)}
                        className="w-full bg-graphite-850 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-clinical-blue"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-graphite-400 block mb-1">
                        Clinical Action
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-graphite-200 cursor-pointer">
                          <input
                            type="radio"
                            name="decision"
                            checked={approved}
                            onChange={() => setApproved(true)}
                            className="accent-clinical-emerald"
                          />
                          <span>Approve Protocol with Override</span>
                        </label>
                        <label className="flex items-center gap-2 text-graphite-200 cursor-pointer">
                          <input
                            type="radio"
                            name="decision"
                            checked={!approved}
                            onChange={() => setApproved(false)}
                            className="accent-clinical-rose"
                          />
                          <span>Halt / Reject Protocol</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-graphite-400 block mb-1">
                        Mandatory Clinical Override Rationale
                      </label>
                      <textarea
                        rows={3}
                        value={overrideRationale}
                        onChange={(e) => setOverrideRationale(e.target.value)}
                        placeholder="Detail mitigating clinical safeguards (e.g., co-prescribed high-dose PPI, scheduled 48h renal labs, patient risk counseled)..."
                        className="w-full bg-graphite-850 border border-white/[0.08] rounded-xl p-3 text-xs text-white placeholder-graphite-500 focus:outline-none focus:border-clinical-blue resize-none"
                      />
                    </div>

                    <button
                      onClick={handleSubmitReview}
                      disabled={isSubmittingReview}
                      className={`px-4 py-2 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                        approved
                          ? "bg-clinical-emerald hover:bg-clinical-emerald/90"
                          : "bg-clinical-rose hover:bg-clinical-rose/90"
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isSubmittingReview ? "Submitting..." : "Sign Off & Resume Run"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Execution Trace Timeline */}
              <div className="bg-graphite-900 border border-white/[0.08] rounded-2xl p-5 space-y-3 shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-clinical-blue" />
                    <h3 className="text-xs font-semibold text-white">
                      Real-Time Server-Sent Events (SSE) Execution Timeline
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-graphite-400">
                    Live Stream / Audit Replay
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedRunDetail?.response?.execution_trace &&
                    selectedRunDetail.response.execution_trace.map((step: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-graphite-850 border border-white/[0.04] rounded-xl p-3 flex items-start justify-between text-xs"
                      >
                        <div className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-clinical-emerald shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                              <span>{step.step_name}</span>
                              <span className="text-[10px] font-mono text-graphite-400">
                                {step.latency_ms > 0 ? `${step.latency_ms}ms` : "in-progress"}
                              </span>
                            </div>
                            <div className="text-[11px] text-graphite-300 mt-0.5">
                              {step.description}
                            </div>
                          </div>
                        </div>

                        {step.metadata && (
                          <div className="text-[10px] font-mono text-graphite-400 text-right">
                            {JSON.stringify(step.metadata)}
                          </div>
                        )}
                      </div>
                    ))}

                  {eventTimeline.length > 0 &&
                    eventTimeline.map((ev, idx) => (
                      <div
                        key={`ev-${idx}`}
                        className="bg-graphite-850/60 border border-clinical-blue/20 rounded-xl p-2.5 text-[11px] font-mono text-graphite-300 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <GitCommit className="w-3 h-3 text-clinical-blue" />
                          <span className="text-clinical-blue font-bold">[{ev.event_type}]</span>
                          <span className="truncate max-w-md">
                            {JSON.stringify(ev.data).slice(0, 80)}...
                          </span>
                        </div>
                        <span className="text-[10px] text-graphite-500">
                          {new Date(ev.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          ) : (
            <div className="max-w-3xl mx-auto py-10 space-y-6">
              <div className="bg-graphite-900 border border-white/[0.08] rounded-2xl p-6 space-y-3 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-clinical-blue/10 border border-clinical-blue/20 flex items-center justify-center text-clinical-blue shrink-0">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Agentic RAG Execution & Human-in-the-Loop Supervision
                    </h2>
                    <p className="text-xs text-graphite-400 mt-0.5">
                      14-Node LangGraph state machine with real-time SSE telemetry, CRAG routing, Self-RAG verification, and regulatory interrupt states.
                    </p>
                  </div>
                </div>

                <div className="pt-2 text-xs text-graphite-300 leading-relaxed border-t border-white/[0.06]">
                  {runs.length === 0 ? (
                    <p>
                      No agent runs have been executed in this session yet. You can launch an immediate agent execution below or initiate inquiries from the <strong className="text-white">Clinical Workspace</strong> tab.
                    </p>
                  ) : (
                    <p>
                      Select an execution run from the left list to review its live SSE event stream, telemetry node checkpoints, and pending clinician sign-off actions.
                    </p>
                  )}
                </div>
              </div>

              {/* Instant Execution Presets */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Execute Benchmark Clinical Scenarios</span>
                  <span className="font-mono text-[11px] text-graphite-400">1-Click Live LangGraph Execution</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PRESET_RUNS.map((p, idx) => (
                    <div
                      key={idx}
                      className="bg-graphite-900 hover:bg-graphite-850 border border-white/[0.08] hover:border-clinical-blue/30 rounded-xl p-4 space-y-3 transition-all flex flex-col justify-between shadow-lg"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white">{p.label}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-graphite-800 text-clinical-blue border border-white/[0.06]">
                            {p.patientId}
                          </span>
                        </div>
                        <p className="text-[11px] text-graphite-400 line-clamp-2 leading-relaxed">
                          &ldquo;{p.query}&rdquo;
                        </p>
                      </div>

                      <button
                        onClick={() => handleLaunchRun(p.query, p.patientId, p.proposedMeds)}
                        disabled={isLaunching}
                        className="w-full py-2 px-3 rounded-lg bg-clinical-blue/15 hover:bg-clinical-blue text-clinical-blue hover:text-white border border-clinical-blue/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{isLaunching ? "Launching Node Flow..." : "Launch Scenario"}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
