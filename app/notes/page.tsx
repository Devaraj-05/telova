"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, NotebookPen, Tag, Search } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { fetchNotes } from "@/lib/workspace/api";
import type { NoteRead } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

const NOTE_META: Record<string, { label: string; color: string; accent: string }> = {
  manual:          { label: "Manual",          color: "bg-brand/10 text-brand",          accent: "bg-brand" },
  context_package: { label: "Context",         color: "bg-violet-500/10 text-violet-400", accent: "bg-violet-500" },
  weekly_review:   { label: "Weekly Review",   color: "bg-emerald-500/10 text-emerald-400", accent: "bg-emerald-500" },
  replan:          { label: "Replan",          color: "bg-amber-500/10 text-amber-400",   accent: "bg-amber-500" },
  goal_switch:     { label: "Goal Switch",     color: "bg-sky-500/10 text-sky-400",       accent: "bg-sky-500" },
  conflict:        { label: "Conflict",        color: "bg-rose-500/10 text-rose-400",     accent: "bg-rose-500" },
};

function noteMeta(type: string) {
  return NOTE_META[type] ?? { label: type, color: "bg-white/5 text-muted", accent: "bg-muted" };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function NotesPage() {
  const { user, logout } = useAuth();
  const [notes, setNotes] = useState<NoteRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    fetchNotes(user.id)
      .then(setNotes)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load notes"))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const types = ["all", ...Array.from(new Set(notes.map((n) => n.note_type)))];

  const visible = notes.filter((n) => {
    if (filterType !== "all" && n.note_type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q);
    }
    return true;
  });

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
          {/* ── Header ── */}
          <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-border px-8">
            <div className="flex items-center gap-3">
              <NotebookPen className="size-5 text-brand" />
              <h1 className="text-xl font-semibold text-text">Notes</h1>
              {!loading && (
                <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                  {notes.length}
                </span>
              )}
            </div>

            {/* Search */}
            {!loading && notes.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card/80 px-3 py-2 text-sm focus-within:border-brand/40 transition w-56">
                <Search className="size-3.5 text-muted shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notes…"
                  className="flex-1 bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
                />
              </div>
            )}
          </header>

          <div className="p-8 max-w-6xl">
            {/* ── Type filters ── */}
            {!loading && notes.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-2">
                {types.map((t) => {
                  const count = t === "all" ? notes.length : notes.filter((n) => n.note_type === t).length;
                  const meta = noteMeta(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFilterType(t)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                        filterType === t
                          ? "bg-brand text-white"
                          : "bg-white/5 text-muted hover:bg-white/10 hover:text-text",
                      )}
                    >
                      {t !== "all" && (
                        <span className={cn("size-1.5 rounded-full", meta.accent)} />
                      )}
                      {t === "all" ? "All" : meta.label}
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                        filterType === t ? "bg-white/20" : "bg-white/10",
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Content ── */}
            {loading ? (
              <div className="flex items-center justify-center p-16">
                <Loader2 className="size-6 animate-spin text-brand" />
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-danger/20 bg-danger/5 p-6 text-sm text-danger/90">
                {error}
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <FileText className="size-10 text-muted/30" />
                <p className="text-base font-semibold text-muted">
                  {search ? "No notes match your search" : filterType === "all" ? "No notes yet" : `No ${noteMeta(filterType).label} notes`}
                </p>
                <p className="max-w-sm text-sm text-muted/60">
                  {!search && "Notes are created automatically as you work with goals, weekly reviews, and conflict scans."}
                </p>
              </div>
            ) : (
              <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
                {visible.map((note) => {
                  const meta = noteMeta(note.note_type);
                  return (
                    <article
                      key={note.id}
                      className="mb-4 break-inside-avoid rounded-2xl border border-border bg-card/80 overflow-hidden transition hover:border-brand/30"
                    >
                      {/* Accent top bar */}
                      <div className={cn("h-1 w-full", meta.accent)} />

                      <div className="p-5">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold leading-snug text-text">{note.title}</h3>
                          </div>
                          <span className={cn(
                            "shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            meta.color,
                          )}>
                            <Tag className="size-2.5" />
                            {meta.label}
                          </span>
                        </div>

                        {note.content && (
                          <p className="mt-2.5 text-xs leading-relaxed text-muted line-clamp-6 whitespace-pre-wrap">
                            {note.content}
                          </p>
                        )}

                        <div className="mt-4 flex items-center gap-3 border-t border-border/60 pt-3 text-[10px] text-muted/50">
                          <time>{fmtDate(note.created_at)}</time>
                          {note.goal_id && (
                            <span className="ml-auto truncate">Goal linked</span>
                          )}
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
