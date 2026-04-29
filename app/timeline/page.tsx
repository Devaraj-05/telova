"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Target,
  TrendingUp,
} from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { fetchDashboard, fetchTasks } from "@/lib/workspace/api";
import type { DashboardRead, TaskRead } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

interface CalendarTask {
  id: string;
  title: string;
  durationLabel: string;
  taskType: string;
  date: string;
  status: "pending" | "done";
  details?: string;
  specificTasks?: string[];
  timeLabel?: string;
  startsAt?: string;
  goalId?: string;
  goalTitle?: string;
}

interface GoalMeta {
  id?: string;
  title: string;
  deadline: string | null;
  tasks: CalendarTask[];
}

function parseStoredGoal(): GoalMeta | null {
  try {
    const raw = localStorage.getItem("telova_created_goal");
    if (raw) {
      const parsed = JSON.parse(raw) as GoalMeta;
      return {
        id: parsed.id,
        title: parsed.title,
        deadline: parsed.deadline ?? null,
        tasks: parsed.tasks ?? [],
      };
    }

    const msgs = localStorage.getItem("telova_chat_messages");
    if (!msgs) return null;
    const messages = JSON.parse(msgs) as Array<{ type: string; data?: { summary?: string } }>;
    const syncMsg = messages.find((message) => message.type === "sync_success");
    if (!syncMsg) return null;

    return {
      title: syncMsg.data?.summary ?? "Your Goal",
      deadline: null,
      tasks: [],
    };
  } catch {
    return null;
  }
}

