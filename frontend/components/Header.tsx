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
    { id: "overview", label: "Overview", icon: <LayoutDashboard className="w-4 h-4 stroke-[1.75]" /> },
    { id: "patient-agent", label: "Patient AI", icon: <MessageSquare className="w-4 h-4 stroke-[1.75]" /> },
    { id: "workspace", label: "Clinician Copilot", icon: <Stethoscope className="w-4 h-4 stroke-[1.75]" /> },
    { id: "knowledge", label: "Knowledge Base", icon: <Database className="w-4 h-4 stroke-[1.75]" /> },
    { id: "handoff", label: "Handoff Queue", icon: <AlertTriangle className="w-4 h-4 stroke-[1.75]" /> },
    { id: "runs", label: "Agent Runs", icon: <Terminal className="w-4 h-4 stroke-[1.75]" /> },
  ];

  const secondaryNavItems: { id: NavView; label: string; icon: React.ReactNode }[] = [
    { id: "orchestrator", label: "Model Orchestrator", icon: <Cpu className="w-4 h-4 stroke-[1.75]" /> },
    { id: "evaluation", label: "RAG Evaluation", icon: <BarChart2 className="w-4 h-4 stroke-[1.75]" /> },
    { id: "tenants", label: "Tenant Management", icon: <Building2 className="w-4 h-4 stroke-[1.75]" /> },
    { id: "users", label: "User & Role RBAC", icon: <Users className="w-4 h-4 stroke-[1.75]" /> },
    { id: "audit", label: "Regulatory Audit Logs", icon: <ShieldCheck className="w-4 h-4 stroke-[1.75]" /> },
    { id: "settings", label: "System Settings", icon: <Sliders className="w-4 h-4 stroke-[1.75]" /> },
  ];

  const isSecondaryActive = secondaryNavItems.some((item) => item.id === currentView);
  const activeSecondaryItem = secondaryNavItems.find((item) => item.id === currentView);

  const handleNavClick = (view: NavView) => {
    onSelectView(view);
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  };

  return (
    <header className="border-b border-hairline bg-surface sticky top-0 z-30">
      <div className="h-14 px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Brand & Primary Navigation */}
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => handleNavClick("overview")}
            className="flex items-center gap-2.5 text-left rounded-lg cursor-pointer group shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center transition-colors group-hover:bg-accent-hover">
              <Activity className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <div className="font-semibold text-sm tracking-tight text-ink flex items-center gap-1.5">
                <span>Synapse Clinical</span>
                <span className="text-[11px] font-mono text-ink-muted">v4.1</span>
              </div>
              <div className="hidden sm:block text-[11px] text-ink-muted">
                Clinical Intelligence &amp; Decision Support
              </div>
            </div>
          </button>

          {/* Quiet Navigation Tabs */}
          <nav
            aria-label="Primary navigation"
            className="hidden lg:flex items-center gap-1 bg-subtle p-1 rounded-lg border border-hairline ml-2"
          >
            {primaryNavItems.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-surface text-ink shadow-sm border border-hairline"
                      : "text-ink-secondary hover:text-ink hover:bg-surface/60 border border-transparent"
                  }`}
                >
                  <span className={isActive ? "text-accent" : "text-ink-muted"}>
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
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isSecondaryActive
                    ? "bg-surface text-ink shadow-sm border border-hairline"
                    : "text-ink-secondary hover:text-ink hover:bg-surface/60 border border-transparent"
                }`}
              >
                <span className={isSecondaryActive ? "text-accent" : "text-ink-muted"}>
                  {isSecondaryActive ? activeSecondaryItem?.icon : <Sliders className="w-4 h-4 stroke-[1.75]" />}
                </span>
                <span>{isSecondaryActive ? activeSecondaryItem?.label : "More"}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-ink-muted transition-transform ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {dropdownOpen && (
                <div
                  role="menu"
                  className="absolute top-full mt-1.5 right-0 w-56 bg-surface border border-hairline rounded-xl p-1.5 shadow-lg z-50"
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
                              ? "bg-accent-soft text-accent border border-accent-border"
                              : "text-ink-secondary hover:text-ink hover:bg-subtle"
                          }`}
                        >
                          <span className={isActive ? "text-accent" : "text-ink-muted"}>
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

        {/* Status & Actions */}
        <div className="flex items-center gap-2 text-xs shrink-0">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("open-synapse-chat"));
              }
            }}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-soft hover:bg-accent hover:text-white text-accent border border-accent-border text-xs font-medium transition-colors cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Triage Navigator</span>
          </button>

          <span
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-clinical-amber text-[11px] font-medium"
            title="Portfolio demonstration using synthetic EHR cohorts"
          >
            Synthetic cohort demo
          </span>

          <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-subtle border border-hairline text-ink-secondary text-[11px] font-mono">
            <GitBranch className="w-3.5 h-3.5 text-accent" />
            <span>Dual LangGraph</span>
          </div>

          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-subtle border border-hairline text-[11px]"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isStreaming ? "bg-accent animate-ping" : "bg-clinical-emerald"
              }`}
              aria-hidden="true"
            />
            <span className="text-ink-secondary font-mono">
              {isStreaming ? "Streaming" : "Ready"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-subtle border border-hairline text-ink-secondary hover:text-ink hover:bg-muted transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile navigation"
          className="lg:hidden border-t border-hairline bg-surface px-4 py-3 space-y-3 max-h-[80vh] overflow-y-auto"
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
                      ? "bg-accent-soft text-accent border border-accent-border"
                      : "bg-subtle text-ink-secondary hover:text-ink border border-hairline"
                  }`}
                >
                  <span className={isActive ? "text-accent" : "text-ink-muted"}>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-hairline">
            <div className="text-[11px] font-medium text-ink-muted mb-2 px-1">
              Governance &amp; Operations
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
                        ? "bg-accent-soft text-accent border border-accent-border"
                        : "bg-subtle text-ink-secondary hover:text-ink border border-hairline"
                    }`}
                  >
                    <span className={isActive ? "text-accent" : "text-ink-muted"}>{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-hairline">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("open-synapse-chat"));
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-accent text-white text-xs font-semibold cursor-pointer"
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
