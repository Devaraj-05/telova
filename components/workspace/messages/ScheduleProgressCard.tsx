import {
  CheckCircle2,
  CircleDashed,
  LoaderCircle,
  OctagonAlert,
} from "lucide-react";

import type { ScheduleProgressData } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

const STEP_ICON = {
  pending: CircleDashed,
  running: LoaderCircle,
  success: CheckCircle2,
  failed: OctagonAlert,
} as const;

interface ScheduleProgressCardProps {
  data: ScheduleProgressData;
}

export function ScheduleProgressCard({ data }: ScheduleProgressCardProps) {
  return (
    <section className="card-surface max-w-[760px] p-5">
      <h3 className="text-lg font-semibold text-text">{data.title}</h3>
      <div className="mt-5 space-y-3">
        {data.steps.map((step) => {
          const Icon = STEP_ICON[step.status];

          return (
            <div
              key={step.id}
              className="flex items-start gap-4 rounded-2xl border border-border bg-white/[0.03] px-4 py-3"
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex size-9 items-center justify-center rounded-full",
                  step.status === "success" && "bg-emerald-500/15 text-emerald-300",
                  step.status === "running" && "bg-brandSoft text-brand",
                  step.status === "failed" && "bg-rose-500/15 text-rose-300",
                  step.status === "pending" && "bg-white/10 text-muted",
                )}
              >
                <Icon
                  className={cn(
                    "size-4",
                    step.status === "running" && "animate-spin",
                  )}
                />
              </span>
              <div>
                <p className="text-sm font-semibold text-text">{step.label}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{step.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
