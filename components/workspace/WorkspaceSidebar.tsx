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
      {/* Header / Logo */}
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

      {/* Navigation */}
      <nav className="mt-6 space-y-1">
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

      {/* Spacer — pushes profile to bottom */}
      <div className="flex-1" />

      {/* User Profile — fixed at bottom */}
      <div className="rounded-2xl border border-border bg-white/[0.03] p-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/20 text-xs font-bold text-brand">
            {initials(userName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text">{userName}</p>
            <p className="truncate text-xs text-muted">{userEmail}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Logout"
            className="shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-white/10 hover:text-text"
          >
            <LogOut className="size-4" />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-1.5 px-0.5">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          <p className="text-xs text-muted">Workspace ready</p>
        </div>
      </div>
    </aside>
  );
}
