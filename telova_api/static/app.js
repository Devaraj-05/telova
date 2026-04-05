const state = {
  activeView: "dashboard",
  userId: "demo-user",
  profileName: "Devaraj",
  goals: [],
  tasks: [],
  notes: [],
  events: [],
  dashboard: {
    goals: [],
    recent_tasks: [],
    upcoming_events: [],
    notes: [],
  },
  systemStatus: null,
  goalDags: {},
  selectedGoalId: null,
  selectedTaskId: null,
  selectedNoteId: null,
  lastGoalPlan: null,
  latestConflictScan: [],
  latestWeeklyReviews: [],
  requestHistory: [],
  draftPreview: null,
  selectedPriority: "High",
  draftNote: "",
  scheduleDate: new Date(),
};

const VIEW_META = {
  dashboard: {
    eyebrow: "Command Center",
    title: () => `Hello, ${state.profileName}`,
    subtitle: "Coordinate tasks, schedules, notes, and adaptive planning from one workspace.",
  },
  goals: {
    eyebrow: "Goal Intake",
    title: () => "Goal Creation",
    subtitle: "Capture one high-level objective and let Telova design the execution lane.",
  },
  agents: {
    eyebrow: "Execution Graph",
    title: () => "AI Plan View",
    subtitle: "Inspect dependency-aware nodes, milestone lanes, and specialist ownership.",
  },
  calendar: {
    eyebrow: "Schedule Layer",
    title: () => "Calendar & Schedule",
    subtitle: "Review time blocks, conflict pressure, and rescheduling opportunities.",
  },
  tasks: {
    eyebrow: "Execution Board",
    title: () => "Task Board",
    subtitle: "Track backlog, today, active work, and completed output in one lane view.",
  },
  activity: {
    eyebrow: "Adaptation Engine",
    title: () => "Replan & Adaptation",
    subtitle: "See where execution slipped and how Telova proposes to recover momentum.",
  },
  notes: {
    eyebrow: "Memory Layer",
    title: () => "Notes & Memory",
    subtitle: "Browse context packages, status reports, and linked workspace memory.",
  },
  settings: {
    eyebrow: "Operational Telemetry",
    title: () => "API & System Status",
    subtitle: "Monitor agent health, MCP connections, database mode, and workflow logs.",
  },
};

const AGENT_CONFIG = {
  Orchestrator: {
    className: "agent-orchestrator",
    color: "#8B5CF6",
    role: "Primary coordinator",
  },
  Scheduler: {
    className: "agent-scheduler",
    color: "#06B6D4",
    role: "Conflict sentinel",
  },
  Research: {
    className: "agent-research",
    color: "#F97316",
    role: "Goal decomposer",
  },
  Memory: {
    className: "agent-memory",
    color: "#22C55E",
    role: "Context bridge",
  },
  Execution: {
    className: "agent-execution",
    color: "#EC4899",
    role: "Progress adaptor",
  },
};

const els = {};
let loadingInterval = null;
let searchDebounce = null;

document.addEventListener("DOMContentLoaded", init);

function init() {
  captureElements();
  installEventHandlers();
  seedDateInputs();
  state.draftPreview = buildDraftPreview();
  renderGoalPreview();
  renderAgentPulseRow();
  updateHeader();
}

function captureElements() {
  const ids = [
    "welcomeScreen",
    "enterWorkspaceButton",
    "continueGoogleButton",
    "welcomeEmail",
    "welcomePassword",
    "appShell",
    "sidebarNav",
    "headerEyebrow",
    "headerTitle",
    "headerSubtitle",
    "statusBanner",
    "agentPulseRow",
    "globalSearchInput",
    "sidebarSearch",
    "searchResults",
    "refreshWorkspaceButton",
    "runConflictsButton",
    "headerNewGoalButton",
    "dashboardGoalOverview",
    "metricActiveGoals",
    "metricTaskVelocity",
    "dashboardSchedule",
    "todayScheduleBadge",
    "dashboardSuggestions",
    "dashboardProgress",
    "dashboardAgents",
    "dashboardAlerts",
    "dashboardOpenPlanButton",
    "dashboardWeeklyReviewButton",
    "goalUserId",
    "goalTextInput",
    "goalDeadlineInput",
    "goalHorizonInput",
    "goalDescriptionInput",
    "priorityRow",
    "generatePlanButton",
    "draftPlanButton",
    "previewModeChip",
    "previewSummary",
    "previewMilestones",
    "previewSchedule",
    "previewRisks",
    "approvePlanButton",
    "editPreviewButton",
    "planGoalSummary",
    "planMilestones",
    "planAgentAssignments",
    "planGoalSelect",
    "planToCalendarButton",
    "graphStage",
    "graphEdges",
    "graphNodes",
    "taskDetailPanel",
    "scheduleDateInput",
    "calendarSyncButton",
    "calendarAddTaskButton",
    "miniCalendar",
    "deadlineList",
    "connectedToolsList",
    "plannerGrid",
    "calendarConflicts",
    "calendarRecommendations",
    "freeSlotsList",
    "taskBoardSearch",
    "taskBoardFilter",
    "backlogColumn",
    "todayColumn",
    "inProgressColumn",
    "completedColumn",
    "backlogCount",
    "todayCount",
    "progressCount",
    "completedCount",
    "replanInsightCard",
    "missedTaskTimeline",
    "reasonTags",
    "replanSummary",
    "replanChanges",
    "runWeeklyReviewButton",
    "rejectReplanButton",
    "noteFolders",
    "selectedNoteTitle",
    "selectedNoteType",
    "noteEditor",
    "linkedContext",
    "systemAgents",
    "systemConnections",
    "systemDatabase",
    "systemWorkflowLogs",
    "systemRequestHistory",
    "systemHeartbeat",
    "loadingModal",
    "loadingTitle",
    "loadingMessage",
    "adaptiveModal",
    "adaptiveModalContent",
    "closeAdaptiveModalButton",
    "adaptiveGoDashboardButton",
    "adaptiveOpenActivityButton",
    "profileName",
    "profileRole",
    "profileAvatar",
  ];

  ids.forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function installEventHandlers() {
  els.enterWorkspaceButton.addEventListener("click", enterWorkspace);
  els.continueGoogleButton.addEventListener("click", enterWorkspace);

  els.sidebarNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) {
      return;
    }
    switchView(button.dataset.view);
  });

  els.headerNewGoalButton.addEventListener("click", () => switchView("goals"));
  els.dashboardOpenPlanButton.addEventListener("click", () => switchView("agents"));
  els.dashboardWeeklyReviewButton.addEventListener("click", runWeeklyReview);
  els.runWeeklyReviewButton.addEventListener("click", runWeeklyReview);
  els.rejectReplanButton.addEventListener("click", clearReplanState);
  els.refreshWorkspaceButton.addEventListener("click", refreshWorkspace);
  els.runConflictsButton.addEventListener("click", runConflictScan);

  els.goalTextInput.addEventListener("input", handleGoalDraftChange);
  els.goalDescriptionInput.addEventListener("input", handleGoalDraftChange);
  els.goalHorizonInput.addEventListener("change", handleGoalDraftChange);
  els.goalDeadlineInput.addEventListener("change", handleGoalDraftChange);
  els.goalUserId.addEventListener("change", handleUserChange);
  els.priorityRow.addEventListener("click", handlePriorityChange);
  els.generatePlanButton.addEventListener("click", generateGoalPlan);
  els.draftPlanButton.addEventListener("click", renderDraftPreview);
  els.approvePlanButton.addEventListener("click", approveGeneratedPlan);
  els.editPreviewButton.addEventListener("click", () => {
    els.goalTextInput.focus();
    showStatus("Edit the goal inputs and refresh the preview.", "info");
  });

  els.planGoalSelect.addEventListener("change", async (event) => {
    state.selectedGoalId = event.target.value || null;
    state.selectedTaskId = getGoalTasks(state.selectedGoalId)[0]?.id ?? null;
    await ensureGoalDag(state.selectedGoalId);
    renderAll();
  });
  els.planToCalendarButton.addEventListener("click", () => switchView("calendar"));

  els.scheduleDateInput.addEventListener("change", () => {
    state.scheduleDate = parseInputDate(els.scheduleDateInput.value) || new Date();
    renderCalendarView();
  });
  els.calendarSyncButton.addEventListener("click", refreshWorkspace);
  els.calendarAddTaskButton.addEventListener("click", () => switchView("goals"));

  els.taskBoardSearch.addEventListener("input", renderTaskBoard);
  els.taskBoardFilter.addEventListener("change", renderTaskBoard);

  els.globalSearchInput.addEventListener("input", handleGlobalSearch);
  els.sidebarSearch.addEventListener("input", () => {
    els.globalSearchInput.value = els.sidebarSearch.value;
    handleGlobalSearch();
  });

  els.noteEditor.addEventListener("input", () => {
    state.draftNote = els.noteEditor.value;
  });

  els.closeAdaptiveModalButton.addEventListener("click", hideAdaptiveModal);
  els.adaptiveGoDashboardButton.addEventListener("click", () => {
    hideAdaptiveModal();
    switchView("dashboard");
  });
  els.adaptiveOpenActivityButton.addEventListener("click", () => {
    hideAdaptiveModal();
    switchView("activity");
  });

  document.addEventListener("click", handleDocumentClick);
}

