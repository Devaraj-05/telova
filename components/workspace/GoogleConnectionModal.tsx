"use client";

import { CalendarDays, CheckCircle2, ExternalLink, ListTodo, X } from "lucide-react";

import type { GoogleConnectionStatus } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

interface GoogleConnectionModalProps {
  connection: GoogleConnectionStatus | null;
  onConnect: () => void | Promise<void>;
  onDismiss: () => void;
  isConnecting?: boolean;
  error?: string | null;
}

const TOOL_ROWS = [
  { key: "calendar_connected", label: "Google Calendar", Icon: CalendarDays },
  { key: "tasks_connected", label: "Google Tasks", Icon: ListTodo },
] as const;

export function GoogleConnectionModal({
  connection,
  onConnect,
  onDismiss,
  isConnecting = false,
  error = null,
}: GoogleConnectionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-lg rounded-[28px] border border-border bg-card p-6 shadow-2xl">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-4 top-4 rounded-xl p-2 text-muted transition hover:bg-white/10 hover:text-text"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand">
          Google Workspace
        </p>
        <h2 className="mt-3 text-xl font-semibold text-text">
          Sync plans to your Google tools
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          After you approve a goal, Telova can create calendar blocks, push task
          queues, and prepare notes so execution starts without extra manual
          setup.
        </p>

        <div className="mt-5 space-y-2">
          {TOOL_ROWS.map(({ key, label, Icon }) => {
            const connected = Boolean(connection?.[key]);
            return (
              <div
                key={key}
                className="flex items-center justify-between rounded-2xl border border-border bg-panel px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-white/5 p-2 text-muted">
                    <Icon className="size-4" />
                  </span>
                  <p className="text-sm font-medium text-text">{label}</p>
                </div>
                <CheckCircle2
                  className={cn(
                    "size-4",
                    connected ? "text-emerald-400" : "text-border",
                  )}
                />
              </div>
            );
          })}
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void onConnect()}
            disabled={isConnecting}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <ExternalLink className="size-4" />
            Connect
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-2xl border border-border bg-white/5 px-5 py-2.5 text-sm font-semibold text-text transition hover:bg-white/10"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
