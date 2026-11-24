"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Search,
  RefreshCw,
  FileText,
  CheckCircle,
  XCircle,
  AlertOctagon,
  Calendar
} from "lucide-react";

interface AuditEvent {
  event_id: number;
  audit_id?: string;
  timestamp: string;
  recorded_at: string;
  run_id: string;
  session_id: string;
  patient_id: string;
  clinician_id: string;
  decision: string;
  override_rationale?: string;
}

export function AuditLogsView() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [patientFilter, setPatientFilter] = useState<string>("ALL");

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  const fetchAuditEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/audit/events`);
      const data = await res.json();
      setEvents(data.audit_events || []);
    } catch (err) {
      console.error("Failed to fetch audit events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditEvents();
  }, []);

  const filteredEvents = events.filter((e) => {
    if (patientFilter !== "ALL" && e.patient_id !== patientFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        e.run_id.toLowerCase().includes(q) ||
        e.clinician_id.toLowerCase().includes(q) ||
        (e.override_rationale && e.override_rationale.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-canvas text-ink max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-clinical-emerald">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">Regulatory Audit Trail &amp; HITL Sign-Off Log</h2>
            <div className="text-xs text-ink-muted">Immutable FDA / BMDC clinical verification record</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clinician, run, or rationale..."
              className="bg-surface border border-hairline rounded-lg pl-8 pr-3 py-1.5 text-xs text-ink placeholder-ink-muted outline-none focus:border-accent w-64"
            />
          </div>
          <select
            value={patientFilter}
            onChange={(e) => setPatientFilter(e.target.value)}
            aria-label="Filter by patient"
            className="bg-surface text-xs text-ink border border-hairline rounded-lg px-2.5 py-1.5 font-mono outline-none focus:border-accent"
          >
            <option value="ALL">All Patients</option>
            <option value="P101">Eleanor Vance (P101)</option>
            <option value="P102">Arthur Pendleton (P102)</option>
            <option value="P103">Marcus Holloway (P103)</option>
            <option value="P104">Sarah Chen (P104)</option>
          </select>
          <button
            type="button"
            onClick={fetchAuditEvents}
            aria-label="Refresh audit trail"
            className="p-2 rounded-lg bg-surface hover:bg-subtle text-ink-secondary border border-hairline text-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Audit Events Table */}
      <div className="rounded-xl border border-hairline bg-surface overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-subtle text-ink-muted font-mono text-[11px] border-b border-hairline">
            <tr>
              <th className="py-3 px-4 font-medium">Event / Timestamp</th>
              <th className="py-3 px-4 font-medium">Run &amp; Session ID</th>
              <th className="py-3 px-4 font-medium">Patient</th>
              <th className="py-3 px-4 font-medium">Clinician Sign-Off</th>
              <th className="py-3 px-4 font-medium">Decision</th>
              <th className="py-3 px-4 font-medium">Clinical Override Justification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {loading && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-ink-muted">Loading audit records...</td>
              </tr>
            )}
            {!loading && filteredEvents.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-ink-muted">
                  No regulatory audit events recorded yet. Perform an override in the Clinician Workspace to generate an entry.
                </td>
              </tr>
            )}
            {filteredEvents.map((e, idx) => {
              const isApproved = e.decision.includes("APPROVED");
              return (
                <tr key={e.audit_id || e.event_id || idx} className="hover:bg-subtle/60 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-ink font-mono">{e.audit_id || `#${e.event_id}`}</div>
                    <div className="text-[11px] text-ink-muted font-mono">{e.timestamp || e.recorded_at}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-accent truncate max-w-[140px]">
                    {e.run_id}
                  </td>
                  <td className="py-3 px-4 font-mono text-ink font-medium">
                    {e.patient_id}
                  </td>
                  <td className="py-3 px-4 font-mono text-clinical-emerald font-medium">
                    {e.clinician_id}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded border font-mono font-semibold inline-flex items-center gap-1 ${
                        isApproved
                          ? "bg-emerald-50 text-clinical-emerald border-emerald-200"
                          : "bg-red-50 text-clinical-rose border-red-200"
                      }`}
                    >
                      {isApproved ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      <span>{e.decision}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-ink-secondary max-w-sm leading-relaxed">
                    {e.override_rationale || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
