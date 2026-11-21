"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Globe,
  PhoneCall,
  ShieldCheck,
  Plus,
  Save,
  Check,
  AlertCircle
} from "lucide-react";

interface Tenant {
  tenant_id: string;
  name: string;
  domains: string[];
  logo_url?: string;
  primary_color: string;
  default_language: string;
  emergency_phone: string;
  emergency_message_en: string;
  emergency_message_bn: string;
  welcome_message_en: string;
  welcome_message_bn: string;
  handoff_enabled: boolean;
  organization_address: string;
}

export function TenantManagementView() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

  const fetchTenants = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/tenants`);
      const data = await res.json();
      setTenants(data.tenants || []);
      if (data.tenants && data.tenants.length > 0 && !selectedTenant) {
        setSelectedTenant(data.tenants[0]);
      }
    } catch (err) {
      console.error("Failed to load tenants:", err);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;
    setIsSaved(false);
    setSaveError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/tenants/${selectedTenant.tenant_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedTenant)
      });
      if (!res.ok) throw new Error("Failed to save tenant configuration");
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
      fetchTenants();
    } catch (err: any) {
      setSaveError(err.message);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-graphite-950 text-white select-none">
      {/* Tenants List */}
      <div className="w-80 border-r border-white/[0.08] p-4 space-y-4 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-clinical-blue" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white">Healthcare Tenants</h2>
          </div>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-graphite-800 text-graphite-400 font-mono">
            {tenants.length} Active
          </span>
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto">
          {tenants.map((t) => {
            const isSelected = selectedTenant?.tenant_id === t.tenant_id;
            return (
              <div
                key={t.tenant_id}
                onClick={() => setSelectedTenant(t)}
                className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1 ${
                  isSelected
                    ? "bg-graphite-850 border-clinical-blue/50 shadow-md"
                    : "bg-graphite-900 hover:bg-graphite-850 border-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{t.name}</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-graphite-800 text-graphite-400 font-mono">
                    {t.default_language.toUpperCase()}
                  </span>
                </div>
                <div className="text-[11px] text-graphite-400 font-mono truncate">{t.tenant_id}</div>
                <div className="text-[10px] text-emerald-400 font-mono">Emergency: {t.emergency_phone}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tenant Editor Form */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {selectedTenant ? (
          <form onSubmit={handleSaveTenant} className="max-w-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedTenant.name}</h3>
                <div className="text-xs text-graphite-400 font-mono">ID: {selectedTenant.tenant_id}</div>
              </div>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-clinical-blue hover:bg-clinical-blue/90 text-xs font-medium text-white shadow-md transition-all"
              >
                {isSaved ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
                <span>{isSaved ? "Saved" : "Save Settings"}</span>
              </button>
            </div>

            {saveError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {saveError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-mono text-graphite-400">Hospital Organization Name</label>
                <input
                  type="text"
                  value={selectedTenant.name}
                  onChange={(e) => setSelectedTenant({ ...selectedTenant, name: e.target.value })}
                  className="w-full mt-1 bg-graphite-900 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-graphite-400">Emergency Phone Number</label>
                <input
                  type="text"
                  value={selectedTenant.emergency_phone}
                  onChange={(e) => setSelectedTenant({ ...selectedTenant, emergency_phone: e.target.value })}
                  className="w-full mt-1 bg-graphite-900 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
                  placeholder="911 or 999"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono text-graphite-400">Allowed Domains (CORS / Embed Allowlist)</label>
              <input
                type="text"
                value={selectedTenant.domains.join(", ")}
                onChange={(e) => setSelectedTenant({ ...selectedTenant, domains: e.target.value.split(",").map(d => d.trim()) })}
                className="w-full mt-1 bg-graphite-900 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
                placeholder="*, hospital.org, portal.hospital.org"
              />
              <span className="text-[10px] text-graphite-500 font-mono">Use comma-separated origins. Use * for public testing.</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-mono text-graphite-400">Default Language</label>
                <select
                  value={selectedTenant.default_language}
                  onChange={(e) => setSelectedTenant({ ...selectedTenant, default_language: e.target.value })}
                  className="w-full mt-1 bg-graphite-900 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="en">English (en)</option>
                  <option value="bn">বাংলা / Bengali (bn)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-graphite-400">Brand Primary Color</label>
                <input
                  type="text"
                  value={selectedTenant.primary_color}
                  onChange={(e) => setSelectedTenant({ ...selectedTenant, primary_color: e.target.value })}
                  className="w-full mt-1 bg-graphite-900 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono text-graphite-400">Welcome Greeting (English)</label>
              <textarea
                value={selectedTenant.welcome_message_en}
                onChange={(e) => setSelectedTenant({ ...selectedTenant, welcome_message_en: e.target.value })}
                rows={2}
                className="w-full mt-1 bg-graphite-900 border border-white/[0.08] rounded-lg p-2.5 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-graphite-400">Welcome Greeting (বাংলা)</label>
              <textarea
                value={selectedTenant.welcome_message_bn}
                onChange={(e) => setSelectedTenant({ ...selectedTenant, welcome_message_bn: e.target.value })}
                rows={2}
                className="w-full mt-1 bg-graphite-900 border border-white/[0.08] rounded-lg p-2.5 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-graphite-400">Physical Address / Clinic Location</label>
              <input
                type="text"
                value={selectedTenant.organization_address}
                onChange={(e) => setSelectedTenant({ ...selectedTenant, organization_address: e.target.value })}
                className="w-full mt-1 bg-graphite-900 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white outline-none"
              />
            </div>
          </form>
        ) : (
          <div className="p-8 text-center text-xs text-graphite-400">Select a tenant to view and configure.</div>
        )}
      </div>
    </div>
  );
}
