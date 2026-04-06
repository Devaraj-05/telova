"use client";

import { useEffect, useRef } from "react";
import { SendHorizontal } from "lucide-react";

import type { WorkspaceComposerMode } from "@/lib/workspace/types";

interface PromptComposerProps {
  value: string;
  mode: WorkspaceComposerMode;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

const MODE_LABELS: Record<WorkspaceComposerMode, string> = {
  goal: "Goal mode",
  reply: "Reply mode",
  editing: "Editing proposal",
};

const MODE_PLACEHOLDERS: Record<WorkspaceComposerMode, string> = {
  goal: "Describe your goal or reply with changes to the plan...",
  reply: "Reply with the details the agents need...",
  editing: "Describe how you want the proposal to change...",
};

export function PromptComposer({
  value,
  mode,
  disabled = false,
  onChange,
  onSubmit,
}: PromptComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) {
      return;
    }

    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }, [value]);

  return (
    <div className="sticky bottom-0 border-t border-border bg-canvas/95 px-6 py-5 backdrop-blur">
      <div className="mx-auto max-w-[900px]">
        <div className="mb-3 inline-flex rounded-full border border-border bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-muted">
          {MODE_LABELS[mode]}
        </div>
        <div className="rounded-[28px] border border-border bg-panel/90 p-3 shadow-panel">
          <div className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSubmit();
                }
              }}
              rows={1}
              placeholder={MODE_PLACEHOLDERS[mode]}
              className="max-h-40 min-h-[56px] flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-7 text-text outline-none placeholder:text-muted"
            />
            <button
              type="button"
              onClick={onSubmit}
              disabled={disabled || !value.trim()}
              className="inline-flex h-14 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-brand/40"
            >
              <SendHorizontal className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