function seedDateInputs() {
  const now = new Date();
  const future = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
  els.goalDeadlineInput.value = toLocalDateTimeInput(future);
  els.scheduleDateInput.value = toDateInput(now);
}

async function enterWorkspace() {
  state.profileName = formatNameFromIdentity(els.welcomeEmail.value || state.userId);
  state.userId = els.goalUserId.value.trim() || formatUserId(els.welcomeEmail.value) || "demo-user";
  els.goalUserId.value = state.userId;
  els.profileName.textContent = state.profileName;
  els.profileRole.textContent = `Operator, ${state.userId}`;
  els.profileAvatar.textContent = initialsFromName(state.profileName);
  showLoading("Hydrating workspace", [
    "Authenticating the command center.",
    "Syncing tasks, notes, and schedule lanes.",
    "Loading operational telemetry.",
  ]);

  try {
    await loadWorkspaceData();
    els.welcomeScreen.classList.add("is-hidden");
    els.appShell.classList.remove("is-hidden");
    switchView("dashboard");
    showStatus("Workspace ready.", "success");
  } catch (error) {
    showStatus(error.message, "danger");
  } finally {
    hideLoading();
  }
}

async function refreshWorkspace() {
  showLoading("Refreshing workspace", [
    "Fetching command center data.",
    "Updating plan graph, notes, and telemetry.",
  ]);
  try {
    await loadWorkspaceData();
    showStatus("Workspace refreshed successfully.", "success");
  } catch (error) {
    showStatus(error.message, "danger");
  } finally {
    hideLoading();
  }
}

async function loadWorkspaceData() {
  const userId = currentUserId();
  state.userId = userId;

  const query = encodeURIComponent(userId);
  const [dashboard, goals, tasks, notes, events, systemStatus] = await Promise.all([
    fetchJson(`/api/v1/dashboard?user_id=${query}`),
    fetchJson(`/api/v1/goals?user_id=${query}`),
    fetchJson(`/api/v1/tasks?user_id=${query}`),
    fetchJson(`/api/v1/notes?user_id=${query}`),
    fetchJson(`/api/v1/calendar/events?user_id=${query}`),
    fetchJson(`/api/v1/system/status?user_id=${query}`),
  ]);

  state.dashboard = dashboard;
  state.goals = goals;
  state.tasks = tasks;
  state.notes = notes;
  state.events = events;
  state.systemStatus = systemStatus;

  if (!state.selectedGoalId || !state.goals.some((goal) => goal.id === state.selectedGoalId)) {
    state.selectedGoalId = state.goals[0]?.id ?? null;
  }
  if (!state.selectedTaskId || !state.tasks.some((task) => task.id === state.selectedTaskId)) {
    state.selectedTaskId = getGoalTasks(state.selectedGoalId)[0]?.id ?? state.tasks[0]?.id ?? null;
  }
  if (!state.selectedNoteId || !state.notes.some((note) => note.id === state.selectedNoteId)) {
    state.selectedNoteId = state.notes[0]?.id ?? null;
  }

  await ensureGoalDag(state.selectedGoalId);

  if (!state.lastGoalPlan && state.selectedGoalId && state.goalDags[state.selectedGoalId]) {
    state.lastGoalPlan = {
      goal: getSelectedGoal(),
      dag: state.goalDags[state.selectedGoalId],
      tasks: getGoalTasks(state.selectedGoalId),
      calendar_events: state.events.filter((event) => event.goal_id === state.selectedGoalId),
    };
  }

  renderAll();
}

async function ensureGoalDag(goalId) {
  if (!goalId) {
    return null;
  }
  if (state.goalDags[goalId]) {
    return state.goalDags[goalId];
  }
  state.goalDags[goalId] = await fetchJson(`/api/v1/goals/${goalId}/dag`);
  return state.goalDags[goalId];
}

function switchView(viewName) {
  state.activeView = viewName;
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("is-active", section.dataset.view === viewName);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewName);
  });
  updateHeader();
}

function updateHeader() {
  const meta = VIEW_META[state.activeView] || VIEW_META.dashboard;
  els.headerEyebrow.textContent = meta.eyebrow;
  els.headerTitle.textContent = typeof meta.title === "function" ? meta.title() : meta.title;
  els.headerSubtitle.textContent = meta.subtitle;
}

function renderAll() {
  renderAgentPulseRow();
  renderGoalPreview();
  renderDashboard();
  renderPlanView();
  renderCalendarView();
  renderTaskBoard();
  renderReplanView();
  renderNotesView();
  renderSystemStatus();
  updateHeader();
}

function renderAgentPulseRow() {
  const agents = state.systemStatus?.agents ?? [
    { name: "Orchestrator", status: "active" },
    { name: "Scheduler", status: "ready" },
    { name: "Research", status: "ready" },
    { name: "Memory", status: "ready" },
    { name: "Execution", status: "monitoring" },
  ];

  els.agentPulseRow.innerHTML = agents
    .map((agent) => {
      const config = AGENT_CONFIG[agent.name] || AGENT_CONFIG.Orchestrator;
      return `
        <span class="agent-pill ${config.className}" style="color:${config.color}">
          ${escapeHtml(agent.name)} · ${escapeHtml(agent.status)}
        </span>
      `;
    })
    .join("");
}

function handleGoalDraftChange() {
  state.draftPreview = buildDraftPreview();
  renderGoalPreview();
}

function handleUserChange() {
  state.userId = currentUserId();
  els.profileRole.textContent = `Operator, ${state.userId}`;
}

function handlePriorityChange(event) {
  const button = event.target.closest("[data-priority]");
  if (!button) {
    return;
  }
  state.selectedPriority = button.dataset.priority;
  document.querySelectorAll(".priority-pill").forEach((pill) => {
    pill.classList.toggle("is-active", pill.dataset.priority === state.selectedPriority);
  });
  handleGoalDraftChange();
}

function renderDraftPreview() {
  state.draftPreview = buildDraftPreview();
  state.lastGoalPlan = null;
  renderGoalPreview();
  showStatus("Draft preview refreshed.", "info");
}

