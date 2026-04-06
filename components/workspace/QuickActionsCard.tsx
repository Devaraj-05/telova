import { ArrowRight, RefreshCcw } from "lucide-react";

import type { QuickActionItem } from "@/lib/workspace/types";

interface QuickActionsCardProps {
  items: QuickActionItem[];
  onAction: (action: QuickActionItem["action"]) => void;
}

export function QuickActionsCard({ items, onAction }: QuickActionsCardProps) {
  return (
    <section className="card-surface p-5">
      <div className="flex items-center gap-2">
        <RefreshCcw className="size-4 text-brand" />
        <h2 className="text-sm font-semibold text-text">Quick Actions</h2>
      </div>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onAction(item.action)}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-left text-sm font-medium text-text transition hover:bg-white/[0.06]"
          >
            <span>{item.label}</span>
            <ArrowRight className="size-4 text-muted" />
          </button>
        ))}
      </div>
    </section>
  );
}
