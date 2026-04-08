"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DEFAULT_AGENT_FEED, QUICK_ACTIONS, WELCOME_PROMPTS } from "@/lib/workspace/constants";
import {
  advanceProgress,
  applyFollowupAnswer,
  buildAnalysisActivity,
  buildAnalysisData,
  buildDraftFromPrompt,
  buildGoalCreatePayload,
  buildMockCreateResponse,
  buildMockPreview,
  completeProgress,
  createMessageId,
  createProgressSteps,
  createSyncSuccess,
  defaultProposalActions,
  nowIso,
  nextFollowupQuestion,
  previewToPlanPreview,
  previewToTimeline,
  sleep,
  toConnectedTools,
  toCurrentGoalSummary,
} from "@/lib/workspace/helpers";
import {
  createGoalPlan,
  fetchDashboard,
  fetchSystemStatus,
  previewGoalPlan,
  sendChatMessage,
} from "@/lib/workspace/api";
import type { ChatHistoryItem } from "@/lib/workspace/api";
import type {
  ChatMessage,
  DashboardRead,
  FollowupQuestion,
  GoalDraft,
  GoalPlanPreviewResponse,
  GoalPlanResponse,
  ProposalActionType,
  QuickActionItem,
  SystemStatusRead,
  WorkspaceComposerMode,
} from "@/lib/workspace/types";

function createUserMessage(text: string): ChatMessage {
  return {
    id: createMessageId("user"),
    type: "user",
    text,
    createdAt: nowIso(),
  };
}

function createWelcomeMessage(): ChatMessage {
  return {
    id: createMessageId("welcome"),
    type: "welcome",
    createdAt: nowIso(),
  };
}

interface AdjustTimelineConfig {
  hoursPerDay: number;
  selectedDays: string[];
}

