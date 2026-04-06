import { CalendarClock } from "lucide-react";

import type {
  ProposalActionType,
  TimelinePreviewData,
} from "@/lib/workspace/types";

interface TimelinePreviewCardProps {
  data: TimelinePreviewData;
  onAction: (action: ProposalActionType) => void;
}

export function TimelinePreviewCard({
  data,
  onAction,
}: TimelinePreviewCardProps) {
  return (
    <section className="card-surface max-w-[760px] p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="inline-flex rounded-full border border-border bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Timeline preview
          </span>
          <h3 className="mt-4 text-2xl font-semibold text-text">
            Task timeline
          </h3>
        </div>
        <CalendarClock className="size-5 text-brand" />
      </div>

      <div className="mt-6 space-y-3">
        {data.groups.map((group, index) => (
          <details
            key={group.id}
            open={index === 0}
            className="rounded-2xl border border-border bg-white/[0.03] p-4"
          >
            <summary className="cursor-pointer list-none text-base font-semibold text-text">
              {group.label}
            </summary>
            <div className="mt-4 space-y-3">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border bg-panel/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {item.taskType} | {item.durationLabel}
                      </p>
                    </div>
                    <span className="rounded-full bg-brandSoft px-3 py-1 text-xs font-semibold text-brand">
                      {item.responsibleAgent}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted">{item.statusPreview}</p>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onAction("proceed")}
          className="rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand/90"
        >
          Proceed
        </button>
        <button
          type="button"
          onClick={() => onAction("adjust_timeline")}
          className="rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-sm font-semibold text-text transition hover:bg-white/[0.06]"
        >
          Adjust Timeline
        </button>
      </div>
    </section>
  );
}
