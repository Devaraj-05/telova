"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { GoogleConnectionModal } from "@/components/workspace/GoogleConnectionModal";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { WorkspaceMain } from "@/components/workspace/WorkspaceMain";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { ChatScrollArea } from "@/components/workspace/ChatScrollArea";
import { PromptComposer } from "@/components/workspace/PromptComposer";
import { useWorkspaceController } from "@/hooks/useWorkspaceController";

const DISMISSED_KEY = "telova_google_prompt_dismissed";

export function WorkspaceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [connectPromptDismissed, setConnectPromptDismissed] = useState(true); // default hidden
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [connectPromptError, setConnectPromptError] = useState<string | null>(null);
  const {
    user,
    logout,
    googleConnection,
    connectGoogleWorkspace,
  } = useAuth();
  const workspace = useWorkspaceController(user?.id ?? null);

  // Show the modal only once — on first login if not previously dismissed
  useEffect(() => {
    if (typeof window === "undefined") return;
    const wasDismissed = localStorage.getItem(DISMISSED_KEY);
    if (!wasDismissed && user && googleConnection?.status !== "connected") {
      setConnectPromptDismissed(false);
    }
  }, [user, googleConnection?.status]);

  useEffect(() => {
    if (googleConnection?.status === "connected") {
      setConnectPromptDismissed(true);
      setConnectPromptError(null);
    }
  }, [googleConnection?.status]);

  const dismissModal = () => {
    setConnectPromptDismissed(true);
    setConnectPromptError(null);
    if (typeof window !== "undefined") {
      localStorage.setItem(DISMISSED_KEY, "1");
    }
  };

  const showGoogleModal =
    user &&
    googleConnection?.status !== "connected" &&
    !connectPromptDismissed;

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-text">
      <div className="hidden md:block">
        <WorkspaceSidebar
          activeItem="workspace"
          userName={user?.display_name}
          userEmail={user?.email}
          onLogout={logout}
        />
      </div>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <button
            type="button"
            className="flex-1 bg-slate-950/70"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation overlay"
          />
          <div className="h-full">
            <WorkspaceSidebar
              activeItem="workspace"
              userName={user?.display_name}
              userEmail={user?.email}
              mobile
              onLogout={logout}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <WorkspaceMain
        header={
          <WorkspaceHeader
            sessionStatus={workspace.sessionStatus}
            runtimeStatus={workspace.runtimeStatus}
            onNewGoal={workspace.handleResetWorkspace}
            onToggleSidebar={() => setSidebarOpen(true)}
          />
        }
        chat={
          <div className="flex min-h-0 flex-1">
            <section className="flex min-w-0 flex-1 flex-col">
              <ChatScrollArea
                messages={workspace.messages}
                welcomePrompts={workspace.welcomePrompts}
                onSelectPrompt={workspace.handleStartGoalFlow}
                onFollowupReply={workspace.handleFollowupReply}
                onProposalAction={workspace.handleProposalAction}
                onSyncAction={workspace.handleSyncAction}
              />
            </section>
          </div>
        }
        composer={
          <PromptComposer
            value={workspace.composerValue}
            mode={workspace.mode}
            disabled={workspace.isBusy}
            onChange={workspace.setComposerValue}
            onSubmit={workspace.handleComposerSubmit}
          />
        }
      />

      {showGoogleModal ? (
        <GoogleConnectionModal
          connection={googleConnection}
          error={connectPromptError}
          isConnecting={isConnectingGoogle}
          onConnect={async () => {
            setIsConnectingGoogle(true);
            setConnectPromptError(null);
            try {
              await connectGoogleWorkspace();
            } catch (error) {
              setConnectPromptError(
                error instanceof Error
                  ? error.message
                  : "Unable to start Google authorization.",
              );
            } finally {
              setIsConnectingGoogle(false);
            }
          }}
          onDismiss={dismissModal}
        />
      ) : null}
    </div>
  );
}
