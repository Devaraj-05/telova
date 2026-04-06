import { CheckCircle2, CircleDashed, Link2Off, PlugZap } from "lucide-react";

import type { ConnectedToolItem } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

const STATUS_ICON = {
  connected: CheckCircle2,
  pending: CircleDashed,
  disconnected: Link2Off,
} as const;

const STATUS_COLOR = {
  connected: "text-emerald-300 bg-emerald-500/15",
  pending: "text-amber-300 bg-amber-500/15",
  disconnected: "text-rose-300 bg-rose-500/15",
} as const;

interface ConnectedToolsCardProps {
  items: ConnectedToolItem[];
}

export function ConnectedToolsCard({ items }: ConnectedToolsCardProps) {
  return (
    <section className="card-surface p-5">
      <div className="flex items-center gap-2">
        <PlugZap className="size-4 text-brand" />
        <h2 className="text-sm font-semibold text-text">Connected Tools</h2>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const Icon = STATUS_ICON[item.status];

          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white/[0.03] px-3 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-text">{item.name}</p>
                <p className="mt-1 text-sm text-muted">{item.detail}</p>
              </div>
              <span
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-full",
                  STATUS_COLOR[item.status],
                )}
              >
                <Icon className="size-4" />
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
