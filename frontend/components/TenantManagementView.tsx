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

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

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
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-canvas text-ink">
      {/* Tenants List */}
      <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-hairline bg-surface p-4 space-y-4 flex flex-col shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-accent" />
            <h2 className="text-xs font-semibold text-ink">Healthcare Tenants</h2>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-subtle text-ink-muted font-mono border border-hairline">
            {tenants.length} Active
          </span>
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto">
          {tenants.map((t) => {
            const isSelected = selectedTenant?.tenant_id === t.tenant_id;
            return (
              <button
                key={t.tenant_id}
                type="button"
                onClick={() => setSelectedTenant(t)}
                className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer space-y-1 ${
                  isSelected
                    ? "bg-accent-soft border-accent-border border-l-4 border-l-accent"
                    : "bg-subtle/60 hover:bg-subtle border-hairline"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink truncate">{t.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-ink-muted font-mono border border-hairline shrink-0">
                    {t.default_language.toUpperCase()}
                  </span>
                </div>
                <div className="text-[11px] text-ink-muted font-mono truncate">{t.tenant_id}</div>
                <div className="text-[11px] text-clinical-emerald font-mono">Emergency: {t.emergency_phone}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tenant Editor Form */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
        {selectedTenant ? (
          <form onSubmit={handleSaveTenant} className="max-w-2xl space-y-5 bg-surface border border-hairline rounded-xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">{selectedTenant.name}</h3>
                <div className="text-xs text-ink-muted font-mono">ID: {selectedTenant.tenant_id}</div>
              </div>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{isSaved ? "Saved" : "Save Settings"}</span>
              </button>
            </div>

            {saveError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-clinical-rose text-xs">
                {saveError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-ink-secondary">Hospital Organization Name</label>
                <input
                  type="text"
                  value={selectedTenant.name}
                  onChange={(e) => setSelectedTenant({ ...selectedTenant, name: e.target.value })}
                  className="w-full mt-1 bg-subtle border border-strong rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-accent"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink-secondary">Emergency Phone Number</label>
                <input
                  type="text"
                  value={selectedTenant.emergency_phone}
                  onChange={(e) => setSelectedTenant({ ...selectedTenant, emergency_phone: e.target.value })}
                  className="w-full mt-1 bg-subtle border border-strong rounded-lg px-3 py-2 text-xs text-ink font-mono outline-none focus:border-accent"
                  placeholder="911 or 999"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-secondary">Allowed Domains (CORS / Embed Allowlist)</label>
              <input
                type="text"
                value={selectedTenant.domains.join(", ")}
                onChange={(e) => setSelectedTenant({ ...selectedTenant, domains: e.target.value.split(",").map(d => d.trim()) })}
                className="w-full mt-1 bg-subtle border border-strong rounded-lg px-3 py-2 text-xs text-ink font-mono outline-none focus:border-accent"
                placeholder="*, hospital.org, portal.hospital.org"
              />
              <span className="text-[11px] text-ink-muted font-mono">Use comma-separated origins. Use * for public testing.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-ink-secondary">Default Language</label>
                <select
                  value={selectedTenant.default_language}
                  onChange={(e) => setSelectedTenant({ ...selectedTenant, default_language: e.target.value })}
                  className="w-full mt-1 bg-subtle border border-strong rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-accent"
                >
                  <option value="en">English (en)</option>
                  <option value="bn">বাংলা / Bengali (bn)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-ink-secondary">Brand Primary Color</label>
                <input
                  type="text"
                  value={selectedTenant.primary_color}
                  onChange={(e) => setSelectedTenant({ ...selectedTenant, primary_color: e.target.value })}
                  className="w-full mt-1 bg-subtle border border-strong rounded-lg px-3 py-2 text-xs text-ink font-mono outline-none focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-secondary">Welcome Greeting (English)</label>
              <textarea
                value={selectedTenant.welcome_message_en}
                onChange={(e) => setSelectedTenant({ ...selectedTenant, welcome_message_en: e.target.value })}
                rows={2}
                className="w-full mt-1 bg-subtle border border-strong rounded-lg p-2.5 text-xs text-ink outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink-secondary">Welcome Greeting (বাংলা)</label>
              <textarea
                value={selectedTenant.welcome_message_bn}
                onChange={(e) => setSelectedTenant({ ...selectedTenant, welcome_message_bn: e.target.value })}
                rows={2}
                className="w-full mt-1 bg-subtle border border-strong rounded-lg p-2.5 text-xs text-ink outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink-secondary">Physical Address / Clinic Location</label>
              <input
                type="text"
                value={selectedTenant.organization_address}
                onChange={(e) => setSelectedTenant({ ...selectedTenant, organization_address: e.target.value })}
                className="w-full mt-1 bg-subtle border border-strong rounded-lg px-3 py-2 text-xs text-ink outline-none focus:border-accent"
              />
            </div>
          </form>
        ) : (
          <div className="p-8 text-center text-xs text-ink-muted">Select a tenant to view and configure.</div>
        )}
      </div>
    </div>
  );
}
