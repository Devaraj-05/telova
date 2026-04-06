"use client";

import { useState } from "react";

import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { WorkspaceMain } from "@/components/workspace/WorkspaceMain";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { ChatScrollArea } from "@/components/workspace/ChatScrollArea";
import { PromptComposer } from "@/components/workspace/PromptComposer";
import { RightInsightPanel } from "@/components/workspace/RightInsightPanel";
import { useWorkspaceController } from "@/hooks/useWorkspaceController";

export function WorkspaceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const workspace = useWorkspaceController();

  return (
    <div className="flex h-screen bg-canvas text-text">
      <div className="hidden xl:block">
        <WorkspaceSidebar activeItem="workspace" />
      </div>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 flex xl:hidden">
          <button
            type="button"
            className="flex-1 bg-slate-950/70"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation overlay"
          />
          <div className="h-full">
            <WorkspaceSidebar
              activeItem="workspace"
              mobile
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
            onToggleInsights={() => setInsightsOpen(true)}
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
            <div className="hidden w-[340px] border-l border-border xl:block">
              <RightInsightPanel
                activity={workspace.agentFeed}
                tools={workspace.connectedTools}
                currentGoal={workspace.currentGoal}
                actions={workspace.quickActions}
                onQuickAction={workspace.handleQuickAction}
              />
            </div>
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

      {insightsOpen ? (
        <div className="fixed inset-0 z-40 flex justify-end xl:hidden">
          <button
            type="button"
            className="flex-1 bg-slate-950/70"
            onClick={() => setInsightsOpen(false)}
            aria-label="Close insights overlay"
          />
          <div className="h-full w-full max-w-[340px] bg-canvas">
            <RightInsightPanel
              activity={workspace.agentFeed}
              tools={workspace.connectedTools}
              currentGoal={workspace.currentGoal}
              actions={workspace.quickActions}
              onQuickAction={(action) => {
                setInsightsOpen(false);
                workspace.handleQuickAction(action);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
