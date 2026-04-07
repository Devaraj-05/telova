"use client";

import { CalendarDays, CheckCircle2, ExternalLink, ListTodo, NotebookPen } from "lucide-react";

import type { GoogleConnectionStatus } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

interface GoogleConnectionPromptProps {
  connection: GoogleConnectionStatus | null;
  onConnect: () => void | Promise<void>;
  onDismiss: () => void;
  isConnecting?: boolean;
  error?: string | null;
}

const TOOL_ROWS = [
  {
    key: "calendar_connected",
    label: "Google Calendar",
    Icon: CalendarDays,
  },
  {
    key: "tasks_connected",
    label: "Google Tasks",
    Icon: ListTodo,
  },
  {
    key: "keep_connected",
    label: "Google Keep",
    Icon: NotebookPen,
  },
] as const;

export function GoogleConnectionPrompt({
  connection,
  onConnect,
  onDismiss,
  isConnecting = false,
  error = null,
}: GoogleConnectionPromptProps) {
  const isPartial = connection?.status === "partial";

  return (
    <section className="mx-auto mt-6 w-full max-w-[900px] rounded-[28px] border border-border bg-card/95 p-6 shadow-panel">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand">
            Google Workspace Access
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-text">
            Let Telova sync your approved plans into your tools.
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            After you approve a goal, Telova can create calendar blocks, push task queues,
            and prepare notes so execution starts without extra manual setup.
          </p>
          {connection?.provider_email ? (
            <p className="mt-3 text-sm text-text">
              Connected account:{" "}
              <span className="font-semibold">{connection.provider_email}</span>
            </p>
          ) : null}
        </div>

        <div className="rounded-3xl border border-border bg-white/[0.03] p-4 lg:min-w-[280px]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Status
          </p>
          <div className="mt-4 space-y-3">
            {TOOL_ROWS.map(({ key, label, Icon }) => {
              const connected = Boolean(connection?.[key]);
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-panel px-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-2xl bg-white/5 p-2 text-muted">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-text">{label}</p>
                      <p className="text-xs text-muted">
                        {connected ? "Ready for sync" : "Waiting for permission"}
                      </p>
                    </div>
                  </div>
                  <CheckCircle2
                    className={cn(
                      "size-4",
                      connected ? "text-emerald-300" : "text-border",
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void onConnect()}
          disabled={isConnecting}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <ExternalLink className="size-4" />
          {isPartial ? "Reconnect Google Tools" : "Connect Google Workspace"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-2xl border border-border bg-white/5 px-5 py-3 text-sm font-semibold text-text transition hover:bg-white/10"
        >
          Continue without sync
        </button>
      </div>
      <p className="mt-3 text-sm text-muted">
        {connection?.detail ??
          "Calendar, Tasks, and Keep will stay local until you connect them."}
      </p>
      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
    </section>
  );
}