function buildDraftPreview() {
  const goalText = (els.goalTextInput.value || "").trim() || "Declare a new command center goal";
  const deadline = parseInputDateTime(els.goalDeadlineInput.value);
  const horizon = els.goalHorizonInput.value || "6 months";
  const description = (els.goalDescriptionInput.value || "").trim();
  const domain = inferDomain(goalText);

  const blueprint = {
    career: {
      summary: "Create a leadership-focused path with visible ownership, evidence capture, and promotion narrative milestones.",
      milestones: [
        "Clarify success criteria and promotion rubric",
        "Map sponsors, manager expectations, and impact proof",
        "Lead one visible initiative and document outcomes",
        "Package evidence into a final promotion narrative",
      ],
      schedule: [
        "Week 1: align on criteria and stakeholders",
        "Weeks 2-10: run visible leadership blocks and mentorship loops",
        "Final phase: assemble narrative, evidence, and promotion review packet",
      ],
      risks: [
        "Calendar fragmentation could erode deep work quality",
        "Evidence logging must happen weekly or the promotion story weakens",
        "Stakeholder alignment should happen early, not near the deadline",
      ],
    },
    product: {
      summary: "Break the launch into discovery, architecture, MVP execution, validation, and hardening checkpoints.",
      milestones: [
        "Define launch metric, target user, and MVP boundary",
        "Validate the problem with users and draft architecture",
        "Build the MVP and create a feedback loop",
        "Harden the release and capture launch outcomes",
      ],
      schedule: [
        "Discovery sprint: define scope and collect user proof",
        "Execution sprint: build the core workflow and instrumentation",
        "Launch sprint: harden, release, and monitor",
      ],
      risks: [
        "Scope expansion could dilute the MVP",
        "Feedback loops need to happen before hardening starts",
        "Calendar pressure near launch can starve validation time",
      ],
    },
    learning: {
      summary: "Convert the learning goal into baseline assessment, deliberate practice blocks, project application, and review loops.",
      milestones: [
        "Define the target competency and success proof",
        "Assess the baseline and isolate high-leverage gaps",
        "Run deliberate practice blocks and project application",
        "Review outcomes, then close remaining gaps",
      ],
      schedule: [
        "Weeks 1-2: baseline and study system design",
        "Weeks 3-8: deliberate practice and mock sessions",
        "Final stretch: project application and review",
      ],
      risks: [
        "Practice without feedback will flatten the learning curve",
        "Skipping project application weakens transfer to real work",
        "The plan needs recurring review points to avoid drift",
      ],
    },
    generic: {
      summary: "Define a measurable outcome, map milestones, reserve execution slots, and watch for deviation.",
      milestones: [
        "Make the outcome specific and measurable",
        "Break the work into milestones and dependencies",
        "Reserve focused execution windows",
        "Review progress and adapt if drift appears",
      ],
      schedule: [
        "Kickoff phase: define the scope and critical path",
        "Execution phase: protect deep work windows",
        "Review phase: adapt the timeline before deadlines compress",
      ],
      risks: [
        "A vague outcome will create vague tasks",
        "Dependencies must be explicit or the schedule will mislead",
        "Missed check-ins will hide drift until too late",
      ],
    },
  };

  const profile = blueprint[domain];
  return {
    mode: "draft",
    summary: `${profile.summary} Priority lane: ${state.selectedPriority}. Horizon: ${horizon}.${description ? ` Context: ${description}` : ""}`,
    milestones: profile.milestones,
    schedule: profile.schedule.map((item) => `${item}${deadline ? ` · target ${formatDateTime(deadline.toISOString())}` : ""}`),
    risks: profile.risks,
    domain,
    goalText,
  };
}

function inferDomain(goalText) {
  const lowered = goalText.toLowerCase();
  if (/(promot|senior|career|staff|leadership)/.test(lowered)) {
    return "career";
  }
  if (/(launch|mvp|ship|release|product)/.test(lowered)) {
    return "product";
  }
  if (/(learn|practice|study|interview|prepare|skill)/.test(lowered)) {
    return "learning";
  }
  return "generic";
}

function renderGoalPreview() {
  const livePreview = state.lastGoalPlan && state.lastGoalPlan.goal
    ? {
        mode: "live",
        summary: `Telova generated a ${humanize(state.lastGoalPlan.goal.domain)} execution lane with ${state.lastGoalPlan.tasks.length} task nodes and ${state.lastGoalPlan.dag.milestones.length} milestones.`,
        milestones: state.lastGoalPlan.tasks
          .filter((task) => state.lastGoalPlan.dag.milestones.includes(task.id))
          .map((task) => `${task.title} · ${formatDateTime(task.scheduled_start)}`),
        schedule: state.lastGoalPlan.tasks
          .slice(0, 5)
          .map((task) => `${task.title} · ${formatDateTime(task.scheduled_start)} to ${formatDateTime(task.scheduled_end)}`),
        risks: buildRisksFromPlan(state.lastGoalPlan.tasks),
      }
    : null;

  const preview = livePreview ?? state.draftPreview ?? buildDraftPreview();
  els.previewModeChip.textContent = preview.mode === "live" ? "Live Plan" : "Draft";
  els.previewSummary.textContent = preview.summary;
  els.previewMilestones.innerHTML = renderSimpleList(preview.milestones);
  els.previewSchedule.innerHTML = renderSimpleList(preview.schedule);
  els.previewRisks.innerHTML = renderSimpleList(preview.risks, "warning");
  els.approvePlanButton.disabled = !livePreview;
}

function buildRisksFromPlan(tasks) {
  const longBlocks = tasks.filter((task) => task.estimated_minutes >= 180).length;
  const milestones = tasks.filter((task) => task.phase === "delivery" || task.phase === "tracking").length;
  const risks = [];
  if (longBlocks) {
    risks.push(`${longBlocks} long focus block(s) need calendar protection to succeed.`);
  }
  if (milestones) {
    risks.push("Late-stage milestones are sensitive to missed weekly reviews.");
  }
  risks.push("External commitments in the next 72 hours can trigger re-sequencing.");
  return risks;
}

