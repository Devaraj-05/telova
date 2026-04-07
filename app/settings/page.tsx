"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { CalendarDays, CheckCircle2, ExternalLink, ListTodo, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const TOOL_ROWS = [
  { key: "calendar_connected", label: "Google Calendar", Icon: CalendarDays },
  { key: "tasks_connected", label: "Google Tasks", Icon: ListTodo },
  { key: "keep_connected", label: "Google Keep", Icon: NotebookPen },
] as const;

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
        <header className="flex h-[72px] items-center border-b border-border px-8 shrink-0">
          <h1 className="text-2xl font-semibold text-text">Settings</h1>
        </header>
        
        <div className="p-8 max-w-3xl">
          <section className="rounded-[28px] border border-border bg-panel p-8">
            <h2 className="text-lg font-semibold text-text">MCP Tools Integrations</h2>
            <p className="mt-2 text-sm text-muted">
              Connect your Google Workspace to allow Telova to automatically schedule tasks, create calendar blocks, and generate follow-up notes natively with your tools.
            </p>

            <div className="mt-8 space-y-4">
              {TOOL_ROWS.map(({ key, label, Icon }) => {
                const connected = Boolean(googleConnection?.[key]);
                return (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row items-center justify-between rounded-2xl border border-border bg-card px-6 py-5"
                  >
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        "rounded-xl p-3 text-white transition-colors",
                        connected ? "bg-brand" : "bg-white/5"
                      )}>
                        <Icon className="size-5" />
                      </span>
                      <div>
                        <p className="font-semibold text-text">{label}</p>
                        <p className="text-sm text-muted">
                          {connected ? "Active and syncing" : "Waiting for permission"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 sm:mt-0 flex items-center gap-2">
                      <CheckCircle2
                        className={cn(
                          "size-5",
                          connected ? "text-success" : "text-border",
                        )}
                      />
                      <span className={cn(
                        "text-sm font-semibold",
                        connected ? "text-success" : "text-muted"
                      )}>
                        {connected ? "Connected" : "Not connected"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <div className="mt-8 border-t border-border pt-8 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text">Global Workspace Connection</p>
                <p className="text-sm text-muted mt-1">
                  Authorize Telova with your Google Account
                </p>
              </div>
              <button
                type="button"
                onClick={handleConnect}
                disabled={isConnecting || googleConnection?.status === "connected"}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold transition",
                  googleConnection?.status === "connected"
                    ? "bg-white/5 text-muted cursor-not-allowed"
                    : "bg-brand text-white hover:bg-brand/90"
                )}
              >
                <ExternalLink className="size-4" />
                {googleConnection?.status === "connected"
                  ? "Workspace Connected"
                  : isConnecting
                  ? "Connecting..."
                  : "Connect Everything"}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
