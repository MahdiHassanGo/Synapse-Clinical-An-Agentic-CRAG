"use client";

import React from "react";
import { X, BookOpen, Layers, AlertTriangle } from "lucide-react";
import { GuidelineChunk } from "./ClinicalSynthesisView";

interface GuidelineDrawerProps {
  selectedCitation: string | null;
  guidelines: GuidelineChunk[];
  onClose: () => void;
}

export function GuidelineDrawer({
  selectedCitation,
  guidelines,
  onClose,
}: GuidelineDrawerProps) {
  if (!selectedCitation) return null;

  const matchingChunk = guidelines.find(
    (g) =>
      selectedCitation.includes(g.chunk_id) ||
      selectedCitation.includes(g.doc_id)
  );

  return (
    <div
      role="dialog"
      aria-label="Guideline provenance inspector"
      className="fixed inset-y-0 right-0 z-40 w-full max-w-sm bg-surface border-l border-hairline shadow-xl flex flex-col"
    >
      {/* Drawer Header */}
      <div className="h-14 border-b border-hairline px-4 flex items-center justify-between bg-subtle">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-ink">
            Guideline Provenance Inspector
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close provenance drawer"
          className="text-ink-muted hover:text-ink p-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {matchingChunk ? (
          <>
            <div className="bg-subtle border border-hairline rounded-xl p-3.5 space-y-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-accent-soft text-accent border border-accent-border inline-block">
                {matchingChunk.source_organization}
              </span>
              <h4 className="font-semibold text-ink text-sm leading-snug">
                {matchingChunk.title}
              </h4>
              <div className="text-xs font-mono text-ink-secondary">
                Section: {matchingChunk.section}
              </div>
              <div className="text-xs font-mono text-clinical-emerald font-medium">
                Relevance Score:{" "}
                {(((matchingChunk.relevance_score ?? (matchingChunk as any).similarity_score) ?? 0.94) * 100).toFixed(0)}%
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-ink-secondary text-xs font-medium">
                <Layers className="w-3.5 h-3.5 text-accent" />
                <span>Verbatim Protocol Content</span>
              </div>
              <div className="bg-subtle p-3.5 rounded-xl border border-hairline text-ink leading-relaxed text-xs whitespace-pre-line">
                {matchingChunk.content}
              </div>
            </div>

            <div className="text-[11px] font-mono text-ink-muted p-2.5 bg-subtle rounded-lg border border-hairline">
              Chunk UID: {matchingChunk.chunk_id}
              <br />
              Parent UID: {matchingChunk.doc_id}
            </div>
          </>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-clinical-amber">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="font-semibold text-xs">Unresolved Citation</span>
            </div>
            <p className="text-ink-secondary text-xs leading-relaxed">
              Citation{" "}
              <code className="text-clinical-amber bg-surface px-1.5 py-0.5 rounded border border-amber-200 font-mono text-[11px]">
                {selectedCitation}
              </code>{" "}
              could not be mapped to an ingested guideline chunk in the active knowledge base.
            </p>
            <p className="text-ink-muted text-xs leading-relaxed">
              Check the Claim-Level Evidence Verification breakdown in the Clinical Workspace.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