async function generateGoalPlan() {
  const payload = {
    user_id: currentUserId(),
    goal: els.goalTextInput.value.trim(),
    description: els.goalDescriptionInput.value.trim() || null,
    deadline: parseInputDateTime(els.goalDeadlineInput.value)?.toISOString() ?? null,
  };

  if (!payload.goal) {
    showStatus("Add a goal before generating a plan.", "warning");
    return;
  }

  showLoading("Orchestrator planning", [
    "Goal decomposer is building a dependency graph.",
    "Scheduler is reserving execution windows.",
    "Memory lane is preparing context hooks.",
  ]);

  try {
    const plan = await fetchJson("/api/v1/goals", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.lastGoalPlan = plan;
    state.selectedGoalId = plan.goal.id;
    state.selectedTaskId = plan.tasks[0]?.id ?? null;
    state.goalDags[plan.goal.id] = plan.dag;
    await loadWorkspaceData();
    renderGoalPreview();
    showStatus(`Generated a live plan for "${plan.goal.title}". Approve it to open the graph view.`, "success");
  } catch (error) {
    showStatus(error.message, "danger");
  } finally {
    hideLoading();
  }
}

function approveGeneratedPlan() {
  if (!state.lastGoalPlan?.goal?.id) {
    showStatus("Generate a live plan before approving it.", "warning");
    return;
  }
  state.selectedGoalId = state.lastGoalPlan.goal.id;
  state.selectedTaskId = state.lastGoalPlan.tasks[0]?.id ?? null;
  switchView("agents");
  showStatus("Plan approved. Inspect the graph and task details.", "success");
}

function renderDashboard() {
  const goal = getSelectedGoal();
  const goalTasks = goal ? getGoalTasks(goal.id) : [];
  const completion = calculateCompletion(goalTasks);
  const activeGoals = state.goals.filter((item) => item.status === "active");
  const upcomingEvents = getEventsForDay(state.events, new Date()).slice(0, 6);
  const suggestions = buildAiSuggestions(goal, goalTasks);

  els.dashboardGoalOverview.innerHTML = goal
    ? `
      <div class="detail-stack">
        <div>
          <h3>${escapeHtml(goal.title)}</h3>
          <p class="support-copy">${escapeHtml(goal.description || "No additional context has been captured yet.")}</p>
        </div>
        <div class="inline-metadata">
          <span class="hero-chip hero-chip-soft">${escapeHtml(humanize(goal.domain))}</span>
          <span class="hero-chip hero-chip-soft">Deadline · ${escapeHtml(formatDateTime(goal.deadline))}</span>
          <span class="hero-chip hero-chip-soft">Deviation · ${Math.round(goal.deviation * 100)}%</span>
        </div>
        <div class="progress-meter">
          <div class="progress-bar"><span style="width:${completion}%"></span></div>
          <div class="stat-grid-inline">
            <div class="metric-strip">
              <span>Completed</span>
              <strong>${goalTasks.filter((task) => task.status === "done").length}</strong>
            </div>
            <div class="metric-strip">
              <span>Remaining</span>
              <strong>${goalTasks.filter((task) => task.status !== "done").length}</strong>
            </div>
          </div>
        </div>
      </div>
    `
    : renderEmptyState("No active goals yet.", "Open Goal Creation to build the first execution lane.");

  els.metricActiveGoals.innerHTML = `
    <div class="metric-strip">
      <span>Active goals</span>
      <strong>${activeGoals.length}</strong>
    </div>
    <p class="support-copy">Goals currently monitored by the orchestrator.</p>
  `;

  els.metricTaskVelocity.innerHTML = `
    <div class="metric-strip">
      <span>Task velocity</span>
      <strong>${state.tasks.filter((task) => task.status === "done").length}/${state.tasks.length}</strong>
    </div>
    <p class="support-copy">Completed tasks out of the current workspace backlog.</p>
  `;

  els.todayScheduleBadge.textContent = `${upcomingEvents.length} blocks`;
  els.dashboardSchedule.innerHTML = upcomingEvents.length
    ? upcomingEvents.map((event) => renderTimelineEvent(event)).join("")
    : renderEmptyState("No time blocks for today.", "Create a goal or add an external event to populate the planner.");

  els.dashboardSuggestions.innerHTML = suggestions.map((item) => `
    <div class="list-item">
      <strong>${escapeHtml(item.title)}</strong>
      <p class="support-copy">${escapeHtml(item.detail)}</p>
    </div>
  `).join("");

  els.dashboardProgress.innerHTML = renderProgressBreakdown(goalTasks);

  const agents = state.systemStatus?.agents ?? [];
  els.dashboardAgents.innerHTML = agents.length
    ? agents.map((agent) => `
      <div class="list-item">
        <strong>${escapeHtml(agent.name)}</strong>
        <p class="support-copy">${escapeHtml(agent.detail)}</p>
        <div class="inline-metadata">
          <span class="task-chip active">${escapeHtml(agent.status)}</span>
          <span class="task-chip">${escapeHtml(agent.load_label)}</span>
        </div>
      </div>
    `).join("")
    : renderEmptyState("Agents are idle.", "Operational telemetry will populate once the workspace loads.");

  const alerts = buildAlerts(goalTasks);
  els.dashboardAlerts.innerHTML = alerts.length
    ? alerts.map((alert) => `
      <div class="list-item">
        <strong>${escapeHtml(alert.title)}</strong>
        <p class="support-copy">${escapeHtml(alert.detail)}</p>
      </div>
    `).join("")
    : renderEmptyState("No alerts right now.", "Run a conflict scan or weekly review to generate adaptation signals.");
}

function buildAiSuggestions(goal, tasks) {
  const suggestions = [];
  const pending = tasks.filter((task) => task.status === "pending");
  const overdue = tasks.filter((task) => isOverdue(task));
  if (goal) {
    suggestions.push({
      title: `Advance "${goal.title}"`,
      detail: pending[0]
        ? `The next strong move is "${pending[0].title}" because it opens the critical path.`
        : "The current goal is fully completed. Consider opening a new lane.",
    });
  } else {
    suggestions.push({
      title: "Create the first goal",
      detail: "A goal unlocks the graph view, the schedule planner, and adaptive review loops.",
    });
  }

  suggestions.push({
    title: overdue.length ? "Address overdue work" : "Protect focus windows",
    detail: overdue.length
      ? `${overdue.length} overdue task(s) are starting to compress future milestones.`
      : "No overdue tasks right now. Keep the calendar clear around long focus blocks.",
  });

  suggestions.push({
    title: "Run a weekly review",
    detail: "The progress adaptor will re-sequence pending work if deviation crosses the threshold.",
  });

  return suggestions;
}

function buildAlerts(tasks) {
  const alerts = [];
  const overdue = tasks.filter((task) => isOverdue(task));
  const active = tasks.filter((task) => task.status === "active");
  if (state.latestConflictScan.length) {
    alerts.push({
      title: `${state.latestConflictScan.length} schedule conflict(s) detected`,
      detail: "Open Calendar to inspect suggested resolutions and free slots.",
    });
  }
  if (overdue.length) {
    alerts.push({
      title: `${overdue.length} overdue task(s)`,
      detail: `The most urgent item is "${overdue[0].title}".`,
    });
  }
  if (state.latestWeeklyReviews.some((review) => review.replanned)) {
    alerts.push({
      title: "A revised plan is available",
      detail: "Open Replan & Adaptation to inspect the new execution order.",
    });
  }
  if (!alerts.length && active.length) {
    alerts.push({
      title: "Execution is stable",
      detail: `${active.length} task(s) are currently in progress with no adaptation warnings.`,
    });
  }
  return alerts;
}

function renderProgressBreakdown(tasks) {
  if (!tasks.length) {
    return renderEmptyState("No tasks yet.", "Generated plans will show completion distribution here.");
  }
  const counts = {
    pending: tasks.filter((task) => task.status === "pending").length,
    active: tasks.filter((task) => task.status === "active").length,
    done: tasks.filter((task) => task.status === "done").length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
  };

  return Object.entries(counts).map(([status, count]) => {
    const percent = Math.round((count / tasks.length) * 100);
    return `
      <div class="detail-stack">
        <div class="metric-strip">
          <span>${escapeHtml(humanize(status))}</span>
          <strong>${count}</strong>
        </div>
        <div class="progress-bar"><span style="width:${percent}%; background:${statusColor(status)}"></span></div>
      </div>
    `;
  }).join("");
}

function renderPlanView() {
  populateGoalSelect();
  const goal = getSelectedGoal();
  const dag = goal ? state.goalDags[goal.id] : null;
  const goalTasks = goal ? getGoalTasks(goal.id) : [];

  els.planGoalSummary.innerHTML = goal
    ? `
      <div class="detail-stack">
        <h3>${escapeHtml(goal.title)}</h3>
        <p class="support-copy">${escapeHtml(goal.description || "No extra context supplied for this goal.")}</p>
        <div class="inline-metadata">
          <span class="hero-chip hero-chip-soft">${escapeHtml(humanize(goal.domain))}</span>
          <span class="hero-chip hero-chip-soft">Deadline · ${escapeHtml(formatDateTime(goal.deadline))}</span>
        </div>
      </div>
    `
    : renderEmptyState("No goal selected.", "Generate or select a goal to inspect the AI plan view.");

  els.planMilestones.innerHTML = dag?.nodes?.length
    ? renderSimpleList(
        dag.nodes
          .filter((node) => node.milestone)
          .map((node) => `${node.title} · ${formatDateTime(node.scheduled_start)}`)
      )
    : renderEmptyState("No milestones yet.", "Milestones will appear once a goal is planned.");

  const assignments = summarizeAgentAssignments(goalTasks);
  els.planAgentAssignments.innerHTML = assignments.length
    ? assignments.map((assignment) => `
      <div class="list-item">
        <strong>${escapeHtml(assignment.agent)}</strong>
        <p class="support-copy">${assignment.count} task(s) · ${escapeHtml(assignment.role)}</p>
      </div>
    `).join("")
    : renderEmptyState("No assignments yet.", "Agent workloads will appear after planning.");

  renderGraph(goal, dag);
  renderTaskDetailPanel();
}

function populateGoalSelect() {
  els.planGoalSelect.innerHTML = state.goals.length
    ? state.goals.map((goal) => `
      <option value="${escapeAttribute(goal.id)}" ${goal.id === state.selectedGoalId ? "selected" : ""}>
        ${escapeHtml(goal.title)}
      </option>
    `).join("")
    : `<option value="">No goals</option>`;
}

function renderGraph(goal, dag) {
  if (!goal || !dag?.nodes?.length) {
    els.graphNodes.innerHTML = renderEmptyState("No graph to display.", "Generate and approve a plan from the Goal Creation screen.");
    els.graphEdges.innerHTML = "";
    return;
  }

  const levelMap = {};
  const nodesById = Object.fromEntries(dag.nodes.map((node) => [node.task_id || node.key, node]));
  const computeLevel = (node) => {
    const nodeId = node.task_id || node.key;
    if (levelMap[nodeId] !== undefined) {
      return levelMap[nodeId];
    }
    if (!node.depends_on?.length) {
      levelMap[nodeId] = 1;
      return 1;
    }
    levelMap[nodeId] = 1 + Math.max(...node.depends_on.map((dependencyId) => {
      const dependencyNode = nodesById[dependencyId];
      return dependencyNode ? computeLevel(dependencyNode) : 1;
    }));
    return levelMap[nodeId];
  };

  dag.nodes.forEach((node) => computeLevel(node));
  const groups = {};
  dag.nodes.forEach((node) => {
    const nodeId = node.task_id || node.key;
    const level = levelMap[nodeId];
    groups[level] = groups[level] || [];
    groups[level].push(node);
  });

  const levels = Object.keys(groups)
    .map(Number)
    .sort((left, right) => left - right);
  const maxCount = Math.max(...levels.map((level) => groups[level].length));
  const width = Math.max(620, maxCount * 200 + Math.max(0, maxCount - 1) * 24 + 96);
  const height = Math.max(760, 240 + levels.length * 150);
  els.graphNodes.style.minWidth = `${width}px`;
  els.graphNodes.style.minHeight = `${height}px`;
  els.graphEdges.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const positions = {};
  const rootPosition = {
    x: width / 2 - 110,
    y: 40,
    width: 220,
    height: 92,
  };

  const nodeMarkup = [
    `
      <div class="graph-node root-node" style="left:${rootPosition.x}px; top:${rootPosition.y}px;">
        <h4>${escapeHtml(goal.title)}</h4>
        <p>${escapeHtml(humanize(goal.domain))} goal lane</p>
        <div class="node-meta">
          <span class="task-chip active">${dag.nodes.length} nodes</span>
          <span class="task-chip">${dag.milestones.length} milestones</span>
        </div>
      </div>
    `,
  ];

  levels.forEach((level) => {
    const row = groups[level];
    const rowWidth = row.length * 180 + Math.max(0, row.length - 1) * 24;
    const startX = Math.max(40, (width - rowWidth) / 2);
    const y = 180 + (level - 1) * 150;
    row.forEach((node, index) => {
      const nodeId = node.task_id || node.key;
      const x = startX + index * 204;
      positions[nodeId] = { x, y, width: 180, height: 88 };
      const task = state.tasks.find((item) => item.id === node.task_id);
      const agent = getAgentForTask(task || node);
      const agentConfig = AGENT_CONFIG[agent];
      nodeMarkup.push(`
        <button
          class="graph-node ${node.task_id === state.selectedTaskId ? "is-selected" : ""}"
          data-action="select-task"
          data-task-id="${escapeAttribute(node.task_id)}"
          style="left:${x}px; top:${y}px; border-color:${agentConfig.color}55;"
          type="button"
        >
          <h4>${escapeHtml(node.title)}</h4>
          <p>${escapeHtml(Math.round((node.estimated_minutes || 0) / 60))} hr · ${escapeHtml(agent)}</p>
          <div class="node-meta">
            <span class="task-chip ${escapeHtml(task?.status || "pending")}">${escapeHtml(humanize(task?.status || "pending"))}</span>
            <span class="task-chip">${escapeHtml(node.phase)}</span>
          </div>
        </button>
      `);
    });
  });

  els.graphNodes.innerHTML = nodeMarkup.join("");
  els.graphEdges.innerHTML = buildGraphEdges(dag, positions, rootPosition);
}

function buildGraphEdges(dag, positions, rootPosition) {
  const pathMarkup = [];
  dag.nodes
    .filter((node) => !node.depends_on?.length)
    .forEach((node) => {
      const pos = positions[node.task_id || node.key];
      if (!pos) {
        return;
      }
      pathMarkup.push(curvedPath(
        rootPosition.x + rootPosition.width / 2,
        rootPosition.y + rootPosition.height,
        pos.x + pos.width / 2,
        pos.y,
        "#6D5EFC"
      ));
    });

  dag.edges.forEach((edge) => {
    const from = positions[edge.from_node];
    const to = positions[edge.to_node];
    if (!from || !to) {
      return;
    }
    pathMarkup.push(curvedPath(
      from.x + from.width / 2,
      from.y + from.height,
      to.x + to.width / 2,
      to.y,
      "#26324A"
    ));
  });

  return pathMarkup.join("");
}

function curvedPath(x1, y1, x2, y2, stroke) {
  const controlY = (y1 + y2) / 2;
  return `<path d="M ${x1} ${y1} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${y2}" stroke="${stroke}" stroke-width="2" fill="none" stroke-linecap="round" />`;
}

function renderTaskDetailPanel() {
  const task = getSelectedTask();
  if (!task) {
    els.taskDetailPanel.innerHTML = renderEmptyState("No task selected.", "Pick a node from the graph to inspect task details.");
    return;
  }

  const dependencies = task.depends_on
    .map((dependencyId) => state.tasks.find((item) => item.id === dependencyId)?.title)
    .filter(Boolean);
  const agent = getAgentForTask(task);

  els.taskDetailPanel.innerHTML = `
    <div class="detail-stack">
      <div>
        <h3>${escapeHtml(task.title)}</h3>
        <p class="support-copy">${escapeHtml(task.description || "No task description available.")}</p>
      </div>
      <div class="inline-metadata">
        <span class="task-chip ${escapeHtml(task.status)}">${escapeHtml(humanize(task.status))}</span>
        <span class="task-chip">${escapeHtml(agent)}</span>
        <span class="task-chip">${Math.round(task.estimated_minutes / 60)} hr</span>
      </div>
      <div class="support-divider"></div>
      <div class="detail-list">
        <div class="list-item">
          <strong>Scheduled window</strong>
          <p class="support-copy">${escapeHtml(formatDateTime(task.scheduled_start))} to ${escapeHtml(formatDateTime(task.scheduled_end))}</p>
        </div>
        <div class="list-item">
          <strong>Dependencies</strong>
          <p class="support-copy">${dependencies.length ? escapeHtml(dependencies.join(", ")) : "This node can start immediately."}</p>
        </div>
        <div class="list-item">
          <strong>Execution note</strong>
          <p class="support-copy">Use this panel for the command-center decision before pushing the task into the next state.</p>
        </div>
      </div>
      <div class="button-row">
        <button class="button button-primary" data-action="mark-task-done" data-task-id="${escapeAttribute(task.id)}" type="button">Mark Completed</button>
        <button class="button button-secondary" data-action="open-calendar" type="button">Open Schedule</button>
      </div>
    </div>
  `;
}

function renderCalendarView() {
  const selectedDate = state.scheduleDate || new Date();
  els.scheduleDateInput.value = toDateInput(selectedDate);

  renderMiniCalendar(selectedDate);
  renderDeadlines();
  renderConnectedTools();
  renderPlanner(selectedDate);
  renderCalendarSignals();
}

function renderMiniCalendar(selectedDate) {
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());

  const cells = [];
  for (let index = 0; index < 35; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const isActive = sameDay(date, selectedDate);
    cells.push(`
      <button class="mini-calendar-cell ${isActive ? "is-active" : ""}" data-action="select-date" data-date="${toDateInput(date)}" type="button">
        ${date.getDate()}
      </button>
    `);
  }

  els.miniCalendar.innerHTML = `
    <div class="detail-stack">
      <div class="metric-strip">
        <span>${selectedDate.toLocaleString(undefined, { month: "long" })}</span>
        <strong>${year}</strong>
      </div>
      <div class="mini-calendar-grid">${cells.join("")}</div>
    </div>
  `;
}

