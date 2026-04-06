import type { ProposalActionData, ProposalActionType } from "@/lib/workspace/types";

interface ProposalActionsCardProps {
  data: ProposalActionData;
  onAction: (action: ProposalActionType) => void;
}

export function ProposalActionsCard({
  data,
  onAction,
}: ProposalActionsCardProps) {
  return (
    <section className="card-surface max-w-[760px] p-5">
      <h3 className="text-lg font-semibold text-text">Proposal actions</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{data.prompt}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        {data.actions.map((action) => (
          <button
            key={action.action}
            type="button"
            onClick={() => onAction(action.action)}
            className="rounded-2xl border border-border bg-white/[0.03] px-4 py-3 text-sm font-semibold text-text transition hover:border-brand/60 hover:bg-brandSoft/50"
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
