import { AlertTriangle, Compass, Flag, Gauge, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import type {
  PlanPreviewData,
  ProposalActionType,
} from "@/lib/workspace/types";

interface PlanPreviewCardProps {
  data: PlanPreviewData;
  onAction: (action: ProposalActionType) => void;
}

export function PlanPreviewCard({ data, onAction }: PlanPreviewCardProps) {
  return (
    <section className="card-surface max-w-[760px] p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="inline-flex rounded-full bg-brandSoft px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand">
            Proposal preview
          </span>
          <h3 className="mt-4 text-2xl font-semibold text-text">
            Plan preview
          </h3>
        </div>
        <Sparkles className="size-5 text-brand" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <SectionBlock icon={<Flag className="size-4" />} label="Goal Summary">
          <p className="text-sm leading-6 text-text">{data.goalSummary}</p>
        </SectionBlock>
        <SectionBlock
          icon={<Compass className="size-4" />}
          label="Execution Strategy"
        >
          <ul className="space-y-2 text-sm leading-6 text-text">
            {data.executionStrategy.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </SectionBlock>
        <SectionBlock icon={<Flag className="size-4" />} label="Milestones">
          <ul className="space-y-2 text-sm leading-6 text-text">
            {data.milestones.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </SectionBlock>
        <SectionBlock
          icon={<Gauge className="size-4" />}
          label="Estimated Effort"
        >
          <div className="space-y-2 text-sm leading-6 text-text">
            <p>Total sessions: {data.estimatedEffort.totalSessions}</p>
            <p>Weekly load: {data.estimatedEffort.weeklyLoad}</p>
            <p>Horizon: {data.estimatedEffort.horizon}</p>
          </div>
        </SectionBlock>
        <SectionBlock
          icon={<Sparkles className="size-4" />}
          label="Key Assumptions"
        >
          <ul className="space-y-2 text-sm leading-6 text-text">
            {data.assumptions.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </SectionBlock>
        <SectionBlock
          icon={<AlertTriangle className="size-4" />}
          label="Risk Indicators"
        >
          <ul className="space-y-2 text-sm leading-6 text-text">
            {data.riskIndicators.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </SectionBlock>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onAction("proceed")}
          className="rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand/90"
        >
          Confirm Plan
        </button>
        <button
          type="button"
          onClick={() => onAction("request_changes")}
          className="rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-sm font-semibold text-text transition hover:bg-white/[0.06]"
        >
          Request Changes
        </button>
        <button
          type="button"
          onClick={() => onAction("regenerate")}
          className="rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-sm font-semibold text-text transition hover:bg-white/[0.06]"
        >
          Regenerate
        </button>
      </div>
    </section>
  );
}

function SectionBlock({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted">
        <span className="text-brand">{icon}</span>
        {label}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
