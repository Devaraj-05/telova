"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Code2,
  Database,
  Loader2,
  Send,
  Sparkles,
  Zap,
} from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { analyticsQuery } from "@/lib/workspace/api";
import type { AnalyticsQueryResponse } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

const SUGGESTED_QUESTIONS = [
  "Which goal has the highest deviation from plan?",
  "What tasks are overdue right now?",
  "Show me my schedule for today",
  "What tasks are currently blocked?",
  "Which goals are at risk of missing their deadline?",
  "What did I complete in the last 7 days?",
  "What's scheduled for tomorrow?",
];

const EXECUTION_MODE_STYLES: Record<string, { label: string; color: string }> = {
  vertex_gemini_nl_sql: {
    label: "Gemini NL→SQL",
    color: "bg-brand/10 text-brand border border-brand/20",
  },
  alloydb_ai_nl: {
    label: "AlloyDB AI",
    color: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
  },
  deterministic_sql: {
    label: "Deterministic SQL",
    color: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  },
};

function ExecutionBadge({ mode }: { mode: string }) {
  const style = EXECUTION_MODE_STYLES[mode] ?? {
    label: mode,
    color: "bg-white/5 text-muted border border-border",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", style.color)}>
      {style.label}
    </span>
  );
}

function SqlBlock({ sql }: { sql: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-text transition"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <Code2 className="size-3" />
        Generated SQL
      </button>
      {open && (
        <pre className="mt-2 overflow-x-auto rounded-xl bg-black/30 p-4 text-xs text-emerald-300 leading-relaxed">
          {sql}
        </pre>
      )}
    </div>
  );
}

function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0]);

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-white/[0.03]">
            {columns.map((col) => (
              <th
                key={col}
                className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted"
              >
                {col.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={cn(
                "border-b border-border/50 transition",
                i % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]",
                "hover:bg-white/[0.04]",
              )}
            >
              {columns.map((col) => {
                const val = row[col];
                const display =
                  val === null || val === undefined
                    ? "—"
                    : typeof val === "object"
                    ? JSON.stringify(val)
                    : String(val);
                return (
                  <td key={col} className="px-4 py-3 text-text/80">
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface QueryResultCardProps {
  result: AnalyticsQueryResponse;
  index: number;
}

function QueryResultCard({ result, index }: QueryResultCardProps) {
  return (
    <article className="rounded-[20px] border border-border bg-panel shadow-sm">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-xs font-bold text-brand mt-0.5">
              {index + 1}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-muted">Q: {result.question}</p>
              <p className="mt-1.5 text-text leading-relaxed">{result.summary}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ExecutionBadge mode={result.execution_mode} />
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-muted">
              {result.row_count} row{result.row_count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {result.fallback_reason && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/5 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-400">
            <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
            <span>AI generation failed — using fallback SQL. Reason: {result.fallback_reason}</span>
          </div>
        )}

        {result.source_objects.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Database className="size-3 text-muted" />
            {result.source_objects.map((obj) => (
              <span
                key={obj}
                className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-muted/70 font-mono"
              >
                {obj}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4">
          <SqlBlock sql={result.generated_sql} />
        </div>
      </div>

      {result.rows.length > 0 && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          <ResultTable rows={result.rows} />
        </div>
      )}
    </article>
  );
}

export default function AnalyticsPage() {
  const { user, logout } = useAuth();
  const [question, setQuestion] = useState("");
  const [results, setResults] = useState<AnalyticsQueryResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const submit = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || !user?.id || loading) return;
    setError(null);
    setLoading(true);
    try {
      const result = await analyticsQuery(user.id, trimmed);
      setResults((prev) => [result, ...prev]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(question);
    }
  };

  return (
    <RequireAuth>
      <div className="flex h-screen overflow-hidden bg-canvas text-text">
        <div className="hidden md:block">
          <WorkspaceSidebar
            activeItem="analytics"
            userName={user?.display_name}
            userEmail={user?.email}
            onLogout={logout}
          />
        </div>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Header */}
          <header className="flex h-[72px] items-center justify-between border-b border-border px-8 shrink-0">
            <div className="flex items-center gap-3">
              <BarChart3 className="size-5 text-brand" />
              <h1 className="text-2xl font-semibold text-text">Analytics</h1>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Sparkles className="size-3.5 text-brand" />
              <span>Powered by Gemini NL→SQL + AlloyDB AI</span>
            </div>
          </header>

          {/* Content area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Results scroll area */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {results.length === 0 && !loading && (
                <div className="flex flex-col items-center gap-6 py-12 text-center">
                  <div className="flex size-16 items-center justify-center rounded-3xl bg-brand/10">
                    <BarChart3 className="size-8 text-brand" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-text">Ask your productivity data anything</p>
                    <p className="mt-1 text-sm text-muted max-w-md">
                      Gemini translates your natural-language questions into SQL, runs them against your
                      goals, tasks, and calendar, and returns structured results.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-w-2xl w-full">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => submit(q)}
                        className="rounded-xl border border-border bg-panel px-4 py-3 text-left text-sm text-muted transition hover:border-brand/30 hover:bg-brand/5 hover:text-text"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-panel p-5 mb-4">
                  <Loader2 className="size-5 animate-spin text-brand shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-text">Generating SQL…</p>
                    <p className="text-xs text-muted">Gemini is translating your question into a secure query</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
                  <AlertCircle className="size-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-rose-400">Query failed</p>
                    <p className="mt-0.5 text-xs text-rose-400/70">{error}</p>
                  </div>
                </div>
              )}

              {results.length > 0 && (
                <div className="space-y-4 max-w-5xl">
                  {results.map((result, i) => (
                    <QueryResultCard key={i} result={result} index={results.length - 1 - i} />
                  ))}
                </div>
              )}
            </div>

            {/* Input bar — pinned to bottom */}
            <div className="shrink-0 border-t border-border bg-panel px-8 py-4">
              <div className="mx-auto max-w-5xl">
                {results.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {SUGGESTED_QUESTIONS.slice(0, 3).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => submit(q)}
                        disabled={loading}
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted transition hover:border-brand/30 hover:text-text disabled:opacity-40"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-3 rounded-2xl border border-border bg-canvas px-4 py-3 focus-within:border-brand/40 transition">
                  <Zap className="size-4 text-muted shrink-0 mb-1" />
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a question about your goals, tasks, or schedule…"
                    className="min-h-[24px] flex-1 resize-none bg-transparent text-sm text-text placeholder:text-muted focus:outline-none leading-6"
                    style={{ maxHeight: "120px" }}
                  />
                  <button
                    type="button"
                    onClick={() => submit(question)}
                    disabled={!question.trim() || loading}
                    className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Run query"
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-center text-[11px] text-muted/50">
                  Enter to send · Shift+Enter for new line · Queries run against your user-scoped secure views
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </RequireAuth>
  );
}
