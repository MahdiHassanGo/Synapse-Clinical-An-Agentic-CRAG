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
        return "bg-red-50 text-clinical-rose border-red-200";
      case "HIGH":
        return "bg-amber-50 text-clinical-amber border-amber-200";
      case "MEDIUM":
        return "bg-blue-50 text-clinical-blue border-blue-200";
      default:
        return "bg-subtle text-ink-secondary border-hairline";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RESOLVED":
        return "bg-emerald-50 text-clinical-emerald border-emerald-200";
      case "ASSIGNED":
      case "IN_REVIEW":
        return "bg-accent-soft text-accent border-accent-border";
      case "CANCELLED":
        return "bg-subtle text-ink-muted border-hairline";
      default:
        return "bg-amber-50 text-clinical-amber border-amber-200";
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-canvas text-ink">
      {/* Left Column: Tickets Queue */}
      <div className="w-full lg:w-1/2 border-b lg:border-b-0 lg:border-r border-hairline flex flex-col max-h-[50vh] lg:max-h-none">
        {/* Header */}
        <div className="p-4 border-b border-hairline bg-surface space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-clinical-amber">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-ink">Human Support &amp; Triage Escalation Queue</h2>
                <div className="text-xs text-ink-muted">Clinic staff ticket management</div>
              </div>
            </div>
            <button
              type="button"
              onClick={fetchRequests}
              aria-label="Refresh escalation queue"
              className="p-2 rounded-lg bg-subtle hover:bg-muted text-ink-secondary border border-hairline text-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[180px] relative">
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient, symptoms, or inquiry..."
                className="w-full bg-subtle border border-hairline rounded-lg pl-8 pr-3 py-1.5 text-xs text-ink placeholder-ink-muted outline-none focus:border-accent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="bg-subtle text-xs text-ink-secondary border border-hairline rounded-lg px-2.5 py-1.5 font-mono outline-none focus:border-accent"
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
              aria-label="Filter by urgency"
              className="bg-subtle text-xs text-ink-secondary border border-hairline rounded-lg px-2.5 py-1.5 font-mono outline-none focus:border-accent"
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
            <div className="p-8 text-center text-xs text-ink-muted">Loading escalation tickets...</div>
          )}
          {!loading && filteredRequests.length === 0 && (
            <div className="p-8 text-center text-xs text-ink-muted space-y-1">
              <div>No escalation requests matching criteria.</div>
              <div className="text-[11px]">All patient inquiries resolved or handled.</div>
            </div>
          )}
          {filteredRequests.map((req) => {
            const isSelected = selectedRequest?.request_id === req.request_id;
            return (
              <button
                key={req.request_id}
                type="button"
                onClick={() => setSelectedRequest(req)}
                className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer space-y-2 ${
                  isSelected
                    ? "bg-accent-soft/60 border-accent-border border-l-4 border-l-accent"
                    : "bg-surface hover:bg-subtle border-hairline"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-semibold text-ink">{req.request_id}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${getUrgencyBadge(req.urgency)}`}>
                      {req.urgency}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${getStatusBadge(req.status)}`}>
                      {req.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-ink-muted font-mono">{req.created_at}</span>
                </div>

                <div className="text-xs font-medium text-ink-secondary line-clamp-2">
                  &ldquo;{req.user_query}&rdquo;
                </div>

                <div className="flex items-center justify-between text-[11px] text-ink-muted border-t border-hairline pt-2">
                  <span>Patient: <strong className="text-ink">{req.patient_name || "Anonymous"}</strong></span>
                  <span>{req.assigned_to ? `Assigned: ${req.assigned_to}` : "Unassigned"}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Ticket Inspection & Actions */}
      <div className="w-full lg:w-1/2 p-4 sm:p-6 flex flex-col justify-between overflow-y-auto space-y-6">
        {selectedRequest ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink font-mono">{selectedRequest.request_id}</h3>
                  <span className={`text-[11px] px-2 py-0.5 rounded border font-mono ${getUrgencyBadge(selectedRequest.urgency)}`}>
                    {selectedRequest.urgency}
                  </span>
                </div>
                <div className="text-xs text-ink-muted mt-1">Tenant: {selectedRequest.tenant_id}</div>
              </div>
              <div className="text-right">
                <span className={`text-xs px-2.5 py-1 rounded border font-mono ${getStatusBadge(selectedRequest.status)}`}>
                  {selectedRequest.status}
                </span>
                <div className="text-[11px] text-ink-muted mt-1 font-mono">Logged: {selectedRequest.created_at}</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-hairline space-y-2.5">
              <div className="text-xs font-semibold text-ink">Patient Context</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-ink-muted">Name: </span>
                  <span className="text-ink font-medium">{selectedRequest.patient_name || "Anonymous Visitor"}</span>
                </div>
                <div>
                  <span className="text-ink-muted">Patient ID: </span>
                  <span className="text-ink font-mono">{selectedRequest.patient_id || "Unauthenticated"}</span>
                </div>
                <div>
                  <span className="text-ink-muted">Session ID: </span>
                  <span className="text-ink-secondary font-mono text-[11px]">{selectedRequest.session_id}</span>
                </div>
                <div>
                  <span className="text-ink-muted">Assigned To: </span>
                  <span className="text-accent font-medium">{selectedRequest.assigned_to || "None"}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-hairline space-y-2">
              <div className="text-xs font-semibold text-ink">Patient Inquiry &amp; Escalation Reason</div>
              <div className="p-3 rounded-lg bg-subtle border border-hairline text-xs text-ink">
                &ldquo;{selectedRequest.user_query}&rdquo;
              </div>
              <div className="text-xs text-ink-secondary">
                <strong className="text-ink">Reason:</strong> {selectedRequest.reason}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-hairline space-y-3">
              <div className="text-xs font-semibold text-ink">Clinical Triage Actions</div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  aria-label="Assign clinician"
                  className="flex-1 min-w-[200px] bg-subtle border border-strong rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-accent"
                >
                  <option value="Nurse Sarah Jenkins, RN">Nurse Sarah Jenkins, RN (Triage)</option>
                  <option value="Dr. Marcus Bell, MD">Dr. Marcus Bell, MD (Internal Med)</option>
                  <option value="Clinical Pharmacist David Chen, PharmD">David Chen, PharmD (Pharmacy)</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleAssign(selectedRequest.request_id)}
                  className="px-3.5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Assign Staff
                </button>
              </div>

              <div>
                <label className="text-xs font-medium text-ink-secondary">Clinical Note / Resolution Summary</label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={2}
                  placeholder="Record call details, medication counseling, or ER referral instructions..."
                  className="w-full mt-1 bg-subtle border border-strong rounded-lg p-2.5 text-xs text-ink placeholder-ink-muted outline-none focus:border-accent"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(selectedRequest.request_id, "IN_REVIEW")}
                  className="px-3 py-1.5 rounded-lg bg-subtle hover:bg-muted text-xs text-ink-secondary border border-hairline cursor-pointer"
                >
                  Mark In Review
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(selectedRequest.request_id, "RESOLVED")}
                  className="px-3 py-1.5 rounded-lg bg-clinical-emerald hover:opacity-90 text-xs font-semibold text-white cursor-pointer"
                >
                  Mark Resolved
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(selectedRequest.request_id, "CANCELLED")}
                  className="px-3 py-1.5 rounded-lg bg-subtle hover:bg-red-50 text-xs text-ink-muted hover:text-clinical-rose border border-hairline cursor-pointer"
                >
                  Dismiss / Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-ink-muted">
            Select an escalation request from the queue to inspect details and assign staff.
          </div>
        )}
      </div>
    </div>
  );
}
