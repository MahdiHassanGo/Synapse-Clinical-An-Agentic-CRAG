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

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

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
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full font-sans bg-canvas text-ink">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-hairline">
        <div>
          <h1 className="text-lg font-semibold text-ink flex items-center gap-2">
            <Sliders className="w-5 h-5 text-accent" />
            <span>Multi-Model Orchestrator &amp; System Governance</span>
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Provider configurations, task-specific model routing policies, and persistent regulatory audit trail.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="px-3 py-1.5 rounded-lg bg-surface hover:bg-subtle border border-hairline text-ink-secondary hover:text-ink text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Prominent Regulatory Disclaimer */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-clinical-amber shrink-0 mt-0.5" />
        <div className="text-xs text-ink-secondary leading-relaxed space-y-1">
          <div className="font-semibold text-ink">
            Research &amp; Educational Portfolio Demonstration Notice
          </div>
          <p className="text-xs">
            Synapse Clinical operates strictly on synthetic patient telemetry (P101–P104) and public clinical guidelines (NICE, KDIGO, WHO, BMDC). This application is not an FDA/CE-cleared medical device and must never be utilized for real patient care, autonomous prescribing, or unverified treatment orders.
          </p>
        </div>
      </div>

      {/* 1. LLM Provider Status Cards */}
      <div className="bg-surface border border-hairline rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-hairline">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-semibold text-ink">
              LLM Provider Registry &amp; Gateway Status
            </h3>
          </div>
          <span className="text-[11px] font-mono text-ink-muted">
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
                className="bg-subtle border border-hairline rounded-lg p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink text-xs capitalize">
                    {p.provider_name}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
                      isMock
                        ? "bg-amber-50 text-clinical-amber border-amber-200"
                        : isOnline
                        ? "bg-emerald-50 text-clinical-emerald border-emerald-200"
                        : "bg-muted text-ink-muted border-hairline"
                    }`}
                  >
                    {isMock ? "Mock Standby" : isOnline ? "Active" : "Missing Key"}
                  </span>
                </div>

                <div className="text-[11px] font-mono text-ink-secondary space-y-0.5">
                  <div className="text-ink-muted text-[11px]">Configured Models:</div>
                  {(p.active_models || []).map((m, mIdx) => (
                    <div key={mIdx} className="text-ink truncate">
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
      <div className="bg-surface border border-hairline rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-hairline">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-semibold text-ink">
              Task-Specific Model Routing Policies &amp; Fallback Chains
            </h3>
          </div>
          <span className="text-[11px] font-mono text-accent">
            Multi-Model Orchestrator
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-hairline text-ink-muted font-mono text-[11px]">
                <th className="pb-2.5 font-medium">Task Type</th>
                <th className="pb-2.5 font-medium">Primary Model</th>
                <th className="pb-2.5 font-medium">Provider</th>
                <th className="pb-2.5 font-medium">Fallback Chain</th>
                <th className="pb-2.5 font-medium">Timeout</th>
                <th className="pb-2.5 font-medium text-right">Max Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {status?.routing_policies &&
                Object.entries(status.routing_policies).map(([taskKey, policy]) => (
                  <tr key={taskKey} className="hover:bg-subtle/60 transition-colors">
                    <td className="py-2.5 font-mono text-accent text-[11px] font-medium">
                      {taskKey}
                    </td>
                    <td className="py-2.5 font-medium text-ink">{policy.primary_model}</td>
                    <td className="py-2.5 font-mono text-ink-secondary capitalize">
                      {policy.primary_provider}
                    </td>
                    <td className="py-2.5 font-mono text-ink-muted text-[11px]">
                      {(policy.fallback_chain || []).join(" -> ") || "None"}
                    </td>
                    <td className="py-2.5 font-mono text-ink-muted tabular-nums">
                      {policy.timeout_seconds}s
                    </td>
                    <td className="py-2.5 text-right font-mono text-ink-secondary tabular-nums">
                      ${policy.max_cost_limit_usd?.toFixed(2) ?? "0.00"}
                    </td>
                  </tr>
                ))}
              <tr className="bg-accent-soft/40">
                <td className="py-2.5 font-mono text-accent text-[11px] font-medium">
                  DETERMINISTIC_CALCULATION
                </td>
                <td className="py-2.5 font-medium text-ink">Pure Python Formula (CKD-EPI / CG)</td>
                <td className="py-2.5 font-mono text-accent">Deterministic Engine</td>
                <td className="py-2.5 font-mono text-ink-muted text-[11px]">
                  Zero LLM Arithmetic Permitted
                </td>
                <td className="py-2.5 font-mono text-ink-muted tabular-nums">&lt; 1ms</td>
                <td className="py-2.5 text-right font-mono text-accent tabular-nums">
                  $0.0000
                </td>
              </tr>
              <tr className="bg-red-50/50">
                <td className="py-2.5 font-mono text-clinical-rose text-[11px] font-medium">
                  DRUG_SAFETY_CHECK
                </td>
                <td className="py-2.5 font-medium text-ink">Deterministic Pharmacovigilance Rules</td>
                <td className="py-2.5 font-mono text-clinical-rose">Rule Engine</td>
                <td className="py-2.5 font-mono text-ink-muted text-[11px]">
                  Zero LLM Contraindication Decisions
                </td>
                <td className="py-2.5 font-mono text-ink-muted tabular-nums">&lt; 1ms</td>
                <td className="py-2.5 text-right font-mono text-clinical-rose tabular-nums">
                  $0.0000
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Retrieval & Reranker Configuration */}
      <div className="bg-surface border border-hairline rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2.5 border-b border-hairline">
          <Layers className="w-4 h-4 text-accent" />
          <h3 className="text-xs font-semibold text-ink">
            Hybrid Retrieval &amp; Neural Cross-Encoder Configuration
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-subtle p-3.5 rounded-lg border border-hairline space-y-1">
            <span className="text-[11px] text-ink-muted font-mono block">
              Vector Storage
            </span>
            <div className="font-semibold text-ink">PostgreSQL / pgvector</div>
            <div className="text-[11px] text-ink-secondary font-mono">
              384-dim dense embeddings + cosine index
            </div>
          </div>

          <div className="bg-subtle p-3.5 rounded-lg border border-hairline space-y-1">
            <span className="text-[11px] text-ink-muted font-mono block">
              BM25 Keyword Search
            </span>
            <div className="font-semibold text-ink">Rank-BM25 Okapi</div>
            <div className="text-[11px] text-ink-secondary font-mono">
              k1=1.5, b=0.75 exact drug match
            </div>
          </div>

          <div className="bg-subtle p-3.5 rounded-lg border border-hairline space-y-1">
            <span className="text-[11px] text-ink-muted font-mono block">
              Cross-Encoder Reranker
            </span>
            <div className="font-semibold text-accent">FlashRank ONNX</div>
            <div className="text-[11px] text-ink-secondary font-mono">
              ms-marco-TinyBERT-L-2-v2 (~5ms)
            </div>
          </div>

          <div className="bg-subtle p-3.5 rounded-lg border border-hairline space-y-1">
            <span className="text-[11px] text-ink-muted font-mono block">
              CRAG Quality Gate
            </span>
            <div className="font-semibold text-clinical-amber">Threshold: 0.65</div>
            <div className="text-[11px] text-ink-secondary font-mono">
              Max 2 query reformulation loops
            </div>
          </div>
        </div>
      </div>

      {/* 4. Regulatory Audit Log (HITL Decisions) */}
      <div className="bg-surface border border-hairline rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-hairline">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-clinical-emerald" />
            <h3 className="text-xs font-semibold text-ink">
              Regulatory Audit Events Trail (HITL Decisions)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-ink-muted">
            {auditEvents.length} immutable events recorded in EHR database
          </span>
        </div>

        {auditEvents.length === 0 ? (
          <div className="text-center py-6 text-xs text-ink-muted font-mono">
            No clinician override decisions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-hairline text-ink-muted font-mono text-[11px]">
                  <th className="pb-2.5 font-medium">Timestamp</th>
                  <th className="pb-2.5 font-medium">Run ID</th>
                  <th className="pb-2.5 font-medium">Patient</th>
                  <th className="pb-2.5 font-medium">Clinician ID</th>
                  <th className="pb-2.5 font-medium">Decision</th>
                  <th className="pb-2.5 font-medium">Override Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {auditEvents.map((evt: any, idx: number) => (
                  <tr key={evt.audit_id || evt.event_id || idx} className="hover:bg-subtle/60">
                    <td className="py-2.5 font-mono text-[11px] text-ink-muted whitespace-nowrap">
                      {evt.timestamp || evt.recorded_at}
                    </td>
                    <td className="py-2.5 font-mono text-accent text-[11px]">
                      {evt.run_id}
                    </td>
                    <td className="py-2.5 font-mono text-ink font-medium">{evt.patient_id}</td>
                    <td className="py-2.5 font-mono text-ink-secondary">{evt.clinician_id}</td>
                    <td className="py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${
                          evt.decision?.includes("APPROVED")
                            ? "bg-emerald-50 text-clinical-emerald border-emerald-200"
                            : "bg-red-50 text-clinical-rose border-red-200"
                        }`}
                      >
                        {evt.decision}
                      </span>
                    </td>
                    <td className="py-2.5 text-ink-secondary font-sans text-xs max-w-sm">
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
