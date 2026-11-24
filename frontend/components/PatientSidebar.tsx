"use client";

import React from "react";
import { AlertTriangle, Pill } from "lucide-react";

export interface Patient {
  patient_id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  age: number;
  gender: string;
  primary_diagnosis: string;
}

export interface PatientDetail {
  patient: Patient & { weight_kg: number; height_cm: number };
  latest_vitals: {
    systolic_bp: number;
    diastolic_bp: number;
    heart_rate: number;
    o2_saturation: number;
    temperature_c: number;
  };
  labs: Array<{
    test_name: string;
    value: number;
    unit: string;
    flag: string;
  }>;
  active_medications: Array<{
    drug_name: string;
    dosage: string;
    frequency: string;
    indication: string;
  }>;
  allergies: Array<{
    allergen: string;
    reaction: string;
    severity: string;
  }>;
  renal_status: {
    serum_creatinine_mg_dl: number;
    egfr_value: number;
    crcl_value: number;
    kdigo_stage: string;
  };
}

interface PatientSidebarProps {
  patients: Patient[];
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
  patientDetail: PatientDetail | null;
  loading: boolean;
}

export function PatientSidebar({
  patients,
  selectedPatientId,
  onSelectPatient,
  patientDetail,
  loading,
}: PatientSidebarProps) {
  return (
    <aside className="w-full lg:w-80 xl:w-[340px] border-b lg:border-b-0 lg:border-r border-hairline bg-surface flex flex-col max-h-[44vh] lg:max-h-none lg:h-[calc(100vh-3.5rem)] overflow-hidden shrink-0">
      {/* Patient Cohort Selector */}
      <div className="p-4 border-b border-hairline">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-semibold text-ink">
            Clinical Patient Cohort
          </span>
          <span className="text-[11px] font-mono text-ink-muted">
            {patients.length} records
          </span>
        </div>
        <div className="space-y-1">
          {patients.map((p) => {
            const isSelected = p.patient_id === selectedPatientId;
            return (
              <button
                key={p.patient_id}
                type="button"
                onClick={() => onSelectPatient(p.patient_id)}
                className={`w-full text-left p-2.5 rounded-lg border transition-colors flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? "bg-accent-soft border-accent-border border-l-4 border-l-accent text-ink"
                    : "bg-subtle/50 border-hairline text-ink-secondary hover:bg-subtle hover:text-ink"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{p.first_name} {p.last_name}</div>
                  <div className="text-[11px] text-ink-muted">
                    {p.age}y, {p.gender} · {p.mrn}
                  </div>
                </div>
                <span
                  className={`text-[11px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                    isSelected
                      ? "bg-surface text-accent border-accent-border font-medium"
                      : "bg-surface text-ink-muted border-hairline"
                  }`}
                >
                  {p.patient_id}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Patient Chart Summary */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-canvas/50">
        {loading || !patientDetail ? (
          <div className="text-xs text-ink-muted py-6 text-center">
            Loading patient chart...
          </div>
        ) : (
          <>
            {/* Primary Diagnosis & Vitals */}
            <div className="bg-surface border border-hairline rounded-xl p-3.5 space-y-3">
              <div className="text-xs font-semibold text-ink">
                Primary Diagnosis
              </div>
              <div className="text-xs text-ink-secondary leading-relaxed bg-subtle p-2.5 rounded-lg border border-hairline">
                {patientDetail.patient.primary_diagnosis}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-subtle p-2.5 rounded-lg border border-hairline">
                  <div className="text-[11px] text-ink-muted">Blood Pressure</div>
                  <div className="font-mono tabular-nums font-semibold text-ink mt-0.5">
                    {patientDetail.latest_vitals.systolic_bp}/
                    {patientDetail.latest_vitals.diastolic_bp}{" "}
                    <span className="text-[10px] font-normal text-ink-muted">mmHg</span>
                  </div>
                </div>

                <div className="bg-subtle p-2.5 rounded-lg border border-hairline">
                  <div className="text-[11px] text-ink-muted">Heart Rate</div>
                  <div className="font-mono tabular-nums font-semibold text-ink mt-0.5">
                    {patientDetail.latest_vitals.heart_rate}{" "}
                    <span className="text-[10px] font-normal text-ink-muted">bpm</span>
                  </div>
                </div>

                <div className="bg-subtle p-2.5 rounded-lg border border-hairline">
                  <div className="text-[11px] text-ink-muted">SpO2</div>
                  <div className="font-mono tabular-nums font-semibold text-ink mt-0.5">
                    {patientDetail.latest_vitals.o2_saturation}%
                  </div>
                </div>

                <div className="bg-subtle p-2.5 rounded-lg border border-hairline">
                  <div className="text-[11px] text-ink-muted">Body Mass</div>
                  <div className="font-mono tabular-nums font-semibold text-ink mt-0.5">
                    {patientDetail.patient.weight_kg}{" "}
                    <span className="text-[10px] font-normal text-ink-muted">kg</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Renal Function */}
            <div className="bg-surface border border-hairline rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink">
                  Renal Clearance (CKD-EPI)
                </span>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-accent-soft text-accent border border-accent-border">
                  Calculated
                </span>
              </div>
              <div className="bg-subtle p-2.5 rounded-lg border border-hairline space-y-1.5">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-ink-muted">eGFR 2021 Race-Free</span>
                  <span className="font-mono tabular-nums font-semibold text-ink">
                    {patientDetail.renal_status.egfr_value} mL/min
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-ink-muted">CrCl (Cockcroft-Gault)</span>
                  <span className="font-mono tabular-nums text-ink-secondary">
                    {patientDetail.renal_status.crcl_value} mL/min
                  </span>
                </div>
                <div className="text-[11px] text-clinical-amber font-mono pt-1 border-t border-hairline">
                  {patientDetail.renal_status.kdigo_stage}
                </div>
              </div>
            </div>

            {/* Active Medications */}
            <div className="bg-surface border border-hairline rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <Pill className="w-3.5 h-3.5 text-accent" />
                <span>Active Prescriptions ({patientDetail.active_medications?.length ?? 0})</span>
              </div>
              <div className="space-y-1.5">
                {patientDetail.active_medications?.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-subtle border border-hairline text-xs flex justify-between items-center gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-ink truncate">{m.drug_name}</div>
                      <div className="text-[11px] text-ink-muted">
                        {m.dosage} · {m.frequency}
                      </div>
                    </div>
                    <span className="text-[11px] text-ink-muted font-mono shrink-0 truncate max-w-[110px]">
                      {m.indication}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Allergies */}
            {(patientDetail.allergies?.length ?? 0) > 0 && (
              <div className="bg-surface border border-red-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-clinical-rose">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Documented Allergies</span>
                </div>
                <div className="space-y-1.5">
                  {patientDetail.allergies?.map((a, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs"
                    >
                      <div className="font-semibold text-clinical-rose flex justify-between">
                        <span>{a.allergen}</span>
                        <span className="text-[11px] font-mono">{a.severity}</span>
                      </div>
                      <div className="text-[11px] text-ink-secondary mt-0.5">
                        {a.reaction}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
