import { MessageSquareQuote } from "lucide-react";

import type { FollowupQuestion } from "@/lib/workspace/types";

interface FollowupQuestionCardProps {
  data: FollowupQuestion;
  onSelectReply: (value: string) => void;
}

export function FollowupQuestionCard({
  data,
  onSelectReply,
}: FollowupQuestionCardProps) {
  return (
    <section className="card-surface max-w-[760px] p-5">
      <div className="flex items-center gap-2">
        <MessageSquareQuote className="size-4 text-brand" />
        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">
          Follow-up
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-text">{data.prompt}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{data.helperText}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        {data.options.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => onSelectReply(option.value)}
            className="rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-sm font-medium text-text transition hover:border-brand/50 hover:bg-brandSoft/50"
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
