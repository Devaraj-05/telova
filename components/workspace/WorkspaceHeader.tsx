"use client";

import Link from "next/link";
import { Menu, PanelRight, Plus } from "lucide-react";

interface WorkspaceHeaderProps {
  sessionStatus: string;
  runtimeStatus: string;
  onNewGoal: () => void;
  onToggleSidebar: () => void;
  onToggleInsights: () => void;
}

export function WorkspaceHeader({
  sessionStatus,
  runtimeStatus,
  onNewGoal,
  onToggleSidebar,
  onToggleInsights,
}: WorkspaceHeaderProps) {
  return (
    <header className="flex h-[72px] items-center justify-between border-b border-border px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex rounded-2xl border border-border bg-white/5 p-2 text-muted transition hover:text-text xl:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-4" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-text">
            Agent Workspace
          </h1>
          <p className="mt-1 text-sm text-muted">
            Give a goal and let the agents build, schedule, and manage the plan.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-border bg-white/5 px-3 py-2 text-xs font-semibold text-muted md:inline-flex">
          <span className="size-2 rounded-full bg-success" />
          {sessionStatus}
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-border bg-white/5 px-3 py-2 text-xs font-semibold text-muted lg:inline-flex">
          <span className="size-2 rounded-full bg-brand" />
          {runtimeStatus}
        </div>
        <button
          type="button"
          onClick={onNewGoal}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand/90"
        >
          <Plus className="size-4" />
          New Goal
        </button>
        <Link
          href="/dashboard"
          className="hidden rounded-2xl border border-border bg-white/5 px-4 py-3 text-sm font-semibold text-text transition hover:bg-white/10 md:inline-flex"
        >
          Open Dashboard
        </Link>
        <button
          type="button"
          onClick={onToggleInsights}
          className="inline-flex rounded-2xl border border-border bg-white/5 p-2 text-muted transition hover:text-text xl:hidden"
          aria-label="Open insights"
        >
          <PanelRight className="size-4" />
        </button>
      </div>
    </header>
  );
}
