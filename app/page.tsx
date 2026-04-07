import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, ListTodo, NotebookPen, Orbit, ShieldCheck, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas text-text">
      <section className="mx-auto flex min-h-screen max-w-[1400px] flex-col px-6 py-8">
        <header className="flex items-center justify-between rounded-[28px] border border-border bg-panel/80 px-6 py-4 backdrop-blur">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/telova-mark.svg"
              alt="Telova"
              className="size-11 rounded-2xl bg-white/5 p-1.5"
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-muted">
                Telova
              </p>
              <p className="text-xs text-muted">
                Multi-agent productivity assistant
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-2xl border border-border bg-white/5 px-4 py-3 text-sm font-semibold text-text transition hover:bg-white/10"
            >
              Login
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand/90"
            >
              Start With Telova
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </header>

        <div className="grid flex-1 gap-8 py-12 xl:grid-cols-[1.15fr_0.85fr] xl:items-center">
          <div>
            <span className="inline-flex rounded-full border border-border bg-brandSoft px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-brand">
              Agent Workspace
            </span>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.05] text-text md:text-6xl">
              Give Telova a goal. Watch agents plan, schedule, sync, and adapt the work.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              Telova combines chat, planning, live orchestration, Calendar, Tasks, and
              Notes into one operating surface so users can move from intent to execution
              without rebuilding the plan by hand.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand/90"
              >
                Login Or Sign Up
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/workspace"
                className="rounded-2xl border border-border bg-white/5 px-5 py-3 text-sm font-semibold text-text transition hover:bg-white/10"
              >
                Open Workspace Preview
              </Link>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <article className="card-surface p-5">
                <Sparkles className="size-5 text-brand" />
                <h2 className="mt-4 text-lg font-semibold">Chat-first planning</h2>
                <p className="mt-2 text-sm leading-7 text-muted">
                  Users describe one goal. Telova returns analysis, milestones, timeline,
                  and proposal controls in the same conversation.
                </p>
              </article>
              <article className="card-surface p-5">
                <Orbit className="size-5 text-brand" />
                <h2 className="mt-4 text-lg font-semibold">Live agent orchestration</h2>
                <p className="mt-2 text-sm leading-7 text-muted">
                  Orchestrator, scheduler, research, and memory agents work in parallel
                  and stay visible through execution.
                </p>
              </article>
              <article className="card-surface p-5">
                <ShieldCheck className="size-5 text-brand" />
                <h2 className="mt-4 text-lg font-semibold">User-approved sync</h2>
                <p className="mt-2 text-sm leading-7 text-muted">
                  Telova asks permission to connect tools first, then only syncs Calendar,
                  Tasks, and Notes after the user confirms the plan.
                </p>
              </article>
            </div>
          </div>

          <div className="card-surface overflow-hidden p-6">
            <div className="rounded-[24px] border border-border bg-panel/70 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
                Tooling surface
              </p>
              <h2 className="mt-3 text-2xl font-semibold">
                The operating layer after login
              </h2>
              <div className="mt-6 space-y-4">
                {[
                  {
                    icon: CalendarDays,
                    title: "Calendar sync",
                    detail: "Task blocks and execution windows land in Google Calendar after approval.",
                  },
                  {
                    icon: ListTodo,
                    title: "Task publishing",
                    detail: "Goal breakdowns become actionable Google Tasks with status sync.",
                  },
                  {
                    icon: NotebookPen,
                    title: "Notes and memory",
                    detail: "Context packages, reports, and workspace notes stay ready in Google Keep when available.",
                  },
                ].map(({ icon: Icon, title, detail }) => (
                  <div
                    key={title}
                    className="flex items-start gap-4 rounded-2xl border border-border bg-white/[0.03] p-4"
                  >
                    <span className="rounded-2xl bg-brand/15 p-3 text-brand">
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-text">{title}</p>
                        <CheckCircle2 className="size-4 text-emerald-300" />
                      </div>
                      <p className="mt-2 text-sm leading-7 text-muted">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