function parseStoredTimelineTasks(): CalendarTask[] {
  try {
    const stored = localStorage.getItem("telova_timeline_tasks");
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as CalendarTask[];
  } catch {
    return [];
  }
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function humanizePhase(phase: string) {
  return phase
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function splitTaskDetails(description: string): string[] {
  return description
    .split(".")
    .map((part) => part.trim())
    .filter((part) => part.length > 4)
    .slice(0, 4);
}

function formatTimeRange(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) {
    return null;
  }

  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })} - ${end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function mapTaskToCalendarTask(task: TaskRead, goalTitle?: string): CalendarTask {
  return {
    id: task.id,
    title: task.title,
    durationLabel: `${Math.max(1, Math.round(task.estimated_minutes / 60))} hr`,
    taskType: humanizePhase(task.phase),
    date:
      task.scheduled_start?.slice(0, 10) ??
      new Date().toISOString().slice(0, 10),
    status: task.status === "done" ? "done" : "pending",
    details: task.description,
    specificTasks: splitTaskDetails(task.description),
    timeLabel: formatTimeRange(task.scheduled_start, task.scheduled_end) ?? undefined,
    startsAt: task.scheduled_start ?? undefined,
    goalId: task.goal_id,
    goalTitle,
  };
}

function buildGoalMeta(
  dashboard: DashboardRead | null,
  tasks: CalendarTask[],
  fallback: GoalMeta | null,
): GoalMeta | null {
  const activeGoal = dashboard?.goals?.[0];
  if (activeGoal) {
    return {
      id: activeGoal.id,
      title: activeGoal.title,
      deadline: activeGoal.deadline,
      tasks,
    };
  }

  if (fallback) {
    return {
      ...fallback,
      tasks: tasks.length > 0 ? tasks : fallback.tasks,
    };
  }

  if (tasks.length > 0) {
    return {
      title: tasks[0].goalTitle ?? "Your Goal",
      deadline: null,
      tasks,
    };
  }

  return null;
}

export default function TimelinePage() {
  const { user, logout } = useAuth();
  const [goalMeta, setGoalMeta] = useState<GoalMeta | null>(null);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week">("month");

  useEffect(() => {
    const fallbackGoal = parseStoredGoal();
    const fallbackTasks = parseStoredTimelineTasks();
    const today = new Date();
    const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

    setGoalMeta(fallbackGoal);
    setTasks(fallbackTasks);
    setSelectedDate(fallbackTasks[0]?.date ?? todayStr);

    if (!user?.id) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [dashboard, backendTasks] = await Promise.all([
          fetchDashboard(user.id),
          fetchTasks(user.id),
        ]);

        if (cancelled) {
          return;
        }

        const goalTitleById = new Map(
          dashboard.goals.map((goal) => [goal.id, goal.title]),
        );
        const scheduledTasks = backendTasks
          .filter((task) => Boolean(task.scheduled_start))
          .sort((left, right) =>
            (left.scheduled_start ?? "").localeCompare(right.scheduled_start ?? ""),
          )
          .map((task) => mapTaskToCalendarTask(task, goalTitleById.get(task.goal_id)));

        const nextTasks = scheduledTasks.length > 0 ? scheduledTasks : fallbackTasks;
        setTasks(nextTasks);
        setGoalMeta(buildGoalMeta(dashboard, nextTasks, fallbackGoal));
        setSelectedDate((current) =>
          current && nextTasks.some((task) => task.date === current)
            ? current
            : nextTasks[0]?.date ?? current ?? todayStr,
        );
      } catch {
        if (!cancelled) {
          setGoalMeta(buildGoalMeta(null, fallbackTasks, fallbackGoal));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  // Week view: compute Mon–Sun of the week containing viewDate
  const getWeekDays = (anchor: Date): Date[] => {
    const day = anchor.getDay(); // 0=Sun
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() - ((day + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  };
  const weekDays = getWeekDays(viewDate);
  const prevWeek = () => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() - 7);
    setViewDate(d);
  };
  const nextWeek = () => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + 7);
    setViewDate(d);
  };
  const weekLabel = `${weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const tasksByDate: Record<string, CalendarTask[]> = {};
  for (const task of tasks) {
    const dateKey = task.date?.slice(0, 10);
    if (!dateKey) {
      continue;
    }
    tasksByDate[dateKey] = tasksByDate[dateKey] ?? [];
    tasksByDate[dateKey].push(task);
  }

  Object.values(tasksByDate).forEach((items) => {
    items.sort((left, right) => (left.startsAt ?? "").localeCompare(right.startsAt ?? ""));
  });

  const selectedTasks = selectedDate ? (tasksByDate[selectedDate] ?? []) : [];
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const cells: Array<{ day: number | null; dateStr: string | null }> = [];
  for (let index = 0; index < firstDay; index += 1) {
    cells.push({ day: null, dateStr: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, dateStr: toDateStr(year, month, day) });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, dateStr: null });
  }

  const hasTasks = tasks.length > 0;

  return (
    <RequireAuth>
      <div className="flex min-h-screen bg-canvas text-text">
        <div className="hidden xl:block">
          <WorkspaceSidebar
            activeItem="timeline"
            userName={user?.display_name}
            userEmail={user?.email}
            onLogout={logout}
          />
        </div>

        <main className="flex min-h-screen flex-1 flex-col overflow-hidden">
          {/* ── Header ── */}
          <header className="shrink-0 border-b border-border">
            <div className="flex h-[72px] items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <CalendarRange className="size-5 text-brand" />
                <div>
                  <h1 className="text-xl font-semibold text-text">Timeline</h1>
                  {goalMeta && (
                    <p className="text-xs text-muted line-clamp-1 max-w-xs">{goalMeta.title}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-border bg-card/60 p-1">
                <button
                  type="button"
                  onClick={() => setView("month")}
                  className={cn(
                    "rounded-lg px-4 py-1.5 text-xs font-semibold transition",
                    view === "month" ? "bg-brand text-white shadow-sm" : "text-muted hover:text-text",
                  )}
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setView("week")}
                  className={cn(
                    "rounded-lg px-4 py-1.5 text-xs font-semibold transition",
                    view === "week" ? "bg-brand text-white shadow-sm" : "text-muted hover:text-text",
                  )}
                >
                  Week
                </button>
              </div>
            </div>

            {/* Stats strip */}
            {hasTasks && (
              <div className="flex items-center gap-6 border-t border-border/60 bg-card/30 px-6 py-2.5">
                {[
                  {
                    icon: Target,
                    label: "Total tasks",
                    value: tasks.length,
                    color: "text-brand",
                  },
                  {
                    icon: CheckCircle2,
                    label: "Completed",
                    value: tasks.filter(t => t.status === "done").length,
                    color: "text-success",
                  },
                  {
                    icon: Clock,
                    label: "Pending",
                    value: tasks.filter(t => t.status !== "done").length,
                    color: "text-warning",
                  },
                  {
                    icon: TrendingUp,
                    label: "Progress",
                    value: `${tasks.length > 0 ? Math.round((tasks.filter(t => t.status === "done").length / tasks.length) * 100) : 0}%`,
                    color: "text-violet-400",
                  },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <Icon className={cn("size-3.5", color)} />
                    <span className="text-xs text-muted">{label}:</span>
                    <span className={cn("text-xs font-semibold", color)}>{value}</span>
                  </div>
                ))}
                {goalMeta?.deadline && (
                  <div className="ml-auto flex items-center gap-1.5 text-xs text-muted">
                    <Clock className="size-3" />
                    Deadline: {new Date(goalMeta.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                )}
              </div>
            )}
          </header>

          <div className="flex min-h-0 flex-1">
            <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={view === "week" ? prevWeek : prevMonth}
                  className="rounded-xl border border-border p-2 text-muted transition hover:text-text"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <h2 className="text-base font-semibold text-text">
                  {view === "week" ? weekLabel : `${MONTH_NAMES[month]} ${year}`}
                </h2>
                <button
                  type="button"
                  onClick={view === "week" ? nextWeek : nextMonth}
                  className="rounded-xl border border-border p-2 text-muted transition hover:text-text"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              {view === "month" ? (
                <>
                  <div className="mb-2 grid grid-cols-7 gap-1">
                    {DAY_NAMES.map((dayName) => (
                      <div
                        key={dayName}
                        className="py-1 text-center text-xs font-semibold uppercase tracking-wide text-muted"
                      >
                        {dayName}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((cell, index) => {
                      if (!cell.day || !cell.dateStr) {
                        return <div key={index} className="h-20 rounded-xl" />;
                      }
                      const cellTasks = tasksByDate[cell.dateStr] ?? [];
                      const isToday = cell.dateStr === todayStr;
                      const isSelected = cell.dateStr === selectedDate;
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setSelectedDate(cell.dateStr)}
                          className={`relative flex h-20 flex-col rounded-xl border p-2 text-left transition ${
                            isSelected
                              ? "border-brand bg-brand/10"
                              : isToday
                              ? "border-brand/40 bg-brandSoft/30"
                              : "border-border bg-white/[0.02] hover:bg-white/[0.05]"
                          }`}
                        >
                          <span
                            className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                              isToday ? "bg-brand text-white" : isSelected ? "text-brand" : "text-text"
                            }`}
                          >
                            {cell.day}
                          </span>
                          <div className="mt-1 space-y-0.5 overflow-hidden">
                            {cellTasks.slice(0, 2).map((task) => (
                              <div
                                key={task.id}
                                className="truncate rounded-md bg-brand/20 px-1 py-0.5 text-[10px] font-medium text-brand"
                              >
                                {task.title}
                              </div>
                            ))}
                            {cellTasks.length > 2 && (
                              <div className="text-[10px] text-muted">+{cellTasks.length - 2} more</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                // ── Week view ──────────────────────────────────────────
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((weekDay) => {
                    const dateStr = toDateStr(weekDay.getFullYear(), weekDay.getMonth(), weekDay.getDate());
                    const dayTasks = tasksByDate[dateStr] ?? [];
                    const isToday = dateStr === todayStr;
                    const isSelected = dateStr === selectedDate;
                    return (
                      <div key={dateStr} className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedDate(dateStr)}
                          className={`flex flex-col items-center rounded-xl border px-1 py-2 text-xs font-semibold transition ${
                            isSelected
                              ? "border-brand bg-brand/10 text-brand"
                              : isToday
                              ? "border-brand/40 text-brand"
                              : "border-transparent text-muted hover:border-border hover:text-text"
                          }`}
                        >
                          <span className="uppercase tracking-wide opacity-60">
                            {DAY_NAMES[weekDay.getDay()]}
                          </span>
                          <span
                            className={`mt-1 inline-flex size-7 items-center justify-center rounded-full text-sm ${
                              isToday ? "bg-brand text-white" : ""
                            }`}
                          >
                            {weekDay.getDate()}
                          </span>
                        </button>
                        <div className="flex flex-col gap-1 overflow-hidden">
                          {dayTasks.slice(0, 6).map((task) => (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => setSelectedDate(dateStr)}
                              className={`w-full truncate rounded-lg px-2 py-1 text-left text-[10px] font-medium transition ${
                                task.status === "done"
                                  ? "bg-emerald-500/10 text-emerald-400 line-through"
                                  : "bg-brand/15 text-brand hover:bg-brand/25"
                              }`}
                            >
                              {task.timeLabel && (
                                <span className="mr-1 opacity-60">{task.timeLabel.split(" - ")[0]}</span>
                              )}
                              {task.title}
                            </button>
                          ))}
                          {dayTasks.length > 6 && (
                            <p className="px-1 text-[10px] text-muted">+{dayTasks.length - 6} more</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!hasTasks && (
                <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
                  <CalendarRange className="mx-auto size-8 text-muted/40" />
                  <p className="mt-3 text-sm font-semibold text-text">No tasks scheduled yet</p>
                  <p className="mt-1 text-xs text-muted">
                    Complete the goal setup in the Workspace to populate your calendar.
                  </p>
                  <Link
                    href="/workspace"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90"
                  >
                    Go to Workspace
                  </Link>
                </div>
              )}
            </div>

            {/* ── Day detail panel ── */}
            <div className="hidden w-80 shrink-0 border-l border-border lg:flex lg:flex-col xl:w-96">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <p className="text-sm font-semibold text-text">
                  {selectedDate
                    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
                        weekday: "long", month: "long", day: "numeric",
                      })
                    : "Select a day"}
                </p>
                {selectedTasks.length > 0 && (
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">
                    {selectedTasks.length} task{selectedTasks.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-auto p-4">
                {selectedTasks.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <Circle className="size-8 text-muted/20" />
                    <p className="text-xs text-muted">No tasks on this day</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedTasks.map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          "rounded-xl border p-4 transition",
                          task.status === "done"
                            ? "border-success/20 bg-success/5"
                            : "border-border bg-card/60 hover:border-brand/25",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className={cn(
                              "text-sm font-semibold leading-snug",
                              task.status === "done" ? "text-muted line-through" : "text-text",
                            )}>
                              {task.title}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                                {task.taskType}
                              </span>
                              <span className="text-[10px] text-muted">{task.durationLabel}</span>
                              {task.timeLabel && (
                                <span className="flex items-center gap-1 text-[10px] text-muted">
                                  <Clock className="size-2.5" /> {task.timeLabel}
                                </span>
                              )}
                            </div>
                          </div>
                          {task.status === "done" ? (
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                          ) : (
                            <Circle className="mt-0.5 size-4 shrink-0 text-muted/30" />
                          )}
                        </div>

                        {task.specificTasks && task.specificTasks.length > 0 && (
                          <ul className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
                            {task.specificTasks.map((item, index) => (
                              <li
                                key={`${task.id}-${index}`}
                                className="flex items-start gap-2 text-xs text-muted"
                              >
                                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand/50" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {goalMeta && (
                <div className="shrink-0 border-t border-border bg-card/40 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Active Goal</p>
                  <p className="mt-1.5 line-clamp-2 text-sm font-medium text-text">{goalMeta.title}</p>
                  {goalMeta.deadline && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                      <Clock className="size-3" />
                      Deadline: {new Date(goalMeta.deadline).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </RequireAuth>
  );
}
