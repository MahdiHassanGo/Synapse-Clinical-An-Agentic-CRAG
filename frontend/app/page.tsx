"use client";

import React, { useState, useEffect } from "react";
import { Header, NavView } from "../components/Header";
import { PatientSidebar, Patient, PatientDetail } from "../components/PatientSidebar";
import { AgentTraceStream, TraceStep } from "../components/AgentTraceStream";
import {
  ClinicalSynthesisView,
  GuidelineChunk,
  SelfRAGCritique,
  ClaimVerificationResult,
  ClinicalCalculationResult,
  DrugInteractionAlert,
  ModelRoutingDecision,
} from "../components/ClinicalSynthesisView";
import {
  PharmacovigilanceModal,
  HITLInterrupt,
} from "../components/PharmacovigilanceModal";
import { GuidelineDrawer } from "../components/GuidelineDrawer";
import { KnowledgeBaseView } from "../components/KnowledgeBaseView";
import { AgentRunsView } from "../components/AgentRunsView";
import { RAGEvaluationView } from "../components/RAGEvaluationView";
import { SettingsView } from "../components/SettingsView";
import { OverviewDashboard } from "../components/OverviewDashboard";
import { PatientChatView } from "../components/PatientChatView";
import { HumanHandoffView } from "../components/HumanHandoffView";
import { TenantManagementView } from "../components/TenantManagementView";
import { UserManagementView } from "../components/UserManagementView";
import { AuditLogsView } from "../components/AuditLogsView";
import { FloatingChatWidget } from "../components/FloatingChatWidget";
import {
  Send,
  Sparkles,
  AlertOctagon,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Cpu,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

const PRESET_SCENARIOS = [
  {
    label: "Metformin in CKD G4 (P101)",
    patientId: "P101",
    query: "Assess renal safety and lactic acidosis risk of continuing Metformin 1000mg BID in Eleanor Vance (P101).",
  },
  {
    label: "Warfarin + Ibuprofen Fatal Bleed (P102)",
    patientId: "P102",
    query: "Can I prescribe Ibuprofen 600mg for acute knee arthritis in Arthur Pendleton (P102)?",
  },
  {
    label: "Spironolactone Hyperkalemia (P103)",
    patientId: "P103",
    query: "Evaluate hyperkalemia cardiac arrest risk for Marcus Holloway (P103) on Spironolactone + Enalapril with K+ 5.8 mmol/L.",
  },
  {
    label: "Pneumonia Penicillin Anaphylaxis (P104)",
    patientId: "P104",
    query: "Recommend empirical antibiotic regimen for severe pneumonia in Sarah Chen (P104) with documented Penicillin anaphylaxis.",
  },
  {
    label: "Chemotherapy Order Gate (P101)",
    patientId: "P101",
    query: "Order systemic chemotherapy protocol with Doxorubicin 60mg/m2 for patient P101.",
  },
];

export default function Home() {
  const [currentView, setCurrentView] = useState<NavView>("overview");

  const handleLaunchScenario = (idx: number) => {
    const sc = PRESET_SCENARIOS[idx];
    if (sc) {
      setSelectedPatientId(sc.patientId);
      setQueryInput(sc.query);
      setCurrentView("workspace");
    }
  };

  // EHR Data
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("P101");
  const [patientDetail, setPatientDetail] = useState<PatientDetail | null>(null);
  const [loadingPatient, setLoadingPatient] = useState<boolean>(true);

  // Agent State
  const [queryInput, setQueryInput] = useState<string>(
    "Assess renal safety and lactic acidosis risk of continuing Metformin 1000mg BID in Eleanor Vance (P101)."
  );
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [traceSteps, setTraceSteps] = useState<TraceStep[]>([]);
  const [cragIterations, setCragIterations] = useState<number>(0);
  const [rewrittenQueries, setRewrittenQueries] = useState<string[]>([]);
  const [totalLatency, setTotalLatency] = useState<number>(0);
  const [clinicalSynthesis, setClinicalSynthesis] = useState<string>("");
  const [selfRagCritique, setSelfRagCritique] = useState<SelfRAGCritique | null>(null);
  const [claimVerifications, setClaimVerifications] = useState<ClaimVerificationResult[]>([]);
  const [calculations, setCalculations] = useState<ClinicalCalculationResult[]>([]);
  const [interactionAlerts, setInteractionAlerts] = useState<DrugInteractionAlert[]>([]);
  const [modelRoutingDecisions, setModelRoutingDecisions] = useState<ModelRoutingDecision[]>([]);
  const [guidelines, setGuidelines] = useState<GuidelineChunk[]>([]);
  const [hitlGate, setHitlGate] = useState<HITLInterrupt | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  // Modals & Drawers
  const [isHitlModalOpen, setIsHitlModalOpen] = useState<boolean>(false);
  const [selectedCitation, setSelectedCitation] = useState<string | null>(null);
  const [overrideSuccessMessage, setOverrideSuccessMessage] = useState<string | null>(null);

  // Fetch Patients on Load
  useEffect(() => {
    async function loadPatients() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/patients`);
        if (res.ok) {
          const data = await res.json();
          setPatients(data.patients);
        }
      } catch (err) {
        console.error("Failed to load patients", err);
      }
    }
    loadPatients();
  }, []);

  // Fetch Patient Details on Selection
  useEffect(() => {
    if (!selectedPatientId) return;
    async function loadDetail() {
      setLoadingPatient(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/patients/${selectedPatientId}`);
        if (res.ok) {
          const data = await res.json();
          setPatientDetail(data);
        }
      } catch (err) {
        console.error("Failed to load patient detail", err);
      } finally {
        setLoadingPatient(false);
      }
    }
    loadDetail();
  }, [selectedPatientId]);

  // Execute Agentic RAG Flow
  const handleRunTriage = async (customQuery?: string, targetPid?: string) => {
    const q = customQuery || queryInput;
    const pid = targetPid || selectedPatientId;
    if (!q.trim()) return;

    setIsStreaming(true);
    setTraceSteps([]);
    setCragIterations(0);
    setRewrittenQueries([]);
    setClinicalSynthesis("");
    setSelfRagCritique(null);
    setClaimVerifications([]);
    setCalculations([]);
    setInteractionAlerts([]);
    setModelRoutingDecisions([]);
    setGuidelines([]);
    setHitlGate(null);
    setSelectedCitation(null);
    setOverrideSuccessMessage(null);

    try {
      // Connect to genuine SSE streaming endpoint
      const eventSource = new EventSource(
        `${BACKEND_URL}/api/triage/stream?query=${encodeURIComponent(
          q
        )}&patient_id=${encodeURIComponent(pid)}`
      );

      eventSource.addEventListener("step_update", (e) => {
        const data = JSON.parse(e.data);
        setTraceSteps((prev) => [
          ...prev,
          {
            step_name: data.step,
            description: data.message,
            status: "IN_PROGRESS",
            latency_ms: 0,
          },
        ]);
      });

      eventSource.addEventListener("trace_step", (e) => {
        const step = JSON.parse(e.data);
        setTraceSteps((prev) => {
          const filtered = prev.filter((s) => s.step_name !== step.step_name);
          return [...filtered, step];
        });
      });

      eventSource.addEventListener("crag_status", (e) => {
        const data = JSON.parse(e.data);
        setCragIterations(data.iterations);
        setRewrittenQueries(data.rewritten_queries || []);
      });

      eventSource.addEventListener("self_rag_tokens", (e) => {
        const data = JSON.parse(e.data);
        setSelfRagCritique(data);
      });

      eventSource.addEventListener("hitl_interrupted", (e) => {
        const data = JSON.parse(e.data);
        setHitlGate(data);
        setIsHitlModalOpen(true);
      });

      eventSource.addEventListener("complete", (e) => {
        const full = JSON.parse(e.data);
        setClinicalSynthesis(full.clinical_synthesis);
        setGuidelines(full.retrieved_guidelines || []);
        setTotalLatency(full.total_latency_ms);
        setSelfRagCritique(full.self_rag_critique);
        setClaimVerifications(full.claim_verifications || []);
        setCalculations(full.calculations || []);
        setInteractionAlerts(full.interaction_alerts || []);
        setModelRoutingDecisions(full.model_routing_decisions || []);
        setHitlGate(full.hitl_gate);
        if (full.run_id) setActiveRunId(full.run_id);
        if (full.hitl_gate && full.hitl_gate.is_required) {
          setIsHitlModalOpen(true);
        }
        setIsStreaming(false);
        eventSource.close();
      });

      eventSource.addEventListener("run_completed", (e) => {
        const full = JSON.parse(e.data);
        setClinicalSynthesis(full.clinical_synthesis);
        setGuidelines(full.retrieved_guidelines || []);
        setTotalLatency(full.total_latency_ms);
        setSelfRagCritique(full.self_rag_critique);
        setClaimVerifications(full.claim_verifications || []);
        setCalculations(full.calculations || []);
        setInteractionAlerts(full.interaction_alerts || []);
        setModelRoutingDecisions(full.model_routing_decisions || []);
        setHitlGate(full.hitl_gate);
        if (full.run_id) setActiveRunId(full.run_id);
        if (full.hitl_gate && full.hitl_gate.is_required && full.hitl_gate.approved === null) {
          setIsHitlModalOpen(true);
        }
        setIsStreaming(false);
        eventSource.close();
      });

      eventSource.onerror = (err) => {
        console.error("SSE stream error", err);
        setIsStreaming(false);
        eventSource.close();
      };
    } catch (err) {
      console.error("Failed to run triage", err);
      setIsStreaming(false);
    }
  };

  const handleApplyPreset = (preset: (typeof PRESET_SCENARIOS)[0]) => {
    setSelectedPatientId(preset.patientId);
    setQueryInput(preset.query);
    handleRunTriage(preset.query, preset.patientId);
  };

  const handlePhysicianOverride = async (
    clinicianId: string,
    rationale: string,
    approved: boolean
  ) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/triage/hitl/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeRunId || "SESSION_" + Date.now(),
          patient_id: selectedPatientId,
          clinician_id: clinicianId,
          approved,
          override_rationale: rationale,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOverrideSuccessMessage(
          `Physician Decision: ${data.decision} recorded by ${clinicianId}. Regulatory audit trail logged.`
        );
      }
    } catch (err) {
      console.error("Failed to record override", err);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      <Header
        currentView={currentView}
        onSelectView={(v) => setCurrentView(v)}
        activePatientId={selectedPatientId}
        isStreaming={isStreaming}
      />

      {/* View Switcher Container */}
      {currentView === "overview" && (
        <OverviewDashboard
          onSelectView={setCurrentView}
          onLaunchScenario={handleLaunchScenario}
        />
      )}

      {currentView === "patient-agent" && <PatientChatView />}

      {currentView === "workspace" && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: Patient EHR Telemetry Sidebar */}
          <PatientSidebar
            patients={patients}
            selectedPatientId={selectedPatientId}
            onSelectPatient={(id) => setSelectedPatientId(id)}
            patientDetail={patientDetail}
            loading={loadingPatient}
          />

          {/* Center: Agentic Workspace & Copilot Stream */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 max-w-5xl w-full">
            {/* Preset Clinical Scenarios */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-ink-muted">
                Validated Clinical Scenarios (Self-RAG &amp; CRAG Benchmarks)
              </span>
              <div className="flex flex-wrap gap-2">
                {PRESET_SCENARIOS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="px-3 py-1.5 rounded-lg bg-surface hover:bg-subtle border border-hairline hover:border-accent-border text-xs text-ink-secondary hover:text-ink transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRight className="w-3 h-3 text-accent shrink-0" aria-hidden="true" />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Clinical Inquiry Input Bar */}
            <div className="bg-surface border border-hairline focus-within:border-accent rounded-xl p-4 space-y-2 transition-colors">
              <label htmlFor="clinical-query-input" className="sr-only">
                Clinical inquiry or proposed prescription
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <textarea
                  id="clinical-query-input"
                  rows={2}
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleRunTriage();
                    }
                  }}
                  placeholder="Enter clinical inquiry, proposed prescription, or triage question..."
                  className="w-full bg-transparent text-sm text-ink placeholder-ink-muted focus:outline-none resize-none leading-relaxed"
                />
                <button
                  type="button"
                  onClick={() => handleRunTriage()}
                  disabled={isStreaming}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shrink-0 self-end cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isStreaming ? "Analyzing..." : "Run Triage"}</span>
                </button>
              </div>
              <div className="text-[11px] text-ink-muted font-mono flex items-center justify-between pt-2 border-t border-hairline">
                <span>Active Patient: <strong className="text-ink">{selectedPatientId}</strong></span>
                <span className="hidden sm:inline">Press ⌘+Enter to analyze</span>
              </div>
            </div>

            {/* Empty / Ready State Guidance */}
            {!isStreaming && traceSteps.length === 0 && !clinicalSynthesis && (
              <div className="p-6 rounded-xl bg-surface border border-dashed border-strong text-center space-y-2">
                <div className="text-sm font-semibold text-ink">
                  Ready for Evidence-Grounded Clinical Triage
                </div>
                <p className="text-xs text-ink-secondary max-w-lg mx-auto leading-relaxed">
                  Select a validated clinical scenario above or enter a prescription safety query, then click{" "}
                  <strong className="text-accent">Run Triage</strong> to stream CRAG retrieval, Cockcroft-Gault renal calculations, Self-RAG claim verification, and HITL safety gates.
                </p>
              </div>
            )}

            {/* Override Success Banner */}
            {overrideSuccessMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-clinical-emerald flex items-center gap-2 font-medium">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{overrideSuccessMessage}</span>
              </div>
            )}

            {/* HITL Safety Interrupt Banner if triggered */}
            {hitlGate && hitlGate.is_required && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 border-l-4 border-l-clinical-rose flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 text-clinical-rose">
                  <AlertOctagon className="w-5 h-5 shrink-0" />
                  <div>
                    <div className="font-semibold text-ink">
                      Human-in-the-Loop Safety Gate Active
                    </div>
                    <div className="text-xs text-clinical-rose font-mono mt-0.5">
                      {hitlGate.reason}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsHitlModalOpen(true)}
                  className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-clinical-rose text-white text-xs font-semibold hover:bg-red-800 transition-colors cursor-pointer"
                >
                  Review &amp; Sign Off
                </button>
              </div>
            )}

            {/* Agentic Reasoning Execution Trace */}
            <AgentTraceStream
              steps={traceSteps}
              cragIterations={cragIterations}
              rewrittenQueries={rewrittenQueries}
              totalLatencyMs={totalLatency}
            />

            {/* Evidence-Grounded Clinical Synthesis */}
            <ClinicalSynthesisView
              synthesisText={clinicalSynthesis}
              selfRagCritique={selfRagCritique}
              claimVerifications={claimVerifications}
              calculations={calculations}
              interactionAlerts={interactionAlerts}
              modelRoutingDecisions={modelRoutingDecisions}
              guidelines={guidelines}
              onSelectCitation={(ref) => setSelectedCitation(ref)}
            />
          </main>
        </div>
      )}

      {currentView === "knowledge" && <KnowledgeBaseView />}
      {currentView === "runs" && <AgentRunsView />}
      {currentView === "orchestrator" && <SettingsView />}
      {currentView === "handoff" && <HumanHandoffView />}
      {currentView === "evaluation" && <RAGEvaluationView />}
      {currentView === "tenants" && <TenantManagementView />}
      {currentView === "users" && <UserManagementView />}
      {currentView === "audit" && <AuditLogsView />}
      {currentView === "settings" && <SettingsView />}

      {/* Slide-over Guideline Provenance Inspector */}
      <GuidelineDrawer
        selectedCitation={selectedCitation}
        guidelines={guidelines}
        onClose={() => setSelectedCitation(null)}
      />

      {/* Human-in-the-Loop Override Dialog */}
      <PharmacovigilanceModal
        hitlData={hitlGate}
        patientId={selectedPatientId}
        isOpen={isHitlModalOpen}
        onClose={() => setIsHitlModalOpen(false)}
        onConfirmOverride={handlePhysicianOverride}
      />

      {/* Floating Hospital Clinical Triage & Specialist Navigator Widget */}
      <FloatingChatWidget />
    </div>
  );
}
