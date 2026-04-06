import {
  AgentActivityItem,
  CurrentGoalSummary,
  DashboardRead,
  FollowupQuestion,
  GoalCreatePayload,
  GoalDraft,
  GoalPlanPreviewResponse,
  GoalPlanResponse,
  ScheduleProgressData,
  ScheduleProgressStep,
  SystemStatusRead,
  TimelineGroup,
  TimelinePreviewData,
  ToolConnectionStatus,
} from "@/lib/workspace/types";
import {
  DEFAULT_PROPOSAL_ACTIONS,
  DEFAULT_TOOLS,
} from "@/lib/workspace/constants";
import { formatDayLabel, formatShortDate } from "@/lib/utils";

let counter = 0;

export function createMessageId(prefix: string) {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function buildDraftFromPrompt(
  prompt: string,
  userId = "demo-user",
): GoalDraft {
  const parsedDeadline = extractDeadline(prompt);

  return {
    userId,
    prompt,
    description: prompt,
    deadlineIso: parsedDeadline?.iso ?? null,
    deadlineLabel: parsedDeadline?.label ?? null,
    priority: null,
    constraints: [],
    dailyHours: null,
    includeWeekends: null,
    calendarSync: null,
  };
}

export function buildGoalCreatePayload(draft: GoalDraft): GoalCreatePayload {
  return {
    user_id: draft.userId,
    goal: draft.prompt,
    description: draft.description,
    deadline: draft.deadlineIso,
    priority: draft.priority,
    constraints: draft.constraints,
  };
}

export function buildAnalysisData(draft: GoalDraft) {
  return {
    goalDetected: inferGoalLabel(draft.prompt),
    timelineDetected: draft.deadlineLabel ?? "Needs confirmation",
    constraintsInferred:
      draft.constraints.length > 0
        ? draft.constraints
        : ["No explicit workload constraints yet"],
    syncRequirements: [
      draft.calendarSync === false
        ? "Calendar sync disabled"
        : "Calendar sync ready",
      "Task list preparation",
      "Notes workspace preparation",
    ],
    likelyWorkflow:
      "planning, scheduling, progress tracking, adaptive replanning",
  };
}

export function buildAnalysisActivity(draft: GoalDraft): AgentActivityItem[] {
  return [
    {
      id: createMessageId("activity"),
      agentName: "Orchestrator",
      currentAction: `Analyzing ${inferGoalLabel(draft.prompt)}`,
      status: "completed",
    },
    {
      id: createMessageId("activity"),
      agentName: "Scheduler",
      currentAction: "Checking available planning windows",
      status: draft.deadlineIso ? "completed" : "running",
    },
    {
      id: createMessageId("activity"),
      agentName: "Research",
      currentAction: "Gathering domain-specific milestones",
      status: "running",
    },
    {
      id: createMessageId("activity"),
      agentName: "Memory",
      currentAction: "Storing user preferences for future replans",
      status: draft.constraints.length ? "completed" : "running",
    },
  ];
}

export function nextFollowupQuestion(
  draft: GoalDraft,
): FollowupQuestion | null {
  if (!draft.deadlineIso) {
    return {
      id: createMessageId("followup"),
      field: "deadline",
      prompt: "What timeline should I plan for?",
      helperText:
        "I can draft the plan better once I know the target window.",
      options: [
        { label: "30 days", value: "30 days" },
        { label: "45 days", value: "45 days" },
        { label: "60 days", value: "60 days" },
        { label: "90 days", value: "90 days" },
      ],
    };
  }

  if (!draft.dailyHours) {
    return {
      id: createMessageId("followup"),
      field: "dailyHours",
      prompt: "How many focused hours can you spend per day?",
      helperText:
        "I will use this to size the workload and avoid unrealistic scheduling.",
      options: [
        { label: "2 hours/day", value: "2 hours/day" },
        { label: "3 hours/day", value: "3 hours/day" },
        { label: "4 hours/day", value: "4 hours/day" },
        { label: "Flexible", value: "Flexible" },
      ],
    };
  }

  if (draft.includeWeekends === null) {
    return {
      id: createMessageId("followup"),
      field: "includeWeekends",
      prompt: "Should weekends be included?",
      helperText:
        "Weekend availability helps the scheduler open extra recovery or deep-work blocks.",
      options: [
        { label: "Weekdays only", value: "weekdays only" },
        { label: "Include weekends", value: "include weekends" },
      ],
    };
  }

  if (!draft.priority) {
    return {
      id: createMessageId("followup"),
      field: "priority",
      prompt: "What priority should I assign?",
      helperText:
        "Priority helps the agents decide how aggressive the schedule should be.",
      options: [
        { label: "High", value: "High" },
        { label: "Balanced", value: "Balanced" },
        { label: "Flexible", value: "Flexible" },
      ],
    };
  }

  if (draft.calendarSync === null) {
    return {
      id: createMessageId("followup"),
      field: "calendarSync",
      prompt: "Do you want calendar sync enabled?",
      helperText:
        "If enabled, Telova will schedule the approved plan without extra manual steps.",
      options: [
        { label: "Sync calendar", value: "sync calendar" },
        { label: "Keep manual for now", value: "manual only" },
      ],
    };
  }

  return null;
}

export function applyFollowupAnswer(
  draft: GoalDraft,
  question: FollowupQuestion,
  answer: string,
): GoalDraft {
  const value = answer.trim();

  if (question.field === "deadline") {
    const parsed = extractDeadline(value);
    return {
      ...draft,
      deadlineIso: parsed?.iso ?? draft.deadlineIso,
      deadlineLabel: parsed?.label ?? value,
    };
  }

  if (question.field === "dailyHours") {
    return withConstraint(
      {
        ...draft,
        dailyHours: value,
      },
      `${value} available for focused work`,
    );
  }

  if (question.field === "includeWeekends") {
    const includeWeekends = value.toLowerCase().includes("include");
    return withConstraint(
      {
        ...draft,
        includeWeekends,
      },
      includeWeekends ? "Include weekends when useful" : "Weekdays only",
    );
  }

  if (question.field === "priority") {
    return {
      ...draft,
      priority: value,
    };
  }

  if (question.field === "calendarSync") {
    const syncEnabled = value.toLowerCase().includes("sync");
    return withConstraint(
      {
        ...draft,
        calendarSync: syncEnabled,
      },
      syncEnabled
        ? "Sync the approved plan to calendar"
        : "Do not sync calendar yet",
    );
  }

  return draft;
}

export function previewToPlanPreview(
  preview: GoalPlanPreviewResponse,
  draft: GoalDraft,
) {
  const strategy = unique(
    preview.tasks.map((task) => humanizePhase(task.phase)),
  );
  const milestones =
    preview.dag.milestones.length > 0
      ? preview.dag.milestones.map(
          (key) =>
            preview.tasks.find((task) => task.key === key)?.title ??
            humanizeKey(key),
        )
      : preview.tasks
          .filter((task) => task.milestone)
          .map((task) => task.title);

  return {
    goalSummary: draft.prompt,
    executionStrategy: strategy,
    milestones,
    assumptions: [
      draft.dailyHours
        ? `${draft.dailyHours} available for focused work`
        : "Daily study hours to be finalized",
      draft.includeWeekends
        ? "Weekends can absorb overflow or revision"
        : "Schedule should prioritize weekdays",
      draft.calendarSync === false
        ? "Calendar sync will wait for manual review"
        : "Calendar sync can happen automatically after approval",
      draft.priority
        ? `Priority set to ${draft.priority}`
        : "Priority will stay balanced by default",
    ],
    riskIndicators: [
      draft.includeWeekends
        ? "Sustained momentum depends on weekend energy"
        : "Weekday-only scheduling reduces recovery slack",
      "Missed focus blocks will trigger replanning",
      "High-complexity tasks should stay near the front of the plan",
    ],
    estimatedEffort: {
      totalSessions: `${preview.tasks.length} structured tasks`,
      weeklyLoad: estimateWeeklyLoad(
        preview.tasks.map((task) => task.estimated_minutes),
      ),
      horizon: formatDayLabel(preview.deadline),
    },
  };
}

export function previewToTimeline(
  preview: GoalPlanPreviewResponse,
): TimelinePreviewData {
  const groups = new Map<string, TimelineGroup>();

  preview.tasks.forEach((task, index) => {
    const groupLabel = `Week ${Math.max(1, Math.floor(index / 3) + 1)}`;

    if (!groups.has(groupLabel)) {
      groups.set(groupLabel, {
        id: groupLabel.toLowerCase().replace(/\s+/g, "-"),
        label: groupLabel,
        items: [],
      });
    }

    groups.get(groupLabel)?.items.push({
      id: task.key,
      title: task.title,
      durationLabel: `${Math.max(
        1,
        Math.round(task.estimated_minutes / 60),
      )} hr`,
      taskType: humanizePhase(task.phase),
      responsibleAgent: task.milestone
        ? "Orchestrator"
        : phaseToAgent(task.phase),
      statusPreview: task.milestone ? "Milestone" : "Ready to schedule",
    });
  });

  return {
    groups: Array.from(groups.values()),
  };
}

export function createProgressSteps(): ScheduleProgressData {
  const steps: ScheduleProgressStep[] = [
    {
      id: "store-goal",
      label: "Storing goal in database",
      detail: "Persisting the approved goal and execution context.",
      status: "running",
    },
    {
      id: "task-dag",
      label: "Creating task DAG",
      detail: "Locking the approved dependency graph.",
      status: "pending",
    },
    {
      id: "schedule",
      label: "Generating schedule",
      detail: "Placing tasks into viable focus windows.",
      status: "pending",
    },
    {
      id: "calendar",
      label: "Syncing calendar",
      detail: "Writing time blocks into the connected calendar.",
      status: "pending",
    },
    {
      id: "tasks",
      label: "Syncing tasks",
      detail: "Publishing the work queue to the task manager.",
      status: "pending",
    },
    {
      id: "notes",
      label: "Syncing notes",
      detail: "Preparing notes, assumptions, and context memory.",
      status: "pending",
    },
    {
      id: "dashboard",
      label: "Finalizing dashboard",
      detail: "Refreshing metrics, timeline visibility, and alerts.",
      status: "pending",
    },
  ];

  return {
    title: "Scheduling and sync in progress",
    steps,
  };
}

export function advanceProgress(
  progress: ScheduleProgressData,
  stepId: string,
  nextStatus: ScheduleProgressStep["status"],
) {
  return {
    ...progress,
    steps: progress.steps.map((step) =>
      step.id === stepId ? { ...step, status: nextStatus } : step,
    ),
  };
}

export function completeProgress(progress: ScheduleProgressData) {
  return {
    ...progress,
    steps: progress.steps.map((step) => ({
      ...step,
      status: "success" as const,
    })),
  };
}

export function createSyncSuccess(created: GoalPlanResponse) {
  return {
    title: "Goal setup complete",
    summary: `${created.goal.title} is live. Telova finished planning, scheduling, and sync preparation without extra manual steps.`,
    metrics: [
      { label: "Tasks created", value: String(created.tasks.length) },
      { label: "Calendar slots", value: String(created.calendar_events.length) },
      { label: "Notes prepared", value: "1 workspace summary" },
      { label: "Dashboard", value: "Updated" },
    ],
  };
}

export function toConnectedTools(systemStatus?: SystemStatusRead | null) {
  if (!systemStatus?.connections?.length) {
    return DEFAULT_TOOLS;
  }

  return systemStatus.connections.slice(0, 5).map((connection, index) => ({
    id: `${connection.name}-${index}`,
    name: connection.name,
    detail: connection.detail,
    status: normalizeToolStatus(connection.status),
  }));
}

export function toCurrentGoalSummary(
  draft: GoalDraft | null,
  preview: GoalPlanPreviewResponse | null,
  created: GoalPlanResponse | null,
  dashboard: DashboardRead | null,
): CurrentGoalSummary {
  if (created) {
    return {
      goalTitle: created.goal.title,
      stage: "Execution live",
      planStatus: "Confirmed",
      scheduleStatus: `${created.calendar_events.length} sync events created`,
      lastUpdated: formatShortDate(created.goal.updated_at),
    };
  }

  if (preview && draft) {
    return {
      goalTitle: draft.prompt,
      stage: "Proposal ready",
      planStatus: "Generated",
      scheduleStatus: "Waiting for confirmation",
      lastUpdated: formatShortDate(preview.deadline),
    };
  }

  if (draft) {
    return {
      goalTitle: draft.prompt,
      stage: "Collecting inputs",
      planStatus: "Drafting",
      scheduleStatus: "Not scheduled yet",
      lastUpdated: "Just now",
    };
  }

  const activeGoal = dashboard?.goals?.[0];
  if (activeGoal) {
    return {
      goalTitle: activeGoal.title,
      stage: humanizeKey(activeGoal.status),
      planStatus: "Existing workspace",
      scheduleStatus: "Available in dashboard",
      lastUpdated: formatShortDate(activeGoal.updated_at),
    };
  }

  return {
    goalTitle: "No active goal",
    stage: "Idle",
    planStatus: "No proposal yet",
    scheduleStatus: "Waiting for a new goal",
    lastUpdated: "No activity",
  };
}

export function defaultProposalActions() {
  return DEFAULT_PROPOSAL_ACTIONS;
}

export function buildMockPreview(draft: GoalDraft): GoalPlanPreviewResponse {
  const now = new Date();
  const deadline = draft.deadlineIso
    ? new Date(draft.deadlineIso)
    : new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

  const tasks = [
    {
      key: "foundation_setup",
      title: "Map the preparation system",
      description:
        "Define the execution structure, metrics, and checkpoints.",
      phase: "foundation",
      estimated_minutes: 180,
      depends_on: [],
      scheduled_start: now.toISOString(),
      scheduled_end: new Date(
        now.getTime() + 3 * 60 * 60 * 1000,
      ).toISOString(),
      milestone: true,
      order_index: 0,
    },
    {
      key: "core_practice",
      title: "Build the core practice loop",
      description: "Start the daily practice, recap, and review blocks.",
      phase: "practice",
      estimated_minutes: 240,
      depends_on: ["foundation_setup"],
      scheduled_start: new Date(
        now.getTime() + 2 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      scheduled_end: new Date(
        now.getTime() + 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000,
      ).toISOString(),
      milestone: false,
      order_index: 1,
    },
    {
      key: "delivery_loop",
      title: "Run execution rehearsals and reviews",
      description:
        "Practice the final simulated runs and close the biggest gaps.",
      phase: "execution",
      estimated_minutes: 210,
      depends_on: ["core_practice"],
      scheduled_start: new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      scheduled_end: new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1000 + 3.5 * 60 * 60 * 1000,
      ).toISOString(),
      milestone: true,
      order_index: 2,
    },
  ];

  return {
    domain: "generic_execution",
    deadline: deadline.toISOString(),
    summary: `Priority is set to ${draft.priority ?? "Balanced"}. Telova generated a focused progression from setup to execution.`,
    dag: {
      domain: "generic_execution",
      nodes: tasks.map((task) => ({
        key: task.key,
        title: task.title,
        phase: task.phase,
        estimated_minutes: task.estimated_minutes,
        depends_on: task.depends_on,
        scheduled_start: task.scheduled_start,
        scheduled_end: task.scheduled_end,
        milestone: task.milestone,
      })),
      edges: [
        { from_node: "foundation_setup", to_node: "core_practice" },
        { from_node: "core_practice", to_node: "delivery_loop" },
      ],
      milestones: ["foundation_setup", "delivery_loop"],
    },
    tasks,
  };
}

export function buildMockCreateResponse(
  draft: GoalDraft,
  preview: GoalPlanPreviewResponse,
): GoalPlanResponse {
  const createdAt = new Date().toISOString();
  const goalId = createMessageId("goal");
  const tasks = preview.tasks.map((task, index) => ({
    id: createMessageId("task"),
    goal_id: goalId,
    user_id: draft.userId,
    title: task.title,
    description: task.description,
    phase: task.phase,
    status: "pending",
    depends_on: task.depends_on,
    estimated_minutes: task.estimated_minutes,
    scheduled_start: task.scheduled_start,
    scheduled_end: task.scheduled_end,
    completed_at: null,
    calendar_event_id: createMessageId("event"),
    order_index: index,
  }));

  return {
    goal: {
      id: goalId,
      user_id: draft.userId,
      title: draft.prompt,
      description: draft.description,
      domain: preview.domain,
      status: "active",
      deadline: preview.deadline,
      deviation: 0.12,
      created_at: createdAt,
      updated_at: createdAt,
    },
    dag: preview.dag,
    tasks,
    calendar_events: tasks.map((task) => ({
      id: task.calendar_event_id ?? createMessageId("event"),
      user_id: draft.userId,
      goal_id: goalId,
      task_id: task.id,
      title: task.title,
      description: task.description,
      source: "calendar",
      start_at: task.scheduled_start ?? createdAt,
      end_at: task.scheduled_end ?? createdAt,
      metadata_json: {},
    })),
  };
}

function withConstraint(draft: GoalDraft, constraint: string): GoalDraft {
  if (draft.constraints.includes(constraint)) {
    return draft;
  }

  return {
    ...draft,
    constraints: [...draft.constraints, constraint],
  };
}

function extractDeadline(text: string) {
  const match = text.match(/(\d+)\s*(day|days|week|weeks|month|months)/i);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const now = new Date();
  const multiplier =
    unit.startsWith("day") ? 1 : unit.startsWith("week") ? 7 : 30;
  const deadline = new Date(
    now.getTime() + amount * multiplier * 24 * 60 * 60 * 1000,
  );

  return {
    label: `${amount} ${unit}`,
    iso: deadline.toISOString(),
  };
}

function inferGoalLabel(prompt: string) {
  return prompt.replace(/[.?!]+$/, "").trim();
}

function phaseToAgent(phase: string) {
  const normalized = phase.toLowerCase();
  if (normalized.includes("research") || normalized.includes("foundation")) {
    return "Research";
  }
  if (normalized.includes("schedule") || normalized.includes("review")) {
    return "Scheduler";
  }
  if (normalized.includes("execution") || normalized.includes("practice")) {
    return "Execution";
  }
  return "Orchestrator";
}

function humanizePhase(phase: string) {
  return phase
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function humanizeKey(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function unique(items: string[]) {
  return Array.from(new Set(items));
}

function estimateWeeklyLoad(minutes: number[]) {
  const totalHours = minutes.reduce((sum, value) => sum + value, 0) / 60;
  return `${Math.max(4, Math.round(totalHours / 2))} hrs / week`;
}

function normalizeToolStatus(status: string): ToolConnectionStatus {
  if (status === "connected") {
    return "connected";
  }
  if (status === "warning" || status === "pending") {
    return "pending";
  }
  return "disconnected";
}
