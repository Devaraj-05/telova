interface AgentMessageBubbleProps {
  text: string;
  timestamp: string;
}

export function AgentMessageBubble({ text, timestamp }: AgentMessageBubbleProps) {
  return (
    <div className="mr-auto max-w-[760px]">
      <div className="mr-auto w-fit max-w-[680px] rounded-[24px] rounded-tl-md border border-border bg-card px-5 py-4 text-sm leading-7 text-text shadow-sm">
        {text}
      </div>
      <p className="mt-2 text-left text-xs uppercase tracking-[0.24em] text-muted">
        {timestamp}
      </p>
    </div>
  );
}
