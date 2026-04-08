"use client";

import { useState } from "react";
import { CalendarClock, ChevronDown, ChevronRight } from "lucide-react";

import type {
  ProposalActionType,
  TimelinePreviewData,
  TimelineGroup,
} from "@/lib/workspace/types";

interface TimelinePreviewCardProps {
  data: TimelinePreviewData;
  onAction: (action: ProposalActionType) => void;
}

function WeekGroup({ group, defaultOpen }: { group: TimelineGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-border bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <span className="text-base font-semibold text-text">{group.label}</span>
          {group.dateRange && (
            <span className="ml-2 text-xs text-muted">{group.dateRange}</span>
          )}
        </div>
        {open ? (
          <ChevronDown className="size-4 text-muted" />
        ) : (
          <ChevronRight className="size-4 text-muted" />
        )}
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {group.days.length > 0
            ? group.days.map((day) => (
                <div key={day.date}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
                    {day.dayLabel}
                  </p>
                  <div className="space-y-2">
                    {day.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border bg-panel/60 p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-text">{item.title}</p>
                            <p className="mt-0.5 text-xs text-muted">
                              {item.taskType} · {item.durationLabel}
                            </p>
                          </div>
                          <span className="rounded-full bg-brandSoft px-2.5 py-0.5 text-xs font-semibold text-brand">
                            {item.responsibleAgent}
                          </span>
                        </div>
                        {item.specificTasks && item.specificTasks.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {item.specificTasks.map((task, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-muted">
                                <span className="mt-1 size-1 shrink-0 rounded-full bg-brand/50" />
                                {task}
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="mt-2 text-xs text-muted/70">{item.statusPreview}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            : /* fallback: flat items list */
              group.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-panel/60 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-text">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {item.taskType} · {item.durationLabel}
                      </p>
                    </div>
                    <span className="rounded-full bg-brandSoft px-2.5 py-0.5 text-xs font-semibold text-brand">
                      {item.responsibleAgent}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted/70">{item.statusPreview}</p>
                </div>
              ))}
        </div>
      )}
    </div>
  );
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
          <h3 className="mt-3 text-2xl font-semibold text-text">
            {data.goalTitle ? `${data.goalTitle} — Day by Day` : "Task timeline"}
          </h3>
          {data.totalWeeks && (
            <p className="mt-1 text-sm text-muted">
              {data.totalWeeks} week{data.totalWeeks > 1 ? "s" : ""} · Full structured plan
            </p>
          )}
        </div>
        <CalendarClock className="size-5 shrink-0 text-brand" />
      </div>

      <div className="mt-6 space-y-3">
        {data.groups.map((group, index) => (
          <WeekGroup
            key={group.id}
            group={group}
            defaultOpen={index === 0}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onAction("proceed")}
          className="rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand/90"
        >
          Proceed with this plan
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
