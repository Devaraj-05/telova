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
  TimelineDayGroup,
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
    background: null,
    deadlineIso: parsedDeadline?.iso ?? null,
    deadlineLabel: parsedDeadline?.label ?? null,
    priority: null,
    constraints: [],
    dailyHours: null,
    includeWeekends: null,
    calendarSync: null,
    detailedPlanText: null,
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
    detailed_plan_text: draft.detailedPlanText,
  };
}

export function buildAnalysisData(draft: GoalDraft) {
  const domain = detectGoalDomain(draft.prompt);
  const domainInsights = getDomainInsights(domain, draft.prompt);

  return {
    goalDetected: inferGoalLabel(draft.prompt),
    timelineDetected: draft.deadlineLabel ?? "Needs confirmation",
    constraintsInferred:
      draft.constraints.length > 0
        ? draft.constraints
        : domainInsights.constraints,
    syncRequirements: [
      draft.calendarSync === false
        ? "Calendar sync disabled"
        : "Calendar sync ready — daily tasks will appear on your calendar",
      "Task list: each day's work will be added as tasks",
      "Notes workspace: weekly summaries and progress notes",
    ],
    likelyWorkflow: domainInsights.workflow,
  };
}

export function buildAnalysisActivity(draft: GoalDraft): AgentActivityItem[] {
  const domain = detectGoalDomain(draft.prompt);
  const label = inferGoalLabel(draft.prompt);
  return [
    {
      id: createMessageId("activity"),
      agentName: "Orchestrator",
      currentAction: `Analyzing "${label}" and mapping execution path`,
      status: "completed",
    },
    {
      id: createMessageId("activity"),
      agentName: "Scheduler",
      currentAction: domain === "job_search"
        ? "Calculating daily study blocks and interview windows"
        : "Mapping daily work blocks across your schedule",
      status: draft.deadlineIso ? "completed" : "running",
    },
    {
      id: createMessageId("activity"),
      agentName: "Research",
      currentAction: getDomainResearchAction(domain),
      status: "running",
    },
    {
      id: createMessageId("activity"),
      agentName: "Memory",
      currentAction: "Storing preferences for adaptive replanning",
      status: draft.constraints.length ? "completed" : "running",
    },
  ];
}

export function nextFollowupQuestion(
  draft: GoalDraft,
): FollowupQuestion | null {
  if (!draft.background) {
    return {
      id: createMessageId("followup"),
      field: "background",
      prompt: "Tell me about your background related to this goal.",
      helperText:
        "This helps me tailor the plan to your current skill level and experience. The more specific you are, the better the plan.",
      options: [
        { label: "Complete beginner", value: "I'm a complete beginner with no prior experience in this area." },
        { label: "Some basics", value: "I have some basic knowledge but need structured guidance." },
        { label: "Intermediate", value: "I have intermediate experience and want to level up quickly." },
        { label: "Switching fields", value: "I'm experienced in a different field and transitioning into this one." },
      ],
    };
  }

  if (!draft.deadlineIso) {
    const deadlineOptions = getDeadlineOptions(draft.prompt);
    return {
      id: createMessageId("followup"),
      field: "deadline",
      prompt: "What's your target timeline for this goal?",
      helperText:
        "Reply with a duration, for example: 1 week, 1 month, 1.5 months, 1 and a half months, 2 months, 1 year, or 2 years. I'll schedule only within that target timeline; available days come next.",
      options: deadlineOptions,
    };
  }

  if (!draft.dailyHours) {
    return {
      id: createMessageId("followup"),
      field: "dailyHours",
      prompt: "How many focused hours can you commit per day?",
      helperText:
        "I'll use this to plan each day's workload. I'll schedule specific tasks and learning blocks for each day.",
      options: [
        { label: "1 hr/day", value: "1 hour/day" },
        { label: "2 hrs/day", value: "2 hours/day" },
        { label: "3 hrs/day", value: "3 hours/day" },
        { label: "4+ hrs/day", value: "4 hours/day" },
      ],
    };
  }

  if (draft.includeWeekends === null) {
    return {
      id: createMessageId("followup"),
      field: "includeWeekends",
      prompt: "Which days of the week are you available?",
      helperText:
        "I'll schedule daily tasks only on your available days. Both weekdays and weekends can be used for different types of work.",
      options: [
        { label: "Mon – Fri only", value: "weekdays only" },
        { label: "Mon – Sat (light weekend)", value: "monday to saturday" },
        { label: "All 7 days (fastest path)", value: "include weekends" },
        { label: "Weekends only", value: "weekends only" },
      ],
    };
  }

  if (!draft.priority) {
    return {
      id: createMessageId("followup"),
      field: "priority",
      prompt: "What intensity level suits you best?",
      helperText:
        "This shapes how aggressive the daily schedule is. High priority means more tasks per day.",
      options: [
        { label: "High — push hard, fast progress", value: "High" },
        { label: "Balanced — steady and sustainable", value: "Balanced" },
        { label: "Light — low pressure, long runway", value: "Flexible" },
      ],
    };
  }

  // calendarSync is now asked after AI plan is shown (in useWorkspaceController)
  return null;
}

