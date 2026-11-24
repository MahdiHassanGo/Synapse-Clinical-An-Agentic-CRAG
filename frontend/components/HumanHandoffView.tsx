"use client";

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserCheck,
  Filter,
  Search,
  RefreshCw,
  Send,
  ShieldAlert,
  ArrowRight
} from "lucide-react";

interface HandoffRequest {
  request_id: string;
  tenant_id: string;
  session_id: string;
  patient_id?: string;
  patient_name?: string;
  user_query: string;
  status: "REQUESTED" | "WAITING" | "ASSIGNED" | "IN_REVIEW" | "RESOLVED" | "CANCELLED";
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
  assigned_to?: string;
  notes?: string;
  created_at: string;
  resolved_at?: string;
}

export function HumanHandoffView() {
  const [requests, setRequests] = useState<HandoffRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedRequest, setSelectedRequest] = useState<HandoffRequest | null>(null);
  const [assigneeName, setAssigneeName] = useState<string>("Nurse Sarah Jenkins, RN");
  const [actionNotes, setActionNotes] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/handoff/requests`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.requests || []);
      setRequests(list);
      if (list.length > 0 && !selectedRequest) {
        setSelectedRequest(list[0]);
      }
    } catch (err) {
      console.error("Failed to fetch handoff requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAssign = async (reqId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/handoff/requests/${reqId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to: assigneeName })
      });
      const updated = await res.json();
      setSelectedRequest(updated);
      fetchRequests();
    } catch (err) {
      console.error("Failed to assign:", err);
    }
  };

  const handleUpdateStatus = async (reqId: string, newStatus: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/handoff/requests/${reqId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, notes: actionNotes || undefined })
      });
      const updated = await res.json();
      setSelectedRequest(updated);
      setActionNotes("");
      fetchRequests();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (urgencyFilter !== "ALL" && r.urgency !== urgencyFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.user_query.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        (r.patient_name && r.patient_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "CRITICAL":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      case "HIGH":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "MEDIUM":
        return "bg-sky-500/20 text-sky-300 border-sky-500/40";
      default:
        return "bg-graphite-700 text-graphite-300 border-graphite-600";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RESOLVED":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "ASSIGNED":
      case "IN_REVIEW":
        return "bg-sky-500/10 text-sky-400 border-sky-500/20";
      case "CANCELLED":
        return "bg-graphite-800 text-graphite-400 border-white/[0.06]";
      default:
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-graphite-950 text-white select-none">
      {/* Left Column: Tickets Queue */}
      <div className="w-1/2 border-r border-white/[0.08] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] bg-graphite-900/90 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-white">Human Support & Triage Escalation Queue</h2>
                <div className="text-[11px] text-graphite-400">Clinic Staff Ticket Management</div>
              </div>
            </div>
            <button
              onClick={fetchRequests}
              className="p-1.5 rounded-lg bg-graphite-800 hover:bg-graphite-700 text-graphite-300 border border-white/[0.08] text-xs transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="w-3.5 h-3.5 text-graphite-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient, symptoms, or inquiry..."
                className="w-full bg-graphite-950 border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-graphite-500 outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-graphite-800 text-xs text-graphite-300 border border-white/[0.08] rounded-lg px-2 py-1.5 font-mono outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="REQUESTED">Requested</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="RESOLVED">Resolved</option>
            </select>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="bg-graphite-800 text-xs text-graphite-300 border border-white/[0.08] rounded-lg px-2 py-1.5 font-mono outline-none"
            >
              <option value="ALL">All Urgencies</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
            </select>
          </div>
        </div>

        {/* Tickets List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && (
            <div className="p-8 text-center text-xs text-graphite-400">Loading escalation tickets...</div>
          )}
          {!loading && filteredRequests.length === 0 && (
            <div className="p-8 text-center text-xs text-graphite-400 space-y-1">
              <div>No escalation requests matching criteria.</div>
              <div className="text-[11px] text-graphite-500">All patient inquiries resolved or handled.</div>
            </div>
          )}
          {filteredRequests.map((req) => {
            const isSelected = selectedRequest?.request_id === req.request_id;
            return (
              <div
                key={req.request_id}
                onClick={() => setSelectedRequest(req)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                  isSelected
                    ? "bg-graphite-850 border-clinical-blue/50 shadow-md"
                    : "bg-graphite-900 hover:bg-graphite-850 border-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-white">{req.request_id}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono ${getUrgencyBadge(req.urgency)}`}>
                      {req.urgency}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono ${getStatusBadge(req.status)}`}>
                      {req.status}
                    </span>
                  </div>
                  <span className="text-[10px] text-graphite-400 font-mono">{req.created_at}</span>
                </div>

                <div className="text-xs font-medium text-graphite-200 line-clamp-2">
                  "{req.user_query}"
                </div>

                <div className="flex items-center justify-between text-[11px] text-graphite-400 border-t border-white/[0.04] pt-2">
                  <span>Patient: <strong className="text-graphite-300">{req.patient_name || "Anonymous"}</strong></span>
                  <span>{req.assigned_to ? `Assigned: ${req.assigned_to}` : "Unassigned"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Ticket Inspection & Actions */}
      <div className="w-1/2 p-6 flex flex-col justify-between overflow-y-auto space-y-6">
        {selectedRequest ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white font-mono">{selectedRequest.request_id}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${getUrgencyBadge(selectedRequest.urgency)}`}>
                    {selectedRequest.urgency}
                  </span>
                </div>
                <div className="text-xs text-graphite-400 mt-1">Tenant: {selectedRequest.tenant_id}</div>
              </div>
              <div className="text-right">
                <span className={`text-xs px-2.5 py-1 rounded border font-mono ${getStatusBadge(selectedRequest.status)}`}>
                  {selectedRequest.status}
                </span>
                <div className="text-[10px] text-graphite-400 mt-1 font-mono">Logged: {selectedRequest.created_at}</div>
              </div>
            </div>

            {/* Patient Context */}
            <div className="p-4 rounded-xl bg-graphite-900 border border-white/[0.06] space-y-2">
              <div className="text-xs font-semibold text-white">Patient Context</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-graphite-400">Name: </span>
                  <span className="text-white font-medium">{selectedRequest.patient_name || "Anonymous Visitor"}</span>
                </div>
                <div>
                  <span className="text-graphite-400">Patient ID: </span>
                  <span className="text-white font-mono">{selectedRequest.patient_id || "Unauthenticated"}</span>
                </div>
                <div>
                  <span className="text-graphite-400">Session ID: </span>
                  <span className="text-white font-mono text-[11px]">{selectedRequest.session_id}</span>
                </div>
                <div>
                  <span className="text-graphite-400">Assigned To: </span>
                  <span className="text-sky-300 font-medium">{selectedRequest.assigned_to || "None"}</span>
                </div>
              </div>
            </div>

            {/* Inquired Query & Trigger Reason */}
            <div className="p-4 rounded-xl bg-graphite-900 border border-white/[0.06] space-y-2">
              <div className="text-xs font-semibold text-white">Patient Inquiry & Escalation Reason</div>
              <div className="p-3 rounded-lg bg-graphite-950 border border-white/[0.04] text-xs text-graphite-200 italic">
                "{selectedRequest.user_query}"
              </div>
              <div className="text-xs text-graphite-300">
                <strong>Reason:</strong> {selectedRequest.reason}
              </div>
            </div>

            {/* Actions: Assign & Status Progression */}
            <div className="p-4 rounded-xl bg-graphite-900 border border-white/[0.06] space-y-3">
              <div className="text-xs font-semibold text-white">Clinical Triage Actions</div>
              
              <div className="flex items-center gap-2">
                <select
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  className="flex-1 bg-graphite-950 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="Nurse Sarah Jenkins, RN">Nurse Sarah Jenkins, RN (Triage)</option>
                  <option value="Dr. Marcus Bell, MD">Dr. Marcus Bell, MD (Internal Med)</option>
                  <option value="Clinical Pharmacist David Chen, PharmD">David Chen, PharmD (Pharmacy)</option>
                </select>
                <button
                  onClick={() => handleAssign(selectedRequest.request_id)}
                  className="px-3 py-2 rounded-lg bg-clinical-blue hover:bg-clinical-blue/90 text-xs font-medium text-white transition-all shadow-md"
                >
                  Assign Staff
                </button>
              </div>

              <div>
                <label className="text-[11px] text-graphite-400 font-mono">Clinical Note / Resolution Summary</label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={2}
                  placeholder="Record call details, medication counseling, or ER referral instructions..."
                  className="w-full mt-1 bg-graphite-950 border border-white/[0.08] rounded-lg p-2.5 text-xs text-white placeholder-graphite-500 outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
                <button
                  onClick={() => handleUpdateStatus(selectedRequest.request_id, "IN_REVIEW")}
                  className="px-3 py-1.5 rounded-lg bg-graphite-800 hover:bg-graphite-700 text-xs text-graphite-200 border border-white/[0.08]"
                >
                  Mark In Review
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedRequest.request_id, "RESOLVED")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white shadow-md"
                >
                  Mark Resolved
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedRequest.request_id, "CANCELLED")}
                  className="px-3 py-1.5 rounded-lg bg-graphite-800 hover:bg-rose-900/40 text-xs text-graphite-400 hover:text-rose-300 border border-white/[0.08]"
                >
                  Dismiss / Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-graphite-400">
            Select an escalation request from the queue to inspect details and assign staff.
          </div>
        )}
      </div>
    </div>
  );
}
