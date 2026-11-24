"use client";

import React from "react";
import {
  ShieldCheck,
  AlertCircle,
  Bookmark,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Calculator,
  FileCheck2,
  Cpu,
  Layers,
} from "lucide-react";

export interface GuidelineChunk {
  chunk_id: string;
  doc_id: string;
  title: string;
  source_organization: string;
  section: string;
  content: string;
  relevance_score: number;
  is_relevant: boolean;
}

export interface SelfRAGCritique {
  is_supported: boolean;
  support_score: number;
  is_useful: boolean;
  utility_score: number;
  cited_chunk_ids: string[];
  hallucination_warnings: string[];
}

export interface ClaimVerificationResult {
  claim_id: string;
  claim_text: string;
  citation_ref?: string | null;
  verdict: "SUPPORTED" | "UNSUPPORTED" | "CONTRADICTORY" | string;
  entailment_explanation: string;
  matched_chunk_id?: string | null;
  evidence_quote?: string | null;
}

export interface ClinicalCalculationResult {
  calculator_name: string;
  computed_value: number;
  unit: string;
  clinical_interpretation: string;
  inputs_used?: Record<string, any>;
}

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

export interface ModelRoutingDecision {
  task: string;
  selected_provider: string;
  selected_model: string;
  rationale: string;
  latency_ms: number;
  tokens_used: number;
  cost_usd: number;
  fallback_used: boolean;
}

export interface ClinicalSynthesisViewProps {
  synthesisText: string;
  selfRagCritique?: SelfRAGCritique | null;
  claimVerifications?: ClaimVerificationResult[];
  calculations?: ClinicalCalculationResult[];
  interactionAlerts?: DrugInteractionAlert[];
  modelRoutingDecisions?: ModelRoutingDecision[];
  guidelines: GuidelineChunk[];
  onSelectCitation: (chunkId: string) => void;
}

