import type { SuggestionPrompt } from "@/lib/workspace/types";

interface WelcomeStateProps {
  prompts: SuggestionPrompt[];
  onSelectPrompt: (value: string) => void;
}

export function WelcomeState({ prompts, onSelectPrompt }: WelcomeStateProps) {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col items-center justify-center px-8 py-14 text-center">
      <span className="rounded-full border border-border bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-brand">
        Agent workspace
      </span>
      <h2 className="mt-6 text-4xl font-semibold tracking-tight text-text">
        How can I help you today?
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
        Tell me your goal and I&apos;ll create a plan, schedule it, track progress,
        and handle follow-ups automatically.
      </p>
    </div>
  );
}
