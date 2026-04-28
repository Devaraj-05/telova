"use client";

import { useEffect, useState } from "react";

const THINKING_LABELS = [
  "Thinking",
  "Planning",
  "Breaking down goal",
  "Checking schedule",
  "Cooking plan",
  "Finding dependencies",
  "Preparing next steps",
  "Re-planning",
  "Syncing context",
];

export function AgentThinkingBubble() {
  const [labelIndex, setLabelIndex] = useState(0);
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const labelTimer = setInterval(() => {
      setLabelIndex((prev) => (prev + 1) % THINKING_LABELS.length);
    }, 1500);
    return () => clearInterval(labelTimer);
  }, []);

  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 400);
    return () => clearInterval(dotTimer);
  }, []);

  const dots = ".".repeat(dotCount);

  return (
    <div className="mr-auto max-w-[760px]">
      <div className="mr-auto w-fit max-w-[680px] rounded-[24px] rounded-tl-md border border-border bg-card px-5 py-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="inline-flex gap-1">
            <span className="size-1.5 animate-bounce rounded-full bg-brand/60 [animation-delay:0ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-brand/60 [animation-delay:150ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-brand/60 [animation-delay:300ms]" />
          </span>
          <span className="min-w-[160px] text-text/60">
            {THINKING_LABELS[labelIndex]}
            {dots}
          </span>
        </div>
      </div>
    </div>
  );
}
