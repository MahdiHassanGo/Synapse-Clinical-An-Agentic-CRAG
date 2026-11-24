"use client";

import React, { useState } from "react";
import { AlertOctagon, X } from "lucide-react";

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
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !hitlData) return null;

  const handleAction = async (approved: boolean) => {
    if (approved && !rationale.trim()) {
      setValidationError("Mandatory clinical override rationale is required by regulatory guidelines.");
      return;
    }
    setValidationError(null);
    setIsSubmitting(true);
    try {
      await onConfirmOverride(clinicianId, rationale, approved);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hitl-modal-title"
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      <div className="bg-surface border border-red-300 rounded-xl w-full max-w-xl shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="bg-red-50 border-b border-red-200 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-clinical-rose">
            <AlertOctagon className="w-5 h-5 shrink-0" />
            <div>
              <h3 id="hitl-modal-title" className="text-sm font-semibold text-ink">
                Human-in-the-Loop Safety Gate Intercept
              </h3>
              <p className="text-xs text-clinical-rose font-mono">
                Regulated high-risk intervention paused
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close safety gate dialog"
            className="text-ink-muted hover:text-ink p-1.5 rounded-md hover:bg-red-100/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          <div className="bg-subtle p-3.5 rounded-lg border border-hairline space-y-1">
            <div className="text-ink-muted font-medium">Trigger Reason</div>
            <div className="text-ink leading-relaxed font-mono text-xs">
              {hitlData.reason}
            </div>
          </div>

          {(hitlData.contraindications_detected?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <span className="text-ink-secondary font-semibold block">
                Detected High-Risk Contraindications
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {hitlData.contraindications_detected?.map((alert, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-red-50/70 border border-red-200 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink">
                        {alert.drug_a} {alert.drug_b ? `+ ${alert.drug_b}` : ""}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-clinical-rose text-white">
                        {alert.severity}
                      </span>
                    </div>
                    <div className="text-xs text-ink-secondary">{alert.mechanism}</div>
                    <div className="text-xs text-accent font-mono">
                      Recommendation: {alert.clinical_recommendation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clinician Override Input */}
          <div className="space-y-3 pt-3 border-t border-hairline">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="hitl-clinician-id" className="text-ink-secondary font-medium text-xs block">
                  Physician NPI / ID
                </label>
                <input
                  id="hitl-clinician-id"
                  type="text"
                  value={clinicianId}
                  onChange={(e) => setClinicianId(e.target.value)}
                  className="w-full mt-1 bg-subtle border border-strong rounded-lg px-2.5 py-2 text-xs text-ink font-mono focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label htmlFor="hitl-target-patient" className="text-ink-secondary font-medium text-xs block">
                  Target Patient
                </label>
                <input
                  id="hitl-target-patient"
                  type="text"
                  disabled
                  value={patientId}
                  className="w-full mt-1 bg-muted border border-hairline rounded-lg px-2.5 py-2 text-xs text-ink-muted font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="hitl-rationale" className="text-ink-secondary font-medium text-xs block">
                Clinical Justification / Mitigation Rationale (Mandatory for Override)
              </label>
              <textarea
                id="hitl-rationale"
                rows={2}
                placeholder="e.g., Co-prescribed high-dose PPI, scheduled 48h renal and coagulation telemetry labs..."
                value={rationale}
                onChange={(e) => {
                  setRationale(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                className="w-full mt-1 bg-subtle border border-strong rounded-lg p-2.5 text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent resize-none"
              />
              {validationError && (
                <p role="alert" className="mt-1.5 text-xs text-clinical-rose font-medium">
                  {validationError}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-subtle px-5 py-3.5 border-t border-hairline flex flex-wrap items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleAction(false)}
            disabled={isSubmitting}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-red-300 bg-surface text-clinical-rose hover:bg-red-50 font-semibold transition-colors cursor-pointer"
          >
            Halt Prescription (Recommended)
          </button>

          <button
            type="button"
            onClick={() => handleAction(true)}
            disabled={isSubmitting}
            className="min-h-[38px] px-4 py-1.5 rounded-lg bg-ink hover:bg-ink-secondary text-white font-semibold transition-colors cursor-pointer"
          >
            Authorize Clinical Override
          </button>
        </div>
      </div>
    </div>
  );
}
