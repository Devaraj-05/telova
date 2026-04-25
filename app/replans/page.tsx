"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCcw, TrendingUp } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { fetchNotes, fetchAgentRuns } from "@/lib/workspace/api";
import type { AgentRunRead, NoteRead } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

interface ReplanEntry {
  id: string;
  type: "weekly_review" | "replan" | "conflict";
  title: string;
  summary: string;
  goalId: string | null;
  timestamp: string;
  deviationPct?: number;
  replanned?: boolean;
  updatedTaskCount?: number;
  agentRunId?: string;
  runtime?: string;
}

function deviationColor(pct: number) {
  if (pct < 10) return "text-emerald-400";
  if (pct < 25) return "text-amber-400";
  return "text-rose-400";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildEntries(notes: NoteRead[], agentRuns: AgentRunRead[]): ReplanEntry[] {
  const reviewRuns = agentRuns.filter(
    (r) => r.operation === "weekly_review" || r.operation === "run_conflict_scan",
  );

  const fromNotes: ReplanEntry[] = notes
    .filter((n) => ["weekly_review", "replan", "conflict"].includes(n.note_type))
    .map((note) => {
      const meta = note.metadata_json as Record<string, unknown>;
      const matchingRun = reviewRuns.find(
        (r) => r.goal_id === note.goal_id && Math.abs(
          new Date(r.started_at).getTime() - new Date(note.created_at).getTime(),
        ) < 60_000,
      );

      return {
        id: note.id,
        type: note.note_type as ReplanEntry["type"],
        title: note.title,
        summary: note.content,
        goalId: note.goal_id,
        timestamp: note.created_at,
        deviationPct: typeof meta.deviation_pct === "number" ? meta.deviation_pct : undefined,
        replanned: typeof meta.replanned === "boolean" ? meta.replanned : undefined,
        updatedTaskCount:
          Array.isArray(meta.updated_task_ids)
            ? (meta.updated_task_ids as unknown[]).length
            : undefined,
        agentRunId: matchingRun?.id,
        runtime: matchingRun?.runtime,
      };
    });

  // Also surface agent runs with output payloads that carry review summaries but no note yet
  const coveredRunIds = new Set(fromNotes.map((e) => e.agentRunId).filter(Boolean));
  const fromRuns: ReplanEntry[] = reviewRuns
    .filter((r) => !coveredRunIds.has(r.id))
    .map((r) => {
      const out = r.output_payload as Record<string, unknown>;
      const summary =
        typeof out.summary === "string"
          ? out.summary
          : typeof out.detail === "string"
          ? out.detail
          : r.operation;

      return {
        id: r.id,
        type: r.operation === "run_conflict_scan" ? "conflict" : "weekly_review",
        title: r.operation === "run_conflict_scan" ? "Conflict Scan" : "Weekly Review",
        summary,
        goalId: r.goal_id,
        timestamp: r.completed_at,
        runtime: r.runtime,
        agentRunId: r.id,
      };
    });

  return [...fromNotes, ...fromRuns].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

const TYPE_CONFIG = {
  weekly_review: {
    label: "Weekly Review",
    icon: TrendingUp,
    color: "bg-emerald-500/10 text-emerald-400",
    border: "border-l-emerald-500",
  },
  replan: {
    label: "Replan",
    icon: RefreshCcw,
    color: "bg-amber-500/10 text-amber-400",
    border: "border-l-amber-500",
  },
  conflict: {
    label: "Conflict",
    icon: AlertTriangle,
    color: "bg-rose-500/10 text-rose-400",
    border: "border-l-rose-500",
  },
};

export default function ReplansPage() {
  const { user, logout } = useAuth();
  const [entries, setEntries] = useState<ReplanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([fetchNotes(user.id), fetchAgentRuns(user.id, 100)])
      .then(([notes, runs]) => setEntries(buildEntries(notes, runs)))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load replans"))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const types = ["all", ...Array.from(new Set(entries.map((e) => e.type)))];
  const visible = filterType === "all" ? entries : entries.filter((e) => e.type === filterType);

  const replanCount = entries.filter((e) => e.type === "replan").length;
  const conflictCount = entries.filter((e) => e.type === "conflict").length;

  return (
    <RequireAuth>
      <div className="flex h-screen overflow-hidden bg-canvas text-text">
        <div className="hidden md:block">
          <WorkspaceSidebar
            activeItem="replans"
            userName={user?.display_name}
            userEmail={user?.email}
            onLogout={logout}
          />
        </div>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <header className="flex h-[72px] items-center justify-between border-b border-border px-8 shrink-0">
            <div className="flex items-center gap-3">
              <RefreshCcw className="size-5 text-brand" />
              <h1 className="text-2xl font-semibold text-text">Replans</h1>
            </div>
            {!loading && entries.length > 0 && (
              <div className="flex items-center gap-4 text-sm text-muted">
                {replanCount > 0 && (
                  <span className="text-amber-400">{replanCount} replan{replanCount !== 1 ? "s" : ""}</span>
                )}
                {conflictCount > 0 && (
                  <span className="text-rose-400">{conflictCount} conflict{conflictCount !== 1 ? "s" : ""}</span>
                )}
                <span>{entries.length} total</span>
              </div>
            )}
          </header>

          <div className="p-8 max-w-5xl">
            {/* Filter pills */}
            {!loading && entries.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-2">
                {types.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilterType(t)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition",
                      filterType === t
                        ? "bg-brand text-white"
                        : "bg-white/5 text-muted hover:bg-white/10 hover:text-text",
                    )}
                  >
                    {t === "all" ? "All" : TYPE_CONFIG[t as ReplanEntry["type"]]?.label ?? t}
                    {t !== "all" && (
                      <span className="ml-1.5 opacity-60">
                        {entries.filter((e) => e.type === t).length}
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
                <RefreshCcw className="size-10 opacity-30" />
                <p className="text-base font-medium">No replan history yet</p>
                <p className="text-sm opacity-60 max-w-md">
                  Replans, weekly reviews, and conflict resolutions appear here automatically as the orchestration agents evaluate your goals against your calendar and progress.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visible.map((entry) => {
                  const cfg = TYPE_CONFIG[entry.type] ?? TYPE_CONFIG.replan;
                  const Icon = cfg.icon;

                  return (
                    <article
                      key={entry.id}
                      className={cn(
                        "rounded-[20px] border border-border bg-panel p-5 shadow-sm border-l-4",
                        cfg.border,
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("mt-0.5 shrink-0 rounded-xl p-2", cfg.color)}>
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="font-semibold text-text">{entry.title}</h3>
                            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", cfg.color)}>
                              {cfg.label}
                            </span>
                            {entry.replanned === true && (
                              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
                                <RefreshCcw className="size-2.5" />
                                Replanned
                              </span>
                            )}
                            {entry.replanned === false && (
                              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                                <CheckCircle2 className="size-2.5" />
                                On track
                              </span>
                            )}
                          </div>

                          {entry.summary && (
                            <p className="mt-2 text-sm text-muted leading-relaxed line-clamp-4 whitespace-pre-wrap">
                              {entry.summary}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted/60">
                            <time>{formatDate(entry.timestamp)}</time>
                            {entry.deviationPct !== undefined && (
                              <span className={cn("font-semibold", deviationColor(entry.deviationPct))}>
                                {entry.deviationPct.toFixed(1)}% deviation
                              </span>
                            )}
                            {entry.updatedTaskCount !== undefined && (
                              <span>{entry.updatedTaskCount} task{entry.updatedTaskCount !== 1 ? "s" : ""} updated</span>
                            )}
                            {entry.runtime && (
                              <span className="opacity-50">{entry.runtime}</span>
                            )}
                            {entry.goalId && (
                              <span className="truncate">Goal: {entry.goalId}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </RequireAuth>
  );
}
