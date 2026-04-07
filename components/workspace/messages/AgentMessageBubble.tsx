"use client";

interface AgentMessageBubbleProps {
  text: string;
  timestamp: string;
}

export function AgentMessageBubble({ text, timestamp }: AgentMessageBubbleProps) {
  // Split text by newlines and render basic markdown-like formatting
  const lines = text.split("\n");

  return (
    <div className="mr-auto max-w-[760px]">
      <div className="mr-auto w-fit max-w-[680px] rounded-[24px] rounded-tl-md border border-border bg-card px-5 py-4 shadow-sm">
        <div className="space-y-2 text-sm leading-7 text-text">
          {lines.map((line, index) => {
            const trimmed = line.trim();
            if (!trimmed) return null;

            // Bold headers (lines starting with **)
            if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
              return (
                <p key={index} className="font-semibold text-text">
                  {trimmed.replace(/\*\*/g, "")}
                </p>
              );
            }

            // Bullet points
            if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
              const content = trimmed.replace(/^[-*•]\s+/, "");
              // Handle inline bold
              const parts = content.split(/\*\*(.*?)\*\*/g);
              return (
                <div key={index} className="flex gap-2 pl-2">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand/60" />
                  <span>
                    {parts.map((part, partIndex) =>
                      partIndex % 2 === 1 ? (
                        <strong key={partIndex} className="font-semibold">
                          {part}
                        </strong>
                      ) : (
                        <span key={partIndex}>{part}</span>
                      ),
                    )}
                  </span>
                </div>
              );
            }

            // Numbered items
            if (/^\d+[\.\)]\s/.test(trimmed)) {
              const content = trimmed.replace(/^\d+[\.\)]\s+/, "");
              const number = trimmed.match(/^(\d+)/)?.[1];
              const parts = content.split(/\*\*(.*?)\*\*/g);
              return (
                <div key={index} className="flex gap-2 pl-2">
                  <span className="mt-0.5 shrink-0 text-xs font-semibold text-brand">
                    {number}.
                  </span>
                  <span>
                    {parts.map((part, partIndex) =>
                      partIndex % 2 === 1 ? (
                        <strong key={partIndex} className="font-semibold">
                          {part}
                        </strong>
                      ) : (
                        <span key={partIndex}>{part}</span>
                      ),
                    )}
                  </span>
                </div>
              );
            }

            // Regular text with inline bold
            const parts = trimmed.split(/\*\*(.*?)\*\*/g);
            return (
              <p key={index}>
                {parts.map((part, partIndex) =>
                  partIndex % 2 === 1 ? (
                    <strong key={partIndex} className="font-semibold">
                      {part}
                    </strong>
                  ) : (
                    <span key={partIndex}>{part}</span>
                  ),
                )}
              </p>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-left text-xs uppercase tracking-[0.24em] text-muted">
        {timestamp}
      </p>
    </div>
  );
}
