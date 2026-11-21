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

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

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
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-graphite-950 text-white select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Regulatory Audit Trail & HITL Sign-Off Log</h2>
            <div className="text-xs text-graphite-400">Immutable FDA / BMDC Clinical Verification Record</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-graphite-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clinician, run, or rationale..."
              className="bg-graphite-900 border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-graphite-500 outline-none w-64"
            />
          </div>
          <select
            value={patientFilter}
            onChange={(e) => setPatientFilter(e.target.value)}
            className="bg-graphite-800 text-xs text-graphite-200 border border-white/[0.08] rounded-lg px-2.5 py-1.5 font-mono outline-none"
          >
            <option value="ALL">All Patients</option>
            <option value="P101">Eleanor Vance (P101)</option>
            <option value="P102">Arthur Pendleton (P102)</option>
            <option value="P103">Marcus Holloway (P103)</option>
            <option value="P104">Sarah Chen (P104)</option>
          </select>
          <button
            onClick={fetchAuditEvents}
            className="p-1.5 rounded-lg bg-graphite-800 hover:bg-graphite-700 text-graphite-300 border border-white/[0.08] text-xs transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Audit Events Table */}
      <div className="rounded-xl border border-white/[0.08] bg-graphite-900 overflow-hidden shadow-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-graphite-850 text-graphite-400 font-mono text-[11px] border-b border-white/[0.06]">
            <tr>
              <th className="py-3 px-4">Event / Timestamp</th>
              <th className="py-3 px-4">Run & Session ID</th>
              <th className="py-3 px-4">Patient</th>
              <th className="py-3 px-4">Clinician Sign-Off</th>
              <th className="py-3 px-4">Decision</th>
              <th className="py-3 px-4">Clinical Override Justification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-graphite-400">Loading audit records...</td>
              </tr>
            )}
            {!loading && filteredEvents.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-graphite-400">
                  No regulatory audit events recorded yet. Perform an override in the Clinician Workspace to generate an entry.
                </td>
              </tr>
            )}
            {filteredEvents.map((e) => {
              const isApproved = e.decision.includes("APPROVED");
              return (
                <tr key={e.event_id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white font-mono">#{e.event_id}</div>
                    <div className="text-[10px] text-graphite-400 font-mono">{e.timestamp || e.recorded_at}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-clinical-blue truncate max-w-[120px]">
                    {e.run_id}
                  </td>
                  <td className="py-3 px-4 font-mono text-white">
                    {e.patient_id}
                  </td>
                  <td className="py-3 px-4 font-mono text-emerald-400">
                    {e.clinician_id}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded border font-mono font-semibold flex items-center gap-1 w-fit ${
                        isApproved
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}
                    >
                      {isApproved ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      <span>{e.decision}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-graphite-300 max-w-sm">
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
