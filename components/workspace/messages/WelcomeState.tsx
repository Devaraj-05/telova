import { ArrowRight } from "lucide-react";

import type { SuggestionPrompt } from "@/lib/workspace/types";

interface WelcomeStateProps {
  prompts: SuggestionPrompt[];
  onSelectPrompt: (value: string) => void;
}

export function WelcomeState({ prompts, onSelectPrompt }: WelcomeStateProps) {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col items-center justify-center rounded-[28px] border border-border bg-white/[0.03] px-8 py-14 text-center">
      <span className="rounded-full border border-border bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-brand">
        Agent workspace
      </span>
      <h2 className="mt-6 text-4xl font-semibold tracking-tight text-text">
        What do you want to achieve?
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
        Describe a goal in one sentence. Telova will plan, schedule, sync, and
        adapt automatically.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        {prompts.map((prompt) => (
          <button
            key={prompt.label}
            type="button"
            onClick={() => onSelectPrompt(prompt.value)}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-panel/80 px-4 py-3 text-left text-sm font-medium text-text transition hover:border-brand/60 hover:bg-brandSoft/60"
          >
            <span>{prompt.label}</span>
            <ArrowRight className="size-4 text-muted" />
          </button>
        ))}
      </div>
    </div>
  );
}
