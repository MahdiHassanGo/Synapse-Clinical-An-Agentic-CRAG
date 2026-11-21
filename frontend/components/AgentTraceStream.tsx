"use client";

import React from "react";
import { CheckCircle2, Clock, GitCommit, Search, ShieldAlert, Cpu } from "lucide-react";

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
    <div className="bg-graphite-900 border border-white/[0.08] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-clinical-blue" />
          <span className="text-xs font-medium text-graphite-200">
            Autonomous Agentic Reasoning Trace
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-graphite-400">
          <span>CRAG Loops: {cragIterations}</span>
          <span>·</span>
          <span>{totalLatencyMs.toFixed(0)} ms total</span>
        </div>
      </div>

      {/* Query Rewriting Notice if Loop occurred */}
      {rewrittenQueries.length > 0 && (
        <div className="bg-graphite-850 border border-clinical-blue/20 rounded-lg p-2.5 text-xs space-y-1">
          <div className="text-clinical-blue font-medium flex items-center gap-1.5">
            <GitCommit className="w-3.5 h-3.5" />
            <span>CRAG Fallback: Query Reformulation Executed</span>
          </div>
          <div className="text-[11px] font-mono text-graphite-300">
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
              className="bg-graphite-850/80 border border-white/[0.04] rounded-lg p-2.5 flex items-start justify-between text-xs"
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5">
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-clinical-emerald" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-clinical-amber animate-spin" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-graphite-200 flex items-center gap-2">
                    <span>{step.step_name}</span>
                    <span className="text-[10px] font-mono text-graphite-400">
                      {step.latency_ms > 0 ? `${step.latency_ms}ms` : "in progress"}
                    </span>
                  </div>
                  <div className="text-[11px] text-graphite-400 mt-0.5">
                    {step.description}
                  </div>
                </div>
              </div>

              {step.metadata && (
                <div className="text-[10px] font-mono text-graphite-400 text-right space-y-0.5">
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
