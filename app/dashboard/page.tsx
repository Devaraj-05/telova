"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { fetchDashboard } from "@/lib/workspace/api";
import { DashboardRead } from "@/lib/workspace/types";
import { CheckCircle2, Clock, CalendarIcon, Loader2, NotebookPen } from "lucide-react";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardRead | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchDashboard(user.id)
        .then(setDashboard)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [user]);

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
        <header className="flex h-[72px] items-center border-b border-border px-8 shrink-0">
          <h1 className="text-2xl font-semibold text-text">Dashboard</h1>
        </header>

        <div className="p-8 max-w-5xl">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="size-6 animate-spin text-brand" />
            </div>
          ) : dashboard ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Goals */}
              <section className="rounded-[28px] border border-border bg-panel p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-text mb-4">Active Goals</h2>
                <div className="space-y-3">
                  {dashboard.goals.length === 0 ? (
                    <p className="text-sm text-muted">No active goals found.</p>
                  ) : (
                    dashboard.goals.map((goal: any) => (
                      <div key={goal.id} className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-text">{goal.title}</h3>
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                            {Math.round((goal.progress ?? 0) * 100)}%
                          </span>
                        </div>
                        {goal.description && (
                          <p className="mt-1 text-xs text-muted line-clamp-1">{goal.description}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Tasks */}
              <section className="rounded-[28px] border border-border bg-panel p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-text mb-4">
                  <CheckCircle2 className="size-5 text-brand" />
                  Upcoming Tasks
                </h2>
                <div className="space-y-3">
                  {dashboard.recent_tasks.length === 0 ? (
                    <p className="text-sm text-muted">No upcoming tasks.</p>
                  ) : (
                    dashboard.recent_tasks.map((task: any) => (
                      <div key={task.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                        <input type="checkbox" className="mt-1 flex-shrink-0" disabled checked={task.status === "completed"} />
                        <div>
                          <p className="text-sm font-medium text-text">{task.title}</p>
                          {task.scheduled_start && (
                            <p className="mt-1 text-xs text-muted flex items-center gap-1">
                              <Clock className="size-3" />
                              {new Date(task.scheduled_start).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Events */}
              <section className="rounded-[28px] border border-border bg-panel p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-text mb-4">
                  <CalendarIcon className="size-5 text-brand" />
                  Calendar Events
                </h2>
                <div className="space-y-3">
                  {dashboard.upcoming_events.length === 0 ? (
                    <p className="text-sm text-muted">No upcoming calendar events.</p>
                  ) : (
                    dashboard.upcoming_events.map((event: any) => (
                      <div key={event.id} className="rounded-2xl border border-border bg-card p-4 border-l-4 border-l-brand">
                        <p className="text-sm font-medium text-text">{event.title}</p>
                        <p className="mt-1 text-xs text-muted flex items-center gap-1">
                          <Clock className="size-3" />
                          {new Date(event.start_at).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Notes */}
              <section className="rounded-[28px] border border-border bg-panel p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-text mb-4">
                  <NotebookPen className="size-5 text-brand" />
                  Recent Notes
                </h2>
                <div className="space-y-3">
                  {dashboard.notes.length === 0 ? (
                    <p className="text-sm text-muted">No recent notes.</p>
                  ) : (
                    dashboard.notes.map((note: any) => (
                      <div key={note.id} className="rounded-2xl border border-border bg-card p-4">
                        <p className="text-sm font-medium text-text">{note.title}</p>
                        {note.content && (
                          <p className="mt-1 text-xs text-muted line-clamp-2">{note.content}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>

            </div>
          ) : (
            <p className="text-muted">Error loading dashboard.</p>
          )}
        </div>
      </main>
    </div>
  );
}