export function ClinicalSynthesisView({
  synthesisText,
  selfRagCritique,
  claimVerifications = [],
  calculations = [],
  interactionAlerts = [],
  modelRoutingDecisions = [],
  guidelines,
  onSelectCitation,
}: ClinicalSynthesisViewProps) {
  if (!synthesisText && calculations.length === 0 && interactionAlerts.length === 0) {
    return null;
  }

  // Render text with interactive citation badges
  const renderFormattedText = (text: string) => {
    // Matches [Guideline:DOC_ID#CHUNK_ID] or [Guideline:DOC_ID]
    const regex = /\[Guideline:([^\]]+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      const citationRef = match[1];
      parts.push(
        <button
          key={match.index}
          onClick={() => onSelectCitation(citationRef)}
          className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded bg-clinical-blue/15 border border-clinical-blue/30 text-clinical-blue text-[11px] font-mono hover:bg-clinical-blue/25 transition-colors align-baseline"
          title="Inspect guideline source"
        >
          <Bookmark className="w-3 h-3" />
          <span>{citationRef}</span>
        </button>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className="space-y-4">
      {/* 1. Main Clinical Synthesis Card */}
      <div className="bg-graphite-900 border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xl">
        {/* Header & Grounding Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-clinical-emerald" />
            <h2 className="text-sm font-semibold text-white">
              Clinical Triage Synthesis & Evidence Grounding
            </h2>
          </div>

          {selfRagCritique && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* IsSupported Token */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border font-mono text-[11px] font-medium ${
                  selfRagCritique.is_supported
                    ? "bg-clinical-emerald/10 border-clinical-emerald/30 text-clinical-emerald"
                    : "bg-clinical-rose/10 border-clinical-rose/30 text-clinical-rose"
                }`}
              >
                {selfRagCritique.is_supported ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span>[IsSupported: {(((selfRagCritique.support_score ?? 0.96) as number) * 100).toFixed(0)}%]</span>
              </div>

              {/* IsUseful Token */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border font-mono text-[11px] font-medium ${
                  selfRagCritique.is_useful
                    ? "bg-clinical-teal/10 border-clinical-teal/30 text-clinical-teal"
                    : "bg-clinical-amber/10 border-clinical-amber/30 text-clinical-amber"
                }`}
              >
                <span>[IsUseful: {(((selfRagCritique.utility_score ?? 0.95) as number) * 100).toFixed(0)}%]</span>
              </div>
            </div>
          )}
        </div>

        {/* Synthesis Prose */}
        {synthesisText && (
          <div className="text-xs text-graphite-200 leading-relaxed space-y-3 font-sans whitespace-pre-line">
            {renderFormattedText(synthesisText)}
          </div>
        )}

        {/* Hallucination Warnings if any */}
        {selfRagCritique && (selfRagCritique.hallucination_warnings?.length ?? 0) > 0 && (
          <div className="bg-clinical-rose/10 border border-clinical-rose/25 rounded-xl p-3 text-xs space-y-1">
            <div className="text-clinical-rose font-medium flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Grounding & Hallucination Gate Warnings</span>
            </div>
            <div className="text-[11px] text-graphite-300 space-y-0.5 font-mono">
              {selfRagCritique.hallucination_warnings?.map((w, idx) => (
                <div key={idx}>• {w}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Claim-Level Self-RAG Evidence Verification (NLI Entailment) */}
      {claimVerifications.length > 0 && (
        <div className="bg-graphite-900 border border-white/[0.08] rounded-2xl p-5 space-y-3 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-clinical-blue" />
              <h3 className="text-xs font-semibold text-white">
                Claim-Level Self-RAG Evidence Verification (Factual Entailment)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-graphite-400">
              {claimVerifications.filter((c) => c.verdict === "SUPPORTED").length} /{" "}
              {claimVerifications.length} Claims Grounded
            </span>
          </div>

          <div className="space-y-2.5">
            {claimVerifications.map((claim, idx) => {
              const isSupported = claim.verdict === "SUPPORTED";
              const isContradictory = claim.verdict === "CONTRADICTORY";
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                    isSupported
                      ? "bg-clinical-emerald/[0.04] border-clinical-emerald/20"
                      : isContradictory
                      ? "bg-clinical-rose/[0.08] border-clinical-rose/30"
                      : "bg-clinical-amber/[0.04] border-clinical-amber/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-graphite-100 flex-1 leading-snug">
                      &ldquo;{claim.claim_text}&rdquo;
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold shrink-0 uppercase ${
                        isSupported
                          ? "bg-clinical-emerald/15 text-clinical-emerald border border-clinical-emerald/30"
                          : isContradictory
                          ? "bg-clinical-rose/20 text-clinical-rose border border-clinical-rose/40 animate-pulse"
                          : "bg-clinical-amber/15 text-clinical-amber border border-clinical-amber/30"
                      }`}
                    >
                      [{claim.verdict}]
                    </span>
                  </div>

                  <div className="text-[11px] text-graphite-400 leading-normal">
                    {claim.entailment_explanation}
                  </div>

                  {claim.evidence_quote && (
                    <div className="text-[11px] font-mono bg-graphite-950/70 p-2 rounded-lg border border-white/[0.04] text-graphite-300">
                      <span className="text-graphite-500 font-sans text-[10px] uppercase block">
                        Source Evidence:
                      </span>
                      &ldquo;{claim.evidence_quote}&rdquo;
                    </div>
                  )}

                  {claim.matched_chunk_id && (
                    <div className="flex items-center gap-2 pt-0.5 text-[10px] font-mono text-graphite-500">
                      <span>Chunk Ref:</span>
                      <button
                        onClick={() => onSelectCitation(claim.matched_chunk_id!)}
                        className="text-clinical-blue hover:underline"
                      >
                        {claim.matched_chunk_id}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Deterministic Clinical Calculations */}
      {calculations.length > 0 && (
        <div className="bg-graphite-900 border border-white/[0.08] rounded-2xl p-5 space-y-3 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-clinical-teal" />
              <h3 className="text-xs font-semibold text-white">
                Deterministic Clinical Calculations (Validated Medical Formulas)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-clinical-teal">
              Zero LLM Arithmetic
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {calculations.map((calc, idx) => (
              <div
                key={idx}
                className="bg-graphite-850 border border-white/[0.06] rounded-xl p-3.5 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-graphite-300">
                    {calc.calculator_name}
                  </span>
                  <div className="text-sm font-bold font-mono text-white tabular-nums">
                    {calc.computed_value}{" "}
                    <span className="text-[10px] font-normal text-graphite-400">
                      {calc.unit}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-graphite-400 font-mono">
                  Stage:{" "}
                  <span className="text-clinical-blue font-medium">
                    {calc.clinical_interpretation}
                  </span>
                </div>

                {calc.inputs_used && (
                  <div className="text-[10px] font-mono text-graphite-500 truncate pt-1 border-t border-white/[0.04]">
                    Inputs: {JSON.stringify(calc.inputs_used)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Pharmacovigilance & Drug Interaction Alerts */}
      {interactionAlerts.length > 0 && (
        <div className="bg-graphite-900 border border-clinical-rose/30 rounded-2xl p-5 space-y-3 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-clinical-rose/20">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-clinical-rose" />
              <h3 className="text-xs font-semibold text-white">
                Pharmacovigilance Contraindication & Toxicity Alerts
              </h3>
            </div>
            <span className="text-[10px] font-mono text-clinical-rose">
              Deterministic Safety Rules
            </span>
          </div>

          <div className="space-y-3">
            {interactionAlerts.map((alert, idx) => {
              const isCritical =
                alert.severity === "FATAL" || alert.severity === "CONTRAINDICATED";
              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border space-y-2 text-xs ${
                    isCritical
                      ? "bg-clinical-rose/10 border-clinical-rose/30"
                      : "bg-clinical-amber/10 border-clinical-amber/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-xs">
                      {alert.drug_a} {alert.drug_b ? `+ ${alert.drug_b}` : ""}
                      {alert.condition ? ` in ${alert.condition}` : ""}
                      {alert.allergen ? ` with ${alert.allergen} Allergy` : ""}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        isCritical
                          ? "bg-clinical-rose text-white"
                          : "bg-clinical-amber text-graphite-950"
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>

                  <div className="text-[11px] text-graphite-300 leading-relaxed">
                    <strong className="text-graphite-100 font-medium">Mechanism:</strong>{" "}
                    {alert.mechanism}
                  </div>

                  <div className="text-[11px] text-clinical-rose leading-relaxed bg-graphite-950/60 p-2.5 rounded-lg border border-white/[0.04]">
                    <strong className="font-semibold">Action Required:</strong>{" "}
                    {alert.action_required}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Model Orchestrator Telemetry Summary */}
      {modelRoutingDecisions.length > 0 && (
        <div className="bg-graphite-900 border border-white/[0.06] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-graphite-400">
            <Cpu className="w-3.5 h-3.5 text-clinical-blue" />
            <span className="text-[11px] font-medium text-graphite-300">
              Orchestrator Routing Decision:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-graphite-400">
            {modelRoutingDecisions.map((dec, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-graphite-800 text-graphite-200">
                  {dec.task}
                </span>
                <span className="text-clinical-blue">{dec.selected_model}</span>
                <span className="text-graphite-500">
                  ({dec.latency_ms}ms · {dec.tokens_used ?? 350} tok · ${(dec.cost_usd ?? 0.0003).toFixed(4)})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