export function applyFollowupAnswer(
  draft: GoalDraft,
  question: FollowupQuestion,
  answer: string,
): GoalDraft {
  const value = answer.trim();

  if (question.field === "background") {
    return {
      ...draft,
      background: value,
    };
  }

  if (question.field === "deadline") {
    const parsed =
      extractDeadline(value) ??
      inferDefaultDeadline(draft.prompt);
    const nextDraft = {
      ...draft,
      deadlineIso: parsed.iso,
      deadlineLabel: parsed.label,
    };
    return applyAvailabilityHint(nextDraft, value);
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
    const lower = value.toLowerCase();
    const includeWeekends = lower.includes("include") || lower.includes("saturday") || lower.includes("weekend");
    const weekendsOnly = lower.includes("weekends only");
    const constraint = weekendsOnly
      ? "Weekends only — schedule on Saturday and Sunday"
      : includeWeekends
      ? "Include weekends when useful"
      : "Weekdays only — Monday to Friday";
    return withConstraint(
      {
        ...draft,
        includeWeekends: includeWeekends || weekendsOnly,
      },
      constraint,
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
        ? `${draft.dailyHours} of focused work planned per day`
        : "Daily study hours to be finalized",
      draft.includeWeekends
        ? "Weekends included for overflow and review"
        : "Schedule prioritises weekdays (Mon–Fri)",
      draft.calendarSync === false
        ? "Calendar sync will wait for manual review"
        : "Each day's tasks will sync to your calendar automatically",
      draft.priority
        ? `Priority: ${draft.priority}`
        : "Priority set to Balanced by default",
    ],
    riskIndicators: [
      draft.includeWeekends
        ? "Weekend sessions require sustained motivation"
        : "Weekday-only scheduling leaves no buffer for catch-up",
      "Missed focus blocks trigger automatic replanning",
      "High-complexity tasks are front-loaded for peak focus",
    ],
    estimatedEffort: {
      totalSessions: `${preview.tasks.length} daily tasks planned`,
      weeklyLoad: estimateWeeklyLoad(
        preview.tasks.map((task) => task.estimated_minutes),
      ),
      horizon: formatDayLabel(preview.deadline),
    },
    runtime: preview.planning_runtime,
  };
}

export function previewToTimeline(
  preview: GoalPlanPreviewResponse,
  draft?: GoalDraft | null,
): TimelinePreviewData {
  const deadlineDate = new Date(preview.deadline);
  const now = new Date();
  const totalDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));

  // Determine which days of the week are allowed
  const includeWeekends = draft?.includeWeekends ?? true;
  const weekendsOnly = draft?.constraints?.some((c) => c.toLowerCase().includes("weekends only")) ?? false;
  const hoursPerDay = extractHoursNumber(draft?.dailyHours ?? null) ?? 2;

  function isDayAllowed(date: Date): boolean {
    const dow = date.getDay(); // 0=Sun, 6=Sat
    if (weekendsOnly) return dow === 0 || dow === 6;
    if (!includeWeekends) return dow >= 1 && dow <= 5; // Mon-Fri
    return true;
  }

  // Build a list of allowed dates from now to deadline
  const allowedDates: Date[] = [];
  for (let d = 0; d < totalDays && d < 365; d++) {
    const date = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
    if (isDayAllowed(date)) allowedDates.push(date);
  }

  // Distribute tasks across allowed dates
  const tasksPerDay = Math.max(1, Math.ceil(preview.tasks.length / Math.max(1, allowedDates.length)));
  let taskIdx = 0;

  const groups: TimelineGroup[] = [];

  for (let weekIdx = 0; weekIdx < totalWeeks; weekIdx++) {
    const weekStart = new Date(now.getTime() + weekIdx * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

    const weekLabel = `Week ${weekIdx + 1}`;
    const dateRange = `${formatShortDate(weekStart.toISOString())} – ${formatShortDate(weekEnd.toISOString())}`;

    const days: TimelineDayGroup[] = [];
    const flatItems: typeof groups[0]["items"] = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const dayDate = new Date(weekStart.getTime() + dayOffset * 24 * 60 * 60 * 1000);

      // Skip days that are not allowed (e.g., weekends when user selected Mon-Fri)
      if (!isDayAllowed(dayDate)) continue;

      // Skip if we've run out of tasks
      if (taskIdx >= preview.tasks.length) continue;

      const dayIso = dayDate.toISOString().slice(0, 10);
      const dayLabel = dayDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });

      const endIdx = Math.min(taskIdx + tasksPerDay, preview.tasks.length);
      const dayTasks = preview.tasks.slice(taskIdx, endIdx);
      taskIdx = endIdx;

      if (dayTasks.length === 0) continue;

      const dayItems = dayTasks.map((task) => ({
        id: task.key,
        title: task.title,
        durationLabel: `${hoursPerDay} hr`,
        taskType: humanizePhase(task.phase),
        responsibleAgent: task.milestone ? "Orchestrator" : phaseToAgent(task.phase),
        statusPreview: task.milestone ? "Milestone — key checkpoint" : "Scheduled",
        specificTasks: task.description
          ? task.description.split(".").filter((s) => s.trim().length > 4).slice(0, 3).map((s) => s.trim())
          : undefined,
      }));

      days.push({ date: dayIso, dayLabel, items: dayItems });
      flatItems.push(...dayItems);
    }

    if (days.length > 0 || flatItems.length > 0) {
      groups.push({
        id: `week-${weekIdx + 1}`,
        label: weekLabel,
        dateRange,
        days,
        items: flatItems,
      });
    }
  }

  return {
    groups,
    totalWeeks,
    goalTitle: preview.summary?.split(".")[0] ?? undefined,
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
      label: "Creating daily task plan",
      detail: "Building a day-by-day task graph for the full timeline.",
      status: "pending",
    },
    {
      id: "schedule",
      label: "Generating schedule",
      detail: "Placing each day's tasks into your available focus windows.",
      status: "pending",
    },
    {
      id: "calendar",
      label: "Syncing calendar",
      detail: "Writing daily task blocks into your connected calendar.",
      status: "pending",
    },
    {
      id: "tasks",
      label: "Syncing tasks",
      detail: "Publishing the day-by-day work queue to your task manager.",
      status: "pending",
    },
    {
      id: "notes",
      label: "Syncing notes",
      detail: "Preparing weekly summaries, assumptions, and context memory.",
      status: "pending",
    },
    {
      id: "dashboard",
      label: "Finalising dashboard",
      detail: "Refreshing metrics, timeline visibility, and progress alerts.",
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
    summary: `${created.goal.title} is live. Telova has planned each day's work, synced your calendar, and prepared your task list — no manual steps needed.`,
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
      scheduleStatus: `${created.calendar_events.length} daily blocks created`,
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
    : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const totalDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const domain = detectGoalDomain(draft.prompt);
  const tasks =
    parseDetailedPlanTasks(draft, now) ??
    generateGoalTasks(domain, draft.prompt, totalDays, now, draft);

  return {
    domain,
    deadline: deadline.toISOString(),
    summary: buildGoalSummary(draft, domain, tasks.length),
    dag: {
      domain,
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
      edges: tasks
        .filter((_, i) => i > 0)
        .map((task, i) => ({ from_node: tasks[i].key, to_node: task.key })),
      milestones: tasks.filter((t) => t.milestone).map((t) => t.key),
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

  // Persist timeline tasks to localStorage so the Timeline page can show them
  if (typeof window !== "undefined") {
    const calendarTasks = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      durationLabel: `${Math.max(1, Math.round(task.estimated_minutes / 60))} hr`,
      taskType: humanizePhase(task.phase),
      date: task.scheduled_start?.slice(0, 10) ?? createdAt.slice(0, 10),
      status: "pending" as const,
      details: task.description,
      specificTasks: splitTaskDetails(task.description),
      timeLabel:
        task.scheduled_start && task.scheduled_end
          ? formatTimeRange(task.scheduled_start, task.scheduled_end)
          : undefined,
    }));
    localStorage.setItem("telova_timeline_tasks", JSON.stringify(calendarTasks));
    localStorage.setItem(
      "telova_created_goal",
      JSON.stringify({ title: draft.prompt, deadline: preview.deadline, tasks: calendarTasks }),
    );
  }

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

