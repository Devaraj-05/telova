import { CheckCircle2, Clock3, LoaderCircle, ShieldAlert } from "lucide-react";

import type { AgentActivityItem } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

const STATUS_ICON = {
  idle: Clock3,
  queued: Clock3,
  running: LoaderCircle,
  completed: CheckCircle2,
  blocked: ShieldAlert,
} as const;

interface AgentActivityInlineCardProps {
  items: AgentActivityItem[];
}

export function AgentActivityInlineCard({
  items,
}: AgentActivityInlineCardProps) {
  return (
    <section className="card-surface max-w-[760px] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-text">Agent activity</h3>
          <p className="mt-1 text-sm text-muted">
            Live orchestration progress inside the conversation thread.
          </p>
        </div>
        <span className="rounded-full border border-border bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-muted">
          Live
        </span>
      </div>
      <div className="mt-5 space-y-3">
        {items.map((item) => {
          const Icon = STATUS_ICON[item.status];

          return (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-white/[0.03] px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-text">{item.agentName}</p>
                <p className="mt-1 text-sm text-muted">{item.currentAction}</p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
                  item.status === "completed" && "bg-emerald-500/15 text-emerald-300",
                  item.status === "running" && "bg-brandSoft text-brand",
                  item.status === "blocked" && "bg-rose-500/15 text-rose-300",
                  (item.status === "idle" || item.status === "queued") &&
                    "bg-white/10 text-muted",
                )}
              >
                <Icon
                  className={cn(
                    "size-3.5",
                    item.status === "running" && "animate-spin",
                  )}
                />
                {item.status}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
