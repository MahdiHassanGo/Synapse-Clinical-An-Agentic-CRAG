"use client";

import React, { useState, useEffect } from "react";
import {
  Sliders,
  Cpu,
  ShieldCheck,
  Key,
  Server,
  Layers,
  FileCheck2,
  AlertTriangle,
  RotateCw,
  ExternalLink,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

interface OrchestratorStatus {
  providers: {
    provider_name: string;
    is_available: boolean;
    active_models: string[];
    is_mock: boolean;
  }[];
  routing_policies: Record<
    string,
    {
      task: string;
      primary_model: string;
      primary_provider: string;
      fallback_chain: string[];
      max_cost_limit_usd: number;
      timeout_seconds: number;
    }
  >;
  recent_decisions: any[];
}

interface AuditEvent {
  event_id: number;
  timestamp: string;
  run_id: string;
  session_id: string;
  patient_id: string;
  clinician_id: string;
  decision: string;
  override_rationale: string;
}

export function SettingsView() {
  const [status, setStatus] = useState<OrchestratorStatus | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [orchRes, auditRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/orchestrator/status`),
        fetch(`${BACKEND_URL}/api/audit/events`),
      ]);

      if (orchRes.ok) {
        setStatus(await orchRes.json());
      }
      if (auditRes.ok) {
        const data = await auditRes.json();
        setAuditEvents(data.audit_events || []);
      }
    } catch (err) {
      console.error("Failed to load settings data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full font-sans">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-clinical-blue" />
            <span>Multi-Model Orchestrator & System Governance</span>
          </h1>
          <p className="text-xs text-graphite-400 mt-1">
            Provider configurations, task-specific model routing policies, and persistent regulatory audit trail.
          </p>
        </div>

        <button
          onClick={loadData}
          className="px-3 py-1.5 rounded-lg bg-graphite-850 hover:bg-graphite-800 border border-white/[0.08] text-graphite-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Prominent Regulatory Disclaimer */}
      <div className="p-4 rounded-2xl bg-clinical-amber/10 border border-clinical-amber/25 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-clinical-amber shrink-0 mt-0.5" />
        <div className="text-xs text-graphite-200 leading-relaxed space-y-1">
          <div className="font-semibold text-white">
            Research & Educational Portfolio Demonstration Notice
          </div>
          <p className="text-[11px] text-graphite-300">
            Synapse Clinical operates strictly on synthetic patient telemetry (P101–P104) and public clinical guidelines (NICE, KDIGO, WHO, BMDC). This application is not an FDA/CE-cleared medical device and must never be utilized for real patient care, autonomous prescribing, or unverified treatment orders. High-risk interventions are gated by mandatory Human-in-the-Loop review.
          </p>
        </div>
      </div>

      {/* 1. LLM Provider Status Cards */}
      <div className="bg-graphite-900 border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-clinical-blue" />
            <h3 className="text-xs font-semibold text-white">
              LLM Provider Registry & Gateway Status
            </h3>
          </div>
          <span className="text-[10px] font-mono text-graphite-400">
            LiteLLM Universal Multi-Provider Abstraction
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {status?.providers?.map((p, idx) => {
            const isMock = p.is_mock;
            const isOnline = p.is_available;
            return (
              <div
                key={idx}
                className="bg-graphite-850 border border-white/[0.06] rounded-xl p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-xs capitalize">
                    {p.provider_name}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                      isMock
                        ? "bg-clinical-amber/10 text-clinical-amber border border-clinical-amber/20"
                        : isOnline
                        ? "bg-clinical-emerald/10 text-clinical-emerald border border-clinical-emerald/20"
                        : "bg-graphite-800 text-graphite-500"
                    }`}
                  >
                    {isMock ? "Mock Standby" : isOnline ? "Active / Connected" : "Missing Key"}
                  </span>
                </div>

                <div className="text-[11px] font-mono text-graphite-400 space-y-0.5">
                  <div className="text-graphite-500 text-[10px]">Configured Models:</div>
                  {(p.active_models || []).map((m, mIdx) => (
                    <div key={mIdx} className="text-graphite-200 truncate">
                      • {m}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Task-Specific Model Routing Matrix */}
      <div className="bg-graphite-900 border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-clinical-teal" />
            <h3 className="text-xs font-semibold text-white">
              Task-Specific Model Routing Policies & Fallback Chains
            </h3>
          </div>
          <span className="text-[10px] font-mono text-clinical-teal">
            Multi-Model Orchestrator
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-graphite-400 font-mono text-[11px]">
                <th className="pb-2.5 font-normal">Task Type</th>
                <th className="pb-2.5 font-normal">Primary Model</th>
                <th className="pb-2.5 font-normal">Provider</th>
                <th className="pb-2.5 font-normal">Fallback Chain</th>
                <th className="pb-2.5 font-normal">Timeout</th>
                <th className="pb-2.5 font-normal text-right">Max Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {status?.routing_policies &&
                Object.entries(status.routing_policies).map(([taskKey, policy]) => (
                  <tr key={taskKey} className="hover:bg-white/[0.01]">
                    <td className="py-2.5 font-mono text-clinical-blue text-[11px]">
                      {taskKey}
                    </td>
                    <td className="py-2.5 font-medium text-white">{policy.primary_model}</td>
                    <td className="py-2.5 font-mono text-graphite-300 capitalize">
                      {policy.primary_provider}
                    </td>
                    <td className="py-2.5 font-mono text-graphite-400 text-[10px]">
                      {(policy.fallback_chain || []).join(" -> ")}
                    </td>
                    <td className="py-2.5 font-mono text-graphite-400 tabular-nums">
                      {policy.timeout_seconds}s
                    </td>
                    <td className="py-2.5 text-right font-mono text-graphite-300 tabular-nums">
                      ${policy.max_cost_limit_usd?.toFixed(2) ?? "0.00"}
                    </td>
                  </tr>
                ))}
              {/* Deterministic Tasks Guard */}
              <tr className="hover:bg-white/[0.01] bg-clinical-teal/[0.02]">
                <td className="py-2.5 font-mono text-clinical-teal text-[11px]">
                  DETERMINISTIC_CALCULATION
                </td>
                <td className="py-2.5 font-medium text-white">Pure Python Formula (CKD-EPI / CG)</td>
                <td className="py-2.5 font-mono text-clinical-teal">Deterministic Engine</td>
                <td className="py-2.5 font-mono text-graphite-400 text-[10px]">
                  Zero LLM Arithmetic Permitted
                </td>
                <td className="py-2.5 font-mono text-graphite-400 tabular-nums">&lt; 1ms</td>
                <td className="py-2.5 text-right font-mono text-clinical-teal tabular-nums">
                  $0.0000
                </td>
              </tr>
              <tr className="hover:bg-white/[0.01] bg-clinical-rose/[0.02]">
                <td className="py-2.5 font-mono text-clinical-rose text-[11px]">
                  DRUG_SAFETY_CHECK
                </td>
                <td className="py-2.5 font-medium text-white">Deterministic Pharmacovigilance Rules</td>
                <td className="py-2.5 font-mono text-clinical-rose">Rule Engine</td>
                <td className="py-2.5 font-mono text-graphite-400 text-[10px]">
                  Zero LLM Contraindication Decisions
                </td>
                <td className="py-2.5 font-mono text-graphite-400 tabular-nums">&lt; 1ms</td>
                <td className="py-2.5 text-right font-mono text-clinical-rose tabular-nums">
                  $0.0000
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Retrieval & Reranker Configuration */}
      <div className="bg-graphite-900 border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
          <Layers className="w-4 h-4 text-clinical-blue" />
          <h3 className="text-xs font-semibold text-white">
            Hybrid Retrieval & Neural Cross-Encoder Configuration
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-graphite-850 p-3.5 rounded-xl border border-white/[0.04] space-y-1">
            <span className="text-[10px] text-graphite-500 font-mono block uppercase">
              Vector Storage
            </span>
            <div className="font-semibold text-white">PostgreSQL / pgvector</div>
            <div className="text-[10px] text-graphite-400 font-mono">
              384-dim dense embeddings + cosine index
            </div>
          </div>

          <div className="bg-graphite-850 p-3.5 rounded-xl border border-white/[0.04] space-y-1">
            <span className="text-[10px] text-graphite-500 font-mono block uppercase">
              BM25 Keyword Search
            </span>
            <div className="font-semibold text-white">Rank-BM25 Okapi</div>
            <div className="text-[10px] text-graphite-400 font-mono">
              k1=1.5, b=0.75 exact drug match
            </div>
          </div>

          <div className="bg-graphite-850 p-3.5 rounded-xl border border-white/[0.04] space-y-1">
            <span className="text-[10px] text-graphite-500 font-mono block uppercase">
              Cross-Encoder Reranker
            </span>
            <div className="font-semibold text-clinical-teal">FlashRank ONNX</div>
            <div className="text-[10px] text-graphite-400 font-mono">
              ms-marco-TinyBERT-L-2-v2 (~5ms)
            </div>
          </div>

          <div className="bg-graphite-850 p-3.5 rounded-xl border border-white/[0.04] space-y-1">
            <span className="text-[10px] text-graphite-500 font-mono block uppercase">
              CRAG Quality Gate
            </span>
            <div className="font-semibold text-clinical-amber">Threshold: 0.65</div>
            <div className="text-[10px] text-graphite-400 font-mono">
              Max 2 query reformulation loops
            </div>
          </div>
        </div>
      </div>

      {/* 4. Regulatory Audit Log (HITL Decisions) */}
      <div className="bg-graphite-900 border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-clinical-emerald" />
            <h3 className="text-xs font-semibold text-white">
              Regulatory Audit Events Trail (HITL Decisions)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-graphite-400">
            {auditEvents.length} immutable events recorded in EHR database
          </span>
        </div>

        {auditEvents.length === 0 ? (
          <div className="text-center py-6 text-xs text-graphite-400 font-mono">
            No clinician override decisions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-graphite-400 font-mono text-[11px]">
                  <th className="pb-2.5 font-normal">Timestamp</th>
                  <th className="pb-2.5 font-normal">Run ID</th>
                  <th className="pb-2.5 font-normal">Patient</th>
                  <th className="pb-2.5 font-normal">Clinician ID</th>
                  <th className="pb-2.5 font-normal">Decision</th>
                  <th className="pb-2.5 font-normal">Override Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {auditEvents.map((evt) => (
                  <tr key={evt.event_id} className="hover:bg-white/[0.01]">
                    <td className="py-2.5 font-mono text-[11px] text-graphite-400 whitespace-nowrap">
                      {evt.timestamp}
                    </td>
                    <td className="py-2.5 font-mono text-clinical-blue text-[11px]">
                      {evt.run_id}
                    </td>
                    <td className="py-2.5 font-mono text-white">{evt.patient_id}</td>
                    <td className="py-2.5 font-mono text-graphite-300">{evt.clinician_id}</td>
                    <td className="py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          evt.decision?.includes("APPROVED")
                            ? "bg-clinical-emerald/15 text-clinical-emerald"
                            : "bg-clinical-rose/15 text-clinical-rose"
                        }`}
                      >
                        {evt.decision}
                      </span>
                    </td>
                    <td className="py-2.5 text-graphite-300 font-sans text-xs max-w-sm">
                      {evt.override_rationale}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
