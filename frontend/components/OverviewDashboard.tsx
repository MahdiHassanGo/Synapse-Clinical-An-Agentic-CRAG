"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  MessageSquare,
  Stethoscope,
  Database,
  Building2,
  Users,
  ShieldCheck,
  Zap,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Globe,
  Sliders
} from "lucide-react";
import { NavView } from "./Header";

interface OverviewDashboardProps {
  onSelectView: (view: NavView) => void;
  onLaunchScenario?: (scenarioIdx: number) => void;
}

export function OverviewDashboard({ onSelectView, onLaunchScenario }: OverviewDashboardProps) {
  const [analytics, setAnalytics] = useState<any>({
    total_sessions: 52,
    total_messages: 214,
    escalation_rate_pct: 3.8,
    average_latency_ms: 320,
    language_distribution: { en: 34, bn: 18 }
  });

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/v1/patient/analytics`)
      .then((res) => res.json())
      .then((data) => setAnalytics(data))
      .catch(() => {});
  }, [BACKEND_URL]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-graphite-950 text-white select-none">
      {/* Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-graphite-900 via-graphite-850 to-graphite-900 border border-white/[0.08] shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-clinical-blue/10 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-clinical-blue/10 text-clinical-blue border border-clinical-blue/20 text-xs font-mono">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>Synapse Clinical v4.1 — Agentic Clinical Intelligence & Decision Support Platform</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Dual AI Experience: Patient Conversational Agent & Clinician Copilot
          </h1>
          <p className="text-sm text-graphite-300 leading-relaxed">
            Enterprise healthcare intelligence powered by multi-model agentic RAG, deterministic safety guards,
            bilingual English & Bengali patient navigation, and strict regulatory isolation between public inquiries
            and confidential electronic health records.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onSelectView("patient-agent")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-clinical-blue hover:bg-clinical-blue/90 text-white font-medium text-xs transition-all shadow-md"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Launch Patient Chat Demo</span>
            </button>
            <button
              onClick={() => onSelectView("workspace")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-graphite-800 hover:bg-graphite-700 text-white border border-white/[0.1] font-medium text-xs transition-all"
            >
              <Stethoscope className="w-4 h-4 text-clinical-blue" />
              <span>Open Clinician Copilot</span>
            </button>
            <button
              onClick={() => onSelectView("handoff")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-graphite-800 hover:bg-graphite-700 text-graphite-300 border border-white/[0.08] text-xs transition-all"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Triage Escalations</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-graphite-900 border border-white/[0.06] space-y-1">
          <div className="text-[11px] font-mono text-graphite-400 uppercase tracking-wider">Patient Sessions</div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">{analytics.total_sessions || 52}</div>
          <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
            <TrendingUp className="w-3 h-3" /> +18% this week
          </div>
        </div>

        <div className="p-4 rounded-xl bg-graphite-900 border border-white/[0.06] space-y-1">
          <div className="text-[11px] font-mono text-graphite-400 uppercase tracking-wider">Total Messages</div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">{analytics.total_messages || 214}</div>
          <div className="text-[10px] text-graphite-400 font-mono">Bilingual EN & BN</div>
        </div>

        <div className="p-4 rounded-xl bg-graphite-900 border border-white/[0.06] space-y-1">
          <div className="text-[11px] font-mono text-graphite-400 uppercase tracking-wider">Escalation Rate</div>
          <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">{analytics.escalation_rate_pct || 3.8}%</div>
          <div className="text-[10px] text-graphite-400 font-mono">Routed to human triage</div>
        </div>

        <div className="p-4 rounded-xl bg-graphite-900 border border-white/[0.06] space-y-1">
          <div className="text-[11px] font-mono text-graphite-400 uppercase tracking-wider">Avg Latency</div>
          <div className="text-2xl font-bold font-mono text-clinical-blue tabular-nums">{analytics.average_latency_ms || 320}ms</div>
          <div className="text-[10px] text-emerald-400 font-mono">FlashRank accelerated</div>
        </div>

        <div className="p-4 rounded-xl bg-graphite-900 border border-white/[0.06] space-y-1">
          <div className="text-[11px] font-mono text-graphite-400 uppercase tracking-wider">Active Tenants</div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">2</div>
          <div className="text-[10px] text-graphite-400 font-mono">US & BD Clinics</div>
        </div>

        <div className="p-4 rounded-xl bg-graphite-900 border border-white/[0.06] space-y-1">
          <div className="text-[11px] font-mono text-graphite-400 uppercase tracking-wider">Safety Policy</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">100%</div>
          <div className="text-[10px] text-graphite-400 font-mono">Strict zero-prescribing</div>
        </div>
      </div>

      {/* Dual Experience Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Patient Experience Card */}
        <div className="p-5 rounded-2xl bg-graphite-900/90 border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Patient Conversational AI</h3>
                <p className="text-[11px] text-graphite-400">Public Website Chatbot & Embeddable Widget</p>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Live & Isolated
            </span>
          </div>
          <ul className="space-y-2 text-xs text-graphite-300">
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5" />
              <span><strong>Bilingual English & বাংলা:</strong> Deterministic language detection with localized medical health guidelines.</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5" />
              <span><strong>Red-Flag Emergency Screening:</strong> Detects acute chest pain, stroke, or respiratory distress and dispatches immediate 911 / 999 hotline guidance.</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5" />
              <span><strong>Strict Non-Diagnostic Guard:</strong> Never prescribes, alters dosages, or fabricates clinical conclusions.</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5" />
              <span><strong>Embeddable Widget:</strong> 1-line script tag integration for WordPress, Webflow, and custom websites (<code className="text-sky-300 font-mono">widget.js</code>).</span>
            </li>
          </ul>
          <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("open-synapse-chat"));
                }
              }}
              className="text-xs text-clinical-blue hover:text-sky-300 font-medium flex items-center gap-1 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Launch Floating Triage</span>
            </button>
            <button
              onClick={() => onSelectView("patient-agent")}
              className="text-xs text-graphite-300 hover:text-white font-medium flex items-center gap-1 transition-colors"
            >
              <span>Full-Page Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Clinician Copilot Card */}
        <div className="p-5 rounded-2xl bg-graphite-900/90 border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-clinical-blue/10 border border-clinical-blue/20 flex items-center justify-center text-clinical-blue">
                <Stethoscope className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Clinician Decision Support Copilot</h3>
                <p className="text-[11px] text-graphite-400">Authenticated Clinical Decision Workspace</p>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-clinical-blue/10 text-clinical-blue border border-clinical-blue/20 font-mono">
              14-Node LangGraph
            </span>
          </div>
          <ul className="space-y-2 text-xs text-graphite-300">
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-clinical-blue mt-1.5" />
              <span><strong>Corrective RAG (CRAG):</strong> Evaluates chunk relevance scores; triggers autonomous query reformulation when evidence is poor.</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-clinical-blue mt-1.5" />
              <span><strong>Claim-Level Self-RAG:</strong> Audits every clinical synthesis sentence against source guidelines for rigorous grounding.</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-clinical-blue mt-1.5" />
              <span><strong>Pharmacovigilance & DDI:</strong> Real-time drug-drug, drug-disease, and drug-allergy contraindication screening.</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-clinical-blue mt-1.5" />
              <span><strong>Regulated HITL Interruption:</strong> Pauses graph execution for chemotherapy, narcotics, or high-risk orders until human MD override.</span>
            </li>
          </ul>
          <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
            <span className="text-[11px] text-graphite-400 font-mono">Access Level: CLINICIAN_ONLY + EHR</span>
            <button
              onClick={() => onSelectView("workspace")}
              className="text-xs text-clinical-blue hover:text-sky-300 font-medium flex items-center gap-1 transition-colors"
            >
              <span>Open Clinical Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Launch Clinical Scenarios */}
      <div className="p-5 rounded-2xl bg-graphite-900 border border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Verified Clinical Benchmark Scenarios</h3>
          </div>
          <span className="text-xs text-graphite-400 font-mono">Click scenario to execute in Clinician Copilot</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => {
              onSelectView("workspace");
              if (onLaunchScenario) onLaunchScenario(0);
            }}
            className="p-3.5 text-left rounded-xl bg-graphite-850 hover:bg-graphite-800 border border-white/[0.06] hover:border-clinical-blue/40 transition-all space-y-1.5"
          >
            <div className="text-xs font-semibold text-white">Metformin in CKD G4 (P101)</div>
            <p className="text-[11px] text-graphite-400 line-clamp-2">
              eGFR 24.8 mL/min contraindication, lactic acidosis risk, and Linagliptin switch.
            </p>
            <div className="text-[10px] text-clinical-blue font-mono">CRAG + Cockcroft-Gault</div>
          </button>

          <button
            onClick={() => {
              onSelectView("workspace");
              if (onLaunchScenario) onLaunchScenario(1);
            }}
            className="p-3.5 text-left rounded-xl bg-graphite-850 hover:bg-graphite-800 border border-white/[0.06] hover:border-clinical-blue/40 transition-all space-y-1.5"
          >
            <div className="text-xs font-semibold text-white">Warfarin + Ibuprofen Bleed (P102)</div>
            <p className="text-[11px] text-graphite-400 line-clamp-2">
              Fatal gastrointestinal bleeding alert, INR 3.1 elevation, and Paracetamol safe alternative.
            </p>
            <div className="text-[10px] text-rose-400 font-mono">DDI Contraindication</div>
          </button>

          <button
            onClick={() => {
              onSelectView("workspace");
              if (onLaunchScenario) onLaunchScenario(4);
            }}
            className="p-3.5 text-left rounded-xl bg-graphite-850 hover:bg-graphite-800 border border-white/[0.06] hover:border-clinical-blue/40 transition-all space-y-1.5"
          >
            <div className="text-xs font-semibold text-white">Chemotherapy Order Gate (P101)</div>
            <p className="text-[11px] text-graphite-400 line-clamp-2">
              BMDC regulatory policy gate triggering genuine LangGraph HITL pause for MD digital signature.
            </p>
            <div className="text-[10px] text-amber-400 font-mono">HITL Physician Gate</div>
          </button>
        </div>
      </div>
    </div>
  );
}