// ─── Domain Detection ─────────────────────────────────────────────────────────

function detectGoalDomain(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (
    lower.includes("full stack") || lower.includes("fullstack") ||
    lower.includes("frontend") || lower.includes("backend") ||
    lower.includes("software engineer") || lower.includes("developer job") ||
    lower.includes("get a job") || lower.includes("job in") ||
    lower.includes("web developer") || lower.includes("coding job")
  ) return "job_search_tech";
  if (
    lower.includes("devops") || lower.includes("aws") ||
    lower.includes("kubernetes") || lower.includes("docker") ||
    lower.includes("certification") || lower.includes("certified")
  ) return "certification";
  if (
    lower.includes("saas") || lower.includes("startup") ||
    lower.includes("product") || lower.includes("launch") ||
    lower.includes("mvp") || lower.includes("app")
  ) return "product_launch";
  if (
    lower.includes("fitness") || lower.includes("workout") ||
    lower.includes("gym") || lower.includes("health") ||
    lower.includes("weight") || lower.includes("run")
  ) return "fitness";
  if (
    lower.includes("learn") || lower.includes("course") ||
    lower.includes("study") || lower.includes("skill")
  ) return "skill_learning";
  return "generic";
}

function getDomainInsights(domain: string, prompt: string) {
  switch (domain) {
    case "job_search_tech":
      return {
        constraints: ["Portfolio projects needed", "Interview prep required", "Resume and LinkedIn optimisation"],
        workflow: "skill gap analysis → daily coding practice → portfolio builds → mock interviews → job applications",
      };
    case "certification":
      return {
        constraints: ["Study schedule around existing work", "Practice exam sessions needed"],
        workflow: "syllabus breakdown → daily study blocks → practice tests → revision → exam",
      };
    case "product_launch":
      return {
        constraints: ["Development sprints required", "User feedback loops needed"],
        workflow: "spec & design → build → test → feedback → launch",
      };
    case "fitness":
      return {
        constraints: ["Rest days required", "Progressive overload needed"],
        workflow: "assessment → progressive training → nutrition alignment → habit tracking",
      };
    default:
      return {
        constraints: ["No explicit workload constraints yet"],
        workflow: "planning → execution → review → refinement",
      };
  }
}

function getDomainResearchAction(domain: string): string {
  switch (domain) {
    case "job_search_tech": return "Mapping Full Stack roadmap: HTML → CSS → JS → React → Node → DB → Portfolio";
    case "certification": return "Gathering certification syllabus and high-yield study topics";
    case "product_launch": return "Researching MVP scoping and launch checklist";
    case "fitness": return "Building progressive training periodization plan";
    default: return "Gathering domain-specific milestones and best practices";
  }
}

function getDeadlineOptions(prompt: string) {
  const lower = prompt.toLowerCase();
  if (lower.includes("job") || lower.includes("engineer")) {
    return [
      { label: "1 month", value: "1 month" },
      { label: "1.5 months", value: "1.5 months" },
      { label: "2 months", value: "2 months" },
      { label: "6 months", value: "6 months" },
      { label: "1 year", value: "1 year" },
    ];
  }
  return [
    { label: "1 week", value: "1 week" },
    { label: "1 month", value: "1 month" },
    { label: "1.5 months", value: "1.5 months" },
    { label: "2 months", value: "2 months" },
    { label: "1 year", value: "1 year" },
  ];
}

// ─── Goal-Aware Task Generator ─────────────────────────────────────────────────

interface PreviewTask {
  key: string;
  title: string;
  description: string;
  phase: string;
  estimated_minutes: number;
  depends_on: string[];
  scheduled_start: string;
  scheduled_end: string;
  milestone: boolean;
  order_index: number;
}

const DETAILED_DAY_LINE_RE =
  /^\s*(?:[-*]\s*)?(?:\*\*)?Day\s+(\d+)\s*\(([^)]*)\)\s*:\s*(?:\*\*)?\s*(.+?)\s*(?:\*\*)?\s*$/i;
const DETAILED_PHASE_LINE_RE =
  /^\s*(?:[-*]\s*)?(?:\*\*)?Phase\s+(\d+)\s*:\s*(.+?)(?:\s+[—–-]\s+Week.*)?\s*(?:\*\*)?\s*$/i;