function renderDeadlines() {
  const deadlines = [...state.tasks]
    .filter((task) => task.scheduled_end)
    .sort((left, right) => new Date(left.scheduled_end) - new Date(right.scheduled_end))
    .slice(0, 5);

  els.deadlineList.innerHTML = deadlines.length
    ? deadlines.map((task) => `
      <div class="deadline-item">
        <strong>${escapeHtml(task.title)}</strong>
        <p class="support-copy">${escapeHtml(formatDateTime(task.scheduled_end))}</p>
      </div>
    `).join("")
    : renderEmptyState("No deadlines yet.", "Once tasks are scheduled, the next deadlines will appear here.");
}

function renderConnectedTools() {
  const tools = state.systemStatus?.connections ?? [];
  els.connectedToolsList.innerHTML = tools.length
    ? tools.map((tool) => `
      <div class="connection-card">
        <strong>${escapeHtml(tool.name)}</strong>
        <p class="support-copy">${escapeHtml(tool.detail)}</p>
        <div class="inline-metadata">
          <span class="task-chip active">${escapeHtml(tool.status)}</span>
          <span class="task-chip">${escapeHtml(tool.kind)}</span>
        </div>
      </div>
    `).join("")
    : renderEmptyState("No tools connected.", "System status will populate connected tool adapters.");
}

function renderPlanner(selectedDate) {
  const rows = [];
  for (let hour = 8; hour <= 22; hour += 1) {
    rows.push(`
      <div class="planner-row">
        <div class="planner-time">${formatHour(hour)}</div>
        <div class="planner-slot"></div>
      </div>
    `);
  }

  const dayEvents = getEventsForDay(state.events, selectedDate);
  const blocks = dayEvents.map((event) => {
    const start = new Date(event.start_at);
    const end = new Date(event.end_at);
    const top = ((start.getHours() + start.getMinutes() / 60) - 8) * 56;
    const height = Math.max(44, (((end - start) / (1000 * 60 * 60)) * 56));
    return `
      <button
        class="event-block ${escapeHtml(event.source)}"
        data-action="inspect-event"
        data-event-id="${escapeAttribute(event.id)}"
        style="top:${top}px; height:${height}px;"
        type="button"
      >
        <strong>${escapeHtml(event.title)}</strong>
        <p>${escapeHtml(formatTimeOnly(event.start_at))} - ${escapeHtml(formatTimeOnly(event.end_at))}</p>
      </button>
    `;
  }).join("");

  els.plannerGrid.innerHTML = `
    <div class="planner-rows">${rows.join("")}</div>
    <div class="planner-events">${blocks}</div>
  `;
}

