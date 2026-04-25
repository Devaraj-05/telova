"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, NotebookPen, Tag } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { fetchNotes } from "@/lib/workspace/api";
import type { NoteRead } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

const NOTE_TYPE_LABELS: Record<string, string> = {
  manual: "Manual",
  context_package: "Context Package",
  weekly_review: "Weekly Review",
  replan: "Replan",
  goal_switch: "Goal Switch",
  conflict: "Conflict",
};

const NOTE_TYPE_COLORS: Record<string, string> = {
  manual: "bg-brand/10 text-brand",
  context_package: "bg-violet-500/10 text-violet-400",
  weekly_review: "bg-emerald-500/10 text-emerald-400",
  replan: "bg-amber-500/10 text-amber-400",
  goal_switch: "bg-sky-500/10 text-sky-400",
  conflict: "bg-rose-500/10 text-rose-400",
};

function noteTypeLabel(type: string) {
  return NOTE_TYPE_LABELS[type] ?? type;
}

function noteTypeColor(type: string) {
  return NOTE_TYPE_COLORS[type] ?? "bg-white/5 text-muted";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotesPage() {
  const { user, logout } = useAuth();
  const [notes, setNotes] = useState<NoteRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    fetchNotes(user.id)
      .then(setNotes)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load notes"))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const types = ["all", ...Array.from(new Set(notes.map((n) => n.note_type)))];
  const visible = filterType === "all" ? notes : notes.filter((n) => n.note_type === filterType);

  return (
    <RequireAuth>
      <div className="flex h-screen overflow-hidden bg-canvas text-text">
        <div className="hidden md:block">
          <WorkspaceSidebar
            activeItem="notes"
            userName={user?.display_name}
            userEmail={user?.email}
            onLogout={logout}
          />
        </div>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <header className="flex h-[72px] items-center justify-between border-b border-border px-8 shrink-0">
            <div className="flex items-center gap-3">
              <NotebookPen className="size-5 text-brand" />
              <h1 className="text-2xl font-semibold text-text">Notes</h1>
            </div>
            {!loading && (
              <span className="text-sm text-muted">{notes.length} note{notes.length !== 1 ? "s" : ""}</span>
            )}
          </header>

          <div className="p-8 max-w-5xl">
            {/* Type filter pills */}
            {!loading && notes.length > 0 && (
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
                    {t === "all" ? "All" : noteTypeLabel(t)}
                    {t !== "all" && (
                      <span className="ml-1.5 opacity-60">
                        {notes.filter((n) => n.note_type === t).length}
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
                <FileText className="size-10 opacity-30" />
                <p className="text-base font-medium">
                  {filterType === "all" ? "No notes yet" : `No ${noteTypeLabel(filterType)} notes`}
                </p>
                <p className="text-sm opacity-60">
                  Notes are created automatically as you work with goals, run weekly reviews, and resolve conflicts.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visible.map((note) => (
                  <article
                    key={note.id}
                    className="rounded-[20px] border border-border bg-panel p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-text truncate">{note.title}</h3>
                          <span
                            className={cn(
                              "shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                              noteTypeColor(note.note_type),
                            )}
                          >
                            <Tag className="size-2.5" />
                            {noteTypeLabel(note.note_type)}
                          </span>
                        </div>
                        {note.content && (
                          <p className="mt-2 text-sm text-muted leading-relaxed whitespace-pre-wrap line-clamp-4">
                            {note.content}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted/60">
                      <time>{formatDate(note.created_at)}</time>
                      {note.goal_id && (
                        <span className="truncate">Goal: {note.goal_id}</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </RequireAuth>
  );
}