const DETAILED_DURATION_RE =
  /^(.+?)\s*[—–-]\s*(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\.?\s*(.*)$/i;
const DETAILED_DEFAULT_HOURS_RE =
  /(?:Daily Commitment|Hours per day)\s*:\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i;

function parseDetailedPlanTasks(
  draft: GoalDraft,
  startDate: Date,
): PreviewTask[] | null {
  const planText = draft.detailedPlanText?.trim();
  if (!planText) {
    return null;
  }

  const explicitHours = extractHoursNumber(draft.dailyHours);
  const fallbackHoursMatch = planText.match(DETAILED_DEFAULT_HOURS_RE);
  const defaultMinutes = Math.max(
    30,
    Math.round(
      (explicitHours ?? Number(fallbackHoursMatch?.[1] ?? "2")) * 60,
    ),
  );

  const tasks: Array<{
    dayNumber: number;
    key: string;
    title: string;
    description: string;
    phase: string;
    estimatedMinutes: number;
    milestone: boolean;
  }> = [];
  let currentPhase = "execution";

  for (const rawLine of planText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const phaseMatch = line.match(DETAILED_PHASE_LINE_RE);
    if (phaseMatch) {
      currentPhase = normalizeDetailedPhase(phaseMatch[2], phaseMatch[1]);
      continue;
    }

    const dayMatch = line.match(DETAILED_DAY_LINE_RE);
    if (!dayMatch) {
      continue;
    }

    const dayNumber = Number(dayMatch[1]);
    let body = dayMatch[3].trim();
    const milestone = /(✅|☑️|✔️|\bmilestone\b)/i.test(body);
    body = body
      .replace(/\s*(?:✅|☑️|✔️)\s*Milestone\b/gi, "")
      .replace(/\bMilestone\b/gi, "")
      .trim();

    const durationMatch = body.match(DETAILED_DURATION_RE);
    const rawTitle = (durationMatch?.[1] ?? body).trim().replace(/^[*-]\s*/, "");
    const detail = (durationMatch?.[3] ?? "").trim();
    const estimatedMinutes = durationMatch
      ? Math.max(30, Math.round(Number(durationMatch[2]) * 60))
      : defaultMinutes;
    const durationHours = estimatedMinutes / 60;
    const durationLabel = Number.isInteger(durationHours)
      ? String(durationHours)
      : durationHours.toFixed(1).replace(/\.0$/, "");

    if (!rawTitle) {
      continue;
    }

    tasks.push({
      dayNumber,
      key: buildDetailedTaskKey(dayNumber, rawTitle),
      title: `Day ${dayNumber}: ${rawTitle} — ${durationLabel}h`,
      description: detail || "Complete the planned focus block for this day.",
      phase: currentPhase,
      estimatedMinutes,
      milestone,
    });
  }

  if (tasks.length === 0) {
    return null;
  }

  const scheduledDates = buildAllowedScheduleDates(tasks.length, startDate, draft);

  return tasks.map((task, index) => {
    const scheduledDay = scheduledDates[index] ?? scheduledDates[scheduledDates.length - 1];
    const start = new Date(scheduledDay);
    const end = new Date(start.getTime() + task.estimatedMinutes * 60 * 1000);
    return {
      key: task.key,
      title: task.title,
      description: task.description,
      phase: task.phase,
      estimated_minutes: task.estimatedMinutes,
      depends_on: index > 0 ? [tasks[index - 1].key] : [],
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      milestone: task.milestone,
      order_index: index,
    };
  });
}

function buildAllowedScheduleDates(
  count: number,
  startDate: Date,
  draft: GoalDraft,
): Date[] {
  const dates: Date[] = [];
  const weekendsOnly = draft.constraints.some((constraint) =>
    constraint.toLowerCase().includes("weekends only"),
  );

  for (let offset = 0; dates.length < count && offset < count * 4 + 30; offset += 1) {
    const candidate = new Date(startDate.getTime() + offset * 24 * 60 * 60 * 1000);
    const dayOfWeek = candidate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (weekendsOnly) {
      if (!isWeekend) {
        continue;
      }
    } else if (draft.includeWeekends === false && isWeekend) {
      continue;
    }

    dates.push(candidate);
  }

  return dates.length > 0 ? dates : [new Date(startDate)];
}

function normalizeDetailedPhase(title: string, phaseNumber: string): string {
  const slug = slugifyDetailedValue(title);
  return slug ? `phase_${phaseNumber}_${slug}` : `phase_${phaseNumber}`;
}

function buildDetailedTaskKey(dayNumber: number, title: string): string {
  const slug = slugifyDetailedValue(title).split("_").slice(0, 5).join("_");
  return slug ? `day_${dayNumber}_${slug}` : `day_${dayNumber}`;
}

function slugifyDetailedValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function generateGoalTasks(
  domain: string,
  prompt: string,
  totalDays: number,
  startDate: Date,
  draft: GoalDraft,
): PreviewTask[] {
  switch (domain) {
    case "job_search_tech": return generateFullStackJobTasks(totalDays, startDate, draft);
    case "certification": return generateCertificationTasks(totalDays, startDate, draft, prompt);
    case "product_launch": return generateProductLaunchTasks(totalDays, startDate, draft);
    case "fitness": return generateFitnessTasks(totalDays, startDate, draft);
    case "skill_learning": return generateSkillLearningTasks(totalDays, startDate, draft, prompt);
    default: return generateGenericTasks(totalDays, startDate, draft);
  }
}

function makeTask(
  index: number,
  key: string,
  title: string,
  description: string,
  phase: string,
  minutes: number,
  startDate: Date,
  dayOffset: number,
  milestone = false,
  dependsOn: string[] = [],
): PreviewTask {
  const start = new Date(startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + minutes * 60 * 1000);
  return {
    key,
    title,
    description,
    phase,
    estimated_minutes: minutes,
    depends_on: dependsOn,
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
    milestone,
    order_index: index,
  };
}

function generateFullStackJobTasks(totalDays: number, start: Date, draft: GoalDraft): PreviewTask[] {
  const hoursPerDay = extractHoursNumber(draft.dailyHours) ?? 3;
  const minutes = hoursPerDay * 60;
  const weeks = Math.floor(totalDays / 7);
  const tasks: PreviewTask[] = [];
  let day = 0;
  let idx = 0;

  const addTask = (key: string, title: string, desc: string, phase: string, mins: number, milestone = false, deps: string[] = []) => {
    tasks.push(makeTask(idx++, key, title, desc, phase, mins, start, day, milestone, deps));
    day++;
  };

  // Week 1: HTML & CSS Fundamentals
  addTask("html_basics", "HTML5 structure and semantics", "Learn document structure, tags, forms, tables. Build a personal HTML page.", "foundation", minutes, false);
  addTask("css_basics", "CSS layout: Flexbox & Grid", "Master Flexbox and CSS Grid. Recreate 3 real website layouts.", "foundation", minutes, false, ["html_basics"]);
  addTask("css_responsive", "Responsive design & media queries", "Build a fully responsive landing page from scratch.", "foundation", minutes, false, ["css_basics"]);
  addTask("html_css_project", "Mini project: Portfolio page HTML/CSS", "Build a simple portfolio page using HTML/CSS. Push to GitHub.", "foundation", minutes, true, ["css_responsive"]);

  if (weeks >= 2 || totalDays >= 14) {
    // Week 2: JavaScript
    addTask("js_basics", "JavaScript fundamentals: variables, loops, functions", "Write JS programs covering arrays, objects, closures, and ES6 syntax.", "core_skills", minutes);
    addTask("js_dom", "DOM manipulation and events", "Build an interactive to-do app using vanilla JS.", "core_skills", minutes, false, ["js_basics"]);
    addTask("js_async", "Async JS: Promises, fetch, async/await", "Fetch data from a public API. Handle loading and error states.", "core_skills", minutes, false, ["js_dom"]);
    addTask("js_milestone", "JavaScript mini-project: Weather App", "Build a weather app using OpenWeatherMap API. Milestone checkpoint.", "core_skills", minutes, true, ["js_async"]);
  }

  if (weeks >= 3 || totalDays >= 21) {
    // Week 3: React
    addTask("react_basics", "React: components, props, and state", "Build a counter and a card list using React functional components.", "react", minutes);
    addTask("react_hooks", "React Hooks: useState, useEffect, useContext", "Refactor the weather app into React. Add global theme context.", "react", minutes, false, ["react_basics"]);
    addTask("react_router", "React Router and multi-page apps", "Add routing to the weather app. Create Home, Search, Detail pages.", "react", minutes, false, ["react_hooks"]);
    addTask("react_project", "React milestone: Task Manager App", "Build a full task manager with CRUD using React. Milestone.", "react", minutes, true, ["react_router"]);
  }

  if (weeks >= 4 || totalDays >= 28) {
    // Week 4: Node.js & Express
    addTask("node_basics", "Node.js: modules, file system, HTTP server", "Build a simple HTTP server without Express. Understand the event loop.", "backend", minutes);
    addTask("express_api", "Express.js REST API", "Build a REST API for the task manager (GET, POST, PUT, DELETE).", "backend", minutes, false, ["node_basics"]);
    addTask("database_basics", "MongoDB basics and Mongoose", "Connect Express app to MongoDB Atlas. Model users and tasks.", "backend", minutes, false, ["express_api"]);
    addTask("fullstack_connect", "Connect React frontend to Node backend", "Full-stack integration: React app calls your Express API. Milestone.", "backend", minutes, true, ["database_basics"]);
  }

  if (weeks >= 5 || totalDays >= 35) {
    // Week 5: Portfolio + Git + Deployment
    addTask("git_workflow", "Git branching, PRs, and collaboration workflow", "Practice git flow: feature branches, pull requests, code reviews.", "portfolio", minutes);
    addTask("portfolio_project", "Build Portfolio project 1: Full-Stack CRUD App", "Deploy a full-stack CRUD app (React + Node + MongoDB) to Vercel/Railway.", "portfolio", minutes, true, ["fullstack_connect"]);
    addTask("css_advanced", "Advanced CSS: animations, Tailwind CSS", "Style the portfolio app using Tailwind CSS and smooth animations.", "portfolio", minutes, false, ["portfolio_project"]);
    addTask("testing_basics", "Testing: Jest unit tests + React Testing Library", "Write unit tests for API routes. Write component tests with RTL.", "portfolio", minutes);
  }

  if (weeks >= 6 || totalDays >= 42) {
    // Week 6: TypeScript + Advanced React
    addTask("typescript_basics", "TypeScript fundamentals for React + Node", "Add TypeScript to the portfolio project. Type all components and APIs.", "advanced", minutes);
    addTask("react_advanced", "Advanced React: memo, useMemo, lazy loading", "Optimise the task manager app. Implement code splitting.", "advanced", minutes, false, ["typescript_basics"]);
    addTask("portfolio_project2", "Portfolio project 2: Real-time chat or e-commerce", "Build a second portfolio project with WebSockets or Stripe. Milestone.", "advanced", minutes, true);
    addTask("linkedin_resume", "Update resume, LinkedIn, and GitHub profile", "Craft an ATS-ready resume. Write a compelling LinkedIn summary. Pin GitHub repos.", "job_prep", minutes);
  }

  if (weeks >= 7 || totalDays >= 49) {
    // Week 7: Interview Prep
    addTask("dsa_arrays", "DSA: Arrays, strings, hashmaps — LeetCode Easy", "Solve 10 easy LeetCode problems. Learn Big-O fundamentals.", "interview_prep", minutes);
    addTask("dsa_trees", "DSA: Trees, recursion, and sorting — LeetCode Medium", "Solve 8 medium LeetCode problems on trees and linked lists.", "interview_prep", minutes);
    addTask("system_design", "System design basics: REST, databases, caching", "Study scalability, load balancers, caching, SQL vs NoSQL.", "interview_prep", minutes);
    addTask("mock_interview_1", "Mock interview 1: Coding round simulation", "Complete a timed coding interview simulation. Milestone.", "interview_prep", minutes, true);
  }

  if (weeks >= 8 || totalDays >= 56) {
    // Week 8: Job Applications
    addTask("job_applications", "Apply to 10 target companies per day", "Research companies, tailor resume, submit applications, track in spreadsheet.", "job_search", minutes);
    addTask("mock_interview_2", "Mock interview 2: Behavioural + technical", "Full mock interview: STAR stories + system design + live coding.", "job_search", minutes, true);
    addTask("networking", "LinkedIn networking and outreach", "Connect with 20 engineers, message 5 hiring managers, engage in communities.", "job_search", minutes);
    addTask("offer_negotiation", "Offer evaluation and negotiation preparation", "Research market salaries, prepare negotiation script. Goal complete. 🎯", "job_search", minutes, true);
  }

  return tasks;
}

function generateCertificationTasks(totalDays: number, start: Date, draft: GoalDraft, prompt: string): PreviewTask[] {
  const hoursPerDay = extractHoursNumber(draft.dailyHours) ?? 2;
  const minutes = hoursPerDay * 60;
  const tasks: PreviewTask[] = [];
  let day = 0;
  let idx = 0;

  const add = (key: string, title: string, desc: string, phase: string, milestone = false, deps: string[] = []) => {
    tasks.push(makeTask(idx++, key, title, desc, phase, minutes, start, day, milestone, deps));
    day++;
  };

  const isAWS = prompt.toLowerCase().includes("aws");
  const isDevOps = prompt.toLowerCase().includes("devops") || prompt.toLowerCase().includes("kubernetes");

  add("syllabus_review", "Review full exam syllabus and domains", "Break down all exam domains by weight. Create a study tracker.", "foundation", true);
  add("domain_1", `Study Domain 1: ${isAWS ? "Cloud Concepts & Global Infrastructure" : "Core Concepts"}`, "Read official documentation. Take notes. 2 practice questions.", "study");
  add("domain_2", `Study Domain 2: ${isAWS ? "IAM, S3, EC2, VPC" : "Architecture Fundamentals"}`, "Hands-on labs on key services. Create flashcards.", "study");
  add("domain_3", `Study Domain 3: ${isDevOps ? "Kubernetes Workloads & Scheduling" : "High Availability & Scaling"}`, "Build real scenarios in a practice account.", "study");
  add("domain_4", `Study Domain 4: ${isAWS ? "Databases, Caching, and Messaging" : "Security & Compliance"}`, "Focus on high-yield exam topics. Practice scenario questions.", "study");
  add("week1_quiz", "Week 1 quiz: 65-question practice test", "Complete a full-length practice exam. Review all wrong answers.", "review", true);
  add("domain_5", `Study Domain 5: ${isAWS ? "Security, Monitoring, Logging" : "Automation & CI/CD"}`, "Deep dive with hands-on labs.", "study");
  add("domain_6", `Study Domain 6: ${isAWS ? "Cost Management & Billing" : "Advanced Scenarios"}`, "Review pricing models. Do mock scenarios.", "study");
  add("weak_areas_review", "Target weak areas identified from practice tests", "Focus 100% on lowest-scoring domains from last quiz.", "review");
  add("practice_exam_2", "Full practice exam 2: Timed simulation", "Complete second timed exam. Score ≥75% before booking real exam.", "review", true);
  if (totalDays >= 28) {
    add("final_review", "Final revision: all domains flashcard sprint", "Speed-review all flashcards. Focus on edge cases.", "final_prep");
    add("exam_day_prep", "Exam day: logistics, sleep, and mental preparation", "Book the exam, prepare ID, rest well. You've prepared enough.", "final_prep", true);
  }
  return tasks;
}

function generateProductLaunchTasks(totalDays: number, start: Date, draft: GoalDraft): PreviewTask[] {
  const hoursPerDay = extractHoursNumber(draft.dailyHours) ?? 4;
  const minutes = hoursPerDay * 60;
  const tasks: PreviewTask[] = [];
  let day = 0;
  let idx = 0;
  const add = (key: string, title: string, desc: string, phase: string, milestone = false, deps: string[] = []) => {
    tasks.push(makeTask(idx++, key, title, desc, phase, minutes, start, day, milestone, deps));
    day++;
  };

  add("discovery", "Discovery: define problem, users, and value proposition", "Write a one-page problem statement. Identify top 3 user personas.", "discovery", true);
  add("competitive_analysis", "Competitive analysis and market positioning", "Research 5 competitors. Identify gaps and differentiation angle.", "discovery");
  add("mvp_spec", "Write MVP feature specification", "Define the minimum feature set. Create user stories and acceptance criteria.", "planning", true);
  add("tech_stack", "Choose tech stack and set up development environment", "Select framework, database, hosting. Initialise repository.", "planning");
  add("ui_wireframes", "Create UI wireframes for core flows", "Wireframe key screens: onboarding, dashboard, main feature.", "design");
  add("backend_setup", "Build backend: auth, database models, API routes", "Implement user auth, core data models, and CRUD API.", "build", true);
  add("frontend_build", "Build frontend: connect to backend API", "Implement core screens. Connect to backend. Basic styling.", "build");
  add("core_feature", "Build and test core differentiating feature", "Implement the feature that makes your product valuable. Milestone.", "build", true);
  if (totalDays >= 21) {
    add("beta_test", "Internal beta test: fix top 10 bugs", "Use the product daily. Log and fix the most critical issues.", "testing");
    add("landing_page", "Build landing page and waitlist", "Create a compelling landing page. Set up email waitlist.", "launch_prep", true);
    add("launch", "Public launch: ProductHunt, communities, outreach", "Submit to ProductHunt. Post in relevant communities. Email waitlist.", "launch", true);
  }
  return tasks;
}

function generateFitnessTasks(totalDays: number, start: Date, draft: GoalDraft): PreviewTask[] {
  const minutes = 60;
  const tasks: PreviewTask[] = [];
  let day = 0;
  let idx = 0;
  const add = (key: string, title: string, desc: string, phase: string, milestone = false) => {
    tasks.push(makeTask(idx++, key, title, desc, phase, minutes, start, day, milestone));
    day++;
  };
  const weeks = Math.floor(totalDays / 7);
  for (let w = 0; w < weeks; w++) {
    add(`w${w+1}_d1`, `Week ${w+1}: Upper body strength`, "Push-ups, rows, shoulder press. 3 sets each.", "training");
    add(`w${w+1}_d2`, `Week ${w+1}: Cardio & core`, "30 min run + plank, crunches, leg raises.", "training");
    add(`w${w+1}_d3`, `Week ${w+1}: Lower body strength`, "Squats, lunges, deadlifts. 3 sets each.", "training");
    add(`w${w+1}_rest`, `Week ${w+1}: Active rest + mobility`, "Light walk or yoga. Stretch all major muscle groups.", "recovery");
    if (w % 2 === 1) {
      add(`w${w+1}_milestone`, `Fitness check: Week ${w+1} progress assessment`, "Measure weight, reps, and energy levels. Log progress.", "review", true);
    }
  }
  return tasks;
}

function generateSkillLearningTasks(totalDays: number, start: Date, draft: GoalDraft, prompt: string): PreviewTask[] {
  const hoursPerDay = extractHoursNumber(draft.dailyHours) ?? 2;
  const minutes = hoursPerDay * 60;
  const tasks: PreviewTask[] = [];
  let day = 0;
  let idx = 0;
  const add = (key: string, title: string, desc: string, phase: string, milestone = false) => {
    tasks.push(makeTask(idx++, key, title, desc, phase, minutes, start, day, milestone));
    day++;
  };
  const weeks = Math.max(2, Math.floor(totalDays / 7));
  add("foundations", "Map the skill: find best resources and set learning goals", "Curate top 3 resources. Define what 'done' looks like.", "foundation", true);
  for (let w = 0; w < weeks; w++) {
    add(`w${w+1}_learn`, `Week ${w+1}: Core study block`, "Read / watch / practice core material for this week.", "learning");
    add(`w${w+1}_practice`, `Week ${w+1}: Apply the skill with a mini project`, "Build something small using what you learned.", "practice");
    if (w % 2 === 1) {
      add(`w${w+1}_review`, `Week ${w+1}: Review and test yourself`, "Quiz yourself on the material. Fix gaps. Milestone.", "review", true);
    }
  }
  add("final_project", "Final project: demonstrate the full skill", "Build a project that shows mastery. Share it publicly.", "delivery", true);
  return tasks;
}

function generateGenericTasks(totalDays: number, start: Date, draft: GoalDraft): PreviewTask[] {
  const hoursPerDay = extractHoursNumber(draft.dailyHours) ?? 2;
  const minutes = hoursPerDay * 60;
  const tasks: PreviewTask[] = [];
  let day = 0;
  let idx = 0;
  const add = (key: string, title: string, desc: string, phase: string, milestone = false) => {
    tasks.push(makeTask(idx++, key, title, desc, phase, minutes, start, day, milestone));
    day++;
  };
  const weeks = Math.max(2, Math.floor(totalDays / 7));
  add("map_goal", "Map the goal: define the target outcome and success criteria", "Write a clear success statement. Identify the 3 biggest obstacles.", "planning", true);
  add("break_milestones", "Break the goal into milestones", "Create a milestone for every 2 weeks. Define what each milestone looks like.", "planning");
  for (let w = 0; w < weeks; w++) {
    add(`w${w+1}_execute`, `Week ${w+1}: Execute core work`, "Focus on the most important task for this week.", "execution");
    add(`w${w+1}_review`, `Week ${w+1}: Weekly review and adjustment`, "Review progress. Identify what's working and what to change.", "review", w % 2 === 1);
  }
  add("final_review", "Final review: measure outcome vs goal", "Compare result to success criteria. Celebrate wins. Plan next steps.", "delivery", true);
  return tasks;
}

function buildGoalSummary(draft: GoalDraft, domain: string, taskCount: number): string {
  const priority = draft.priority ?? "Balanced";
  const days = draft.dailyHours ? `${draft.dailyHours} of focused work` : "a structured daily schedule";
  const domainLabel = domain === "job_search_tech"
    ? "Full Stack job search"
    : domain === "certification"
    ? "certification study"
    : domain === "product_launch"
    ? "product launch"
    : "goal execution";
  return `${priority} priority ${domainLabel} plan. ${taskCount} daily tasks across the full timeline with ${days} per day.`;
}

// ─── AI Plan Prompt Builder ──────────────────────────────────────────────────

export function buildAIPlanPrompt(draft: GoalDraft): string {
  const parts: string[] = [];
  parts.push(`Goal: "${draft.prompt}"`);
  if (draft.background) parts.push(`User's background: ${draft.background}`);
  if (draft.deadlineLabel) parts.push(`Timeline: ${draft.deadlineLabel}`);
  if (draft.dailyHours) parts.push(`Available time: ${draft.dailyHours}`);
  if (draft.includeWeekends === false) parts.push("Schedule: Monday to Friday only (no weekends)");
  else if (draft.includeWeekends === true) {
    const weekendsOnly = draft.constraints.some((c) => c.toLowerCase().includes("weekends only"));
    parts.push(weekendsOnly ? "Schedule: Weekends only (Saturday & Sunday)" : "Schedule: All 7 days including weekends");
  }
  if (draft.priority) parts.push(`Intensity: ${draft.priority}`);

  return `${parts.join("\n")}\n\nBased on the above, generate a COMPLETE and DETAILED day-by-day execution plan. Include specific daily tasks for each day (${draft.includeWeekends === false ? "Monday through Friday only" : "each scheduled day"}), with ${draft.dailyHours ?? "2 hours/day"} of work per day. Be specific to the goal — mention real tools, resources, and actionable tasks. Organize by weeks and phases. Do NOT be generic.`;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function withConstraint(draft: GoalDraft, constraint: string): GoalDraft {
  if (draft.constraints.includes(constraint)) {
    return draft;
  }

  return {
    ...draft,
    constraints: [...draft.constraints, constraint],
  };
}

function extractDeadline(
  text: string,
  options: { allowLooseWeekday?: boolean } = {},
) {
  const normalized = text.trim().toLowerCase();
  const duration = parseTimelineDuration(normalized);
  if (duration) {
    return buildDeadlineFromDuration(duration.amount, duration.unit);
  }

  if (/\b(today)\b/.test(normalized)) {
    return buildDeadline(0, "today");
  }

  if (/\b(tomorrow)\b/.test(normalized)) {
    return buildDeadline(1, "tomorrow");
  }

  if (/\b(asap|soon|quickly)\b/.test(normalized)) {
    return buildDeadline(14, "2 weeks");
  }

  if (/\b(this week|end of week|by friday)\b/.test(normalized)) {
    return buildDeadlineToWeekday(5, "this week");
  }

  if (/\b(next week)\b/.test(normalized)) {
    return buildDeadline(7, "next week");
  }

  if (/\b(this month|end of month)\b/.test(normalized)) {
    return buildDeadlineToMonthEnd("this month");
  }

  if (/\b(next month)\b/.test(normalized)) {
    return buildDeadline(30, "next month");
  }

  const weekday = extractWeekday(normalized, options.allowLooseWeekday ?? false);
  if (weekday !== null) {
    return buildDeadlineToWeekday(weekday, `by ${weekdayName(weekday)}`);
  }

  const parsedDate = Date.parse(text);
  if (!Number.isNaN(parsedDate)) {
    const deadline = new Date(parsedDate);
    return {
      label: deadline.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      iso: deadline.toISOString(),
    };
  }

  return null;
}

function inferDefaultDeadline(prompt: string) {
  const lower = prompt.toLowerCase();
  if (lower.includes("job") || lower.includes("engineer")) {
    return buildDeadline(60, "2 months");
  }
  if (lower.includes("certification") || lower.includes("exam")) {
    return buildDeadline(30, "1 month");
  }
  if (lower.includes("launch") || lower.includes("mvp")) {
    return buildDeadline(30, "30 days");
  }
  return buildDeadline(30, "30 days");
}

function buildDeadline(daysFromNow: number, label: string) {
  const now = new Date();
  const deadline = new Date(
    now.getTime() + daysFromNow * 24 * 60 * 60 * 1000,
  );

  return {
    label,
    iso: deadline.toISOString(),
  };
}

type TimelineUnit = "day" | "week" | "month" | "year";

function parseTimelineDuration(text: string): { amount: number; unit: TimelineUnit } | null {
  const normalized = normalizeNumberWords(text);
  const unitPattern = "(days?|weeks?|months?|years?)";
  const mixedHalfMatch = normalized.match(
    new RegExp(
      `\\b(\\d+(?:\\.\\d+)?)\\s+(?:and\\s+)?(?:(?:a|1)\\s+)?half\\s*${unitPattern}\\b`,
    ),
  );
  if (mixedHalfMatch) {
    return {
      amount: Number(mixedHalfMatch[1]) + 0.5,
      unit: normalizeTimelineUnit(mixedHalfMatch[2]),
    };
  }

  const halfOnlyMatch = normalized.match(
    new RegExp(`\\b(?:(?:a|1)\\s+)?half\\s*(?:(?:a|1)\\s+)?${unitPattern}\\b`),
  );
  if (halfOnlyMatch) {
    return {
      amount: 0.5,
      unit: normalizeTimelineUnit(halfOnlyMatch[1]),
    };
  }

  const numericMatch = normalized.match(
    new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*${unitPattern}\\b`),
  );
  if (!numericMatch) {
    return null;
  }

  return {
    amount: Number(numericMatch[1]),
    unit: normalizeTimelineUnit(numericMatch[2]),
  };
}

function normalizeNumberWords(text: string) {
  const words: Record<string, string> = {
    a: "1",
    an: "1",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
  };
  return text.replace(
    /\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten)\b/g,
    (word) => words[word] ?? word,
  );
}

function normalizeTimelineUnit(unit: string): TimelineUnit {
  if (unit.startsWith("day")) {
    return "day";
  }
  if (unit.startsWith("week")) {
    return "week";
  }
  if (unit.startsWith("year")) {
    return "year";
  }
  return "month";
}

function buildDeadlineFromDuration(amount: number, unit: TimelineUnit) {
  const multipliers: Record<TimelineUnit, number> = {
    day: 1,
    week: 7,
    month: 30,
    year: 365,
  };
  const days = Math.max(1, Math.round(amount * multipliers[unit]));
  const labelAmount = Number.isInteger(amount)
    ? String(amount)
    : String(amount).replace(/\.0$/, "");
  const labelUnit = amount === 1 ? unit : `${unit}s`;
  return buildDeadline(days, `${labelAmount} ${labelUnit}`);
}

function buildDeadlineToWeekday(targetDay: number, label: string) {
  const now = new Date();
  const currentDay = now.getDay();
  let daysUntil = (targetDay - currentDay + 7) % 7;
  if (daysUntil === 0) {
    daysUntil = 7;
  }
  return buildDeadline(daysUntil, label);
}

function buildDeadlineToMonthEnd(label: string) {
  const now = new Date();
  const deadline = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return {
    label,
    iso: deadline.toISOString(),
  };
}

function extractWeekday(text: string, allowLoose: boolean): number | null {
  const weekdays: Array<[RegExp, number]> = [
    [/\b(sunday|sun)\b/, 0],
    [/\b(monday|mon)\b/, 1],
    [/\b(tuesday|tue|tues)\b/, 2],
    [/\b(wednesday|wed)\b/, 3],
    [/\b(thursday|thu|thur|thurs)\b/, 4],
    [/\b(friday|fri)\b/, 5],
    [/\b(saturday|sat)\b/, 6],
  ];
  if (allowLoose) {
    return weekdays.find(([pattern]) => pattern.test(text))?.[1] ?? null;
  }

  const qualifiedWeekday = text.match(
    /\b(?:by|on|before|until|next|this)\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/,
  )?.[1];
  if (!qualifiedWeekday) {
    return null;
  }
  return weekdays.find(([pattern]) => pattern.test(qualifiedWeekday))?.[1] ?? null;
}

function weekdayName(day: number) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day] ?? "that day";
}

function applyAvailabilityHint(draft: GoalDraft, answer: string): GoalDraft {
  const lower = answer.toLowerCase();
  if (/\b(weekdays|weekday|mon\s*-\s*fri|monday to friday)\b/.test(lower)) {
    return withConstraint(
      {
        ...draft,
        includeWeekends: false,
      },
      "Weekdays only - Monday to Friday",
    );
  }
  if (/\b(weekends only|saturday and sunday|sat\s*-\s*sun)\b/.test(lower)) {
    return withConstraint(
      {
        ...draft,
        includeWeekends: true,
      },
      "Weekends only - schedule on Saturday and Sunday",
    );
  }
  if (/\b(include weekends|all 7 days|every day|daily)\b/.test(lower)) {
    return withConstraint(
      {
        ...draft,
        includeWeekends: true,
      },
      "Include weekends when useful",
    );
  }
  return draft;
}

function extractHoursNumber(dailyHours: string | null): number | null {
  if (!dailyHours) return null;
  const match = dailyHours.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function splitTaskDetails(description: string): string[] {
  return description
    .split(".")
    .map((part) => part.trim())
    .filter((part) => part.length > 4)
    .slice(0, 4);
}

function formatTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })} - ${end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
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
  if (normalized.includes("execution") || normalized.includes("practice") || normalized.includes("build")) {
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
  return `${Math.max(4, Math.round(totalHours / 4))} hrs / week`;
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