function renderCalendarSignals() {
  els.calendarConflicts.innerHTML = state.latestConflictScan.length
    ? state.latestConflictScan.map((alert) => `
      <div class="list-item">
        <strong>${escapeHtml(alert.task_title)}</strong>
        <p class="support-copy">${escapeHtml(alert.colliding_title)} overlaps ${escapeHtml(formatDateTime(alert.original_start))}.</p>
      </div>
    `).join("")
    : renderEmptyState("No conflict warnings.", "Run the conflict detector to inspect the next 72-hour window.");

  const recommendations = buildCalendarRecommendations();
  els.calendarRecommendations.innerHTML = recommendations.length
    ? recommendations.map((item) => `
      <div class="list-item">
        <strong>${escapeHtml(item.title)}</strong>
        <p class="support-copy">${escapeHtml(item.detail)}</p>
      </div>
    `).join("")
    : renderEmptyState("No replan recommendations yet.", "Run a weekly review or create more schedule pressure.");

  const freeSlots = getFreeSlotsForSelectedDay();
  els.freeSlotsList.innerHTML = freeSlots.length
    ? freeSlots.map((slot) => `
      <div class="list-item">
        <strong>${escapeHtml(slot.label)}</strong>
        <p class="support-copy">${escapeHtml(slot.detail)}</p>
      </div>
    `).join("")
    : renderEmptyState("No free slots found.", "Create or move events to open execution windows.");
}

function buildCalendarRecommendations() {
  const recommendations = [];
  const overdue = state.tasks.filter((task) => isOverdue(task));
  if (overdue.length) {
    recommendations.push({
      title: "Recover overdue work",
      detail: `Reserve a free slot for "${overdue[0].title}" before the next milestone tightens.`,
    });
  }
  if (state.latestWeeklyReviews.some((review) => review.replanned)) {
    const review = state.latestWeeklyReviews.find((item) => item.replanned);
    recommendations.push({
      title: "Open the revised plan",
      detail: review.summary,
    });
  }
  if (!recommendations.length) {
    recommendations.push({
      title: "Protect focus blocks",
      detail: "Long execution tasks perform best when external meetings are held outside core blocks.",
    });
  }
  return recommendations;
}

function getFreeSlotsForSelectedDay() {
  const selectedDate = state.scheduleDate || new Date();
  const events = getEventsForDay(state.events, selectedDate)
    .map((event) => ({
      start: new Date(event.start_at),
      end: new Date(event.end_at),
    }))
    .sort((left, right) => left.start - right.start);

  const dayStart = new Date(selectedDate);
  dayStart.setHours(8, 0, 0, 0);
  const dayEnd = new Date(selectedDate);
  dayEnd.setHours(22, 0, 0, 0);

  const slots = [];
  let cursor = new Date(dayStart);
  events.forEach((event) => {
    if (event.start > cursor) {
      slots.push({ start: new Date(cursor), end: new Date(event.start) });
    }
    if (event.end > cursor) {
      cursor = new Date(event.end);
    }
  });
  if (cursor < dayEnd) {
    slots.push({ start: cursor, end: dayEnd });
  }

  return slots
    .filter((slot) => slot.end - slot.start >= 30 * 60 * 1000)
    .slice(0, 4)
    .map((slot) => ({
      label: `${formatTimeOnly(slot.start.toISOString())} - ${formatTimeOnly(slot.end.toISOString())}`,
      detail: `${Math.round((slot.end - slot.start) / (1000 * 60))} minute window available for a recovery block.`,
    }));
}

function renderTaskBoard() {
  const filter = els.taskBoardFilter.value || "all";
  const query = (els.taskBoardSearch.value || "").trim().toLowerCase();
  const filteredTasks = state.tasks.filter((task) => {
    const matchesFilter = filter === "all" ? true : task.status === filter;
    const matchesQuery = query
      ? [task.title, task.description, task.phase].join(" ").toLowerCase().includes(query)
      : true;
    return matchesFilter && matchesQuery;
  });

  const buckets = {
    backlog: [],
    today: [],
    inProgress: [],
    completed: [],
  };

  filteredTasks.forEach((task) => {
    if (task.status === "done") {
      buckets.completed.push(task);
      return;
    }
    if (task.status === "active") {
      buckets.inProgress.push(task);
      return;
    }
    const scheduled = task.scheduled_start ? new Date(task.scheduled_start) : null;
    if (scheduled && sameDay(scheduled, new Date())) {
      buckets.today.push(task);
      return;
    }
    buckets.backlog.push(task);
  });

  renderTaskColumn(els.backlogColumn, buckets.backlog);
  renderTaskColumn(els.todayColumn, buckets.today);
  renderTaskColumn(els.inProgressColumn, buckets.inProgress);
  renderTaskColumn(els.completedColumn, buckets.completed);

  els.backlogCount.textContent = String(buckets.backlog.length);
  els.todayCount.textContent = String(buckets.today.length);
  els.progressCount.textContent = String(buckets.inProgress.length);
  els.completedCount.textContent = String(buckets.completed.length);
}

function renderTaskColumn(target, tasks) {
  target.innerHTML = tasks.length
    ? tasks.map((task) => renderTaskCard(task)).join("")
    : renderEmptyState("No tasks in this lane.", "");
}

function renderTaskCard(task) {
  const agent = getAgentForTask(task);
  return `
    <div class="task-card">
      <div class="task-card-top">
        <span class="task-chip ${escapeHtml(task.status)}">${escapeHtml(humanize(task.status))}</span>
        <span class="task-chip">${escapeHtml(agent)}</span>
      </div>
      <div>
        <h4>${escapeHtml(task.title)}</h4>
        <p>${escapeHtml(task.description || "Task generated by the plan graph.")}</p>
      </div>
      <div class="task-card-bottom">
        <span class="support-copy">${escapeHtml(formatDateTime(task.scheduled_start))}</span>
        ${task.status !== "done" ? `<button class="button button-ghost" data-action="mark-task-done" data-task-id="${escapeAttribute(task.id)}" type="button">Complete</button>` : ""}
      </div>
    </div>
  `;
}

function renderReplanView() {
  const overdue = state.tasks.filter((task) => isOverdue(task));
  const replanned = state.latestWeeklyReviews.filter((review) => review.replanned);
  const overdueCount = overdue.length;
  const freeSlots = getFreeSlotsForSelectedDay().length;

  els.replanInsightCard.innerHTML = `
    <div class="detail-stack">
      <h3>You missed ${overdueCount} task(s)</h3>
      <p class="support-copy">The scheduler found ${freeSlots} free slot(s) in the selected day window and the execution plan is watching for drift.</p>
      <div class="inline-metadata">
        <span class="hero-chip hero-chip-soft">${replanned.length} revised plan(s)</span>
        <span class="hero-chip hero-chip-soft">${overdueCount} overdue</span>
      </div>
    </div>
  `;

  els.missedTaskTimeline.innerHTML = overdue.length
    ? overdue.map((task) => `
      <div class="timeline-item">
        <strong>${escapeHtml(task.title)}</strong>
        <p class="support-copy">Missed ${escapeHtml(formatDateTime(task.scheduled_end))}</p>
        <div class="inline-metadata">
          <span class="task-chip pending">${escapeHtml(task.phase)}</span>
          <span class="task-chip">${escapeHtml(getAgentForTask(task))}</span>
        </div>
      </div>
    `).join("")
    : renderEmptyState("No missed tasks.", "The timeline is stable right now.");

  const reasons = dedupe(overdue.map((task) => {
    if (task.phase === "planning") {
      return "Planning backlog";
    }
    if (task.phase === "tracking") {
      return "Review cadence drift";
    }
    return "Execution compression";
  }));

  els.reasonTags.innerHTML = reasons.length
    ? `<div class="reason-tags">${reasons.map((tag) => `<span class="task-chip blocked">${escapeHtml(tag)}</span>`).join("")}</div>`
    : renderEmptyState("No reason tags yet.", "Overdue work or missed dependencies will surface tags here.");

  if (state.latestWeeklyReviews.length) {
    els.replanSummary.innerHTML = state.latestWeeklyReviews.map((review) => `
      <div class="list-item">
        <strong>${escapeHtml(goalTitle(review.goal_id))}</strong>
        <p class="support-copy">${escapeHtml(review.summary)}</p>
        <div class="inline-metadata">
          <span class="task-chip ${review.replanned ? "active" : "done"}">${review.replanned ? "Replanned" : "Stable"}</span>
          <span class="task-chip">${Math.round(review.deviation_pct * 100)}% deviation</span>
        </div>
      </div>
    `).join("");
    els.replanChanges.innerHTML = state.latestWeeklyReviews.map((review) => `
      <div class="list-item">
        <strong>${review.updated_task_ids.length} task(s) updated</strong>
        <p class="support-copy">${review.updated_task_ids.length ? "The plan has fresh schedule windows applied." : "No schedule changes were required."}</p>
      </div>
    `).join("");
  } else {
    els.replanSummary.innerHTML = renderEmptyState("No replan data yet.", "Run the weekly review to generate an adaptive recommendation.");
    els.replanChanges.innerHTML = "";
  }
}

