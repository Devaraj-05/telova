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

export function WorkspaceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [connectPromptDismissed, setConnectPromptDismissed] = useState(false); // default to showing it
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [connectPromptError, setConnectPromptError] = useState<string | null>(null);
  const {
    user,
    logout,
    googleConnection,
    connectGoogleWorkspace,
  } = useAuth();
  const workspace = useWorkspaceController(user?.id ?? null);

  useEffect(() => {
    if (googleConnection?.status === "connected") {
      setConnectPromptDismissed(true);
      setConnectPromptError(null);
    }
  }, [googleConnection?.status]);

  const dismissModal = () => {
    setConnectPromptDismissed(true);
    setConnectPromptError(null);
  };

  const showGoogleModal =
    user &&
    googleConnection &&
    googleConnection.status !== "connected" &&
    !connectPromptDismissed;

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-text">
      <div className="hidden md:block">
        <WorkspaceSidebar
          activeItem="workspace"
          userName={user?.display_name}
          userEmail={user?.email}
          chatSessions={workspace.chatSessions}
          activeSessionId={workspace.activeSessionId}
          onLogout={logout}
          onSwitchSession={workspace.handleSwitchSession}
          onNewChat={workspace.handleNewChat}
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
              chatSessions={workspace.chatSessions}
              activeSessionId={workspace.activeSessionId}
              onLogout={logout}
              onClose={() => setSidebarOpen(false)}
              onSwitchSession={workspace.handleSwitchSession}
              onNewChat={workspace.handleNewChat}
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
                onAdjustTimeline={workspace.handleAdjustTimeline}
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
