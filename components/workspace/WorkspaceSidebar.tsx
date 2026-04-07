"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  Bot,
  CalendarRange,
  LayoutDashboard,
  LogOut,
  NotebookTabs,
  RefreshCcw,
  Settings,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";

import { SIDEBAR_NAV_ITEMS } from "@/lib/workspace/constants";
import type { SidebarItemId } from "@/lib/workspace/types";
import { cn, initials } from "@/lib/utils";

const ICONS: Record<SidebarItemId, ComponentType<{ className?: string }>> = {
  workspace: Sparkles,
  dashboard: LayoutDashboard,
  timeline: CalendarRange,
  notes: NotebookTabs,
  replans: RefreshCcw,
  agents: Bot,
  settings: Settings,
};

interface WorkspaceSidebarProps {
  activeItem: SidebarItemId;
  userName?: string;
  userEmail?: string;
  mobile?: boolean;
  onLogout?: () => void;
  onClose?: () => void;
}

export function WorkspaceSidebar({
  activeItem,
  userName = "User",
  userEmail = "user@telova.ai",
  mobile = false,
  onLogout,
  onClose,
}: WorkspaceSidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-[260px] flex-col border-r border-border bg-panel px-4 py-4",
        mobile && "shadow-panel",
      )}
    >
      <div className="flex h-14 items-center justify-between">
        <Link href="/workspace" className="flex items-center gap-3">
          <img
            src="/telova-mark.svg"
            alt="Telova"
            className="size-10 rounded-2xl bg-white/5 p-1"
          />
          <div>
            <p className="text-sm font-semibold tracking-[0.24em] text-muted uppercase">
              Telova
            </p>
            <p className="text-xs text-muted">Agent workspace</p>
          </div>
        </Link>
        {mobile ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-white/5 p-2 text-muted transition hover:text-text"
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <nav className="mt-6 space-y-2">
        {SIDEBAR_NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.id];
          const isActive = item.id === activeItem;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                isActive
                  ? "bg-brand text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "text-muted hover:bg-white/5 hover:text-text",
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 rounded-2xl border border-border bg-cardSoft/70 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-brand/20 text-sm font-semibold text-brand">
            {initials(userName)}
          </div>
          <div>
            <p className="text-sm font-semibold text-text">{userName}</p>
            <p className="text-xs text-muted">{userEmail}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-white/5 px-3 py-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
              Session
            </p>
            <p className="mt-1 text-sm text-text">Workspace ready</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted transition hover:text-text"
          >
            <LogOut className="size-3.5" />
            Logout
          </button>
        </div>
      </div>

      <div className="mt-auto rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-text">
          <Workflow className="size-4 text-brand" />
          Live workspace
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">
          Chat, orchestration, planning, and sync all stay in one surface.
        </p>
      </div>
    </aside>
  );
}
