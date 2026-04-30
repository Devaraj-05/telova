"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { DEFAULT_AGENT_FEED, QUICK_ACTIONS, WELCOME_PROMPTS } from "@/lib/workspace/constants";
import {
  advanceProgress,
  applyFollowupAnswer,
  buildAIPlanPrompt,
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
  createChatSession,
  createGoalPlan,
  deleteChatSession,
  fetchDashboard,
  fetchSystemStatus,
  listChatSessions,
  previewGoalPlan,
  sendChatMessage,
  sendWorkspaceChatMessage,
  updateChatSession,
} from "@/lib/workspace/api";
import type { ChatHistoryItem } from "@/lib/workspace/api";
import type {
  ChatMessage,
  ChatPhase,
  ChatSession,
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
  const [chatPhase, setChatPhase] = useState<ChatPhase>("idle");
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasSyncedFromBackend, setHasSyncedFromBackend] = useState(false);
  const messagePersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const storedMessages = localStorage.getItem("telova_chat_messages");
      if (storedMessages) {
        const parsed = JSON.parse(storedMessages) as ChatMessage[];
        // Migrate old timeline_preview messages that lack the new `days` field
        const migrated = parsed.map((msg) => {
          if (msg.type === "timeline_preview") {
            return {
              ...msg,
              data: {
                ...msg.data,
                groups: (msg.data.groups ?? []).map((g: any) => ({
                  ...g,
                  days: g.days ?? [],
                  items: g.items ?? [],
                })),
              },
            } as ChatMessage;
          }
          return msg;
        });
        setMessages(migrated);
      } else {
        setMessages([createWelcomeMessage()]);
      }

      const storedHistory = localStorage.getItem("telova_chat_history");
      if (storedHistory) {
        setChatHistory(JSON.parse(storedHistory));
      }

      const storedSessions = localStorage.getItem("telova_chat_sessions");
      if (storedSessions) {
        setChatSessions(JSON.parse(storedSessions));
      }
      const storedActiveSession = localStorage.getItem("telova_active_session");
      if (storedActiveSession) {
        setActiveSessionId(storedActiveSession);
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
      localStorage.setItem("telova_chat_sessions", JSON.stringify(chatSessions));
      if (activeSessionId) {
        localStorage.setItem("telova_active_session", activeSessionId);
      }
    }
  }, [messages, chatHistory, chatSessions, activeSessionId, isHydrated]);

  const activeUserId = draft?.userId ?? userId;

  // Reset the backend-sync flag whenever the logged-in user changes (login/logout/switch).
  useEffect(() => {
    if (lastUserIdRef.current !== userId) {
      lastUserIdRef.current = userId;
      setHasSyncedFromBackend(false);
    }
  }, [userId]);

  // On login, replace local sessions with the user's persisted sessions from the backend.
  // Sessions in localStorage from the unauthenticated/demo flow are preserved on disk
  // but no longer shown in the sidebar, so they don't pollute the user's workspace.
  useEffect(() => {
    if (!isHydrated || !userId || hasSyncedFromBackend) return;

    let cancelled = false;
    (async () => {
      try {
        const remote = await listChatSessions("workspace");
        if (cancelled) return;

        const remoteSessions: ChatSession[] = remote.map((s) => ({
          id: s.id,
          title: s.title,
          createdAt: s.created_at,
          goalPrompt: s.goal_prompt ?? "",
        }));
        setChatSessions(remoteSessions);

        // Cache each session's messages locally so offline reads still work.
        for (const s of remote) {
          try {
            localStorage.setItem(
              `telova_session_${s.id}`,
              JSON.stringify(s.messages ?? []),
            );
          } catch {
            // localStorage quota — ignore, backend remains source of truth.
          }
        }

        // If the previously-active session no longer exists for this user, drop it.
        if (
          activeSessionId &&
          !remoteSessions.some((s) => s.id === activeSessionId)
        ) {
          setActiveSessionId(null);
          setMessages([createWelcomeMessage()]);
        } else if (activeSessionId) {
          // Refresh active session messages from backend.
          const active = remote.find((s) => s.id === activeSessionId);
          if (active && Array.isArray(active.messages)) {
            setMessages(active.messages as unknown as ChatMessage[]);
          }
        }
      } catch {
        // Backend unreachable — keep local sessions as fallback.
      } finally {
        if (!cancelled) setHasSyncedFromBackend(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isHydrated, userId, hasSyncedFromBackend, activeSessionId]);

  // Debounced persistence of the active session's messages to the backend.
  useEffect(() => {
    if (!isHydrated || !hasSyncedFromBackend || !userId || !activeSessionId) return;
    // Skip the implicit welcome-only state (don't waste a write on an empty thread).
    if (messages.length === 0) return;
    if (messages.length === 1 && messages[0].type === "welcome") return;

    if (messagePersistTimerRef.current) {
      clearTimeout(messagePersistTimerRef.current);
    }
    messagePersistTimerRef.current = setTimeout(() => {
      void updateChatSession(activeSessionId, {
        messages: messages as unknown as Array<Record<string, unknown>>,
      }).catch(() => {
        // Backend unreachable — localStorage already holds the latest state.
      });
    }, 800);

    return () => {
      if (messagePersistTimerRef.current) {
        clearTimeout(messagePersistTimerRef.current);
        messagePersistTimerRef.current = null;
      }
    };
  }, [messages, activeSessionId, userId, isHydrated, hasSyncedFromBackend]);

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

  const showThinking = useCallback((): string => {
    const id = createMessageId("thinking");
    setMessages((current) => [
      ...current,
      { id, type: "thinking", createdAt: nowIso() },
    ]);
    return id;
  }, []);

  const resolveThinking = useCallback((thinkingId: string, text: string) => {
    setMessages((current) =>
      current.map((m) =>
        m.id === thinkingId
          ? ({ id: thinkingId, type: "agent_reply", text, createdAt: nowIso() } as ChatMessage)
          : m,
      ),
    );
  }, []);

  const handleResetWorkspace = useCallback(() => {
    setMessages([createWelcomeMessage()]);
    setComposerValue("");
    setMode("goal");
    setChatPhase("idle");
    setPendingFollowup(null);
    setDraft(null);
    setPreview(null);
    setCreatedGoal(null);
    setAgentFeed(DEFAULT_AGENT_FEED);
    setChatHistory([]);
    localStorage.removeItem("telova_chat_messages");
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
      let usedMockPreview = false;
      try {
        nextPreview = await previewGoalPlan(buildGoalCreatePayload(nextDraft));
      } catch {
        nextPreview = buildMockPreview(nextDraft);
        usedMockPreview = true;
      }

      if (usedMockPreview) {
        pushMessages([
          {
            id: createMessageId("agent_reply"),
            type: "agent_reply",
            createdAt: nowIso(),
            text: "**Demo Mode** — The planning service is temporarily unavailable. Showing a sample plan to illustrate the flow. Start the backend (`uvicorn telova_api.main:app --reload`) to generate a real personalized plan.",
          },
        ]);
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
          id: createMessageId("timeline"),
          type: "timeline_preview",
          createdAt: nowIso(),
          data: previewToTimeline(nextPreview, nextDraft),
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

  // Generate a full AI plan after all preferences are collected
  const handleGenerateAIPlan = useCallback(
    async (completedDraft: GoalDraft) => {
      setIsBusy(true);
      setChatPhase("generating_plan");

      const planPrompt = buildAIPlanPrompt(completedDraft);

      const planThinkingId = showThinking();
      let aiPlan = "";
      try {
        aiPlan = await sendChatMessage(planPrompt, chatHistory);
        setChatHistory((prev) => [
          ...prev,
          { role: "user", content: planPrompt },
          { role: "assistant", content: aiPlan },
        ]);
      } catch {
        aiPlan = buildDynamicIntro(completedDraft.prompt, completedDraft);
      }
      resolveThinking(planThinkingId, aiPlan);

      const updatedDraft = {
        ...completedDraft,
        detailedPlanText: aiPlan,
      };
      setDraft(updatedDraft);

      setIsBusy(false);
      setChatPhase("plan_shown");

      // Ask if they want to turn it into a calendar schedule (plain text, no buttons)
      const calendarFollowup: FollowupQuestion = {
        id: createMessageId("followup"),
        field: "calendarSync",
        prompt: "Would you like me to turn this into a day-by-day calendar schedule? I can create a visual timeline with daily tasks and sync them to your Google Calendar and Tasks.\n\nJust reply yes or no.",
        helperText: "",
        options: [],
      };
      setPendingFollowup(calendarFollowup);
      pushMessages([
        {
          id: calendarFollowup.id,
          type: "agent_reply",
          createdAt: nowIso(),
          text: calendarFollowup.prompt,
        },
      ]);
    },
    [chatHistory, pushMessages, showThinking, resolveThinking],
  );

  const handleStartGoalFlow = useCallback(
    async (prompt: string) => {
      const nextDraft = buildDraftFromPrompt(prompt, activeUserId ?? "demo-user");
      setDraft(nextDraft);
      setPreview(null);
      setCreatedGoal(null);
      setMode("reply");
      setChatPhase("asking_background");

      // Create a new chat session — use backend ID when authenticated so the
      // session persists across devices; fall back to a local ID otherwise.
      const fallbackId = createMessageId("session");
      const sessionTitle =
        prompt.length > 50 ? prompt.slice(0, 50) + "..." : prompt;
      let sessionId = fallbackId;

      if (userId) {
        try {
          const created = await createChatSession({
            kind: "workspace",
            title: sessionTitle,
            goal_prompt: prompt,
            messages: [],
          });
          sessionId = created.id;
        } catch {
          // Backend unreachable — keep the local fallback ID.
        }
      }

      const newSession: ChatSession = {
        id: sessionId,
        title: sessionTitle,
        createdAt: nowIso(),
        goalPrompt: prompt,
      };
      setChatSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(sessionId);

      pushMessages([createUserMessage(prompt)]);
      setIsBusy(true);

      // Get a dynamic, goal-specific intro from Vertex AI (no analysis/activity cards)
      const agentIntroPrompt = `The user wants to: "${prompt}". In 2-3 concise sentences, acknowledge their goal and briefly explain that you'll create a personalized day-by-day plan for them. Be specific to their goal. End by saying you need to know a bit about their background first to make the plan right.`;

      const introThinkingId = showThinking();
      let agentIntro = "";
      try {
        agentIntro = await sendChatMessage(agentIntroPrompt, []);
        setChatHistory([
          { role: "user", content: agentIntroPrompt },
          { role: "assistant", content: agentIntro },
        ]);
      } catch {
        agentIntro = buildDynamicIntro(prompt, nextDraft);
      }
      resolveThinking(introThinkingId, agentIntro);

      setIsBusy(false);

      // First followup: ask about background as plain text (no option buttons)
      const followup = nextFollowupQuestion(nextDraft);
      if (followup) {
        setPendingFollowup(followup);
        pushMessages([
          {
            id: followup.id,
            type: "agent_reply",
            createdAt: nowIso(),
            text: followup.prompt + (followup.helperText ? `\n\n${followup.helperText}` : ""),
          },
        ]);
        return;
      }

      await handleGenerateAIPlan(nextDraft);
    },
    [activeUserId, handleGenerateAIPlan, pushMessages, showThinking, resolveThinking],
  );

  const handleFollowupReply = useCallback(
    async (answer: string) => {
      if (!draft || !pendingFollowup) {
        return;
      }

      pushMessages([createUserMessage(answer)]);
      const updatedDraft = applyFollowupAnswer(draft, pendingFollowup, answer);
      setDraft(updatedDraft);

      // If this was the calendar sync question (after AI plan), generate timeline preview
      if (pendingFollowup.field === "calendarSync" && chatPhase === "plan_shown") {
        setPendingFollowup(null);
        const syncEnabled = answer.toLowerCase().includes("sync") || answer.toLowerCase().includes("yes");
        if (syncEnabled) {
          setChatPhase("calendar_confirm");
          await handleGeneratePreview(updatedDraft);
        } else {
          setChatPhase("idle");
          pushMessages([
            {
              id: createMessageId("agent_reply"),
              type: "agent_reply",
              createdAt: nowIso(),
              text: "No problem! Your plan is ready above. You can always come back and sync it to your calendar later. Just type 'sync calendar' when you're ready.",
            },
          ]);
          setMode("goal");
        }
        return;
      }

      // Check for next preference question (background → deadline → hours → days → priority)
      const nextQuestion = nextFollowupQuestion(updatedDraft);
      if (nextQuestion) {
        setPendingFollowup(nextQuestion);
        setChatPhase("collecting_preferences");
        pushMessages([
          {
            id: nextQuestion.id,
            type: "agent_reply",
            createdAt: nowIso(),
            text: nextQuestion.prompt + (nextQuestion.helperText ? `\n\n${nextQuestion.helperText}` : ""),
          },
        ]);
        return;
      }

      // All preferences collected — generate AI plan (not static preview)
      await handleGenerateAIPlan(updatedDraft);
    },
    [draft, handleGenerateAIPlan, handleGeneratePreview, pendingFollowup, pushMessages, chatPhase],
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

    let _usedMockCreate = false;
    const createPromise = createGoalPlan(buildGoalCreatePayload(draft)).catch(() => {
      _usedMockCreate = true;
      return Promise.resolve(buildMockCreateResponse(draft, preview ?? buildMockPreview(draft)));
    });

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
    const syncMessages: typeof messages = [
      {
        id: createMessageId("sync"),
        type: "sync_success",
        createdAt: nowIso(),
        data: createSyncSuccess(created),
      },
    ];
    if (_usedMockCreate) {
      syncMessages.push({
        id: createMessageId("agent_reply"),
        type: "agent_reply",
        createdAt: nowIso(),
        text: "**Demo Mode** — Goal was created using sample data because the backend was unreachable. Start `uvicorn telova_api.main:app --reload` to persist real goals, tasks, and calendar events.",
      });
    }
    pushMessages(syncMessages);
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

    // Raw chat via workspace-aware Vertex AI
    pushMessages([createUserMessage(value)]);
    setIsBusy(true);
    setChatHistory((prev) => [...prev, { role: "user", content: value }]);

    const chatThinkingId = showThinking();
    try {
      const result = await sendWorkspaceChatMessage(
        activeUserId ?? "demo-user",
        value,
        chatHistory,
        createdGoal?.goal?.id,
      );
      const reply = result.message;
      setChatHistory((prev) => [...prev, { role: "assistant", content: reply }]);
      resolveThinking(chatThinkingId, reply);
    } catch {
      resolveThinking(
        chatThinkingId,
        "I couldn't reach the planning agent right now. Please try again in a moment.",
      );
    } finally {
      setIsBusy(false);
    }
  }, [
    activeUserId,
    chatHistory,
    composerValue,
    createdGoal,
    draft,
    handleFollowupReply,
    handleGeneratePreview,
    handleGenerateAIPlan,
    isBusy,
    mode,
    pendingFollowup,
    pushMessages,
    handleStartGoalFlow,
    showThinking,
    resolveThinking,
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

  const handleSwitchSession = useCallback(
    (sessionId: string) => {
      if (sessionId === activeSessionId) return;
      // Save current messages under current session
      if (activeSessionId) {
        localStorage.setItem(`telova_session_${activeSessionId}`, JSON.stringify(messages));
      }
      // Load the target session's messages
      const stored = localStorage.getItem(`telova_session_${sessionId}`);
      if (stored) {
        setMessages(JSON.parse(stored));
      } else {
        setMessages([createWelcomeMessage()]);
      }
      setActiveSessionId(sessionId);
      setPendingFollowup(null);
      setDraft(null);
      setPreview(null);
      setCreatedGoal(null);
      setChatPhase("idle");
      setMode("goal");
    },
    [activeSessionId, messages],
  );

  const handleNewChat = useCallback(() => {
    // Save current session messages
    if (activeSessionId) {
      localStorage.setItem(`telova_session_${activeSessionId}`, JSON.stringify(messages));
    }
    handleResetWorkspace();
    setActiveSessionId(null);
  }, [activeSessionId, handleResetWorkspace, messages]);

  const handleRenameSession = useCallback(
    async (sessionId: string, nextTitle: string) => {
      const trimmed = nextTitle.trim();
      if (!trimmed) return;

      setChatSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: trimmed } : s)),
      );

      if (userId) {
        try {
          await updateChatSession(sessionId, { title: trimmed });
        } catch {
          // Local update stays; backend will catch up on next successful write.
        }
      }
    },
    [userId],
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      const wasActive = sessionId === activeSessionId;

      setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
      try {
        localStorage.removeItem(`telova_session_${sessionId}`);
      } catch {
        // ignore storage errors
      }

      if (wasActive) {
        setActiveSessionId(null);
        setMessages([createWelcomeMessage()]);
        setPendingFollowup(null);
        setDraft(null);
        setPreview(null);
        setCreatedGoal(null);
        setChatPhase("idle");
        setMode("goal");
      }

      if (userId) {
        try {
          await deleteChatSession(sessionId);
        } catch {
          // Backend unreachable — local state is updated; will resync on next login.
        }
      }
    },
    [activeSessionId, userId],
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
    chatSessions,
    activeSessionId,
    handleComposerSubmit,
    handleFollowupReply,
    handleProposalAction,
    handleAdjustTimeline,
    handleQuickAction,
    handleSyncAction,
    handleStartGoalFlow,
    handleResetWorkspace,
    handleSwitchSession,
    handleNewChat,
    handleRenameSession,
    handleDeleteSession,
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