function clearReplanState() {
  state.latestWeeklyReviews = [];
  renderReplanView();
  showStatus("Latest replan suggestions cleared from the UI.", "info");
}

function renderNotesView() {
  const categories = groupNotesByType();
  const selectedNote = getSelectedNote();
  els.noteFolders.innerHTML = categories.length
    ? categories.map((category) => `
      <div class="folder-item ${category.active ? "is-active" : ""}" data-action="select-note" data-note-id="${escapeAttribute(category.note.id)}">
        <strong>${escapeHtml(humanize(category.note.note_type))}</strong>
        <p class="support-copy">${escapeHtml(category.note.title)}</p>
      </div>
    `).join("")
    : renderEmptyState("No notes yet.", "Context packages and status reports will appear after goal switches or weekly reviews.");

  els.selectedNoteTitle.textContent = selectedNote?.title || "Memory workspace";
  els.selectedNoteType.textContent = humanize(selectedNote?.note_type || "draft");
  if (selectedNote) {
    els.noteEditor.value = state.draftNote || selectedNote.content;
  } else {
    els.noteEditor.value = state.draftNote || "";
  }

  els.linkedContext.innerHTML = selectedNote
    ? renderLinkedContext(selectedNote)
    : renderEmptyState("No linked context yet.", "Select a note to inspect related goal, tasks, and time blocks.");
}

function groupNotesByType() {
  return state.notes.map((note) => ({
    note,
    active: note.id === state.selectedNoteId,
  }));
}

function renderLinkedContext(note) {
  const relatedGoal = state.goals.find((goal) => goal.id === note.goal_id);
  const relatedTasks = note.goal_id ? getGoalTasks(note.goal_id).slice(0, 3) : [];
  const relatedEvents = note.goal_id ? state.events.filter((event) => event.goal_id === note.goal_id).slice(0, 3) : [];

  const cards = [];
  if (relatedGoal) {
    cards.push(`
      <div class="context-item">
        <strong>Linked goal</strong>
        <p class="support-copy">${escapeHtml(relatedGoal.title)}</p>
      </div>
    `);
  }
  if (relatedTasks.length) {
    cards.push(`
      <div class="context-item">
        <strong>Linked tasks</strong>
        <p class="support-copy">${escapeHtml(relatedTasks.map((task) => task.title).join(", "))}</p>
      </div>
    `);
  }
  if (relatedEvents.length) {
    cards.push(`
      <div class="context-item">
        <strong>Meetings and blocks</strong>
        <p class="support-copy">${escapeHtml(relatedEvents.map((event) => event.title).join(", "))}</p>
      </div>
    `);
  }
  if (!cards.length) {
    cards.push(renderEmptyState("No linked entities.", "This note is not attached to a goal yet."));
  }
  return cards.join("");
}

function renderSystemStatus() {
  const status = state.systemStatus;
  if (!status) {
    return;
  }

  els.systemAgents.innerHTML = status.agents.map((agent) => `
    <div class="agent-health-card">
      <strong>${escapeHtml(agent.name)}</strong>
      <p class="support-copy">${escapeHtml(agent.detail)}</p>
      <div class="inline-metadata">
        <span class="task-chip active">${escapeHtml(agent.status)}</span>
        <span class="task-chip">${escapeHtml(agent.load_label)}</span>
      </div>
    </div>
  `).join("");

  els.systemConnections.innerHTML = status.connections.map((connection) => `
    <div class="connection-card">
      <strong>${escapeHtml(connection.name)}</strong>
      <p class="support-copy">${escapeHtml(connection.detail)}</p>
      <div class="inline-metadata">
        <span class="task-chip active">${escapeHtml(connection.status)}</span>
        <span class="task-chip">${escapeHtml(connection.kind)}</span>
      </div>
    </div>
  `).join("");

  els.systemDatabase.innerHTML = `
    <div class="detail-stack">
      <div class="metric-strip">
        <span>${escapeHtml(status.database)}</span>
        <strong>${escapeHtml(status.status)}</strong>
      </div>
      <p class="support-copy">Environment: ${escapeHtml(status.environment)} · Mode: ${escapeHtml(status.runtime_mode)}</p>
      ${status.metrics.map((metric) => `
        <div class="metric-strip">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${metric.value}</strong>
        </div>
      `).join("")}
    </div>
  `;

  els.systemWorkflowLogs.innerHTML = status.workflows.map((entry) => `
    <div class="workflow-log">
      <strong>${escapeHtml(entry.title)}</strong>
      <p class="support-copy">${escapeHtml(entry.detail)}</p>
      <div class="inline-metadata">
        <span class="task-chip">${escapeHtml(humanize(entry.status))}</span>
        <span class="task-chip">${escapeHtml(entry.timestamp ? formatDateTime(entry.timestamp) : "No timestamp")}</span>
      </div>
    </div>
  `).join("");

  els.systemRequestHistory.innerHTML = state.requestHistory.length
    ? state.requestHistory.slice(0, 8).map((entry) => `
      <div class="workflow-log">
        <strong>${escapeHtml(entry.method)} ${escapeHtml(entry.url)}</strong>
        <p class="support-copy">Status ${entry.status} · ${entry.duration} ms · ${escapeHtml(formatDateTime(entry.at))}</p>
      </div>
    `).join("")
    : renderEmptyState("No frontend requests yet.", "Request history is populated after the workspace starts loading data.");

  els.systemHeartbeat.innerHTML = `
    <div class="detail-stack">
      <div class="metric-strip">
        <span>Application</span>
        <strong>${escapeHtml(status.app)}</strong>
      </div>
      <p class="support-copy">Last update: ${escapeHtml(formatDateTime(status.last_updated))}</p>
      <div class="inline-metadata">
        <span class="task-chip active">Healthy</span>
        <span class="task-chip">${escapeHtml(status.runtime_mode)}</span>
      </div>
    </div>
  `;
}

async function runConflictScan() {
  showLoading("Conflict sentinel", [
    "Scanning the next 72 hours for schedule pressure.",
    "Evaluating alternative windows and free slots.",
  ]);
  try {
    state.latestConflictScan = await fetchJson("/api/v1/webhooks/cron/conflict-check", {
      method: "POST",
      body: JSON.stringify({ user_id: currentUserId(), auto_resolve: false }),
    });
    renderDashboard();
    renderCalendarSignals();
    showStatus(
      state.latestConflictScan.length
        ? `Detected ${state.latestConflictScan.length} conflict(s).`
        : "No conflicts found in the next 72 hours.",
      state.latestConflictScan.length ? "warning" : "success"
    );
  } catch (error) {
    showStatus(error.message, "danger");
  } finally {
    hideLoading();
  }
}

async function runWeeklyReview() {
  showLoading("Progress adaptor", [
    "Reviewing due tasks and deviation percentages.",
    "Testing whether the plan needs a new sequence.",
  ]);
  try {
    state.latestWeeklyReviews = await fetchJson("/api/v1/webhooks/cron/weekly-review", {
      method: "POST",
      body: JSON.stringify({ user_id: currentUserId() }),
    });
    await loadWorkspaceData();
    renderReplanView();
    const replanned = state.latestWeeklyReviews.filter((review) => review.replanned);
    if (replanned.length) {
      showAdaptiveModal(replanned);
      showStatus("Weekly review generated a revised execution lane.", "warning");
    } else {
      showStatus("Weekly review completed. The current plan remains stable.", "success");
    }
  } catch (error) {
    showStatus(error.message, "danger");
  } finally {
    hideLoading();
  }
}

function showAdaptiveModal(reviews) {
  els.adaptiveModalContent.innerHTML = reviews.map((review) => `
    <div class="list-item">
      <strong>${escapeHtml(goalTitle(review.goal_id))}</strong>
      <p class="support-copy">${escapeHtml(review.summary)}</p>
    </div>
  `).join("");
  els.adaptiveModal.classList.remove("is-hidden");
}

