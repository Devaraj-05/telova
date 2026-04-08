"use client";

import { useState } from "react";
import { X, Clock, Calendar } from "lucide-react";
import type { ProposalActionData, ProposalActionType } from "@/lib/workspace/types";

interface AdjustTimelineConfig {
  hoursPerDay: number;
  selectedDays: string[];
}

interface ProposalActionsCardProps {
  data: ProposalActionData;
  onAction: (action: ProposalActionType) => void;
  onAdjustTimeline?: (config: AdjustTimelineConfig) => void;
}

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6];

export function ProposalActionsCard({
  data,
  onAction,
  onAdjustTimeline,
}: ProposalActionsCardProps) {
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [hoursPerDay, setHoursPerDay] = useState(3);
  const [selectedDays, setSelectedDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleActionClick = (action: ProposalActionType) => {
    if (action === "adjust_timeline") {
      setShowAdjustModal(true);
      return;
    }
    onAction(action);
  };

  const handleApplyAdjust = () => {
    setShowAdjustModal(false);
    if (onAdjustTimeline) {
      onAdjustTimeline({ hoursPerDay, selectedDays });
    } else {
      onAction("adjust_timeline");
    }
  };

  return (
    <>
      <section className="card-surface max-w-[760px] p-5">
        <h3 className="text-lg font-semibold text-text">Proposal actions</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{data.prompt}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {data.actions.map((action) => (
            <button
              key={action.action}
              type="button"
              onClick={() => handleActionClick(action.action)}
              className="rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-sm font-semibold text-text transition hover:border-brand/60 hover:bg-brandSoft/50"
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>

      {/* Adjust Timeline Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAdjustModal(false)}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-panel p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text">Adjust Timeline</h3>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="rounded-xl p-2 text-muted transition hover:bg-white/5 hover:text-text"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">
              Choose your availability and we'll rebuild the schedule to fit.
            </p>

            {/* Hours per day */}
            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="size-4 text-brand" />
                <p className="text-sm font-semibold text-text">Hours per day</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {HOUR_OPTIONS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHoursPerDay(h)}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      hoursPerDay === h
                        ? "border-brand bg-brand/20 text-brand"
                        : "border-border bg-white/[0.03] text-muted hover:border-brand/40 hover:text-text"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            {/* Days of week */}
            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2">
                <Calendar className="size-4 text-brand" />
                <p className="text-sm font-semibold text-text">Available days</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {ALL_DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      selectedDays.includes(day)
                        ? "border-brand bg-brand/20 text-brand"
                        : "border-border bg-white/[0.03] text-muted hover:border-brand/40 hover:text-text"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">
                {selectedDays.length === 0
                  ? "Select at least one day"
                  : `${selectedDays.length} day${selectedDays.length > 1 ? "s" : ""} × ${hoursPerDay}h = ${selectedDays.length * hoursPerDay}h/week`}
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="flex-1 rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-sm font-semibold text-text transition hover:bg-white/[0.06]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyAdjust}
                disabled={selectedDays.length === 0}
                className="flex-1 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-40"
              >
                Apply & Rebuild
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
