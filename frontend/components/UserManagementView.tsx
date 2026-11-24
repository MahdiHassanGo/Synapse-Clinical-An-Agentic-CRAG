"use client";

import React, { useState } from "react";
import {
  Users,
  ShieldCheck,
  UserCheck,
  Key,
  Lock,
  Plus,
  ShieldAlert,
  CheckCircle2
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  role: "ADMIN" | "CLINICIAN" | "TRIAGE_NURSE" | "PATIENT";
  email: string;
  department: string;
  status: "ACTIVE" | "INACTIVE";
  permissions: string[];
}

const INITIAL_USERS: UserProfile[] = [
  {
    id: "USR_101",
    name: "Dr. Marcus Bell, MD",
    role: "CLINICIAN",
    email: "m.bell@synapse.health",
    department: "Internal Medicine & Nephrology",
    status: "ACTIVE",
    permissions: [
      "EHR:READ_FULL",
      "CLINICAL_COPILOT:EXECUTE",
      "HITL_GATE:SIGN_AND_OVERRIDE",
      "CALCULATORS:EXECUTE"
    ]
  },
  {
    id: "USR_102",
    name: "Nurse Sarah Jenkins, RN",
    role: "TRIAGE_NURSE",
    email: "s.jenkins@synapse.health",
    department: "Outpatient Clinic & Triage",
    status: "ACTIVE",
    permissions: [
      "HANDOFF_QUEUE:ASSIGN_AND_RESOLVE",
      "PATIENT_CHAT:ROUTER",
      "EHR:READ_SUMMARY"
    ]
  },
  {
    id: "USR_103",
    name: "Asif Rahman (Platform Lead)",
    role: "ADMIN",
    email: "asif@synapse.ai",
    department: "AI Engineering & Health Informatics",
    status: "ACTIVE",
    permissions: [
      "ALL:SUPERADMIN",
      "TENANT:MANAGE",
      "MODELS:ORCHESTRATE",
      "KNOWLEDGE:INGEST_AND_DELETE",
      "AUDIT:READ_ALL"
    ]
  },
  {
    id: "USR_104",
    name: "Eleanor Vance (Patient P101)",
    role: "PATIENT",
    email: "e.vance@example.org",
    department: "Patient Health Portal",
    status: "ACTIVE",
    permissions: [
      "PATIENT_CHAT:USE",
      "MY_EHR:VIEW_ONLY",
      "CONSENT:MANAGE_WITHDRAWAL"
    ]
  }
];

export function UserManagementView() {
  const [users, setUsers] = useState<UserProfile[]>(INITIAL_USERS);
  const [selectedRole, setSelectedRole] = useState<string>("ALL");

  const filteredUsers = selectedRole === "ALL" 
    ? users 
    : users.filter(u => u.role === selectedRole);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-red-50 text-clinical-rose border-red-200";
      case "CLINICIAN":
        return "bg-accent-soft text-accent border-accent-border";
      case "TRIAGE_NURSE":
        return "bg-amber-50 text-clinical-amber border-amber-200";
      default:
        return "bg-emerald-50 text-clinical-emerald border-emerald-200";
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-canvas text-ink max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent-soft border border-accent-border flex items-center justify-center text-accent">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">User &amp; Role-Based Access Control (RBAC)</h2>
            <div className="text-xs text-ink-muted">Strict permission separation between clinicians, nurses, and patients</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            aria-label="Filter by role"
            className="bg-surface text-xs text-ink border border-hairline rounded-lg px-3 py-1.5 font-mono outline-none focus:border-accent"
          >
            <option value="ALL">All Roles</option>
            <option value="CLINICIAN">Clinician</option>
            <option value="TRIAGE_NURSE">Triage Nurse</option>
            <option value="ADMIN">Administrator</option>
            <option value="PATIENT">Patient</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-hairline bg-surface overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-subtle text-ink-muted font-mono text-[11px] border-b border-hairline">
            <tr>
              <th className="py-3 px-4 font-medium">User</th>
              <th className="py-3 px-4 font-medium">Role</th>
              <th className="py-3 px-4 font-medium">Department / Clinic</th>
              <th className="py-3 px-4 font-medium">Permissions</th>
              <th className="py-3 px-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {filteredUsers.map((u) => (
              <tr key={u.id} className="hover:bg-subtle/60 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-medium text-ink">{u.name}</div>
                  <div className="text-[11px] text-ink-muted font-mono">{u.email}</div>
                </td>
                <td className="py-3 px-4">
                  <span className={`text-[11px] px-2 py-0.5 rounded border font-mono font-semibold ${getRoleBadge(u.role)}`}>
                    {u.role}
                  </span>
                </td>
                <td className="py-3 px-4 text-ink-secondary">{u.department}</td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {u.permissions.map((p) => (
                      <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-subtle text-ink-secondary font-mono border border-hairline">
                        {p}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-clinical-emerald border border-emerald-200 font-mono">
                    {u.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RBAC Permission Policy Matrix */}
      <div className="p-5 rounded-xl bg-surface border border-hairline space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-clinical-emerald" />
          <h3 className="text-xs font-semibold text-ink">
            Security Isolation &amp; Permission Boundaries
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-lg bg-subtle border border-hairline space-y-2">
            <div className="font-semibold text-accent flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Clinicians &amp; Physicians</span>
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Full access to synthetic EHR, eGFR/Cockcroft-Gault calculators, and regulatory Human-in-the-Loop overrides.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-subtle border border-hairline space-y-2">
            <div className="font-semibold text-clinical-amber flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              <span>Triage Nurses &amp; Clinic Staff</span>
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Assigned to human handoff escalation queue. Triage inbound emergency alerts and coordinate clinic visits.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-subtle border border-hairline space-y-2">
            <div className="font-semibold text-clinical-emerald flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Patients (Public &amp; Verified)</span>
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Strictly restricted to <code className="text-accent font-mono">PATIENT_APPROVED</code> guidelines. Zero SQL queries or autonomous diagnoses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
