interface UserMessageBubbleProps {
  text: string;
  timestamp: string;
}

export function UserMessageBubble({ text, timestamp }: UserMessageBubbleProps) {
  return (
    <div className="ml-auto max-w-[760px]">
      <div className="ml-auto w-fit max-w-[680px] rounded-[24px] rounded-tr-md bg-brand px-5 py-4 text-sm leading-7 text-white shadow-[0_18px_40px_rgba(111,124,255,0.3)]">
        {text}
      </div>
      <p className="mt-2 text-right text-xs uppercase tracking-[0.24em] text-muted">
        {timestamp}
      </p>
    </div>
  );
}
