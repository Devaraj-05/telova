"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { fetchDashboard, fetchAgentRuns } from "@/lib/workspace/api";
import type { DashboardRead, AgentRunRead } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";
import {
  Target, CheckCircle2, Clock, CalendarIcon, Loader2,
  NotebookPen, TrendingUp, Bot, ArrowRight, Circle,
  CheckCheck, BarChart3, Zap, Flame, Plus,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function greet(name: string) {
  const h = new Date().getHours();
  const prefix = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${prefix}, ${name?.split(" ")[0] ?? "there"}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function timeUntil(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  if (diff < 0) return "Overdue";
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return `${Math.round(diff / 86400)}d`;
}

// ─── sub-components ──────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 52, stroke = 4 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(111,124,255,0.12)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="#6f7cff" strokeWidth={stroke}
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any; label: string; value: string | number; sub?: string; accent: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card/80 p-5">
      <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", accent)}>
        <Icon className="size-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-text">{value}</p>
        <p className="text-xs text-muted">{label}</p>
        {sub && <p className="mt-0.5 text-[10px] text-muted/60">{sub}</p>}
      </div>
    </div>
  );
}

function TaskStatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="size-4 shrink-0 text-success" />;
  if (status === "in_progress") return <Circle className="size-4 shrink-0 fill-brand/20 text-brand" />;
  return <Circle className="size-4 shrink-0 text-muted" />;
}

function UrgencyBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) return null;
  const days = Math.round((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (days < 7) return (
    <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-semibold text-danger">Urgent</span>
  );
  if (days < 30) return (
    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">Soon</span>
  );
  return null;
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardRead | null>(null);
  const [agentRuns, setAgentRuns] = useState<AgentRunRead[]>([]);
  const [loading, setLoading] = useState(true);

  const todayLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([fetchDashboard(user.id), fetchAgentRuns(user.id, 5)])
      .then(([dash, runs]) => { setDashboard(dash); setAgentRuns(runs); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const totalTasks = dashboard?.recent_tasks.length ?? 0;
  const completedTasks = dashboard?.recent_tasks.filter(t => t.status === "completed").length ?? 0;
  const pendingTasks = totalTasks - completedTasks;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const todayStr = new Date().toDateString();
  const todayTasks = dashboard?.recent_tasks.filter(
    t => t.scheduled_start && new Date(t.scheduled_start).toDateString() === todayStr,
  ) ?? [];

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-text">
      <div className="hidden md:block">
        <WorkspaceSidebar
          activeItem="dashboard"
          userName={user?.display_name}
          userEmail={user?.email}
          onLogout={logout}
        />
      </div>

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* ── Header ── */}
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-border px-8">
          <div>
            <h1 className="text-xl font-semibold text-text">{greet(user?.display_name ?? "")}</h1>
            <p className="mt-0.5 text-xs text-muted">{todayLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/workspace"
              className="flex items-center gap-2 rounded-xl border border-brand bg-brand/10 px-4 py-2 text-sm font-medium text-brand transition hover:bg-brand hover:text-white"
            >
              <Plus className="size-4" /> New Goal
            </Link>
            <Link
              href="/analytics"
              className="rounded-xl border border-border bg-card p-2.5 text-muted transition hover:bg-white/5 hover:text-text"
              title="Analytics"
            >
              <BarChart3 className="size-4" />
            </Link>
          </div>
        </header>

        {/* ── Body ── */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-brand" />
          </div>
        ) : !dashboard ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted">Failed to load dashboard.</p>
          </div>
        ) : (
          <div className="space-y-6 p-6 max-w-[1400px]">

            {/* ── Stats row ── */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard icon={Target} label="Active Goals" value={dashboard.goals.length} accent="bg-brand" />
              <StatCard icon={CheckCheck} label="Completed" value={completedTasks} sub={`of ${totalTasks} tasks`} accent="bg-success" />
              <StatCard icon={Clock} label="Pending" value={pendingTasks} accent="bg-warning" />
              <StatCard icon={TrendingUp} label="Completion Rate" value={`${completionRate}%`} accent="bg-purple-600" />
            </div>

            {/* ── Main grid ── */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

              {/* ── LEFT col (2/3) ── */}
              <div className="space-y-6 xl:col-span-2">

                {/* Active Goals */}
                <section className="rounded-2xl border border-border bg-card/80 p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-text">
                      <Target className="size-4 text-brand" /> Active Goals
                    </h2>
                    <Link href="/workspace" className="flex items-center gap-1 text-xs text-brand hover:underline">
                      Add goal <ArrowRight className="size-3" />
                    </Link>
                  </div>

                  {dashboard.goals.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-center">
                      <Target className="mb-3 size-10 text-muted/30" />
                      <p className="text-sm text-muted">No active goals yet.</p>
                      <Link href="/workspace" className="mt-3 text-xs text-brand hover:underline">
                        Create your first goal →
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dashboard.goals.map((goal: any) => {
                        const pct = Math.round((goal.progress ?? 0) * 100);
                        return (
                          <div
                            key={goal.id}
                            className="flex items-center gap-4 rounded-xl border border-border bg-panel/60 p-4 transition hover:border-brand/30"
                          >
                            {/* Ring */}
                            <div className="relative flex shrink-0 items-center justify-center">
                              <ProgressRing pct={pct} size={52} stroke={4} />
                              <span className="absolute text-[10px] font-bold text-text">{pct}%</span>
                            </div>

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-sm font-semibold text-text">{goal.title}</h3>
                                <UrgencyBadge deadline={goal.deadline} />
                              </div>
                              {goal.description && (
                                <p className="mt-0.5 line-clamp-1 text-xs text-muted">{goal.description}</p>
                              )}
                              <div className="mt-2 flex items-center gap-3">
                                {goal.deadline && (
                                  <span className="flex items-center gap-1 text-[10px] text-muted">
                                    <CalendarIcon className="size-3" /> {fmtDate(goal.deadline)}
                                  </span>
                                )}
                                <span className="flex items-center gap-1 text-[10px] capitalize text-muted">
                                  <Zap className="size-3" /> {goal.domain ?? "General"}
                                </span>
                              </div>
                            </div>

                            {/* Bar + status */}
                            <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-border">
                                <div
                                  className="h-full rounded-full bg-brand transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] capitalize text-muted">{goal.status}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Today's Focus — only shown when there are tasks scheduled today */}
                {todayTasks.length > 0 && (
                  <section className="rounded-2xl border border-brand/25 bg-brand/5 p-6">
                    <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-text">
                      <Flame className="size-4 text-brand" /> Today's Focus
                      <span className="ml-auto rounded-full bg-brand/20 px-2.5 py-0.5 text-xs font-semibold text-brand">
                        {todayTasks.length}
                      </span>
                    </h2>
                    <div className="space-y-2">
                      {todayTasks.map((task: any) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 rounded-xl border border-border/60 bg-panel/80 p-3"
                        >
                          <TaskStatusIcon status={task.status} />
                          <p className={cn(
                            "flex-1 truncate text-sm font-medium",
                            task.status === "completed" ? "text-muted line-through" : "text-text",
                          )}>
                            {task.title}
                          </p>
                          {task.scheduled_start && (
                            <span className="shrink-0 text-[10px] text-muted">{fmtDateTime(task.scheduled_start)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Upcoming Tasks */}
                <section className="rounded-2xl border border-border bg-card/80 p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-text">
                      <CheckCircle2 className="size-4 text-brand" /> Upcoming Tasks
                    </h2>
                    <Link href="/timeline" className="flex items-center gap-1 text-xs text-brand hover:underline">
                      Full timeline <ArrowRight className="size-3" />
                    </Link>
                  </div>

                  {dashboard.recent_tasks.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted">No tasks yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {dashboard.recent_tasks.slice(0, 8).map((task: any) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 rounded-xl border border-border/60 bg-panel/50 px-4 py-3 transition hover:border-brand/20"
                        >
                          <TaskStatusIcon status={task.status} />
                          <div className="min-w-0 flex-1">
                            <p className={cn(
                              "truncate text-sm font-medium",
                              task.status === "completed" ? "text-muted line-through" : "text-text",
                            )}>
                              {task.title}
                            </p>
                            {task.scheduled_start && (
                              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
                                <Clock className="size-3" /> {fmtDateTime(task.scheduled_start)}
                              </p>
                            )}
                          </div>
                          {task.scheduled_start && task.status !== "completed" && (
                            <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                              {timeUntil(task.scheduled_start)}
                            </span>
                          )}
                          {task.status === "completed" && (
                            <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                              Done
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* ── RIGHT col (1/3) ── */}
              <div className="space-y-6">

                {/* Calendar Events */}
                <section className="rounded-2xl border border-border bg-card/80 p-5">
                  <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-text">
                    <CalendarIcon className="size-4 text-brand" /> Calendar Events
                  </h2>
                  {dashboard.upcoming_events.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted">No upcoming events.</p>
                  ) : (
                    <div className="space-y-2">
                      {dashboard.upcoming_events.slice(0, 6).map((event: any) => (
                        <div
                          key={event.id}
                          className="rounded-xl border border-l-2 border-border/60 border-l-brand bg-panel/50 p-3"
                        >
                          <p className="line-clamp-1 text-xs font-medium text-text">{event.title}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
                            <Clock className="size-2.5" /> {fmtDateTime(event.start_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Recent Notes */}
                <section className="rounded-2xl border border-border bg-card/80 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
                      <NotebookPen className="size-4 text-brand" /> Recent Notes
                    </h2>
                  </div>
                  {dashboard.notes.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted">No notes yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {dashboard.notes.slice(0, 4).map((note: any) => (
                        <div key={note.id} className="rounded-xl border border-border/60 bg-panel/50 p-3">
                          <p className="line-clamp-1 text-xs font-semibold text-text">{note.title}</p>
                          {note.content && (
                            <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted">{note.content}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Agent Activity */}
                <section className="rounded-2xl border border-border bg-card/80 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
                      <Bot className="size-4 text-brand" /> Agent Activity
                    </h2>
                    <Link href="/agents" className="text-xs text-brand hover:underline">All →</Link>
                  </div>
                  {agentRuns.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted">No agent runs yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {agentRuns.slice(0, 5).map((run) => (
                        <div key={run.id} className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-panel/50 p-3">
                          <span className={cn(
                            "mt-1.5 size-1.5 shrink-0 rounded-full",
                            run.status === "completed" ? "bg-success" :
                            run.status === "failed" ? "bg-danger" : "animate-pulse bg-brand",
                          )} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium text-text">{run.agent_name}</p>
                            <p className="truncate text-[10px] capitalize text-muted">{run.operation}</p>
                          </div>
                          <span className={cn(
                            "shrink-0 text-[10px] font-semibold capitalize",
                            run.status === "completed" ? "text-success" :
                            run.status === "failed" ? "text-danger" : "text-brand",
                          )}>
                            {run.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Quick Actions */}
                <section className="rounded-2xl border border-border bg-card/80 p-5">
                  <h2 className="mb-4 text-sm font-semibold text-text">Quick Actions</h2>
                  <div className="space-y-2">
                    {[
                      { label: "New Goal", href: "/workspace", icon: Target, color: "text-brand" },
                      { label: "View Timeline", href: "/timeline", icon: CalendarIcon, color: "text-success" },
                      { label: "Analytics", href: "/analytics", icon: BarChart3, color: "text-warning" },
                    ].map(({ label, href, icon: Icon, color }) => (
                      <Link
                        key={label}
                        href={href}
                        className="flex items-center gap-3 rounded-xl border border-border/60 bg-panel/50 px-4 py-3 text-sm font-medium text-text transition hover:border-brand/30 hover:bg-brand/5"
                      >
                        <Icon className={cn("size-4", color)} />
                        {label}
                        <ArrowRight className="ml-auto size-3.5 text-muted" />
                      </Link>
                    ))}
                  </div>
                </section>

              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
