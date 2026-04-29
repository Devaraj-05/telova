"use client";

import { useState } from "react";
import {
  CalendarDays, CheckCircle2, ExternalLink, ListTodo,
  NotebookPen, User, Mail, Shield, Loader2, LogOut,
  RefreshCw, Wifi, WifiOff, Info,
} from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { cn, initials } from "@/lib/utils";

const TOOL_ROWS = [
  {
    key: "calendar_connected" as const,
    label: "Google Calendar",
    Icon: CalendarDays,
    desc: "Sync tasks and schedule blocks to your calendar",
  },
  {
    key: "tasks_connected" as const,
    label: "Google Tasks",
    Icon: ListTodo,
    desc: "Create and track tasks in Google Tasks",
  },
  {
    key: "keep_connected" as const,
    label: "Google Keep",
    Icon: NotebookPen,
    desc: "Save notes and reminders to Google Keep",
  },
];

const APP_INFO = [
  ["Platform", "Telova Agent Workspace"],
  ["Planning Engine", "Google ADK · Gemini 2.5 Flash"],
  ["Database", "AlloyDB · PostgreSQL"],
  ["Deployment", "Cloud Run · GCP"],
  ["Version", "0.1.0"],
];

export default function SettingsPage() {
  const { user, logout, googleConnection, connectGoogleWorkspace } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await connectGoogleWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect.");
    } finally {
      setIsConnecting(false);
    }
  };

  const isConnected = googleConnection?.status === "connected";

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-text">
      <div className="hidden md:block">
        <WorkspaceSidebar
          activeItem="settings"
          userName={user?.display_name}
          userEmail={user?.email}
          onLogout={logout}
        />
      </div>

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="flex h-[72px] shrink-0 items-center border-b border-border px-8">
          <h1 className="text-xl font-semibold text-text">Settings</h1>
        </header>

        <div className="space-y-5 p-8 max-w-3xl">

          {/* ── Account ── */}
          <section className="rounded-2xl border border-border bg-card/80 p-6">
            <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-muted">Account</h2>
            <div className="flex items-start gap-5">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand/20 text-2xl font-bold text-brand">
                {initials(user?.display_name ?? "U")}
              </div>
              <div className="flex-1 space-y-3">
                {[
                  { icon: User, label: "Name", value: user?.display_name ?? "—" },
                  { icon: Mail, label: "Email", value: user?.email ?? "—" },
                  { icon: Shield, label: "Auth", value: "JWT · Telova" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 rounded-xl border border-border/60 bg-panel/50 px-4 py-2.5">
                    <Icon className="size-3.5 shrink-0 text-muted" />
                    <span className="text-sm text-muted w-14">{label}</span>
                    <span className="ml-auto text-sm font-medium text-text truncate">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 border-t border-border pt-5">
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted transition hover:border-danger/40 hover:bg-danger/5 hover:text-danger"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          </section>

          {/* ── Google Workspace ── */}
          <section className="rounded-2xl border border-border bg-card/80 p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Google Workspace</h2>
                <p className="mt-1.5 text-sm text-muted/80">
                  Connect your Google account to enable calendar sync, task creation, and note-taking across your workspace.
                </p>
              </div>
              <span className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                isConnected ? "bg-success/15 text-success" : "bg-white/5 text-muted",
              )}>
                {isConnected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
                {isConnected ? "Connected" : "Not connected"}
              </span>
            </div>

            <div className="space-y-2.5">
              {TOOL_ROWS.map(({ key, label, Icon, desc }) => {
                const connected = Boolean(googleConnection?.[key]);
                return (
                  <div
                    key={key}
                    className="flex items-center gap-4 rounded-xl border border-border/60 bg-panel/50 px-5 py-4"
                  >
                    <div className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl transition",
                      connected ? "bg-brand text-white" : "bg-white/5 text-muted",
                    )}>
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text">{label}</p>
                      <p className="text-xs text-muted">{desc}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <CheckCircle2 className={cn(
                        "size-4",
                        connected ? "text-success" : "text-border",
                      )} />
                      <span className={cn(
                        "text-xs font-semibold",
                        connected ? "text-success" : "text-muted/40",
                      )}>
                        {connected ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger/90">
                {error}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-border pt-5">
              <div>
                <p className="text-sm font-medium text-text">
                  {isConnected ? "Reconnect or expand permissions" : "Authorize your Google account"}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {googleConnection?.provider_email
                    ? `Linked as ${googleConnection.provider_email}`
                    : "No Google account linked yet"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleConnect}
                disabled={isConnecting}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition",
                  isConnected
                    ? "border border-border bg-card text-muted hover:border-brand/40 hover:text-text"
                    : "bg-brand text-white hover:bg-brand/90",
                  isConnecting && "opacity-70 cursor-not-allowed",
                )}
              >
                {isConnecting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isConnected ? (
                  <RefreshCw className="size-4" />
                ) : (
                  <ExternalLink className="size-4" />
                )}
                {isConnected ? "Reconnect" : isConnecting ? "Connecting…" : "Connect Google"}
              </button>
            </div>
          </section>

          {/* ── App Info ── */}
          <section className="rounded-2xl border border-border bg-card/80 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
              <Info className="size-3.5" /> App Info
            </h2>
            <div className="space-y-3">
              {APP_INFO.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-xl border border-border/60 bg-panel/50 px-4 py-2.5">
                  <span className="text-sm text-muted">{label}</span>
                  <span className="text-sm font-medium text-text">{value}</span>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
