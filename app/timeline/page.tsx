"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  Clock,
  CheckCircle2,
  Circle,
} from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";

interface CalendarTask {
  id: string;
  title: string;
  durationLabel: string;
  taskType: string;
  date: string; // ISO date
  status: "pending" | "done";
  specificTasks?: string[];
}

interface GoalMeta {
  title: string;
  deadline: string;
  tasks: CalendarTask[];
}

function parseStoredGoal(): GoalMeta | null {
  try {
    const raw = localStorage.getItem("telova_created_goal");
    if (raw) return JSON.parse(raw);

    // Fallback: extract from chat messages
    const msgs = localStorage.getItem("telova_chat_messages");
    if (!msgs) return null;
    const messages = JSON.parse(msgs) as Array<{ type: string; data?: any }>;
    const syncMsg = messages.find((m) => m.type === "sync_success");
    if (!syncMsg) return null;

    return {
      title: syncMsg.data?.summary ?? "Your Goal",
      deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      tasks: [],
    };
  } catch {
    return null;
  }
}

function parseStoredTimelineTasks(): CalendarTask[] {
  try {
    const stored = localStorage.getItem("telova_timeline_tasks");
    if (stored) return JSON.parse(stored);
    return [];
  } catch {
    return [];
  }
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function TimelinePage() {
  const { user, logout } = useAuth();
  const [goalMeta, setGoalMeta] = useState<GoalMeta | null>(null);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week">("month");

  useEffect(() => {
    const meta = parseStoredGoal();
    setGoalMeta(meta);
    const storedTasks = parseStoredTimelineTasks();
    setTasks(storedTasks);
    // default select today
    const today = new Date();
    setSelectedDate(toDateStr(today.getFullYear(), today.getMonth(), today.getDate()));
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month); // 0=Sun

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  // tasks indexed by date string
  const tasksByDate: Record<string, CalendarTask[]> = {};
  for (const task of tasks) {
    const d = task.date?.slice(0, 10);
    if (d) {
      tasksByDate[d] = tasksByDate[d] ?? [];
      tasksByDate[d].push(task);
    }
  }

  const selectedTasks = selectedDate ? (tasksByDate[selectedDate] ?? []) : [];
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  // Build calendar grid (6 rows × 7 cols)
  const cells: Array<{ day: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, dateStr: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateStr: toDateStr(year, month, d) });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, dateStr: null });

  const hasTasks = tasks.length > 0;

  return (
    <RequireAuth>
      <div className="flex min-h-screen bg-canvas text-text">
        {/* Sidebar */}
        <div className="hidden xl:block">
          <WorkspaceSidebar
            activeItem="timeline"
            userName={user?.display_name}
            userEmail={user?.email}
            onLogout={logout}
          />
        </div>

        {/* Main */}
        <main className="flex min-h-screen flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarRange className="size-5 text-brand" />
                <div>
                  <h1 className="text-lg font-semibold text-text">Timeline</h1>
                  {goalMeta && (
                    <p className="text-xs text-muted">{goalMeta.title}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setView("month")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${view === "month" ? "bg-brand text-white" : "text-muted hover:text-text"}`}
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setView("week")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${view === "week" ? "bg-brand text-white" : "text-muted hover:text-text"}`}
                >
                  Week
                </button>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* Calendar Panel */}
            <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
              {/* Month navigation */}
              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="rounded-xl border border-border p-2 text-muted transition hover:text-text"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <h2 className="text-base font-semibold text-text">
                  {MONTH_NAMES[month]} {year}
                </h2>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="rounded-xl border border-border p-2 text-muted transition hover:text-text"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              {/* Day headers */}
              <div className="mb-2 grid grid-cols-7 gap-1">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="py-1 text-center text-xs font-semibold uppercase tracking-wide text-muted">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {cells.map((cell, idx) => {
                  if (!cell.day || !cell.dateStr) {
                    return <div key={idx} className="h-20 rounded-xl" />;
                  }
                  const cellTasks = tasksByDate[cell.dateStr] ?? [];
                  const isToday = cell.dateStr === todayStr;
                  const isSelected = cell.dateStr === selectedDate;
                  return (
                    <button
                      key={idx}
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
                          isToday
                            ? "bg-brand text-white"
                            : isSelected
                            ? "text-brand"
                            : "text-text"
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
                          <div className="text-[10px] text-muted">
                            +{cellTasks.length - 2} more
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Empty state */}
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

            {/* Day Detail Panel */}
            <div className="hidden w-80 shrink-0 border-l border-border lg:flex lg:flex-col">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-text">
                  {selectedDate
                    ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })
                    : "Select a day"}
                </p>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {selectedTasks.length === 0 ? (
                  <div className="mt-6 text-center">
                    <Circle className="mx-auto size-6 text-muted/30" />
                    <p className="mt-2 text-xs text-muted">No tasks on this day</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-xl border border-border bg-white/[0.03] p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-text">{task.title}</p>
                            <p className="mt-0.5 text-xs text-muted">
                              {task.taskType} · {task.durationLabel}
                            </p>
                          </div>
                          {task.status === "done" ? (
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                          ) : (
                            <Circle className="mt-0.5 size-4 shrink-0 text-muted/40" />
                          )}
                        </div>
                        {task.specificTasks && task.specificTasks.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {task.specificTasks.map((t, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-muted">
                                <span className="mt-1 size-1 shrink-0 rounded-full bg-brand/50" />
                                {t}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Goal summary at bottom */}
              {goalMeta && (
                <div className="border-t border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Active Goal</p>
                  <p className="mt-1 text-sm text-text line-clamp-2">{goalMeta.title}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Clock className="size-3 text-muted" />
                    <p className="text-xs text-muted">
                      Deadline:{" "}
                      {new Date(goalMeta.deadline).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </RequireAuth>
  );
}
