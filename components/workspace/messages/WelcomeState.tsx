interface WelcomeStateProps {
  prompts: { label: string; value: string }[];
  onSelectPrompt: (value: string) => void;
}

export function WelcomeState({ prompts, onSelectPrompt }: WelcomeStateProps) {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col items-center justify-center px-8 py-14 text-center">
      <span className="rounded-full border border-border bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-brand">
        Goal Execution Engine
      </span>
      <h2 className="mt-6 text-4xl font-semibold tracking-tight text-text">
        What do you want to achieve?
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
        Describe your goal in one sentence. Telova will plan, schedule, track,
        and adapt automatically — you just focus on execution.
      </p>
      <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
        {prompts.map((prompt) => (
          <button
            key={prompt.label}
            type="button"
            onClick={() => onSelectPrompt(prompt.value)}
            className="rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-left text-sm font-medium text-muted transition hover:border-brand/60 hover:bg-brandSoft/60 hover:text-text"
          >
            {prompt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
