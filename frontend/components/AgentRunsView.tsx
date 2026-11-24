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
    <div className="flex-1 overflow-hidden flex flex-col font-sans bg-canvas text-ink">
      {/* Subheader */}
      <div className="h-14 border-b border-hairline px-4 sm:px-6 flex items-center justify-between bg-surface shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Terminal className="w-4 h-4 text-accent shrink-0" />
            <h1 className="text-sm font-semibold text-ink truncate">
              Agentic RAG Execution Runs &amp; HITL Supervision
            </h1>
          </div>
          <span className="hidden sm:inline-block text-[11px] font-mono text-ink-muted px-2 py-0.5 rounded bg-subtle border border-hairline shrink-0">
            {runs.length} runs recorded
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowLaunchModal(true)}
            className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Launch New Run</span>
          </button>

          <button
            type="button"
            onClick={fetchRuns}
            className="px-2.5 py-1.5 rounded-lg bg-subtle hover:bg-muted border border-hairline text-ink-secondary hover:text-ink text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Quick Launch Popover */}
      {showLaunchModal && (
        <div className="bg-subtle border-b border-hairline p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-ink">Select a Clinical Scenario to Execute:</div>
            <div className="text-xs text-ink-muted">Triggers full 14-node LangGraph execution with real-time SSE streaming.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_RUNS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isLaunching}
                onClick={() => handleLaunchRun(p.query, p.patientId, p.proposedMeds)}
                className="px-2.5 py-1.5 rounded-lg bg-surface hover:bg-accent-soft border border-hairline hover:border-accent-border text-xs text-ink flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-3 h-3 text-accent fill-accent" />
                <span>{p.label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowLaunchModal(false)}
              className="px-2.5 py-1.5 rounded-lg bg-surface border border-hairline text-ink-muted hover:text-ink text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left List of Runs */}
        <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-hairline bg-surface overflow-y-auto divide-y divide-hairline max-h-[38vh] lg:max-h-none shrink-0">
          {loading ? (
            <div className="p-6 text-center text-xs font-mono text-ink-muted">
              Loading agent execution runs...
            </div>
          ) : runs.length === 0 ? (
            <div className="p-6 text-center text-xs text-ink-muted space-y-3">
              <div>No triage runs initiated yet in this session.</div>
              <div className="space-y-1.5 pt-2">
                <span className="text-xs text-ink-muted block">Launch a benchmark scenario:</span>
                {PRESET_RUNS.slice(0, 2).map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleLaunchRun(p.query, p.patientId, p.proposedMeds)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-subtle hover:bg-muted border border-hairline text-xs text-ink-secondary hover:text-ink flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>{p.label}</span>
                    <ArrowRight className="w-3 h-3 text-accent" />
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
                  type="button"
                  onClick={() => setSelectedRunId(run.run_id)}
                  className={`w-full text-left p-4 transition-colors block cursor-pointer ${
                    isSelected
                      ? "bg-accent-soft/60 border-l-4 border-l-accent"
                      : "hover:bg-subtle/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-accent font-semibold truncate">
                      {run.run_id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border shrink-0 ${
                        isPaused
                          ? "bg-red-50 text-clinical-rose border-red-200"
                          : isDone
                          ? "bg-emerald-50 text-clinical-emerald border-emerald-200"
                          : isFailed
                          ? "bg-red-50 text-clinical-rose border-red-200"
                          : "bg-accent-soft text-accent border-accent-border"
                      }`}
                    >
                      {run.status}
                    </span>
                  </div>

                  <div className="text-xs text-ink line-clamp-2 mt-1.5 leading-snug">
                    {run.query}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted mt-2">
                    <span>Patient: {run.patient_id || "None"}</span>
                    <span>{run.created_at}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Detail Pane */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {selectedSummary ? (
            <>
              {/* Run Overview Header */}
              <div className="bg-surface border border-hairline rounded-xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-hairline">
                  <div>
                    <div className="text-[11px] font-mono text-ink-muted">
                      Run Lifecycle State
                    </div>
                    <div className="text-sm font-semibold text-ink flex flex-wrap items-center gap-2">
                      <span>{selectedSummary.run_id}</span>
                      <span className="text-xs font-mono font-normal text-ink-muted">
                        (Session: {selectedSummary.session_id})
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold border ${
                      selectedSummary.status === "PAUSED_FOR_REVIEW"
                        ? "bg-red-50 text-clinical-rose border-red-200"
                        : selectedSummary.status === "COMPLETED"
                        ? "bg-emerald-50 text-clinical-emerald border-emerald-200"
                        : "bg-subtle text-ink-secondary border-hairline"
                    }`}
                  >
                    {selectedSummary.status}
                  </span>
                </div>

                <div className="text-xs text-ink bg-subtle p-3 rounded-lg border border-hairline leading-relaxed">
                  <span className="text-[11px] font-mono text-ink-muted block mb-1">
                    Clinical Inquiry:
                  </span>
                  &ldquo;{selectedSummary.query}&rdquo;
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono text-ink-muted">
                  <div>
                    <span className="text-[11px] block">Patient Target</span>
                    <span className="text-ink font-medium">{selectedSummary.patient_id || "Unspecified"}</span>
                  </div>
                  <div>
                    <span className="text-[11px] block">Created At</span>
                    <span className="text-ink-secondary">{selectedSummary.created_at}</span>
                  </div>
                  <div>
                    <span className="text-[11px] block">Completed At</span>
                    <span className="text-ink-secondary">{selectedSummary.completed_at || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[11px] block">Recorded Events</span>
                    <span className="text-accent font-medium">{selectedSummary.total_events}</span>
                  </div>
                </div>
              </div>

              {/* HITL Review Panel if PAUSED */}
              {selectedSummary.status === "PAUSED_FOR_REVIEW" && (
                <div className="bg-surface border border-red-300 border-l-4 border-l-clinical-rose rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2 text-clinical-rose pb-2.5 border-b border-red-100">
                    <AlertOctagon className="w-5 h-5 shrink-0" />
                    <div>
                      <h3 className="text-sm font-semibold text-ink">
                        Human-in-the-Loop Clinical Intercept Active
                      </h3>
                      <p className="text-xs text-clinical-rose font-mono">
                        Regulated high-risk intervention paused awaiting authenticated clinician sign-off.
                      </p>
                    </div>
                  </div>

                  {reviewMessage && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-clinical-emerald font-medium">
                      {reviewMessage}
                    </div>
                  )}

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-xs font-medium text-ink-secondary block mb-1">
                        Reviewing Clinician ID (Authenticated)
                      </label>
                      <input
                        type="text"
                        value={clinicianId}
                        onChange={(e) => setClinicianId(e.target.value)}
                        className="w-full bg-subtle border border-strong rounded-lg px-3 py-2 text-xs text-ink font-mono focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-ink-secondary block mb-1">
                        Clinical Action
                      </label>
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-ink cursor-pointer">
                          <input
                            type="radio"
                            name="decision"
                            checked={approved}
                            onChange={() => setApproved(true)}
                            className="accent-clinical-emerald"
                          />
                          <span>Approve Protocol with Override</span>
                        </label>
                        <label className="flex items-center gap-2 text-ink cursor-pointer">
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
                      <label className="text-xs font-medium text-ink-secondary block mb-1">
                        Mandatory Clinical Override Rationale
                      </label>
                      <textarea
                        rows={3}
                        value={overrideRationale}
                        onChange={(e) => setOverrideRationale(e.target.value)}
                        placeholder="Detail mitigating clinical safeguards (e.g., co-prescribed high-dose PPI, scheduled 48h renal labs, patient risk counseled)..."
                        className="w-full bg-subtle border border-strong rounded-lg p-3 text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent resize-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleSubmitReview}
                      disabled={isSubmittingReview}
                      className={`px-4 py-2 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer ${
                        approved
                          ? "bg-clinical-emerald hover:opacity-90"
                          : "bg-clinical-rose hover:bg-red-800"
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isSubmittingReview ? "Submitting..." : "Sign Off & Resume Run"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Execution Trace Timeline */}
              <div className="bg-surface border border-hairline rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-hairline">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-accent" />
                    <h3 className="text-xs font-semibold text-ink">
                      Server-Sent Events (SSE) Execution Timeline
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-ink-muted">
                    Live Stream / Audit Replay
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedRunDetail?.response?.execution_trace &&
                    selectedRunDetail.response.execution_trace.map((step: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-subtle border border-hairline rounded-lg p-3 flex items-start justify-between text-xs"
                      >
                        <div className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-clinical-emerald shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-ink flex items-center gap-2">
                              <span>{step.step_name}</span>
                              <span className="text-[11px] font-mono text-ink-muted">
                                {step.latency_ms > 0 ? `${step.latency_ms}ms` : "in-progress"}
                              </span>
                            </div>
                            <div className="text-xs text-ink-secondary mt-0.5">
                              {step.description}
                            </div>
                          </div>
                        </div>

                        {step.metadata && (
                          <div className="text-[11px] font-mono text-ink-muted text-right">
                            {JSON.stringify(step.metadata)}
                          </div>
                        )}
                      </div>
                    ))}

                  {eventTimeline.length > 0 &&
                    eventTimeline.map((ev, idx) => (
                      <div
                        key={`ev-${idx}`}
                        className="bg-subtle border border-accent-border rounded-lg p-2.5 text-[11px] font-mono text-ink-secondary flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <GitCommit className="w-3 h-3 text-accent shrink-0" />
                          <span className="text-accent font-semibold shrink-0">[{ev.event_type}]</span>
                          <span className="truncate">
                            {JSON.stringify(ev.data).slice(0, 80)}...
                          </span>
                        </div>
                        <span className="text-[11px] text-ink-muted shrink-0">
                          {new Date(ev.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          ) : (
            <div className="max-w-3xl mx-auto py-8 space-y-6">
              <div className="bg-surface border border-hairline rounded-xl p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-soft border border-accent-border flex items-center justify-center text-accent shrink-0">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-ink">
                      Agentic RAG Execution &amp; Human-in-the-Loop Supervision
                    </h2>
                    <p className="text-xs text-ink-muted mt-0.5">
                      14-Node LangGraph state machine with real-time SSE telemetry, CRAG routing, Self-RAG verification, and regulatory interrupt states.
                    </p>
                  </div>
                </div>

                <div className="pt-2 text-xs text-ink-secondary leading-relaxed border-t border-hairline">
                  {runs.length === 0 ? (
                    <p>
                      No agent runs have been executed in this session yet. Launch a scenario below or initiate inquiries from <strong className="text-ink">Clinician Copilot</strong>.
                    </p>
                  ) : (
                    <p>
                      Select an execution run from the left list to review its live SSE event stream, telemetry node checkpoints, and pending clinician sign-off actions.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">Execute Benchmark Clinical Scenarios</span>
                  <span className="font-mono text-[11px] text-ink-muted">1-Click Live LangGraph Execution</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PRESET_RUNS.map((p, idx) => (
                    <div
                      key={idx}
                      className="bg-surface hover:bg-subtle/60 border border-hairline hover:border-accent-border rounded-xl p-4 space-y-3 transition-colors flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-ink">{p.label}</span>
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-accent-soft text-accent border border-accent-border shrink-0">
                            {p.patientId}
                          </span>
                        </div>
                        <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                          &ldquo;{p.query}&rdquo;
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleLaunchRun(p.query, p.patientId, p.proposedMeds)}
                        disabled={isLaunching}
                        className="w-full py-2 px-3 rounded-lg bg-accent-soft hover:bg-accent text-accent hover:text-white border border-accent-border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
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
