import { ArrowRight, CheckCircle2, CalendarRange } from "lucide-react";

import type { SyncSuccessData } from "@/lib/workspace/types";

interface SyncSuccessCardProps {
  data: SyncSuccessData;
  onAction: (action: "open_dashboard" | "view_timeline" | "stay") => void;
}

export function SyncSuccessCard({ data, onAction }: SyncSuccessCardProps) {
  return (
    <section className="card-surface max-w-[760px] p-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
          <CheckCircle2 className="size-5" />
        </span>
        <div>
          <h3 className="text-xl font-semibold text-text">{data.title}</h3>
          <p className="mt-1 text-sm text-muted">{data.summary}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        {data.metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-border bg-white/[0.03] p-4"
          >
            <p className="text-xs uppercase tracking-[0.24em] text-muted">
              {metric.label}
            </p>
            <p className="mt-2 text-lg font-semibold text-text">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onAction("open_dashboard")}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand/90"
        >
          Open Dashboard
          <ArrowRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onAction("view_timeline")}
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-sm font-semibold text-text transition hover:bg-white/[0.06]"
        >
          <CalendarRange className="size-4" />
          View Timeline
        </button>
      </div>
    </section>
  );
}
