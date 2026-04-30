"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ComponentType, KeyboardEvent } from "react";
import {
  BarChart3,
  Bot,
  CalendarRange,
  Check,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  NotebookTabs,
  Pencil,
  Plus,
  RefreshCcw,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { SIDEBAR_NAV_ITEMS } from "@/lib/workspace/constants";
import type { ChatSession, SidebarItemId } from "@/lib/workspace/types";
import { cn, initials } from "@/lib/utils";

const ICONS: Record<SidebarItemId, ComponentType<{ className?: string }>> = {
  workspace: Sparkles,
  dashboard: LayoutDashboard,
  timeline: CalendarRange,
  analytics: BarChart3,
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
  chatSessions?: ChatSession[];
  activeSessionId?: string | null;
  chatsLabel?: string;
  onLogout?: () => void;
  onClose?: () => void;
  onSwitchSession?: (sessionId: string) => void;
  onNewChat?: () => void;
  onRenameSession?: (sessionId: string, nextTitle: string) => void;
  onDeleteSession?: (sessionId: string) => void;
}

interface ChatRowProps {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onRename?: (sessionId: string, nextTitle: string) => void;
  onDelete?: (sessionId: string) => void;
}

function ChatRow({ session, isActive, onSelect, onRename, onDelete }: ChatRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(session.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraftTitle(session.title);
  }, [session.title]);

  useEffect(() => {
    if (!menuOpen && !confirmingDelete) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmingDelete(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen, confirmingDelete]);

  useEffect(() => {
    if (renaming) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [renaming]);

  const commitRename = () => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== session.title && onRename) {
      onRename(session.id, trimmed);
    } else {
      setDraftTitle(session.title);
    }
    setRenaming(false);
  };

  const cancelRename = () => {
    setDraftTitle(session.title);
    setRenaming(false);
  };

  const handleInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
  };

  return (
    <div className="group relative">
      {renaming ? (
        <div
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs",
            isActive ? "bg-brand/15" : "bg-white/5",
          )}
        >
          <MessageSquare className="size-3.5 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleInputKey}
            className="flex-1 min-w-0 bg-transparent text-text outline-none placeholder:text-muted/50"
            placeholder="Chat name"
            maxLength={120}
          />
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              commitRename();
            }}
            className="shrink-0 rounded p-0.5 text-muted hover:text-success"
            aria-label="Save chat name"
          >
            <Check className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 pr-8 text-left text-xs transition",
            isActive
              ? "bg-brand/15 text-brand"
              : "text-muted hover:bg-white/5 hover:text-text",
          )}
        >
          <MessageSquare className="size-3.5 shrink-0" />
          <span className="truncate">{session.title}</span>
        </button>
      )}

      {!renaming && (onRename || onDelete) ? (
        <div ref={menuRef} className="absolute right-1 top-1/2 -translate-y-1/2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
              setConfirmingDelete(false);
            }}
            className={cn(
              "rounded-md p-1 text-muted transition",
              menuOpen
                ? "bg-white/10 text-text opacity-100"
                : "opacity-0 hover:bg-white/10 hover:text-text group-hover:opacity-100",
            )}
            aria-label="Chat options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal className="size-3.5" />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-panel shadow-panel"
            >
              {onRename ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    setRenaming(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text transition hover:bg-white/5"
                >
                  <Pencil className="size-3.5 text-muted" />
                  Rename
                </button>
              ) : null}
              {onDelete ? (
                confirmingDelete ? (
                  <div className="flex flex-col gap-1 border-t border-border bg-rose-500/5 px-3 py-2 text-xs">
                    <p className="text-rose-300">Delete this chat?</p>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(session.id);
                          setMenuOpen(false);
                          setConfirmingDelete(false);
                        }}
                        className="flex-1 rounded-md bg-rose-500/20 px-2 py-1 text-rose-200 transition hover:bg-rose-500/30"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingDelete(false);
                        }}
                        className="flex-1 rounded-md bg-white/5 px-2 py-1 text-muted transition hover:bg-white/10"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmingDelete(true);
                    }}
                    className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-xs text-rose-300 transition hover:bg-rose-500/10"
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </button>
                )
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceSidebar({
  activeItem,
  userName = "User",
  userEmail = "user@telova.ai",
  mobile = false,
  chatSessions = [],
  activeSessionId,
  chatsLabel = "Chats",
  onLogout,
  onClose,
  onSwitchSession,
  onNewChat,
  onRenameSession,
  onDeleteSession,
}: WorkspaceSidebarProps) {
  const showChatList =
    (activeItem === "workspace" || activeItem === "analytics") &&
    (!!onSwitchSession || chatSessions.length > 0 || !!onNewChat);
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

      {/* Chat Sessions */}
      {showChatList && (
        <div className="mt-6">
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              {chatsLabel}
            </p>
            {onNewChat ? (
              <button
                type="button"
                onClick={onNewChat}
                className="rounded-lg p-1 text-muted transition hover:bg-white/10 hover:text-text"
                title={`New ${chatsLabel.toLowerCase().replace(/s$/, "")}`}
              >
                <Plus className="size-3.5" />
              </button>
            ) : null}
          </div>
          <div className="max-h-[260px] overflow-y-auto space-y-0.5">
            {chatSessions.length === 0 ? (
              <p className="px-3 text-xs text-muted/60">
                No {chatsLabel.toLowerCase()} yet
              </p>
            ) : (
              chatSessions.map((session) => (
                <ChatRow
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  onSelect={() => onSwitchSession?.(session.id)}
                  onRename={onRenameSession}
                  onDelete={onDeleteSession}
                />
              ))
            )}
          </div>
        </div>
      )}

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
