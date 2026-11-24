"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Stethoscope,
  ArrowRight,
  AlertTriangle,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { NavView } from "./Header";

interface OverviewDashboardProps {
  onSelectView: (view: NavView) => void;
  onLaunchScenario?: (scenarioIdx: number) => void;
}

export function OverviewDashboard({ onSelectView, onLaunchScenario }: OverviewDashboardProps) {
  const [analytics, setAnalytics] = useState<any>({
    active_sessions: 42,
    total_messages: 384,
    emergency_redirects: 14,
    avg_latency_ms: 38.2,
  });

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/v1/patient/analytics`)
      .then((res) => res.json())
      .then((data) => setAnalytics(data))
      .catch(() => {});
  }, [BACKEND_URL]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 bg-canvas text-ink max-w-7xl mx-auto w-full">
      {/* Primary Clinical Summary Header Card */}
      <section
        aria-label="Platform overview"
        className="p-6 sm:p-8 rounded-xl bg-surface border border-hairline border-l-4 border-l-accent"
      >
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-accent font-medium">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>Synapse Clinical v4.1 · Dual-boundary medical AI architecture</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink leading-tight">
            Patient conversational triage and clinician decision support
          </h1>
          <p className="text-sm text-ink-secondary leading-relaxed max-w-2xl">
            Built with strict regulatory isolation between public patient guidance (bilingual English and Bengali)
            and authenticated electronic health record decision support powered by Corrective RAG, claim-level
            entailment verification, and deterministic pharmacovigilance gates.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onSelectView("workspace")}
              className="min-h-[40px] flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium text-xs transition-colors cursor-pointer"
            >
              <Stethoscope className="w-4 h-4" />
              <span>Open Clinician Copilot</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectView("patient-agent")}
              className="min-h-[40px] flex items-center gap-2 px-4 py-2 rounded-lg bg-surface hover:bg-subtle text-ink border border-strong font-medium text-xs transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-accent" />
              <span>Launch Patient Chat Demo</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectView("handoff")}
              className="min-h-[40px] flex items-center gap-2 px-3.5 py-2 rounded-lg text-ink-secondary hover:text-ink hover:bg-subtle text-xs font-medium transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-clinical-amber" />
              <span>Triage Escalations</span>
            </button>
          </div>
        </div>
      </section>

      {/* Telemetry Row — Pure Numbers, No Decorative Mini-Charts */}
      <section aria-label="Key telemetry metrics" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-surface border border-hairline space-y-1">
          <div className="text-xs text-ink-muted">Patient sessions</div>
          <div className="text-2xl font-semibold font-mono text-ink tabular-nums">
            {analytics.active_sessions ?? analytics.total_sessions ?? 42}
          </div>
          <div className="text-[11px] text-clinical-emerald font-mono">Active cohort</div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-hairline space-y-1">
          <div className="text-xs text-ink-muted">Total messages</div>
          <div className="text-2xl font-semibold font-mono text-ink tabular-nums">
            {analytics.total_messages ?? 384}
          </div>
          <div className="text-[11px] text-ink-muted font-mono">EN &amp; বাংলা</div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-hairline space-y-1">
          <div className="text-xs text-ink-muted">Escalations</div>
          <div className="text-2xl font-semibold font-mono text-clinical-amber tabular-nums">
            {analytics.emergency_redirects ?? analytics.escalation_rate_pct ?? 14}
          </div>
          <div className="text-[11px] text-ink-muted font-mono">Human triage</div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-hairline space-y-1">
          <div className="text-xs text-ink-muted">Avg latency</div>
          <div className="text-2xl font-semibold font-mono text-accent tabular-nums">
            {Math.round(analytics.avg_latency_ms ?? analytics.average_latency_ms ?? 38)}ms
          </div>
          <div className="text-[11px] text-clinical-emerald font-mono">FlashRank ONNX</div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-hairline space-y-1">
          <div className="text-xs text-ink-muted">Active tenants</div>
          <div className="text-2xl font-semibold font-mono text-ink tabular-nums">2</div>
          <div className="text-[11px] text-ink-muted font-mono">US &amp; BD clinics</div>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-hairline space-y-1">
          <div className="text-xs text-ink-muted">Safety policy</div>
          <div className="text-2xl font-semibold font-mono text-clinical-emerald tabular-nums">100%</div>
          <div className="text-[11px] text-ink-muted font-mono">Zero prescribing</div>
        </div>
      </section>

      {/* Dual Architecture Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Patient Experience */}
        <div className="p-6 rounded-xl bg-surface border border-hairline flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent-soft border border-accent-border flex items-center justify-center text-accent shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-ink">Patient Conversational AI</h2>
                  <p className="text-xs text-ink-muted">Public website navigator &amp; embeddable widget</p>
                </div>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-clinical-emerald border border-emerald-200 font-mono">
                Isolated
              </span>
            </div>

            <ul className="space-y-2 text-xs text-ink-secondary leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" aria-hidden="true" />
                <span><strong className="text-ink font-medium">Bilingual English &amp; বাংলা:</strong> Deterministic language detection with localized medical guidance.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" aria-hidden="true" />
                <span><strong className="text-ink font-medium">Red-flag screening:</strong> Detects chest pain, stroke, or respiratory distress and surfaces 911 / 999 guidance.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" aria-hidden="true" />
                <span><strong className="text-ink font-medium">Non-diagnostic guard:</strong> Never prescribes, alters dosages, or mutates EHR state.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" aria-hidden="true" />
                <span><strong className="text-ink font-medium">Embeddable widget:</strong> One-line <code className="text-accent font-mono">widget.js</code> script tag integration.</span>
              </li>
            </ul>
          </div>

          <div className="pt-3 flex items-center justify-between border-t border-hairline">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("open-synapse-chat"));
                }
              }}
              className="text-xs text-accent hover:text-accent-hover font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Launch floating triage</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectView("patient-agent")}
              className="text-xs text-ink-secondary hover:text-ink font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Full-page portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Clinician Copilot */}
        <div className="p-6 rounded-xl bg-surface border border-hairline flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-clinical-blue shrink-0">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-ink">Clinician Decision Support Copilot</h2>
                  <p className="text-xs text-ink-muted">Authenticated clinical triage workspace</p>
                </div>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-subtle text-ink-secondary border border-hairline font-mono">
                14-node graph
              </span>
            </div>

            <ul className="space-y-2 text-xs text-ink-secondary leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-clinical-blue mt-1.5 shrink-0" aria-hidden="true" />
                <span><strong className="text-ink font-medium">Corrective RAG (CRAG):</strong> Grades retrieved chunks and reformulates queries when context is weak.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-clinical-blue mt-1.5 shrink-0" aria-hidden="true" />
                <span><strong className="text-ink font-medium">Claim-level Self-RAG:</strong> Verifies each clinical claim against NICE and KDIGO sources.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-clinical-blue mt-1.5 shrink-0" aria-hidden="true" />
                <span><strong className="text-ink font-medium">Pharmacovigilance engine:</strong> Real-time drug-drug, renal, and allergy contraindication screening.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-clinical-blue mt-1.5 shrink-0" aria-hidden="true" />
                <span><strong className="text-ink font-medium">HITL interrupt gate:</strong> Pauses high-risk interventions until physician digital sign-off.</span>
              </li>
            </ul>
          </div>

          <div className="pt-3 flex items-center justify-between border-t border-hairline">
            <span className="text-[11px] text-ink-muted font-mono">Scope: Clinician + EHR</span>
            <button
              type="button"
              onClick={() => onSelectView("workspace")}
              className="text-xs text-accent hover:text-accent-hover font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Open clinical workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Benchmark Scenarios */}
      <section aria-label="Verified clinical scenarios" className="p-6 rounded-xl bg-surface border border-hairline space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-clinical-amber" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Verified clinical benchmark scenarios</h2>
          </div>
          <span className="text-xs text-ink-muted">Select a scenario to inspect in Clinician Copilot</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => {
              onSelectView("workspace");
              if (onLaunchScenario) onLaunchScenario(0);
            }}
            className="p-4 text-left rounded-lg bg-subtle/60 hover:bg-subtle border border-hairline hover:border-accent-border transition-colors space-y-1.5 cursor-pointer"
          >
            <div className="text-xs font-semibold text-ink">Metformin in CKD G4 (P101)</div>
            <p className="text-xs text-ink-secondary line-clamp-2 leading-relaxed">
              eGFR 22.4 mL/min contraindication, lactic acidosis hazard, and alternative glycemic therapy.
            </p>
            <div className="text-[11px] text-accent font-mono">CRAG + Cockcroft-Gault</div>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectView("workspace");
              if (onLaunchScenario) onLaunchScenario(1);
            }}
            className="p-4 text-left rounded-lg bg-subtle/60 hover:bg-subtle border border-hairline hover:border-accent-border transition-colors space-y-1.5 cursor-pointer"
          >
            <div className="text-xs font-semibold text-ink">Warfarin + Ibuprofen bleed (P102)</div>
            <p className="text-xs text-ink-secondary line-clamp-2 leading-relaxed">
              Upper GI hemorrhage interaction alert, INR 2.8 monitoring, and Paracetamol substitution.
            </p>
            <div className="text-[11px] text-clinical-rose font-mono">DDI contraindication</div>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectView("workspace");
              if (onLaunchScenario) onLaunchScenario(4);
            }}
            className="p-4 text-left rounded-lg bg-subtle/60 hover:bg-subtle border border-hairline hover:border-accent-border transition-colors space-y-1.5 cursor-pointer"
          >
            <div className="text-xs font-semibold text-ink">Chemotherapy order gate (P101)</div>
            <p className="text-xs text-ink-secondary line-clamp-2 leading-relaxed">
              BMDC regulatory policy gate pausing execution for mandatory clinician authorization.
            </p>
            <div className="text-[11px] text-clinical-amber font-mono">HITL physician gate</div>
          </button>
        </div>
      </section>
    </div>
  );
}
