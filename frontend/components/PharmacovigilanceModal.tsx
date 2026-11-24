"use client";

import React, { useState } from "react";
import { AlertOctagon, CheckCircle2, ShieldAlert, X } from "lucide-react";

export interface DrugInteractionAlert {
  drug_a: string;
  drug_b?: string;
  condition?: string;
  allergen?: string;
  severity: string;
  mechanism: string;
  clinical_recommendation: string;
  action_required: string;
}

export interface HITLInterrupt {
  is_required: boolean;
  requires_approval_for?: string;
  risk_level: string;
  reason?: string;
  contraindications_detected: DrugInteractionAlert[];
  approved?: boolean | null;
}

interface PharmacovigilanceModalProps {
  hitlData: HITLInterrupt | null;
  patientId: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirmOverride: (clinicianId: string, rationale: string, approved: boolean) => Promise<void>;
}

export function PharmacovigilanceModal({
  hitlData,
  patientId,
  isOpen,
  onClose,
  onConfirmOverride,
}: PharmacovigilanceModalProps) {
  const [clinicianId, setClinicianId] = useState("DR-9921");
  const [rationale, setRationale] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !hitlData) return null;

  const handleAction = async (approved: boolean) => {
    if (approved && !rationale.trim()) {
      alert("Mandatory clinical override rationale is required by regulatory guidelines.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirmOverride(clinicianId, rationale, approved);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-graphite-900 border border-clinical-rose/40 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="bg-clinical-rose/15 border-b border-clinical-rose/25 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-clinical-rose">
            <AlertOctagon className="w-5 h-5 text-clinical-rose" />
            <div>
              <h3 className="text-sm font-semibold text-white">
                Human-in-the-Loop Safety Gate Intercept
              </h3>
              <p className="text-[11px] text-clinical-rose/90 font-mono">
                Regulated High-Risk Intervention Paused
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-graphite-400 hover:text-white p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          <div className="bg-graphite-850 p-3 rounded-lg border border-white/[0.06] space-y-1">
            <div className="text-graphite-400">Trigger Reason</div>
            <div className="text-graphite-200 leading-relaxed font-mono text-[11px]">
              {hitlData.reason}
            </div>
          </div>

          {/* Contraindications List */}
          {(hitlData.contraindications_detected?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <span className="text-graphite-400 font-medium">
                Detected High-Risk Contraindications
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {hitlData.contraindications_detected?.map((alert, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-graphite-850 border border-white/[0.06] space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">
                        {alert.drug_a} {alert.drug_b ? `+ ${alert.drug_b}` : ""}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-clinical-rose/20 text-clinical-rose border border-clinical-rose/30">
                        {alert.severity}
                      </span>
                    </div>
                    <div className="text-[11px] text-graphite-300">
                      {alert.mechanism}
                    </div>
                    <div className="text-[11px] text-clinical-teal font-mono">
                      Action: {alert.clinical_recommendation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clinician Override Input */}
          <div className="space-y-3 pt-2 border-t border-white/[0.06]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-graphite-400 text-[11px]">Physician NPI / ID</label>
                <input
                  type="text"
                  value={clinicianId}
                  onChange={(e) => setClinicianId(e.target.value)}
                  className="w-full mt-1 bg-graphite-800 border border-white/[0.1] rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-clinical-blue"
                />
              </div>
              <div>
                <label className="text-graphite-400 text-[11px]">Target Patient</label>
                <input
                  type="text"
                  disabled
                  value={patientId}
                  className="w-full mt-1 bg-graphite-850 border border-white/[0.06] rounded px-2.5 py-1.5 text-xs text-graphite-400 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-graphite-400 text-[11px]">
                Clinical Justification / Mitigation Rationale (Mandatory for Override)
              </label>
              <textarea
                rows={2}
                placeholder="e.g., Co-prescribed high-dose PPI, scheduled 48h renal and coagulation telemetry labs..."
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                className="w-full mt-1 bg-graphite-800 border border-white/[0.1] rounded p-2 text-xs text-white placeholder-graphite-500 focus:outline-none focus:border-clinical-blue resize-none"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-graphite-850/80 px-5 py-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
          <button
            onClick={() => handleAction(false)}
            disabled={isSubmitting}
            className="px-3 py-1.5 rounded-lg border border-clinical-rose/40 text-clinical-rose hover:bg-clinical-rose/10 font-medium transition-colors"
          >
            Halt Prescription (Recommended)
          </button>

          <button
            onClick={() => handleAction(true)}
            disabled={isSubmitting}
            className="px-4 py-1.5 rounded-lg bg-graphite-700 hover:bg-graphite-600 border border-white/[0.1] text-white font-medium transition-colors"
          >
            Authorize Clinical Override
          </button>
        </div>
      </div>
    </div>
  );
}
