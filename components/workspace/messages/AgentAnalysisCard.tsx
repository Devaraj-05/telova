import { BrainCircuit } from "lucide-react";

import type { AnalysisData } from "@/lib/workspace/types";

interface AgentAnalysisCardProps {
  data: AnalysisData;
}

export function AgentAnalysisCard({ data }: AgentAnalysisCardProps) {
  return (
    <section className="card-surface max-w-[760px] p-5">
      <div className="flex items-center gap-2">
        <span className="inline-flex rounded-full bg-brandSoft px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand">
          Analysis
        </span>
        <BrainCircuit className="size-4 text-brand" />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-muted">
            Goal identified
          </p>
          <p className="mt-2 text-base font-semibold text-text">
            {data.goalDetected}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-muted">
            Timeline detected
          </p>
          <p className="mt-2 text-base font-semibold text-text">
            {data.timelineDetected}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-muted">
            Constraints inferred
          </p>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-text">
            {data.constraintsInferred.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-muted">
            Tool sync requirements
          </p>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-text">
            {data.syncRequirements.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-panel/70 p-4">
        <p className="text-xs uppercase tracking-[0.24em] text-muted">
          Likely workflow
        </p>
        <p className="mt-2 text-sm leading-6 text-text">{data.likelyWorkflow}</p>
      </div>
    </section>
  );
}