function hideAdaptiveModal() {
  els.adaptiveModal.classList.add("is-hidden");
}

function handleGlobalSearch() {
  const query = els.globalSearchInput.value.trim();
  els.sidebarSearch.value = query;
  if (searchDebounce) {
    clearTimeout(searchDebounce);
  }
  if (query.length < 2) {
    els.searchResults.classList.add("is-hidden");
    els.searchResults.innerHTML = "";
    return;
  }

  searchDebounce = setTimeout(async () => {
    try {
      const results = await fetchJson(`/api/v1/tasks/search?q=${encodeURIComponent(query)}&user_id=${encodeURIComponent(currentUserId())}`);
      els.searchResults.innerHTML = results.length
        ? results.map((task) => `
          <button class="search-result-card" data-action="select-search-task" data-task-id="${escapeAttribute(task.id)}" type="button">
            <strong>${escapeHtml(task.title)}</strong>
            <p class="support-copy">${escapeHtml(task.phase)} · ${escapeHtml(formatDateTime(task.scheduled_start))}</p>
          </button>
        `).join("")
        : renderEmptyState("No task matches.", "Try a broader search query.");
      els.searchResults.classList.remove("is-hidden");
    } catch (error) {
      showStatus(error.message, "danger");
    }
  }, 220);
}

async function handleDocumentClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    if (!event.target.closest("#searchResults") && !event.target.closest("#globalSearchInput")) {
      els.searchResults.classList.add("is-hidden");
    }
    return;
  }

  const action = actionTarget.dataset.action;
  if (action === "mark-task-done") {
    const taskId = actionTarget.dataset.taskId;
    await markTaskDone(taskId);
    return;
  }
  if (action === "select-task") {
    state.selectedTaskId = actionTarget.dataset.taskId;
    renderPlanView();
    return;
  }
  if (action === "select-note") {
    state.selectedNoteId = actionTarget.dataset.noteId;
    state.draftNote = "";
    renderNotesView();
    return;
  }
  if (action === "select-date") {
    state.scheduleDate = parseInputDate(actionTarget.dataset.date) || new Date();
    renderCalendarView();
    return;
  }
  if (action === "select-search-task") {
    state.selectedTaskId = actionTarget.dataset.taskId;
    const task = state.tasks.find((item) => item.id === state.selectedTaskId);
    state.selectedGoalId = task?.goal_id ?? state.selectedGoalId;
    await ensureGoalDag(state.selectedGoalId);
    els.searchResults.classList.add("is-hidden");
    switchView("agents");
    renderAll();
    return;
  }
  if (action === "open-calendar") {
    switchView("calendar");
  }
}

async function markTaskDone(taskId) {
  try {
    await fetchJson(`/api/v1/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "done" }),
    });
    await loadWorkspaceData();
    showStatus("Task marked as completed.", "success");
  } catch (error) {
    showStatus(error.message, "danger");
  }
}

async function fetchJson(url, options = {}) {
  const startedAt = performance.now();
  const method = options.method || "GET";
  const fetchOptions = {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  };

  try {
    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    const duration = Math.round(performance.now() - startedAt);
    trackRequest(method, url, response.status, duration);
    if (!response.ok) {
      throw new Error(typeof payload === "string" ? payload : JSON.stringify(payload));
    }
    return payload;
  } catch (error) {
    const duration = Math.round(performance.now() - startedAt);
    trackRequest(method, url, "ERR", duration);
    throw error;
  }
}

function trackRequest(method, url, status, duration) {
  state.requestHistory.unshift({
    method,
    url,
    status: String(status),
    duration: String(duration),
    at: new Date().toISOString(),
  });
  state.requestHistory = state.requestHistory.slice(0, 10);
}

function showStatus(message, tone = "info") {
  els.statusBanner.textContent = message;
  els.statusBanner.className = `status-chip status-chip-${tone}`;
}

function showLoading(title, messages) {
  clearLoadingCycle();
  els.loadingTitle.textContent = title;
  els.loadingMessage.textContent = messages[0] || "";
  els.loadingModal.classList.remove("is-hidden");
  if (messages.length > 1) {
    let index = 0;
    loadingInterval = window.setInterval(() => {
      index = (index + 1) % messages.length;
      els.loadingMessage.textContent = messages[index];
    }, 1100);
  }
}

function hideLoading() {
  clearLoadingCycle();
  els.loadingModal.classList.add("is-hidden");
}

function clearLoadingCycle() {
  if (loadingInterval) {
    window.clearInterval(loadingInterval);
    loadingInterval = null;
  }
}

function getSelectedGoal() {
  return state.goals.find((goal) => goal.id === state.selectedGoalId) || null;
}

function getSelectedTask() {
  return state.tasks.find((task) => task.id === state.selectedTaskId) || null;
}

function getSelectedNote() {
  return state.notes.find((note) => note.id === state.selectedNoteId) || null;
}

function getGoalTasks(goalId) {
  return state.tasks
    .filter((task) => task.goal_id === goalId)
    .sort((left, right) => left.order_index - right.order_index);
}

function currentUserId() {
  return (els.goalUserId?.value || state.userId || "demo-user").trim() || "demo-user";
}

function calculateCompletion(tasks) {
  if (!tasks.length) {
    return 0;
  }
  return Math.round((tasks.filter((task) => task.status === "done").length / tasks.length) * 100);
}

function summarizeAgentAssignments(tasks) {
  const counts = {};
  tasks.forEach((task) => {
    const agent = getAgentForTask(task);
    counts[agent] = counts[agent] || { agent, role: AGENT_CONFIG[agent].role, count: 0 };
    counts[agent].count += 1;
  });
  return Object.values(counts);
}

function getAgentForTask(task) {
  const phase = (task?.phase || "").toLowerCase();
  if (/(plan|track|delivery)/.test(phase)) {
    return "Orchestrator";
  }
  if (/(discover|design|research)/.test(phase)) {
    return "Research";
  }
  if (/(validation|hardening|calendar)/.test(phase)) {
    return "Scheduler";
  }
  if (/(mentorship|review|context|memory)/.test(phase)) {
    return "Memory";
  }
  return "Execution";
}

function getEventsForDay(events, date) {
  return events
    .filter((event) => sameDay(new Date(event.start_at), date))
    .sort((left, right) => new Date(left.start_at) - new Date(right.start_at));
}

function isOverdue(task) {
  return task.scheduled_end && new Date(task.scheduled_end) < new Date() && task.status !== "done";
}

function renderTimelineEvent(event) {
  return `
    <div class="list-item">
      <strong>${escapeHtml(event.title)}</strong>
      <p class="support-copy">${escapeHtml(formatTimeOnly(event.start_at))} - ${escapeHtml(formatTimeOnly(event.end_at))} · ${escapeHtml(event.source)}</p>
    </div>
  `;
}

function renderSimpleList(items, tone = "info") {
  if (!items?.length) {
    return renderEmptyState("No items yet.", "");
  }
  return items.map((item) => `
    <div class="list-item">
      <span class="status-chip status-chip-${tone}">${tone === "warning" ? "Risk" : "Item"}</span>
      <p class="support-copy">${escapeHtml(item)}</p>
    </div>
  `).join("");
}

function renderEmptyState(title, detail) {
  return `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      ${detail ? `<p class="support-copy">${escapeHtml(detail)}</p>` : ""}
    </div>
  `;
}

function goalTitle(goalId) {
  return state.goals.find((goal) => goal.id === goalId)?.title || "Unknown goal";
}

function statusColor(status) {
  if (status === "done") {
    return "#22C55E";
  }
  if (status === "active") {
    return "#38BDF8";
  }
  if (status === "blocked") {
    return "#EF4444";
  }
  return "#F59E0B";
}

function formatNameFromIdentity(value) {
  const stem = (value || "devaraj").split("@")[0].replace(/[._-]+/g, " ");
  return stem
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatUserId(value) {
  return (value || "")
    .split("@")[0]
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "demo-user";
}

function initialsFromName(value) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function formatDateTime(value) {
  if (!value) {
    return "Unscheduled";
  }
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeOnly(value) {
  if (!value) {
    return "--";
  }
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHour(hour) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function toLocalDateTimeInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function toDateInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function parseInputDateTime(value) {
  return value ? new Date(value) : null;
}

function parseInputDate(value) {
  return value ? new Date(`${value}T00:00:00`) : null;
}

function sameDay(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function humanize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function dedupe(items) {
  return [...new Set(items)];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
