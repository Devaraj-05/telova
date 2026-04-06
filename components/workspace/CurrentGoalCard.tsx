import { Flag, Hourglass, Radar } from "lucide-react";

import type { CurrentGoalSummary } from "@/lib/workspace/types";

interface CurrentGoalCardProps {
  goal: CurrentGoalSummary;
}

export function CurrentGoalCard({ goal }: CurrentGoalCardProps) {
  return (
    <section className="card-surface p-5">
      <div className="flex items-center gap-2">
        <Flag className="size-4 text-brand" />
        <h2 className="text-sm font-semibold text-text">Current Goal</h2>
      </div>
      <div className="mt-4 rounded-2xl border border-border bg-white/[0.03] p-4">
        <p className="text-base font-semibold text-text">{goal.goalTitle}</p>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-muted">
              <Radar className="size-4" />
              Stage
            </span>
            <span className="font-medium text-text">{goal.stage}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-muted">
              <Flag className="size-4" />
              Plan
            </span>
            <span className="font-medium text-text">{goal.planStatus}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-muted">
              <Hourglass className="size-4" />
              Schedule
            </span>
            <span className="text-right font-medium text-text">
              {goal.scheduleStatus}
            </span>
          </div>
        </div>
        <p className="mt-4 text-xs uppercase tracking-[0.24em] text-muted">
          Last update
        </p>
        <p className="mt-1 text-sm text-text">{goal.lastUpdated}</p>
      </div>
    </section>
  );
}
