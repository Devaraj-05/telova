import { Bot, CheckCircle2, Clock3, LoaderCircle, ShieldAlert } from "lucide-react";

import type { AgentActivityItem } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  idle: "bg-white/10 text-muted",
  queued: "bg-brandSoft text-brand",
  running: "bg-brandSoft text-brand",
  completed: "bg-emerald-500/15 text-emerald-300",
  blocked: "bg-rose-500/15 text-rose-300",
} as const;

const STATUS_ICONS = {
  idle: Clock3,
  queued: Clock3,
  running: LoaderCircle,
  completed: CheckCircle2,
  blocked: ShieldAlert,
} as const;

interface AgentActivityFeedCardProps {
  items: AgentActivityItem[];
}

export function AgentActivityFeedCard({ items }: AgentActivityFeedCardProps) {
  return (
    <section className="card-surface p-5">
      <div className="flex items-center gap-2">
        <Bot className="size-4 text-brand" />
        <h2 className="text-sm font-semibold text-text">Agent Activity Feed</h2>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const Icon = STATUS_ICONS[item.status];

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-border bg-white/[0.03] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text">{item.agentName}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {item.currentAction}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
                    STATUS_STYLES[item.status],
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
