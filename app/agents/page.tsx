"use client";

import { useEffect, useState } from "react";
import { Bot, ChevronDown, ChevronRight, Clock, Code2, Loader2, Radio, Zap } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { useAgentStream } from "@/hooks/useAgentStream";
import { fetchAgentRuns } from "@/lib/workspace/api";
import type { AgentRunRead } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  success: "bg-emerald-500/10 text-emerald-400",
  completed: "bg-emerald-500/10 text-emerald-400",
  failed: "bg-rose-500/10 text-rose-400",
  error: "bg-rose-500/10 text-rose-400",
  running: "bg-brand/10 text-brand",
  pending: "bg-amber-500/10 text-amber-400",
};

const AGENT_COLORS: Record<string, string> = {
  Orchestrator: "bg-brand/15 text-brand",
  Scheduler: "bg-violet-500/15 text-violet-400",
  Research: "bg-sky-500/15 text-sky-400",
  Memory: "bg-emerald-500/15 text-emerald-400",
  Execution: "bg-amber-500/15 text-amber-400",
  "Data Analyst": "bg-rose-500/15 text-rose-400",
};

function statusStyle(status: string) {
  return STATUS_STYLES[status] ?? "bg-white/5 text-muted";
}

function agentColor(name: string) {
  return AGENT_COLORS[name] ?? "bg-white/5 text-muted";
}

function formatDuration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function JsonBlock({ label, data }: { label: string; data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const isEmpty = Object.keys(data).length === 0;
  if (isEmpty) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-text transition"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <Code2 className="size-3" />
        {label}
      </button>
      {open && (
        <pre className="mt-2 overflow-x-auto rounded-xl bg-black/20 p-3 text-xs text-muted leading-relaxed">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function AgentRunCard({ run }: { run: AgentRunRead }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="rounded-[20px] border border-border bg-panel shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-4 p-5 text-left"
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className={cn("shrink-0 rounded-xl px-2.5 py-1 text-xs font-bold", agentColor(run.agent_name))}>
            {run.agent_name}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-text">{run.operation}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {formatDate(run.started_at)}
              </span>
              <span className="flex items-center gap-1">
                <Zap className="size-3" />
                {formatDuration(run.started_at, run.completed_at)}
              </span>
              <span className="opacity-60">{run.runtime}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", statusStyle(run.status))}>
            {run.status}
          </span>
          {expanded ? (
            <ChevronDown className="size-4 text-muted" />
          ) : (
            <ChevronRight className="size-4 text-muted" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          {run.sql_text && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">SQL Provenance</p>
              <pre className="overflow-x-auto rounded-xl bg-black/20 p-3 text-xs text-emerald-300 leading-relaxed">
                {run.sql_text}
              </pre>
            </div>
          )}
          <JsonBlock label="Input payload" data={run.input_payload} />
          <JsonBlock label="Output payload" data={run.output_payload} />
          {run.goal_id && (
            <p className="mt-3 text-xs text-muted/60">Goal: {run.goal_id}</p>
          )}
        </div>
      )}
    </article>
  );
}

export default function AgentsPage() {
  const { user, logout } = useAuth();
  const [runs, setRuns] = useState<AgentRunRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAgent, setFilterAgent] = useState("all");

  // SSE live stream — merges new runs in real-time.
  const { runs: streamRuns, connected: streamConnected } = useAgentStream(user?.id);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    fetchAgentRuns(user.id, 100)
      .then(setRuns)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load agent runs"))
      .finally(() => setLoading(false));
  }, [user?.id]);

  // Merge streamed runs with the initial fetch result, newest first.
  const allRuns = (() => {
    const seen = new Set(runs.map((r) => r.id));
    const fresh = streamRuns.filter((r) => !seen.has(r.id));
    return [...fresh, ...runs];
  })();

  const agentNames = ["all", ...Array.from(new Set(allRuns.map((r) => r.agent_name)))];
  const visible = filterAgent === "all" ? allRuns : allRuns.filter((r) => r.agent_name === filterAgent);

  const successCount = allRuns.filter((r) => r.status === "success" || r.status === "completed").length;
  const failedCount = allRuns.filter((r) => r.status === "failed" || r.status === "error").length;

  return (
    <RequireAuth>
      <div className="flex h-screen overflow-hidden bg-canvas text-text">
        <div className="hidden md:block">
          <WorkspaceSidebar
            activeItem="agents"
            userName={user?.display_name}
            userEmail={user?.email}
            onLogout={logout}
          />
        </div>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <header className="flex h-[72px] items-center justify-between border-b border-border px-8 shrink-0">
            <div className="flex items-center gap-3">
              <Bot className="size-5 text-brand" />
              <h1 className="text-2xl font-semibold text-text">Agent Runs</h1>
              {streamConnected && (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs text-emerald-400">
                  <Radio className="size-3" />
                  Live
                </span>
              )}
            </div>
            {!loading && allRuns.length > 0 && (
              <div className="flex items-center gap-4 text-sm text-muted">
                <span className="text-emerald-400">{successCount} succeeded</span>
                {failedCount > 0 && <span className="text-rose-400">{failedCount} failed</span>}
                <span>{allRuns.length} total</span>
              </div>
            )}
          </header>

          <div className="p-8 max-w-5xl">
            {/* Agent filter pills */}
            {!loading && allRuns.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-2">
                {agentNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setFilterAgent(name)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition",
                      filterAgent === name
                        ? "bg-brand text-white"
                        : "bg-white/5 text-muted hover:bg-white/10 hover:text-text",
                    )}
                  >
                    {name === "all" ? "All Agents" : name}
                    {name !== "all" && (
                      <span className="ml-1.5 opacity-60">
                        {runs.filter((r) => r.agent_name === name).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="size-6 animate-spin text-brand" />
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-400">
                {error}
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center text-muted">
                <Bot className="size-10 opacity-30" />
                <p className="text-base font-medium">No agent runs recorded yet</p>
                <p className="text-sm opacity-60">
                  Runs are logged each time an orchestration agent executes an operation — goal planning, conflict detection, weekly reviews, and AlloyDB analytics queries.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visible.map((run) => (
                  <AgentRunCard key={run.id} run={run} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </RequireAuth>
  );
}
