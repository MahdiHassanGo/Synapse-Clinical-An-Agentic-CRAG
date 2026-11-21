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
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "CLINICIAN":
        return "bg-clinical-blue/10 text-clinical-blue border-clinical-blue/20";
      case "TRIAGE_NURSE":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-graphite-950 text-white select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-clinical-blue/10 border border-clinical-blue/20 flex items-center justify-center text-clinical-blue">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">User & Role-Based Access Control (RBAC)</h2>
            <div className="text-xs text-graphite-400">Strict Permission Separation between Clinicians, Nurses, and Patients</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="bg-graphite-800 text-xs text-graphite-200 border border-white/[0.08] rounded-lg px-3 py-1.5 font-mono outline-none"
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
      <div className="rounded-xl border border-white/[0.08] bg-graphite-900 overflow-hidden shadow-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-graphite-850 text-graphite-400 font-mono text-[11px] border-b border-white/[0.06]">
            <tr>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Department / Clinic</th>
              <th className="py-3 px-4">Permissions</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filteredUsers.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="py-3 px-4">
                  <div className="font-medium text-white">{u.name}</div>
                  <div className="text-[11px] text-graphite-400 font-mono">{u.email}</div>
                </td>
                <td className="py-3 px-4">
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-mono font-semibold ${getRoleBadge(u.role)}`}>
                    {u.role}
                  </span>
                </td>
                <td className="py-3 px-4 text-graphite-300">{u.department}</td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {u.permissions.map((p) => (
                      <span key={p} className="text-[9px] px-1.5 py-0.2 rounded bg-graphite-800 text-graphite-300 font-mono border border-white/[0.04]">
                        {p}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    {u.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RBAC Permission Policy Matrix */}
      <div className="p-5 rounded-2xl bg-graphite-900 border border-white/[0.08] space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white font-mono">
            Security Isolation & Permission Boundaries
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-graphite-850 border border-white/[0.06] space-y-2">
            <div className="font-semibold text-clinical-blue flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Clinicians & Physicians</span>
            </div>
            <p className="text-[11px] text-graphite-300 leading-relaxed">
              Full access to patient synthetic EHR, eGFR/Cockcroft-Gault calculators, and regulatory Human-in-the-Loop overrides for chemotherapy & narcotics.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-graphite-850 border border-white/[0.06] space-y-2">
            <div className="font-semibold text-amber-400 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              <span>Triage Nurses & Clinic Staff</span>
            </div>
            <p className="text-[11px] text-graphite-300 leading-relaxed">
              Assigned to human handoff escalation queue. Triage inbound emergency alerts, schedule clinic visits, and reply to patient inquiries.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-graphite-850 border border-white/[0.06] space-y-2">
            <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Patients (Public & Verified)</span>
            </div>
            <p className="text-[11px] text-graphite-300 leading-relaxed">
              Strictly restricted to <code className="text-emerald-300 font-mono">PATIENT_APPROVED</code> guidelines. Zero SQL queries, zero EHR mutations, zero autonomous diagnoses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
