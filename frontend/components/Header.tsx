"use client";

import React, { useState, useEffect, useRef } from "react";
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
  LayoutDashboard,
  Menu,
  X,
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
  isStreaming,
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  const handleNavClick = (view: NavView) => {
    onSelectView(view);
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  };

  return (
    <header className="border-b border-white/[0.08] bg-graphite-900/95 backdrop-blur sticky top-0 z-30">
      <div className="h-14 px-4 sm:px-5 flex items-center justify-between gap-3">
        {/* Brand & Version */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => handleNavClick("overview")}
            className="flex items-center gap-2.5 text-left rounded-lg focus-visible:outline-none cursor-pointer group shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-graphite-800 border border-white/[0.1] group-hover:border-clinical-blue/40 flex items-center justify-center text-clinical-blue transition-colors">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
                <span>Synapse</span>
                <span className="text-clinical-blue font-bold">Clinical</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-clinical-blue/10 text-clinical-blue font-mono border border-clinical-blue/25 leading-none">
                  v4.1
                </span>
              </div>
              <div className="hidden sm:block text-[10.5px] text-graphite-400 font-mono truncate">
                Clinical Intelligence & Decision Support
              </div>
            </div>
          </button>

          {/* Desktop View Switcher Tabs */}
          <nav
            aria-label="Primary navigation"
            className="hidden lg:flex items-center gap-1 bg-graphite-950/90 p-1 rounded-xl border border-white/[0.07] ml-2"
          >
            {primaryNavItems.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-graphite-800 text-white shadow-sm border border-white/[0.1]"
                      : "text-graphite-400 hover:text-graphite-100 hover:bg-white/[0.04] border border-transparent"
                  }`}
                >
                  <span className={isActive ? "text-clinical-blue" : "text-graphite-400"}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* More Views Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                aria-expanded={dropdownOpen}
                aria-haspopup="menu"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isSecondaryActive
                    ? "bg-graphite-800 text-white shadow-sm border border-white/[0.1]"
                    : "text-graphite-400 hover:text-graphite-100 hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                <span className={isSecondaryActive ? "text-clinical-blue" : "text-graphite-400"}>
                  {isSecondaryActive ? activeSecondaryItem?.icon : <Sliders className="w-3.5 h-3.5" />}
                </span>
                <span>{isSecondaryActive ? activeSecondaryItem?.label : "More"}</span>
                <ChevronDown
                  className={`w-3 h-3 ml-0.5 text-graphite-400 transition-transform ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {dropdownOpen && (
                <div
                  role="menu"
                  className="absolute top-full mt-1.5 right-0 w-56 bg-graphite-900 border border-white/[0.1] rounded-xl p-1.5 shadow-2xl z-50"
                >
                  <div className="space-y-0.5">
                    {secondaryNavItems.map((item) => {
                      const isActive = currentView === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitem"
                          onClick={() => handleNavClick(item.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                            isActive
                              ? "bg-graphite-800 text-white border border-white/[0.08]"
                              : "text-graphite-300 hover:text-white hover:bg-white/[0.05]"
                          }`}
                        >
                          <span className={isActive ? "text-clinical-blue" : "text-graphite-400"}>
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Telemetry Status Pills & Mobile Menu Trigger */}
        <div className="flex items-center gap-2 text-xs shrink-0">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("open-synapse-chat"));
              }
            }}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-clinical-blue/15 hover:bg-clinical-blue/25 text-clinical-blue hover:text-white border border-clinical-blue/30 text-[11.5px] font-medium transition-colors cursor-pointer"
            title="Open Hospital Triage & Specialist Chatbot"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Triage Navigator</span>
          </button>

          <div
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-clinical-amber/10 border border-clinical-amber/25 text-clinical-amber text-[11px] font-mono"
            title="Portfolio demonstration using synthetic EHR cohorts"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-clinical-amber" aria-hidden="true" />
            <span>Synthetic Demo</span>
          </div>

          <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-graphite-850 border border-white/[0.08] text-graphite-300 text-[11px] font-mono">
            <GitBranch className="w-3.5 h-3.5 text-clinical-blue" />
            <span>Dual AI LangGraph</span>
          </div>

          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-graphite-850 border border-white/[0.08] text-[11px]"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isStreaming ? "bg-clinical-teal animate-ping" : "bg-emerald-500"
              }`}
              aria-hidden="true"
            />
            <span className="text-graphite-200 font-mono text-[11px]">
              {isStreaming ? "Streaming" : "Ready"}
            </span>
          </div>

          {/* Mobile / Tablet Navigation Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-graphite-850 border border-white/[0.08] text-graphite-200 hover:text-white hover:bg-graphite-800 transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile navigation"
          className="lg:hidden border-t border-white/[0.08] bg-graphite-900 px-4 py-3 space-y-3 max-h-[80vh] overflow-y-auto"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {primaryNavItems.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "bg-clinical-blue/15 text-white border border-clinical-blue/40"
                      : "bg-graphite-850 text-graphite-300 hover:text-white border border-white/[0.06]"
                  }`}
                >
                  <span className={isActive ? "text-clinical-blue" : "text-graphite-400"}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-white/[0.06]">
            <div className="text-[10.5px] font-mono uppercase tracking-wider text-graphite-400 mb-2 px-1">
              Governance & Operations
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {secondaryNavItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? "bg-clinical-blue/15 text-white border border-clinical-blue/40"
                        : "bg-graphite-850 text-graphite-300 hover:text-white border border-white/[0.06]"
                    }`}
                  >
                    <span className={isActive ? "text-clinical-blue" : "text-graphite-400"}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("open-synapse-chat"));
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-clinical-blue text-white text-xs font-semibold cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Open Triage Navigator</span>
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
