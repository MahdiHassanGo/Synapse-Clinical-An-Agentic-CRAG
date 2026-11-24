"use client";

import React from "react";
import { User, AlertTriangle, Pill, Heart, Activity, FileText, CheckCircle2 } from "lucide-react";

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
    <aside className="w-full lg:w-80 xl:w-[340px] border-b lg:border-b-0 lg:border-r border-white/[0.08] bg-graphite-900/60 flex flex-col max-h-[44vh] lg:max-h-none lg:h-[calc(100vh-3.5rem)] overflow-hidden shrink-0">
      {/* Patient Cohort Selector */}
      <div className="p-4 border-b border-white/[0.08]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-graphite-400">
            Clinical Patient Cohort
          </span>
          <span className="text-[11px] font-mono text-graphite-400">
            {patients.length} records
          </span>
        </div>
        <div className="space-y-1">
          {patients.map((p) => {
            const isSelected = p.patient_id === selectedPatientId;
            return (
              <button
                key={p.patient_id}
                onClick={() => onSelectPatient(p.patient_id)}
                className={`w-full text-left p-2.5 rounded-lg border transition-colors flex items-center justify-between ${
                  isSelected
                    ? "bg-graphite-800 border-white/[0.15] text-white"
                    : "bg-graphite-850/50 border-white/[0.04] text-graphite-300 hover:bg-graphite-800/50"
                }`}
              >
                <div>
                  <div className="text-xs font-medium">
                    {p.first_name} {p.last_name}
                  </div>
                  <div className="text-[11px] text-graphite-400">
                    {p.age}y, {p.gender} · {p.mrn}
                  </div>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-graphite-750 text-graphite-300 border border-white/[0.05]">
                  {p.patient_id}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Patient Live Telemetry */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading || !patientDetail ? (
          <div className="text-xs text-graphite-400 py-6 text-center">
            Loading patient telemetry...
          </div>
        ) : (
          <>
            {/* Primary Diagnosis & Vitals */}
            <div className="bg-graphite-850 border border-white/[0.08] rounded-xl p-3.5 space-y-3">
              <div className="text-xs font-medium text-graphite-200">
                Primary Diagnosis
              </div>
              <div className="text-xs text-graphite-300 leading-relaxed bg-graphite-900/80 p-2 rounded-md border border-white/[0.04]">
                {patientDetail.patient.primary_diagnosis}
              </div>

              {/* Vitals Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-graphite-900/60 p-2 rounded-md border border-white/[0.04]">
                  <div className="text-[10px] text-graphite-400">Blood Pressure</div>
                  <div className="font-mono tabular-nums font-medium text-white">
                    {patientDetail.latest_vitals.systolic_bp}/
                    {patientDetail.latest_vitals.diastolic_bp}{" "}
                    <span className="text-[10px] text-graphite-400">mmHg</span>
                  </div>
                </div>

                <div className="bg-graphite-900/60 p-2 rounded-md border border-white/[0.04]">
                  <div className="text-[10px] text-graphite-400">Heart Rate</div>
                  <div className="font-mono tabular-nums font-medium text-white">
                    {patientDetail.latest_vitals.heart_rate}{" "}
                    <span className="text-[10px] text-graphite-400">bpm</span>
                  </div>
                </div>

                <div className="bg-graphite-900/60 p-2 rounded-md border border-white/[0.04]">
                  <div className="text-[10px] text-graphite-400">SpO2</div>
                  <div className="font-mono tabular-nums font-medium text-white">
                    {patientDetail.latest_vitals.o2_saturation}%
                  </div>
                </div>

                <div className="bg-graphite-900/60 p-2 rounded-md border border-white/[0.04]">
                  <div className="text-[10px] text-graphite-400">Body Mass / BSA</div>
                  <div className="font-mono tabular-nums font-medium text-white">
                    {patientDetail.patient.weight_kg}{" "}
                    <span className="text-[10px] text-graphite-400">kg</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Renal Function & Clinical Calculators */}
            <div className="bg-graphite-850 border border-white/[0.08] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-graphite-200">
                  Renal Clearance (CKD-EPI)
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-clinical-blue/10 text-clinical-blue border border-clinical-blue/20">
                  Calculated
                </span>
              </div>
              <div className="bg-graphite-900/80 p-2.5 rounded-lg border border-white/[0.04] space-y-1.5">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-graphite-400">eGFR 2021 Race-Free</span>
                  <span className="font-mono tabular-nums font-semibold text-white">
                    {patientDetail.renal_status.egfr_value} mL/min
                  </span>
                </div>
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-graphite-400">CrCl (Cockcroft-Gault)</span>
                  <span className="font-mono tabular-nums text-graphite-300">
                    {patientDetail.renal_status.crcl_value} mL/min
                  </span>
                </div>
                <div className="text-[11px] text-clinical-amber font-mono pt-1">
                  {patientDetail.renal_status.kdigo_stage}
                </div>
              </div>
            </div>

            {/* Active Medications */}
            <div className="bg-graphite-850 border border-white/[0.08] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-graphite-200">
                <Pill className="w-3.5 h-3.5 text-clinical-blue" />
                <span>Active Prescriptions ({patientDetail.active_medications?.length ?? 0})</span>
              </div>
              <div className="space-y-1.5">
                {patientDetail.active_medications?.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-graphite-900/70 border border-white/[0.04] text-xs flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium text-graphite-200">
                        {m.drug_name}
                      </div>
                      <div className="text-[11px] text-graphite-400">
                        {m.dosage} · {m.frequency}
                      </div>
                    </div>
                    <span className="text-[10px] text-graphite-400 font-mono">
                      {m.indication.slice(0, 15)}...
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Allergies */}
            {(patientDetail.allergies?.length ?? 0) > 0 && (
              <div className="bg-graphite-850 border border-white/[0.08] rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-clinical-rose">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Documented Allergies</span>
                </div>
                <div className="space-y-1.5">
                  {patientDetail.allergies?.map((a, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-clinical-rose/10 border border-clinical-rose/20 text-xs"
                    >
                      <div className="font-medium text-clinical-rose flex justify-between">
                        <span>{a.allergen}</span>
                        <span className="text-[10px] uppercase font-mono">
                          {a.severity}
                        </span>
                      </div>
                      <div className="text-[11px] text-graphite-300 mt-0.5">
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
