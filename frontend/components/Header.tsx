"use client";

import React, { useState } from "react";
import {
  Activity,
  Database,
  GitBranch,
  Cpu,
  BarChart2,
  Sliders,
  ShieldCheck,
  Stethoscope,
  Terminal,
  MessageSquare,
  Building2,
  Users,
  AlertTriangle,
  ChevronDown,
  LayoutDashboard
} from "lucide-react";

export type NavView =
  | "overview"
  | "patient-agent"
  | "workspace"
  | "knowledge"
  | "runs"
  | "orchestrator"
  | "handoff"
  | "evaluation"
  | "tenants"
  | "users"
  | "audit"
  | "settings";

interface HeaderProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  activePatientId?: string;
  isStreaming: boolean;
}

export function Header({
  currentView,
  onSelectView,
  activePatientId,
  isStreaming,
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  const primaryNavItems: { id: NavView; label: string; icon: React.ReactNode }[] = [
    {
      id: "overview",
      label: "Overview",
      icon: <LayoutDashboard className="w-3.5 h-3.5" />,
    },
    {
      id: "patient-agent",
      label: "Patient AI",
      icon: <MessageSquare className="w-3.5 h-3.5" />,
    },
    {
      id: "workspace",
      label: "Clinician Copilot",
      icon: <Stethoscope className="w-3.5 h-3.5" />,
    },
    {
      id: "knowledge",
      label: "Knowledge Base",
      icon: <Database className="w-3.5 h-3.5" />,
    },
    {
      id: "handoff",
      label: "Handoff Queue",
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
    {
      id: "runs",
      label: "Agent Runs",
      icon: <Terminal className="w-3.5 h-3.5" />,
    },
  ];

  const secondaryNavItems: { id: NavView; label: string; icon: React.ReactNode }[] = [
    {
      id: "orchestrator",
      label: "Model Orchestrator",
      icon: <Cpu className="w-3.5 h-3.5" />,
    },
    {
      id: "evaluation",
      label: "RAG Evaluation",
      icon: <BarChart2 className="w-3.5 h-3.5" />,
    },
    {
      id: "tenants",
      label: "Tenant Management",
      icon: <Building2 className="w-3.5 h-3.5" />,
    },
    {
      id: "users",
      label: "User & Role RBAC",
      icon: <Users className="w-3.5 h-3.5" />,
    },
    {
      id: "audit",
      label: "Regulatory Audit Logs",
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
    },
    {
      id: "settings",
      label: "System Settings",
      icon: <Sliders className="w-3.5 h-3.5" />,
    },
  ];

  const isSecondaryActive = secondaryNavItems.some((item) => item.id === currentView);
  const activeSecondaryItem = secondaryNavItems.find((item) => item.id === currentView);

  return (
    <header className="h-14 border-b border-white/[0.08] bg-graphite-900/95 backdrop-blur px-5 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Brand & Version */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onSelectView("overview")}>
          <div className="w-8 h-8 rounded-lg bg-graphite-800 border border-white/[0.08] flex items-center justify-center text-clinical-blue shadow-inner">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
              <span>Synapse</span>
              <span className="text-clinical-blue font-bold">Clinical</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-clinical-blue/10 text-clinical-blue font-mono border border-clinical-blue/20">
                v4.1
              </span>
            </div>
            <div className="text-[10px] text-graphite-400 font-mono">
              Clinical Intelligence & Decision Support
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <nav className="hidden lg:flex items-center gap-1 bg-graphite-950/80 p-1 rounded-xl border border-white/[0.06] ml-2">
          {primaryNavItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-graphite-850 text-white shadow-sm border border-white/[0.08]"
                    : "text-graphite-400 hover:text-graphite-200 hover:bg-white/[0.02]"
                }`}
              >
                <span className={isActive ? "text-clinical-blue" : "text-graphite-500"}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* More Views Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                isSecondaryActive
                  ? "bg-graphite-850 text-white shadow-sm border border-white/[0.08]"
                  : "text-graphite-400 hover:text-graphite-200 hover:bg-white/[0.02]"
              }`}
            >
              <span className={isSecondaryActive ? "text-clinical-blue" : "text-graphite-500"}>
                {isSecondaryActive ? activeSecondaryItem?.icon : <Sliders className="w-3.5 h-3.5" />}
              </span>
              <span>{isSecondaryActive ? activeSecondaryItem?.label : "More Views"}</span>
              <ChevronDown className="w-3 h-3 ml-0.5 text-graphite-500" />
            </button>

            {dropdownOpen && (
              <div
                className="absolute top-full mt-1.5 right-0 w-52 bg-graphite-900 border border-white/[0.08] rounded-xl p-1.5 shadow-2xl z-50 divide-y divide-white/[0.04]"
                onMouseLeave={() => setDropdownOpen(false)}
              >
                <div className="py-1">
                  {secondaryNavItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectView(item.id);
                        setDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                        currentView === item.id
                          ? "bg-graphite-800 text-white"
                          : "text-graphite-300 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className={currentView === item.id ? "text-clinical-blue" : "text-graphite-400"}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Telemetry Status Pills & Permanent Disclaimer */}
      <div className="flex items-center gap-3 text-xs">
        {/* Open Triage Chat Widget Button */}
        <button
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("open-synapse-chat"));
            }
          }}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-clinical-blue/15 hover:bg-clinical-blue/25 text-clinical-blue hover:text-white border border-clinical-blue/30 text-[11px] font-medium transition-all"
          title="Open Hospital Triage & Specialist Chatbot"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Triage Navigator</span>
        </button>

        {/* Synthetic Research Demo Disclaimer Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-clinical-amber/10 border border-clinical-amber/20 text-clinical-amber text-[10px] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-clinical-amber" />
          <span>Synthetic Research Demo</span>
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-graphite-850 border border-white/[0.08] text-graphite-300 text-[11px] font-mono">
          <GitBranch className="w-3.5 h-3.5 text-clinical-blue" />
          <span>Dual AI LangGraph</span>
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-graphite-850 border border-white/[0.08] text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${
              isStreaming ? "bg-clinical-teal animate-ping" : "bg-emerald-500"
            }`}
          />
          <span className="text-graphite-300 font-mono text-[10px]">
            {isStreaming ? "Stream Active" : "Ready"}
          </span>
        </div>
      </div>
    </header>
  );
}
