"use client";

import React from "react";
import { CheckCircle2, Clock, GitCommit, Cpu } from "lucide-react";

export interface TraceStep {
  step_name: string;
  description: string;
  status: string;
  latency_ms: number;
  metadata?: Record<string, any>;
}

interface AgentTraceStreamProps {
  steps: TraceStep[];
  cragIterations: number;
  rewrittenQueries: string[];
  totalLatencyMs: number;
}

export function AgentTraceStream({
  steps,
  cragIterations,
  rewrittenQueries,
  totalLatencyMs,
}: AgentTraceStreamProps) {
  if (steps.length === 0) return null;

  return (
    <div className="bg-surface border border-hairline rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between pb-2.5 border-b border-hairline">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-ink">
            Agentic Reasoning Execution Trace
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-ink-muted tabular-nums">
          <span>CRAG Loops: {cragIterations}</span>
          <span>·</span>
          <span>{(totalLatencyMs ?? 0).toFixed(0)} ms total</span>
        </div>
      </div>

      {/* Query Rewriting Notice if Loop occurred */}
      {rewrittenQueries.length > 0 && (
        <div className="bg-accent-soft border border-accent-border rounded-lg p-3 text-xs space-y-1">
          <div className="text-accent font-medium flex items-center gap-1.5">
            <GitCommit className="w-3.5 h-3.5" />
            <span>CRAG Query Reformulation Executed</span>
          </div>
          <div className="text-[11px] font-mono text-ink-secondary space-y-0.5">
            {rewrittenQueries.map((rq, idx) => (
              <div key={idx} className="truncate">
                Iter {idx + 1}: &quot;{rq}&quot;
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execution Step Flow */}
      <div className="space-y-2">
        {steps.map((step, idx) => {
          const isDone = step.status === "COMPLETED";
          return (
            <div
              key={idx}
              className="bg-subtle border border-hairline rounded-lg p-3 flex items-start justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-clinical-emerald" />
                  ) : (
                    <Clock className="w-4 h-4 text-clinical-amber" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-ink flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px]">{step.step_name}</span>
                    <span className="text-[11px] font-mono text-ink-muted tabular-nums">
                      {step.latency_ms > 0 ? `${step.latency_ms}ms` : "In progress"}
                    </span>
                  </div>
                  <div className="text-xs text-ink-secondary mt-0.5 leading-relaxed">
                    {step.description}
                  </div>
                </div>
              </div>

              {step.metadata && (
                <div className="text-[11px] font-mono text-ink-muted text-right space-y-0.5 shrink-0">
                  {step.metadata.is_context_sufficient !== undefined && (
                    <div
                      className={
                        step.metadata.is_context_sufficient
                          ? "text-clinical-emerald"
                          : "text-clinical-amber"
                      }
                    >
                      Sufficient: {step.metadata.is_context_sufficient ? "Yes" : "Reformulate"}
                    </div>
                  )}
                  {step.metadata.support_score !== undefined && (
                    <div>Score: {(step.metadata.support_score * 100).toFixed(0)}%</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