export function useWorkspaceController(userId: string | null) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerValue, setComposerValue] = useState("");
  const [mode, setMode] = useState<WorkspaceComposerMode>("goal");
  const [pendingFollowup, setPendingFollowup] = useState<FollowupQuestion | null>(null);
  const [draft, setDraft] = useState<GoalDraft | null>(null);
  const [preview, setPreview] = useState<GoalPlanPreviewResponse | null>(null);
  const [createdGoal, setCreatedGoal] = useState<GoalPlanResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardRead | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatusRead | null>(null);
  const [agentFeed, setAgentFeed] = useState(DEFAULT_AGENT_FEED);
  const [isBusy, setIsBusy] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedMessages = localStorage.getItem("telova_chat_messages");
      if (storedMessages) {
        setMessages(JSON.parse(storedMessages));
      } else {
        setMessages([createWelcomeMessage()]);
      }

      const storedHistory = localStorage.getItem("telova_chat_history");
      if (storedHistory) {
        setChatHistory(JSON.parse(storedHistory));
      }
    } catch {
      setMessages([createWelcomeMessage()]);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem("telova_chat_messages", JSON.stringify(messages));
      localStorage.setItem("telova_chat_history", JSON.stringify(chatHistory));
    }
  }, [messages, chatHistory, isHydrated]);

  const activeUserId = draft?.userId ?? userId;

  const refreshWorkspaceContext = useCallback(async () => {
    if (!activeUserId) {
      setDashboard(null);
      setSystemStatus(null);
      return;
    }
    const [dashboardResult, systemResult] = await Promise.allSettled([
      fetchDashboard(activeUserId),
      fetchSystemStatus(activeUserId),
    ]);

    if (dashboardResult.status === "fulfilled") {
      setDashboard(dashboardResult.value);
    }

    if (systemResult.status === "fulfilled") {
      setSystemStatus(systemResult.value);
    }
  }, [activeUserId]);

  useEffect(() => {
    void refreshWorkspaceContext();
  }, [refreshWorkspaceContext]);

  const runtimeStatus = useMemo(() => {
    const count = systemStatus?.agents?.length ?? 0;
    return `${count} agents online`;
  }, [systemStatus]);

  const sessionStatus = useMemo(() => {
    if (isBusy) {
      return "Working";
    }
    if (createdGoal) {
      return "Goal active";
    }
    if (preview) {
      return "Proposal ready";
    }
    if (draft) {
      return "Planning";
    }
    return "Active";
  }, [createdGoal, draft, isBusy, preview]);

  const tools = useMemo(() => toConnectedTools(systemStatus), [systemStatus]);

  const currentGoal = useMemo(
    () => toCurrentGoalSummary(draft, preview, createdGoal, dashboard),
    [createdGoal, dashboard, draft, preview],
  );

  const pushMessages = useCallback((nextMessages: ChatMessage[]) => {
    setMessages((current) => [...current, ...nextMessages]);
  }, []);

  const updateMessage = useCallback(
    (messageId: string, updater: (message: ChatMessage) => ChatMessage) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? updater(message) : message,
        ),
      );
    },
    [],
  );

  const handleResetWorkspace = useCallback(() => {
    setMessages([createWelcomeMessage()]);
    setComposerValue("");
    setMode("goal");
    setPendingFollowup(null);
    setDraft(null);
    setPreview(null);
    setCreatedGoal(null);
    setAgentFeed(DEFAULT_AGENT_FEED);
    setChatHistory([]);
  }, []);

  const handleGeneratePreview = useCallback(
    async (nextDraft: GoalDraft, announceText?: string) => {
      setIsBusy(true);
      setPendingFollowup(null);
      setMode("editing");
      setDraft(nextDraft);
      setAgentFeed(buildAnalysisActivity(nextDraft));

      if (announceText) {
        pushMessages([createUserMessage(announceText)]);
      }

      let nextPreview: GoalPlanPreviewResponse;
      try {
        nextPreview = await previewGoalPlan(buildGoalCreatePayload(nextDraft));
      } catch {
        nextPreview = buildMockPreview(nextDraft);
      }

      setPreview(nextPreview);
      setAgentFeed(
        buildAnalysisActivity({
          ...nextDraft,
          constraints: nextDraft.constraints,
        }).map((item) => ({ ...item, status: "completed" as const })),
      );

      pushMessages([
        {
          id: createMessageId("plan"),
          type: "plan_preview",
          createdAt: nowIso(),
          data: previewToPlanPreview(nextPreview, nextDraft),
        },
        {
          id: createMessageId("timeline"),
          type: "timeline_preview",
          createdAt: nowIso(),
          data: previewToTimeline(nextPreview),
        },
        {
          id: createMessageId("proposal"),
          type: "proposal_actions",
          createdAt: nowIso(),
          data: defaultProposalActions(),
        },
      ]);
      setIsBusy(false);
    },
    [pushMessages],
  );

  const handleStartGoalFlow = useCallback(
    async (prompt: string) => {
      const nextDraft = buildDraftFromPrompt(prompt, activeUserId ?? "demo-user");
      setDraft(nextDraft);
      setPreview(null);
      setCreatedGoal(null);
      setMode("reply");
      setAgentFeed(buildAnalysisActivity(nextDraft));

      pushMessages([createUserMessage(prompt)]);
      setIsBusy(true);

      // Get a dynamic, goal-specific response from Vertex AI
      const agentIntroPrompt = `The user wants to: "${prompt}". In 2-3 concise sentences, acknowledge their goal and briefly explain the day-by-day execution plan you're about to create for them. Be specific to their goal — mention key phases (e.g., for a job goal: learning, projects, interviews). End by saying you'll ask a few quick questions to customise the schedule.`;

      let agentIntro = "";
      try {
        agentIntro = await sendChatMessage(agentIntroPrompt, []);
      } catch {
        agentIntro = buildDynamicIntro(prompt, nextDraft);
      }

      const analysisData = buildAnalysisData(nextDraft);
      pushMessages([
        {
          id: createMessageId("agent_reply"),
          type: "agent_reply",
          createdAt: nowIso(),
          text: agentIntro,
        },
        {
          id: createMessageId("analysis"),
          type: "analysis",
          createdAt: nowIso(),
          data: analysisData,
        },
        {
          id: createMessageId("activity"),
          type: "activity",
          createdAt: nowIso(),
          data: buildAnalysisActivity(nextDraft),
        },
      ]);

      setIsBusy(false);

      const followup = nextFollowupQuestion(nextDraft);
      if (followup) {
        setPendingFollowup(followup);
        pushMessages([
          {
            id: followup.id,
            type: "followup",
            createdAt: nowIso(),
            data: followup,
          },
        ]);
        return;
      }

      await handleGeneratePreview(nextDraft);
    },
    [activeUserId, handleGeneratePreview, pushMessages],
  );

  const handleFollowupReply = useCallback(
    async (answer: string) => {
      if (!draft || !pendingFollowup) {
        return;
      }

      pushMessages([createUserMessage(answer)]);
      const updatedDraft = applyFollowupAnswer(draft, pendingFollowup, answer);
      setDraft(updatedDraft);

      const nextQuestion = nextFollowupQuestion(updatedDraft);
      if (nextQuestion) {
        setPendingFollowup(nextQuestion);
        pushMessages([
          {
            id: nextQuestion.id,
            type: "followup",
            createdAt: nowIso(),
            data: nextQuestion,
          },
        ]);
        return;
      }

      await handleGeneratePreview(updatedDraft);
    },
    [draft, handleGeneratePreview, pendingFollowup, pushMessages],
  );

  const handleConfirmPlan = useCallback(async () => {
    if (!draft) {
      return;
    }

    pushMessages([createUserMessage("Proceed with this plan.")]);
    setIsBusy(true);

    const progressMessageId = createMessageId("progress");
    let progress = createProgressSteps();
    pushMessages([
      {
        id: progressMessageId,
        type: "schedule_progress",
        createdAt: nowIso(),
        data: progress,
      },
    ]);

    setAgentFeed([
      {
        id: "orchestrator",
        agentName: "Orchestrator",
        currentAction: "Locking the approved goal structure",
        status: "running",
      },
      {
        id: "scheduler",
        agentName: "Scheduler",
        currentAction: "Allocating daily schedule slots",
        status: "running",
      },
      {
        id: "research",
        agentName: "Research",
        currentAction: "Finalising the day-by-day execution breakdown",
        status: "completed",
      },
      {
        id: "memory",
        agentName: "Memory",
        currentAction: "Preparing notes and workspace context",
        status: "running",
      },
    ]);

    const createPromise = createGoalPlan(buildGoalCreatePayload(draft)).catch(() =>
      Promise.resolve(buildMockCreateResponse(draft, preview ?? buildMockPreview(draft))),
    );

    const stepOrder = [
      "store-goal",
      "task-dag",
      "schedule",
      "calendar",
      "tasks",
      "notes",
      "dashboard",
    ];

    for (let index = 0; index < stepOrder.length; index += 1) {
      const currentStep = stepOrder[index];
      if (index > 0) {
        progress = advanceProgress(progress, stepOrder[index - 1], "success");
      }
      progress = advanceProgress(progress, currentStep, "running");
      updateMessage(progressMessageId, (message) =>
        message.type === "schedule_progress"
          ? { ...message, data: progress }
          : message,
      );
      await sleep(260);
    }

    const created = await createPromise;
    progress = completeProgress(progress);
    updateMessage(progressMessageId, (message) =>
      message.type === "schedule_progress"
        ? { ...message, data: progress }
        : message,
    );

    setCreatedGoal(created);
    setPreview(null);
    setPendingFollowup(null);
    setMode("goal");
    setAgentFeed(
      buildAnalysisActivity({
        ...draft,
        constraints: draft.constraints,
      }).map((item) => ({
        ...item,
        currentAction: "Execution workspace is ready",
        status: "completed" as const,
      })),
    );
    pushMessages([
      {
        id: createMessageId("sync"),
        type: "sync_success",
        createdAt: nowIso(),
        data: createSyncSuccess(created),
      },
    ]);
    setIsBusy(false);
    void refreshWorkspaceContext();
  }, [draft, preview, pushMessages, refreshWorkspaceContext, updateMessage]);

  // Handle "Adjust Timeline" with custom hours + days config from the modal
  const handleAdjustTimeline = useCallback(
    async (config: AdjustTimelineConfig) => {
      if (!draft) return;
      const daysStr = config.selectedDays.join(", ");
      const constraint = `Schedule ${config.hoursPerDay}h/day on ${daysStr} only`;
      const announceText = `Adjust timeline: ${config.hoursPerDay}h per day on ${daysStr}.`;
      await handleGeneratePreview(
        {
          ...draft,
          dailyHours: `${config.hoursPerDay} hours/day`,
          includeWeekends: config.selectedDays.some((d) => ["Sat", "Sun"].includes(d)),
          constraints: [
            ...draft.constraints.filter((c) => !c.startsWith("Schedule")),
            constraint,
          ],
        },
        announceText,
      );
    },
    [draft, handleGeneratePreview],
  );

  const handleProposalAction = useCallback(
    async (action: ProposalActionType) => {
      if (!draft) {
        return;
      }

      if (action === "proceed") {
        await handleConfirmPlan();
        return;
      }

      if (action === "edit_prompt") {
        setMode("editing");
        setComposerValue(draft.prompt);
        return;
      }

      if (action === "request_changes") {
        setMode("editing");
        setComposerValue("Reduce the workload and make the pace smoother.");
        pushMessages([createUserMessage("Please revise the proposal.")]);
        return;
      }

      if (action === "adjust_timeline") {
        // Handled directly by ProposalActionsCard modal → handleAdjustTimeline
        // This fallback runs if onAdjustTimeline wasn't wired (e.g. from TimelinePreviewCard)
        await handleGeneratePreview(
          {
            ...draft,
            constraints: [
              ...draft.constraints,
              "Rebalance the timeline across a smoother pacing plan",
            ],
          },
          "Adjust the timeline.",
        );
        return;
      }

      if (action === "reduce_workload") {
        pushMessages([createUserMessage("Reduce the workload.")]);
        await handleGeneratePreview(
          {
            ...draft,
            dailyHours: draft.dailyHours ?? "2 hours/day",
            constraints: [
              ...draft.constraints,
              "Reduce workload — fewer tasks per day, more recovery time",
            ],
          },
          undefined,
        );
        return;
      }

      if (action === "add_weekends") {
        pushMessages([createUserMessage("Add weekends to the schedule.")]);
        await handleGeneratePreview(
          {
            ...draft,
            includeWeekends: true,
            constraints: [
              ...draft.constraints,
              "Include Saturday and Sunday for study and review sessions",
            ],
          },
          undefined,
        );
        return;
      }

      if (action === "regenerate") {
        await handleGeneratePreview(draft, "Regenerate the proposal.");
      }
    },
    [draft, handleConfirmPlan, handleGeneratePreview, pushMessages],
  );

  const handleComposerSubmit = useCallback(async () => {
    const value = composerValue.trim();
    if (!value || isBusy) {
      return;
    }

    setComposerValue("");

    if (pendingFollowup) {
      await handleFollowupReply(value);
      return;
    }

    if (mode === "editing" && draft) {
      pushMessages([createUserMessage(value)]);
      setIsBusy(true);
      await handleGeneratePreview(
        {
          ...draft,
          constraints: [...draft.constraints, value],
        },
        value,
      );
      return;
    }

    if (mode === "goal") {
      const lower = value.toLowerCase();
      if (lower === "hi" || lower === "hello" || lower === "hey" || lower.length < 4) {
        // Fall through to raw chat
      } else {
        await handleStartGoalFlow(value);
        return;
      }
    }

    // Raw chat via Vertex AI
    pushMessages([createUserMessage(value)]);
    setIsBusy(true);
    setChatHistory((prev) => [...prev, { role: "user", content: value }]);

    try {
      const reply = await sendChatMessage(value, chatHistory);
      setChatHistory((prev) => [...prev, { role: "assistant", content: reply }]);
      pushMessages([
        {
          id: createMessageId("agent_reply"),
          type: "agent_reply",
          createdAt: nowIso(),
          text: reply,
        },
      ]);
    } catch {
      pushMessages([
        {
          id: createMessageId("agent_reply"),
          type: "agent_reply",
          createdAt: nowIso(),
          text: "I'm having trouble connecting to the AI right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsBusy(false);
    }
  }, [
    chatHistory,
    composerValue,
    draft,
    handleFollowupReply,
    handleGeneratePreview,
    isBusy,
    mode,
    pendingFollowup,
    pushMessages,
    handleStartGoalFlow,
  ]);

  const handleQuickAction = useCallback(
    (action: QuickActionItem["action"]) => {
      if (action === "open_dashboard") {
        router.push("/dashboard");
        return;
      }
      if (action === "view_timeline") {
        router.push("/timeline");
        return;
      }
      if (action === "see_replans") {
        router.push("/replans");
        return;
      }
      if (action === "revise") {
        setMode("editing");
        setComposerValue("Please revise the current proposal to be lighter.");
        return;
      }
      handleResetWorkspace();
    },
    [handleResetWorkspace, router],
  );

  const handleSyncAction = useCallback(
    (action: "open_dashboard" | "view_timeline" | "stay") => {
      if (action === "open_dashboard") {
        router.push("/dashboard");
        return;
      }
      if (action === "view_timeline") {
        router.push("/timeline");
      }
    },
    [router],
  );

  return {
    messages,
    composerValue,
    setComposerValue,
    mode,
    isBusy,
    welcomePrompts: WELCOME_PROMPTS,
    quickActions: QUICK_ACTIONS,
    agentFeed,
    connectedTools: tools,
    currentGoal,
    sessionStatus,
    runtimeStatus,
    handleComposerSubmit,
    handleFollowupReply,
    handleProposalAction,
    handleAdjustTimeline,
    handleQuickAction,
    handleSyncAction,
    handleStartGoalFlow,
    handleResetWorkspace,
  };
}

// ─── Dynamic Intro Fallback ───────────────────────────────────────────────────

function buildDynamicIntro(prompt: string, draft: GoalDraft): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("full stack") || lower.includes("job") || lower.includes("engineer")) {
    return `Great goal! I'll build you a complete day-by-day Full Stack engineer job prep plan — covering HTML/CSS, JavaScript, React, Node.js, databases, portfolio projects, and interview prep. Each day will have specific tasks so you always know exactly what to work on. Let me ask a few quick questions to customise your schedule.`;
  }
  if (lower.includes("devops") || lower.includes("certification") || lower.includes("aws")) {
    return `Excellent target! I'll create a structured day-by-day certification study plan with domain-by-domain coverage, practice exams, and a final review sprint. Each day will have a focused study block. Let me tailor the schedule to your availability.`;
  }
  if (lower.includes("saas") || lower.includes("product") || lower.includes("launch")) {
    return `Let's build your product! I'll plan each day from discovery through development, testing, and launch — with clear daily tasks and milestones. A few quick questions will help me size the workload correctly.`;
  }
  return `I'll create a complete day-by-day plan for "${prompt.trim()}" with specific daily tasks, milestones, and a full timeline. Let me ask a few quick questions to personalise your schedule.`;
}
