"use client";

import { useEffect, useMemo, useRef } from "react";

import type {
  ChatMessage,
  ProposalActionType,
  SuggestionPrompt,
} from "@/lib/workspace/types";
import { formatShortDate } from "@/lib/utils";
import { WelcomeState } from "@/components/workspace/messages/WelcomeState";
import { UserMessageBubble } from "@/components/workspace/messages/UserMessageBubble";
import { AgentMessageBubble } from "@/components/workspace/messages/AgentMessageBubble";
import { AgentAnalysisCard } from "@/components/workspace/messages/AgentAnalysisCard";
import { AgentActivityInlineCard } from "@/components/workspace/messages/AgentActivityInlineCard";
import { FollowupQuestionCard } from "@/components/workspace/messages/FollowupQuestionCard";
import { PlanPreviewCard } from "@/components/workspace/messages/PlanPreviewCard";
import { TimelinePreviewCard } from "@/components/workspace/messages/TimelinePreviewCard";
import { ProposalActionsCard } from "@/components/workspace/messages/ProposalActionsCard";
import { ScheduleProgressCard } from "@/components/workspace/messages/ScheduleProgressCard";
import { SyncSuccessCard } from "@/components/workspace/messages/SyncSuccessCard";
import { AgentThinkingBubble } from "@/components/workspace/messages/AgentThinkingBubble";

interface AdjustTimelineConfig {
  hoursPerDay: number;
  selectedDays: string[];
}

interface ChatScrollAreaProps {
  messages: ChatMessage[];
  welcomePrompts: SuggestionPrompt[];
  onSelectPrompt: (value: string) => void;
  onFollowupReply: (value: string) => void;
  onProposalAction: (action: ProposalActionType) => void;
  onAdjustTimeline: (config: AdjustTimelineConfig) => void;
  onSyncAction: (action: "open_dashboard" | "view_timeline" | "stay") => void;
}

export function ChatScrollArea({
  messages,
  welcomePrompts,
  onSelectPrompt,
  onFollowupReply,
  onProposalAction,
  onAdjustTimeline,
  onSyncAction,
}: ChatScrollAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    element.scrollTo({
      top: element.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const renderedMessages = useMemo(
    () =>
      messages.map((message) => {
        switch (message.type) {
          case "welcome":
            return (
              <WelcomeState
                key={message.id}
                prompts={welcomePrompts}
                onSelectPrompt={onSelectPrompt}
              />
            );
          case "user":
            return (
              <UserMessageBubble
                key={message.id}
                text={message.text}
                timestamp={formatShortDate(message.createdAt)}
              />
            );
          case "agent_reply":
            return (
              <AgentMessageBubble
                key={message.id}
                text={message.text}
                timestamp={formatShortDate(message.createdAt)}
              />
            );
          case "thinking":
            return <AgentThinkingBubble key={message.id} />;
          case "analysis":
            return <AgentAnalysisCard key={message.id} data={message.data} />;
          case "activity":
            return (
              <AgentActivityInlineCard key={message.id} items={message.data} />
            );
          case "followup":
            return (
              <FollowupQuestionCard
                key={message.id}
                data={message.data}
                onSelectReply={onFollowupReply}
              />
            );
          case "plan_preview":
            return (
              <PlanPreviewCard
                key={message.id}
                data={message.data}
                onAction={onProposalAction}
              />
            );
          case "timeline_preview":
            return (
              <TimelinePreviewCard
                key={message.id}
                data={message.data}
                onAction={onProposalAction}
              />
            );
          case "proposal_actions":
            return (
              <ProposalActionsCard
                key={message.id}
                data={message.data}
                onAction={onProposalAction}
                onAdjustTimeline={onAdjustTimeline}
              />
            );
          case "schedule_progress":
            return (
              <ScheduleProgressCard key={message.id} data={message.data} />
            );
          case "sync_success":
            return (
              <SyncSuccessCard
                key={message.id}
                data={message.data}
                onAction={onSyncAction}
              />
            );
          default:
            return null;
        }
      }),
    [
      messages,
      onFollowupReply,
      onProposalAction,
      onAdjustTimeline,
      onSelectPrompt,
      onSyncAction,
      welcomePrompts,
    ],
  );

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto flex max-w-[900px] flex-col gap-5 pb-28">
        {renderedMessages}
      </div>
    </div>
  );
}
