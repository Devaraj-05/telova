const state = {
  userId: "demo-user",
  profileName: "Devaraj",
  apiKey: "demo-pass",
  goals: [],
  tasks: [],
  notes: [],
  events: [],
  dashboard: null,
  systemStatus: null,
  requestHistory: [],
  selectedGoalId: null,
  latestConflictScan: [],
  latestWeeklyReviews: [],
  chatMessages: [],
  goalDraft: null,
  pendingPreview: null,
};

const QUICK_PROMPTS = [
  { action: "send-prompt", prompt: "Help me create a new goal.", label: "Create a goal" },
  { action: "send-prompt", prompt: "What should I do next?", label: "What should I do next?" },
  { action: "send-prompt", prompt: "What's due today?", label: "What's due today?" },
  { action: "run-conflict-scan", label: "Run conflict scan" },
  { action: "run-weekly-review", label: "Run weekly review" },
  { action: "send-prompt", prompt: "Remember that I need to capture a note.", label: "Capture a note" },
];

const PRIORITY_CHOICES = ["High", "Balanced", "Flexible"];
const els = {};
let loadingTimer = null;
let messageCounter = 0;

document.addEventListener("DOMContentLoaded", init);

function init() {
  [
    "welcomeScreen",
    "welcomeEmail",
    "welcomePassword",
    "enterWorkspaceButton",
    "continueGoogleButton",
    "appShell",
    "quickPromptList",
    "goalCount",
    "goalList",
    "sidebarConnections",
    "profileAvatar",
    "profileName",
    "profileRole",
    "workspaceTitle",
    "workspaceSubtitle",
    "workspaceStatus",
    "chatThread",
    "suggestionRow",
    "chatComposer",
    "sendMessageButton",
    "contextGoal",
    "contextProgress",
    "contextSchedule",
    "contextNotes",
    "contextSystem",
    "loadingModal",
    "loadingTitle",
    "loadingMessage",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });

  els.enterWorkspaceButton.addEventListener("click", enterWorkspace);
  els.continueGoogleButton.addEventListener("click", enterWorkspace);
  els.sendMessageButton.addEventListener("click", sendComposerMessage);
  els.chatComposer.addEventListener("keydown", handleComposerKeydown);
  els.chatComposer.addEventListener("input", autoResizeComposer);
  document.addEventListener("click", handleDocumentClick);

  renderQuickPromptList();
  renderSuggestionRow();
  autoResizeComposer();
}

async function enterWorkspace() {
  state.profileName = prettyName(els.welcomeEmail.value || state.userId);
  state.userId = userIdFromEmail(els.welcomeEmail.value) || "demo-user";
  state.apiKey = (els.welcomePassword.value || "").trim();

  hydrateProfile();
  showLoading("Opening workspace", [
    "Loading goals, tasks, schedule, and notes.",
    "Preparing the Telova agent conversation.",
  ]);

  try {
    await loadWorkspace();
    ensureConversation();
    els.welcomeScreen.classList.add("is-hidden");
    els.appShell.classList.remove("is-hidden");
    renderAll();
    setStatus("Workspace ready");
  } catch (error) {
    setStatus(readError(error));
  } finally {
    hideLoading();
  }
}

async function loadWorkspace() {
  const user = encodeURIComponent(state.userId);
  const [dashboard, goals, tasks, notes, events, systemStatus] = await Promise.all([
    fetchJson(`/api/v1/dashboard?user_id=${user}`),
    fetchJson(`/api/v1/goals?user_id=${user}`),
    fetchJson(`/api/v1/tasks?user_id=${user}`),
    fetchJson(`/api/v1/notes?user_id=${user}`),
    fetchJson(`/api/v1/calendar/events?user_id=${user}`),
    fetchJson(`/api/v1/system/status?user_id=${user}`),
  ]);

  state.dashboard = dashboard;
  state.goals = goals;
  state.tasks = tasks;
  state.notes = notes;
  state.events = events;
  state.systemStatus = systemStatus;

  if (!state.selectedGoalId || !state.goals.some((goal) => goal.id === state.selectedGoalId)) {
    state.selectedGoalId = state.goals[0]?.id || null;
  }

  renderAll();
}

function ensureConversation() {
  if (state.chatMessages.length) return;

  addAssistantMessage({
    title: "Telova is ready",
    text: state.goals.length
      ? "Ask me about your active goals, progress, upcoming schedule, notes, conflicts, or tell me what new goal you want to plan."
      : "Tell me the goal you want to achieve. I'll collect the missing deadline, constraints, and priority before I draft your plan.",
    cards: buildWorkspaceSummaryCards(),
    actions: [
      { action: "send-prompt", prompt: "Help me create a new goal.", label: "Create a goal", variant: "primary" },
      { action: "send-prompt", prompt: "What's due today?", label: "What's due today?", variant: "secondary" },
      { action: "send-prompt", prompt: "How is my progress?", label: "Show progress", variant: "secondary" },
    ],
  });
}

function renderAll() {
  hydrateProfile();
  renderQuickPromptList();
  renderSuggestionRow();
  renderSidebarGoals();
  renderSidebarConnections();
  renderWorkspaceHeader();
  renderChatThread();
  renderContextRail();
}

function hydrateProfile() {
  els.profileName.textContent = state.profileName;
  els.profileRole.textContent = `Operator, ${state.userId}`;
  els.profileAvatar.textContent = initials(state.profileName);
}

function renderQuickPromptList() {
  els.quickPromptList.innerHTML = QUICK_PROMPTS.map((item) => actionChip(item, "action-chip")).join("");
}

function renderSuggestionRow() {
  const items = state.pendingPreview
    ? [
        { action: "approve-plan", label: "Approve plan" },
        { action: "revise-plan", label: "Request changes" },
        { action: "send-prompt", prompt: "Show me the tasks in the preview again.", label: "Preview tasks" },
        { action: "send-prompt", prompt: "What's due today?", label: "Today's schedule" },
      ]
    : state.goalDraft
    ? [
        { action: "send-prompt", prompt: "Cancel this draft.", label: "Cancel draft" },
        { action: "send-prompt", prompt: "Use a high priority plan.", label: "High priority" },
        { action: "send-prompt", prompt: "No constraints.", label: "No constraints" },
        { action: "send-prompt", prompt: "Deadline in 6 months.", label: "Deadline in 6 months" },
      ]
    : QUICK_PROMPTS.slice(0, 4);

  els.suggestionRow.innerHTML = items.map((item) => actionChip(item, "action-chip")).join("");
}

function renderSidebarGoals() {
  els.goalCount.textContent = String(state.goals.length);

  if (!state.goals.length) {
    els.goalList.innerHTML = emptyState("No goals yet", "Start a conversation to create your first goal.");
    return;
  }

  els.goalList.innerHTML = state.goals.map((goal) => {
    const tasks = tasksForGoal(goal.id);
    const done = tasks.filter((task) => task.status === "done").length;
    const cls = goal.id === state.selectedGoalId ? "goal-item is-active" : "goal-item";
    return `
      <button class="${cls}" type="button" data-action="select-goal" data-goal-id="${esc(goal.id)}">
        <strong>${esc(goal.title)}</strong>
        <p class="goal-meta">${esc(human(goal.domain))} | ${done}/${tasks.length || 0} done</p>
      </button>
    `;
  }).join("");
}

function renderSidebarConnections() {
  const connections = state.systemStatus?.connections || [];
  if (!connections.length) {
    els.sidebarConnections.innerHTML = emptyState("No sync data", "Connections appear after the workspace loads.");
    return;
  }

  els.sidebarConnections.innerHTML = connections.slice(0, 4).map((connection) => `
    <div class="connection-pill">
      <div>
        <strong>${esc(connection.name)}</strong>
        <p class="goal-meta">${esc(connection.kind)}</p>
      </div>
      <span class="tag ${toneForStatus(connection.status)}">${esc(human(connection.status))}</span>
    </div>
  `).join("");
}

function renderWorkspaceHeader() {
  const current = selectedGoal();
  els.workspaceTitle.textContent = current ? current.title : `Hello, ${state.profileName}`;
  els.workspaceSubtitle.textContent = current
    ? "Chat with Telova to inspect progress, review time pressure, adapt the plan, or capture new notes around this goal."
    : "Chat with Telova to create goals, inspect schedule pressure, review tasks, track progress, and capture notes.";
}

function renderChatThread() {
  els.chatThread.innerHTML = state.chatMessages.map(renderMessage).join("");
  requestAnimationFrame(() => {
    els.chatThread.scrollTop = els.chatThread.scrollHeight;
  });
}

function renderContextRail() {
  renderContextGoal();
  renderContextProgress();
  renderContextSchedule();
  renderContextNotes();
  renderContextSystem();
}

function renderContextGoal() {
  const goal = selectedGoal();
  if (!goal) {
    els.contextGoal.innerHTML = emptyState("No active goal", "Create a goal in chat and Telova will turn it into a scheduled execution plan.");
    return;
  }

  const tasks = tasksForGoal(goal.id);
  const nextTask = tasks.find((task) => task.status !== "done");
  els.contextGoal.innerHTML = `
    <div class="context-row">
      <strong>${esc(goal.title)}</strong>
      <p class="card-copy">${esc(goal.description || "No additional context saved yet.")}</p>
      <div class="plan-meta">
        <span class="tag">${esc(human(goal.domain))}</span>
        <span class="tag">${esc(formatDate(goal.deadline))}</span>
      </div>
    </div>
    ${nextTask ? `
      <div class="context-row">
        <strong>Next task</strong>
        <p class="card-copy">${esc(nextTask.title)}</p>
        <div class="plan-meta">
          <span class="tag ${toneForStatus(nextTask.status)}">${esc(human(nextTask.status))}</span>
          <span class="tag">${esc(formatDate(nextTask.scheduled_start))}</span>
        </div>
      </div>
    ` : ""}
  `;
}

function renderContextProgress() {
  const tasks = selectedGoal() ? tasksForGoal(state.selectedGoalId) : state.tasks;
  if (!tasks.length) {
    els.contextProgress.innerHTML = emptyState("No tasks yet", "Approved plans will create a live task list here.");
    return;
  }

  const done = tasks.filter((task) => task.status === "done").length;
  const active = tasks.filter((task) => task.status === "active").length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const pending = tasks.filter((task) => task.status === "pending").length;
  const completion = Math.round((done / tasks.length) * 100);

  els.contextProgress.innerHTML = `
    <div class="progress-block">
      <div class="context-row">
        <strong>Completion</strong>
        <p class="card-copy">${completion}% of the current lane is done.</p>
        <div class="progress-line"><span style="width:${completion}%"></span></div>
      </div>
      ${metricRow("Completed", `${done}`)}
      ${metricRow("In progress", `${active}`)}
      ${metricRow("Pending", `${pending}`)}
      ${blocked ? metricRow("Blocked", `${blocked}`) : ""}
    </div>
  `;
}

function renderContextSchedule() {
  const events = todayEvents().slice(0, 6);
  if (!events.length) {
    els.contextSchedule.innerHTML = emptyState("No schedule blocks today", "Ask Telova about your calendar or approve a new goal to see fresh execution blocks.");
    return;
  }

  els.contextSchedule.innerHTML = `<div class="schedule-list">${events.map((event) => `
    <div class="list-row">
      <strong>${esc(event.title)}</strong>
      <p class="list-copy">${esc(formatTimeRange(event.start_at, event.end_at))}</p>
      <div class="plan-meta">
        <span class="tag ${event.source === "system" ? "success" : ""}">${esc(human(event.source))}</span>
      </div>
    </div>
  `).join("")}</div>`;
}

function renderContextNotes() {
  const notes = relatedNotes().slice(0, 4);
  if (!notes.length) {
    els.contextNotes.innerHTML = emptyState("No recent notes", "Use chat to capture context and Telova will sync it into memory.");
    return;
  }

  els.contextNotes.innerHTML = `<div class="note-list">${notes.map((note) => `
    <div class="list-row">
      <strong>${esc(note.title)}</strong>
      <p class="list-copy">${esc(truncate(note.content, 120))}</p>
      <div class="plan-meta">
        <span class="tag">${esc(human(note.note_type))}</span>
        <span class="tag">${esc(formatDate(note.created_at))}</span>
      </div>
    </div>
  `).join("")}</div>`;
}

function renderContextSystem() {
  const system = state.systemStatus;
  if (!system) {
    els.contextSystem.innerHTML = emptyState("System status unavailable", "The health panel will appear after the workspace loads.");
    return;
  }

  const readiness = system.readiness.slice(0, 4).map((item) => `
    <div class="list-row">
      <strong>${esc(item.name)}</strong>
      <p class="list-copy">${esc(item.detail)}</p>
      <div class="plan-meta">
        <span class="tag ${item.status === "ready" ? "success" : "warning"}">${esc(human(item.status))}</span>
      </div>
    </div>
  `).join("");

  els.contextSystem.innerHTML = `
    <div class="context-row">
      <strong>${esc(system.app)}</strong>
      <p class="card-copy">${esc(system.environment)} | ${esc(system.runtime_mode)}</p>
      <div class="plan-meta">
        <span class="tag">${esc(human(system.integration_backend))}</span>
        <span class="tag">${esc(human(system.orchestration_runtime))}</span>
      </div>
    </div>
    ${readiness}
  `;
}

async function sendComposerMessage() {
  const text = (els.chatComposer.value || "").trim();
  if (!text) return;
  els.chatComposer.value = "";
  autoResizeComposer();
  await handleUserMessage(text);
}

async function handleUserMessage(text) {
  addUserMessage(text);
  renderChatThread();

  if (isCancelIntent(text)) {
    state.goalDraft = null;
    state.pendingPreview = null;
    addAssistantMessage({
      text: "Cancelled the current planning draft. You can start over any time by telling me the goal you want to achieve.",
    });
    renderAll();
    return;
  }

  if (isRefreshIntent(text)) {
    await refreshWorkspaceInChat();
    return;
  }

  if (state.pendingPreview) {
    const handledPreview = await handlePendingPreviewResponse(text);
    if (handledPreview) return;
  }

  if (state.goalDraft) {
    await continueGoalDraft(text);
    return;
  }

  if (await maybeHandleOperationalIntent(text)) {
    return;
  }

  if (isGoalCreationIntent(text) || (!state.goals.length && !looksLikeQuestion(text))) {
    await startGoalDraft(text);
    return;
  }

  addAssistantMessage({
    text: "I can help with goal planning, schedule questions, task progress, note capture, conflict scans, weekly reviews, and system sync status. Tell me what you want to achieve, or ask something like \"What should I do next?\"",
    actions: [
      { action: "send-prompt", prompt: "Help me create a new goal.", label: "Create a goal", variant: "primary" },
      { action: "send-prompt", prompt: "What should I do next?", label: "What should I do next?", variant: "secondary" },
    ],
  });
  renderAll();
}

async function startGoalDraft(text) {
  const extractedGoal = extractGoalText(text);
  const inferredConstraints = extractConstraintHints(text);
  state.goalDraft = {
    goal: extractedGoal,
    description: null,
    deadline: parseDeadlineInput(text),
    constraints: inferredConstraints,
    constraintsConfirmed: inferredConstraints.length > 0,
    priority: parsePriority(text),
    awaiting: extractedGoal ? null : "goal",
  };

  if (!extractedGoal) {
    addAssistantMessage({
      text: "What is the goal you want me to plan? Give me the outcome in one sentence, and I'll take it from there.",
    });
    renderAll();
    return;
  }

  addAssistantMessage({
    title: "Goal intake started",
    text: `I'm planning for "${extractedGoal}". I'll collect the missing details here, then I'll preview the task DAG in chat before anything is created.`,
  });
  await askNextGoalQuestionOrPreview();
}

async function continueGoalDraft(text) {
  const draft = state.goalDraft;
  if (!draft) return;

  if (draft.awaiting === "goal") {
    draft.goal = text.trim();
    draft.deadline = draft.deadline || parseDeadlineInput(text);
    draft.priority = draft.priority || parsePriority(text);
  } else if (draft.awaiting === "deadline") {
    const deadline = parseDeadlineInput(text);
    if (!deadline) {
      addAssistantMessage({
        text: "I couldn't read that deadline. Try something like \"in 6 months\", \"by 2026-09-30\", or \"next Friday\".",
      });
      renderAll();
      return;
    }
    draft.deadline = deadline;
  } else if (draft.awaiting === "constraints") {
    if (isNoneIntent(text)) {
      draft.constraints = [];
    } else {
      draft.constraints = splitConstraints(text);
    }
    draft.constraintsConfirmed = true;
  } else if (draft.awaiting === "priority") {
    const priority = parsePriority(text);
    if (!priority) {
      addAssistantMessage({
        text: "Pick a priority lane: High, Balanced, or Flexible.",
        actions: PRIORITY_CHOICES.map((choice) => ({
          action: "choose-priority",
          value: choice,
          label: choice,
          variant: choice === "High" ? "primary" : "secondary",
        })),
      });
      renderAll();
      return;
    }
    draft.priority = priority;
  } else if (draft.awaiting === "revision") {
    applyRevisionToDraft(text, draft);
  }

  await askNextGoalQuestionOrPreview();
}

async function askNextGoalQuestionOrPreview() {
  const draft = state.goalDraft;
  if (!draft) return;

  if (!draft.goal) {
    draft.awaiting = "goal";
    addAssistantMessage({ text: "What outcome are we planning for?" });
    renderAll();
    return;
  }

  if (!draft.deadline) {
    draft.awaiting = "deadline";
    addAssistantMessage({
      text: "What deadline should I plan against? You can reply with \"in 6 months\", \"by 2026-09-30\", or something similar.",
    });
    renderAll();
    return;
  }

  if (!draft.constraintsConfirmed) {
    draft.awaiting = "constraints";
    addAssistantMessage({
      text: "Any constraints I should respect while scheduling? Examples: weekdays only, 1 hour per day, avoid late evenings. Reply with \"none\" if there are no constraints.",
    });
    renderAll();
    return;
  }

  if (!draft.priority) {
    draft.awaiting = "priority";
    addAssistantMessage({
      text: "What priority should I plan for?",
      actions: PRIORITY_CHOICES.map((choice) => ({
        action: "choose-priority",
        value: choice,
        label: choice,
        variant: choice === "High" ? "primary" : "secondary",
      })),
    });
    renderAll();
    return;
  }

  draft.awaiting = "preview";
  await previewGoalDraft();
}

async function previewGoalDraft() {
  const draft = state.goalDraft;
  if (!draft) return;

  showLoading("Drafting your plan", [
    "Generating the task DAG and execution windows.",
    "Preparing the preview before anything is created.",
  ]);

  try {
    const preview = await fetchJson("/api/v1/goals/preview", {
      method: "POST",
      body: JSON.stringify(buildGoalPayload(draft)),
    });
    state.pendingPreview = preview;
    addAssistantMessage({
      title: "Plan preview ready",
      text: preview.summary,
      plan: preview,
      actions: [
        { action: "approve-plan", label: "Approve plan", variant: "primary" },
        { action: "revise-plan", label: "Request changes", variant: "secondary" },
      ],
    });
    setStatus("Preview ready");
  } catch (error) {
    addAssistantMessage({
      text: `I couldn't generate the preview: ${readError(error)}`,
    });
    setStatus(readError(error));
  } finally {
    hideLoading();
    renderAll();
  }
}

async function handlePendingPreviewResponse(text) {
  if (isApprovalIntent(text)) {
    await approvePendingPlan();
    return true;
  }

  if (isRevisionIntent(text)) {
    if (hasRevisionPayload(text)) {
      state.goalDraft.awaiting = "revision";
      state.pendingPreview = null;
      applyRevisionToDraft(text, state.goalDraft);
      await askNextGoalQuestionOrPreview();
      return true;
    }
    requestPlanRevision();
    return true;
  }

  addAssistantMessage({
    text: "I have the preview ready. Say \"approve\", click Approve plan, or tell me what you want changed and I'll re-draft it.",
    actions: [
      { action: "approve-plan", label: "Approve plan", variant: "primary" },
      { action: "revise-plan", label: "Request changes", variant: "secondary" },
    ],
  });
  renderAll();
  return true;
}

function requestPlanRevision() {
  state.pendingPreview = null;
  if (state.goalDraft) {
    state.goalDraft.awaiting = "revision";
  }
  addAssistantMessage({
    text: "Tell me what you want changed. You can adjust the deadline, constraints, priority, or the direction of the plan.",
  });
  renderAll();
}

async function approvePendingPlan() {
  const draft = state.goalDraft;
  if (!draft || !state.pendingPreview) return;

  showLoading("Creating your goal", [
    "Saving tasks and schedule.",
    "Syncing calendar, tasks, notes, and workspace context.",
  ]);

  try {
    const created = await fetchJson("/api/v1/goals", {
      method: "POST",
      body: JSON.stringify(buildGoalPayload(draft)),
    });
    state.pendingPreview = null;
    state.goalDraft = null;
    state.selectedGoalId = created.goal.id;
    await loadWorkspace();
    addAssistantMessage({
      title: "Goal activated",
      text: `I created "${created.goal.title}" and synced the execution lane automatically. Tasks, schedule blocks, notes memory, and workspace context are now updated.`,
      cards: [
        { title: "Tasks created", detail: `${created.tasks.length} task nodes are now live.` },
        { title: "Schedule synced", detail: `${created.calendar_events.length} calendar block(s) were created.` },
        { title: "Next action", detail: created.tasks[0] ? created.tasks[0].title : "No immediate task found." },
      ],
      actions: [
        { action: "send-prompt", prompt: "What should I do next?", label: "What should I do next?", variant: "primary" },
        { action: "send-prompt", prompt: "What's due today?", label: "What's due today?", variant: "secondary" },
      ],
    });
    setStatus("Goal created and synced");
  } catch (error) {
    addAssistantMessage({
      text: `I couldn't create the goal: ${readError(error)}`,
    });
    setStatus(readError(error));
  } finally {
    hideLoading();
    renderAll();
  }
}

function buildGoalPayload(draft) {
  return {
    user_id: state.userId,
    goal: draft.goal,
    description: draft.description,
    deadline: draft.deadline ? draft.deadline.toISOString() : null,
    priority: draft.priority,
    constraints: draft.constraints || [],
  };
}

function applyRevisionToDraft(text, draft) {
  const deadline = parseDeadlineInput(text);
  if (deadline) draft.deadline = deadline;

  const priority = parsePriority(text);
  if (priority) draft.priority = priority;

  const constraints = extractConstraintHints(text);
  if (constraints.length) {
    draft.constraints = constraints;
    draft.constraintsConfirmed = true;
  }

  draft.description = [draft.description, `Revision request: ${text.trim()}`]
    .filter(Boolean)
    .join(" ");
}

async function maybeHandleOperationalIntent(text) {
  if (isConflictIntent(text)) {
    await runConflictScanInChat();
    return true;
  }

  if (isWeeklyReviewIntent(text)) {
    await runWeeklyReviewInChat();
    return true;
  }

  if (isTaskUpdateIntent(text)) {
    await updateTaskFromChat(text);
    return true;
  }

  if (isNoteCaptureIntent(text)) {
    await saveNoteFromChat(text);
    return true;
  }

  if (isNextActionQuery(text)) {
    answerNextAction();
    return true;
  }

  if (isScheduleQuery(text)) {
    answerSchedule(text);
    return true;
  }

  if (isProgressQuery(text)) {
    answerProgress();
    return true;
  }

  if (isTaskQuery(text)) {
    answerTasks();
    return true;
  }

  if (isGoalQuery(text)) {
    answerGoals();
    return true;
  }

  if (isNoteQuery(text)) {
    answerNotes();
    return true;
  }

  if (isSystemQuery(text)) {
    answerSystem();
    return true;
  }

  return false;
}

function answerNextAction() {
  const goal = selectedGoal() || state.goals[0];
  const nextTask = (goal ? tasksForGoal(goal.id) : state.tasks).find((task) => task.status !== "done");

  if (!goal || !nextTask) {
    addAssistantMessage({
      text: "There isn't an active next task right now. You can create a new goal or ask me to review your current workspace.",
    });
    renderAll();
    return;
  }

  addAssistantMessage({
    title: "Next best move",
    text: `The next task for "${goal.title}" is "${nextTask.title}". It is the best next move because it sits earliest in the current execution lane that is not yet complete.`,
    cards: [
      { title: "Scheduled window", detail: formatTimeRange(nextTask.scheduled_start, nextTask.scheduled_end) },
      { title: "Phase", detail: human(nextTask.phase) },
      { title: "Status", detail: human(nextTask.status) },
    ],
    actions: [
      { action: "send-prompt", prompt: `Mark ${nextTask.title} as done.`, label: "Mark as done", variant: "secondary" },
      { action: "send-prompt", prompt: "What's due today?", label: "Show today's schedule", variant: "secondary" },
    ],
  });
  renderAll();
}

function answerSchedule(text) {
  const targetDate = resolveQueryDate(text);
  const events = eventsForDay(targetDate).slice(0, 8);

  if (!events.length) {
    addAssistantMessage({
      text: `There are no scheduled blocks on ${targetDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}.`,
    });
    renderAll();
    return;
  }

  addAssistantMessage({
    title: `Schedule for ${targetDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}`,
    text: "Here are the current calendar commitments and execution blocks.",
    cards: events.map((event) => ({
      title: event.title,
      detail: `${formatTimeRange(event.start_at, event.end_at)} | ${human(event.source)}`,
    })),
  });
  renderAll();
}

function answerProgress() {
  const goal = selectedGoal();
  const tasks = goal ? tasksForGoal(goal.id) : state.tasks;
  if (!tasks.length) {
    addAssistantMessage({
      text: "There are no task lanes to review yet. Create a goal and I'll start tracking progress automatically.",
    });
    renderAll();
    return;
  }

  const done = tasks.filter((task) => task.status === "done").length;
  const active = tasks.filter((task) => task.status === "active").length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const pending = tasks.filter((task) => task.status === "pending").length;
  const completion = Math.round((done / tasks.length) * 100);

  addAssistantMessage({
    title: goal ? `Progress for ${goal.title}` : "Workspace progress",
    text: `Current completion is ${completion}% across ${tasks.length} tracked task(s).`,
    cards: [
      { title: "Completed", detail: `${done} task(s)` },
      { title: "In progress", detail: `${active} task(s)` },
      { title: "Pending", detail: `${pending} task(s)` },
      { title: "Blocked", detail: `${blocked} task(s)` },
    ],
    actions: [
      { action: "send-prompt", prompt: "Run weekly review.", label: "Run weekly review", variant: "secondary" },
    ],
  });
  renderAll();
}

function answerTasks() {
  const goal = selectedGoal();
  const tasks = (goal ? tasksForGoal(goal.id) : state.tasks).slice(0, 6);

  if (!tasks.length) {
    addAssistantMessage({
      text: "No tasks are available yet.",
    });
    renderAll();
    return;
  }

  addAssistantMessage({
    title: goal ? `Tasks for ${goal.title}` : "Current tasks",
    text: "Here are the most relevant tasks in the current lane.",
    cards: tasks.map((task) => ({
      title: task.title,
      detail: `${human(task.status)} | ${formatDate(task.scheduled_start)}`,
    })),
  });
  renderAll();
}

function answerGoals() {
  if (!state.goals.length) {
    addAssistantMessage({
      text: "There are no goals in the workspace yet. Tell me what you want to achieve and I'll plan it with you in chat.",
    });
    renderAll();
    return;
  }

  addAssistantMessage({
    title: "Active goals",
    text: "These are the current goal lanes in your workspace.",
    cards: state.goals.map((goal) => ({
      title: goal.title,
      detail: `${human(goal.domain)} | ${tasksForGoal(goal.id).filter((task) => task.status === "done").length}/${tasksForGoal(goal.id).length || 0} done`,
    })),
  });
  renderAll();
}

function answerNotes() {
  const notes = relatedNotes().slice(0, 5);
  if (!notes.length) {
    addAssistantMessage({
      text: "There are no recent notes in memory yet. You can say \"remember that ...\" and I'll save it into the current workspace.",
    });
    renderAll();
    return;
  }

  addAssistantMessage({
    title: "Recent notes",
    text: "Here are the latest notes and memory items I can see.",
    cards: notes.map((note) => ({
      title: note.title,
      detail: truncate(note.content, 120),
    })),
  });
  renderAll();
}

function answerSystem() {
  const system = state.systemStatus;
  if (!system) {
    addAssistantMessage({ text: "System status is not loaded yet." });
    renderAll();
    return;
  }

  addAssistantMessage({
    title: "System and sync status",
    text: `${system.app} is running in ${system.environment} with ${human(system.integration_backend)} integrations and ${human(system.orchestration_runtime)} orchestration.`,
    cards: system.connections.slice(0, 5).map((connection) => ({
      title: connection.name,
      detail: `${human(connection.status)} | ${connection.detail}`,
    })),
  });
  renderAll();
}

async function runConflictScanInChat() {
  showLoading("Running conflict scan", [
    "Inspecting the next 72 hours for collisions.",
    "Checking free slots and pressure points.",
  ]);

  try {
    state.latestConflictScan = await fetchJson("/api/v1/webhooks/cron/conflict-check", {
      method: "POST",
      body: JSON.stringify({ user_id: state.userId, auto_resolve: false }),
    });
    await loadWorkspace();
    addAssistantMessage({
      title: "Conflict scan complete",
      text: state.latestConflictScan.length
        ? `I found ${state.latestConflictScan.length} conflict(s) that could compress your plan.`
        : "No near-term conflicts were detected.",
      cards: state.latestConflictScan.slice(0, 5).map((alert) => ({
        title: alert.task_title,
        detail: `${alert.colliding_title} overlaps with ${formatTimeRange(alert.original_start, alert.original_end)}`,
      })),
    });
    setStatus("Conflict scan complete");
  } catch (error) {
    addAssistantMessage({ text: `I couldn't run the conflict scan: ${readError(error)}` });
    setStatus(readError(error));
  } finally {
    hideLoading();
    renderAll();
  }
}

async function runWeeklyReviewInChat() {
  showLoading("Running weekly review", [
    "Reviewing progress deviation and due work.",
    "Checking whether a re-plan is needed.",
  ]);

  try {
    state.latestWeeklyReviews = await fetchJson("/api/v1/webhooks/cron/weekly-review", {
      method: "POST",
      body: JSON.stringify({ user_id: state.userId }),
    });
    await loadWorkspace();

    const replanned = state.latestWeeklyReviews.filter((item) => item.replanned);
    addAssistantMessage({
      title: "Weekly review complete",
      text: replanned.length
        ? `I revised ${replanned.length} goal lane(s) based on missed work or deviation.`
        : "The current plans remain stable. No re-sequencing was required.",
      cards: state.latestWeeklyReviews.map((item) => ({
        title: goalTitle(item.goal_id),
        detail: `${Math.round(item.deviation_pct * 100)}% deviation | ${item.summary}`,
      })),
    });
    setStatus("Weekly review complete");
  } catch (error) {
    addAssistantMessage({ text: `I couldn't run the weekly review: ${readError(error)}` });
    setStatus(readError(error));
  } finally {
    hideLoading();
    renderAll();
  }
}

async function updateTaskFromChat(text) {
  const target = findTaskFromText(text);
  if (!target) {
    addAssistantMessage({
      text: "I couldn't confidently match that task. Ask me \"What should I do next?\" first, or mention more of the task title.",
    });
    renderAll();
    return;
  }

  const desiredStatus = parseTaskStatus(text) || "done";
  try {
    await fetchJson(`/api/v1/tasks/${target.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: desiredStatus }),
    });
    await loadWorkspace();
    addAssistantMessage({
      text: `Updated "${target.title}" to ${human(desiredStatus)}.`,
    });
    renderAll();
  } catch (error) {
    addAssistantMessage({ text: `I couldn't update the task: ${readError(error)}` });
    renderAll();
  }
}

async function saveNoteFromChat(text) {
  const content = extractNoteText(text);
  if (!content) {
    addAssistantMessage({
      text: "Tell me what you want me to remember, for example: \"Remember that I should avoid interviews on Fridays.\"",
    });
    renderAll();
    return;
  }

  try {
    await fetchJson("/api/v1/notes", {
      method: "POST",
      body: JSON.stringify({
        user_id: state.userId,
        title: noteTitleFromContent(content),
        content,
        goal_id: state.selectedGoalId,
        note_type: "manual",
      }),
    });
    await loadWorkspace();
    addAssistantMessage({
      text: "Saved that into Telova memory and linked it to the current workspace.",
    });
    renderAll();
  } catch (error) {
    addAssistantMessage({ text: `I couldn't save the note: ${readError(error)}` });
    renderAll();
  }
}

async function refreshWorkspaceInChat() {
  showLoading("Refreshing workspace", [
    "Pulling the latest goals, tasks, notes, and schedule.",
    "Updating chat context and sync status.",
  ]);
  try {
    await loadWorkspace();
    addAssistantMessage({
      text: "Workspace refreshed. I'm using the latest goals, tasks, notes, and calendar data now.",
    });
    setStatus("Workspace refreshed");
  } catch (error) {
    addAssistantMessage({ text: `I couldn't refresh the workspace: ${readError(error)}` });
    setStatus(readError(error));
  } finally {
    hideLoading();
    renderAll();
  }
}

function addAssistantMessage(payload) {
  state.chatMessages.push({
    id: `message-${messageCounter += 1}`,
    role: "assistant",
    title: payload.title || "",
    text: payload.text || "",
    cards: payload.cards || [],
    actions: payload.actions || [],
    plan: payload.plan || null,
    createdAt: new Date().toISOString(),
  });
}

function addUserMessage(text) {
  state.chatMessages.push({
    id: `message-${messageCounter += 1}`,
    role: "user",
    title: "",
    text,
    cards: [],
    actions: [],
    plan: null,
    createdAt: new Date().toISOString(),
  });
}

function renderMessage(message) {
  return `
    <div class="message-bubble ${message.role}">
      <div class="avatar ${message.role}">${message.role === "assistant" ? "T" : initials(state.profileName)}</div>
      <div class="message-shell">
        ${message.title ? `<div class="message-title">${esc(message.title)}</div>` : ""}
        ${message.text ? `<div class="message-text">${paragraphs(message.text)}</div>` : ""}
        ${message.cards?.length ? `<div class="message-grid">${message.cards.map((card) => `
          <div class="quick-card">
            <strong>${esc(card.title)}</strong>
            <p class="list-copy">${esc(card.detail)}</p>
          </div>
        `).join("")}</div>` : ""}
        ${message.plan ? renderPlanPreview(message.plan) : ""}
        ${message.actions?.length ? `<div class="chat-actions">${message.actions.map((action) => actionChip(action, `chat-action ${action.variant || "secondary"}`)).join("")}</div>` : ""}
        <div class="message-meta">${formatMessageTime(message.createdAt)}</div>
      </div>
    </div>
  `;
}

function renderPlanPreview(plan) {
  const tasks = plan.tasks || [];
  return `
    <div class="plan-preview">
      <h4>Task DAG preview</h4>
      <p class="card-copy">${esc(plan.summary || "")}</p>
      <div class="plan-meta">
        <span class="tag">${esc(human(plan.domain))}</span>
        <span class="tag">${esc(formatDate(plan.deadline))}</span>
        <span class="tag">${tasks.length} tasks</span>
      </div>
      <div class="plan-list">
        ${tasks.slice(0, 8).map((task) => `
          <div class="plan-row">
            <div>
              <strong>${esc(task.title)}</strong>
              <p class="list-copy">${esc(task.description)}</p>
              <div class="plan-meta">
                <span class="tag">${esc(human(task.phase))}</span>
                <span class="tag">${task.estimated_minutes} min</span>
                ${task.milestone ? `<span class="tag success">Milestone</span>` : ""}
              </div>
            </div>
            <div class="list-copy">${esc(formatTimeRange(task.scheduled_start, task.scheduled_end))}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function handleDocumentClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;
  if (action === "send-prompt") {
    const prompt = target.dataset.prompt || "";
    els.chatComposer.value = prompt;
    autoResizeComposer();
    sendComposerMessage();
    return;
  }

  if (action === "select-goal") {
    state.selectedGoalId = target.dataset.goalId || null;
    renderAll();
    return;
  }

  if (action === "approve-plan") {
    approvePendingPlan();
    return;
  }

  if (action === "revise-plan") {
    requestPlanRevision();
    return;
  }

  if (action === "choose-priority" && state.goalDraft) {
    state.goalDraft.priority = target.dataset.value;
    askNextGoalQuestionOrPreview();
    return;
  }

  if (action === "run-conflict-scan") {
    runConflictScanInChat();
    return;
  }

  if (action === "run-weekly-review") {
    runWeeklyReviewInChat();
  }
}

function handleComposerKeydown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendComposerMessage();
  }
}

function autoResizeComposer() {
  els.chatComposer.style.height = "auto";
  els.chatComposer.style.height = `${Math.min(els.chatComposer.scrollHeight, 220)}px`;
}

async function fetchJson(url, options = {}) {
  const started = performance.now();
  const method = options.method || "GET";
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (state.apiKey) {
    headers["X-Telova-API-Key"] = state.apiKey;
  }

  try {
    const response = await fetch(url, { ...options, headers });
    const type = response.headers.get("content-type") || "";
    const payload = type.includes("application/json") ? await response.json() : await response.text();
    trackRequest(method, url, response.status, Math.round(performance.now() - started));
    if (!response.ok) {
      throw new Error(typeof payload === "string" ? payload : JSON.stringify(payload));
    }
    return payload;
  } catch (error) {
    trackRequest(method, url, "ERR", Math.round(performance.now() - started));
    throw error;
  }
}

function trackRequest(method, url, status, duration) {
  state.requestHistory.unshift({
    method,
    url,
    status: String(status),
    duration,
    at: new Date().toISOString(),
  });
  state.requestHistory = state.requestHistory.slice(0, 20);
}

function showLoading(title, messages) {
  clearLoading();
  els.loadingTitle.textContent = title;
  els.loadingMessage.textContent = messages[0] || "";
  els.loadingModal.classList.remove("is-hidden");
  if (messages.length > 1) {
    let index = 0;
    loadingTimer = setInterval(() => {
      index = (index + 1) % messages.length;
      els.loadingMessage.textContent = messages[index];
    }, 1000);
  }
}

function hideLoading() {
  clearLoading();
  els.loadingModal.classList.add("is-hidden");
}

function clearLoading() {
  if (loadingTimer) {
    clearInterval(loadingTimer);
    loadingTimer = null;
  }
}

function setStatus(message) {
  els.workspaceStatus.textContent = message;
}

function selectedGoal() {
  return state.goals.find((goal) => goal.id === state.selectedGoalId) || null;
}

function tasksForGoal(goalId) {
  return state.tasks
    .filter((task) => task.goal_id === goalId)
    .sort((left, right) => (left.order_index || 0) - (right.order_index || 0));
}

function relatedNotes() {
  if (!state.selectedGoalId) return [...state.notes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const selected = state.notes.filter((note) => note.goal_id === state.selectedGoalId);
  return (selected.length ? selected : state.notes).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function todayEvents() {
  return eventsForDay(new Date());
}

function eventsForDay(date) {
  return state.events
    .filter((event) => sameDay(new Date(event.start_at), date))
    .sort((left, right) => new Date(left.start_at) - new Date(right.start_at));
}

function buildWorkspaceSummaryCards() {
  const today = todayEvents();
  const done = state.tasks.filter((task) => task.status === "done").length;
  return [
    { title: "Goals", detail: `${state.goals.length} active lane(s)` },
    { title: "Tasks completed", detail: `${done}/${state.tasks.length || 0}` },
    { title: "Today", detail: `${today.length} scheduled block(s)` },
  ];
}

function actionChip(item, className) {
  const prompt = item.prompt ? ` data-prompt="${esc(item.prompt)}"` : "";
  const value = item.value ? ` data-value="${esc(item.value)}"` : "";
  return `<button class="${className}" type="button" data-action="${esc(item.action)}"${prompt}${value}>${esc(item.label)}</button>`;
}

function metricRow(label, value) {
  return `
    <div class="context-row">
      <strong>${esc(label)}</strong>
      <p class="card-copy">${esc(value)}</p>
    </div>
  `;
}

function emptyState(title, detail) {
  return `
    <div class="empty-state">
      <strong>${esc(title)}</strong>
      <p class="card-copy">${esc(detail)}</p>
    </div>
  `;
}

function toneForStatus(status) {
  if (status === "connected" || status === "ready" || status === "done") return "success";
  if (status === "warning" || status === "pending") return "warning";
  if (status === "danger" || status === "error" || status === "blocked") return "danger";
  return "";
}

function parseDeadlineInput(text) {
  const lower = text.toLowerCase();
  const now = new Date();

  if (lower.includes("tomorrow")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    return tomorrow;
  }

  if (lower.includes("next week")) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(18, 0, 0, 0);
    return nextWeek;
  }

  const relativeMatch = lower.match(/(?:in|by)?\s*(\d+)\s+(day|days|week|weeks|month|months)/);
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2];
    const date = new Date(now);
    if (unit.startsWith("day")) date.setDate(date.getDate() + amount);
    if (unit.startsWith("week")) date.setDate(date.getDate() + amount * 7);
    if (unit.startsWith("month")) date.setMonth(date.getMonth() + amount);
    date.setHours(18, 0, 0, 0);
    return date;
  }

  const clean = text.replace(/^by\s+/i, "").trim();
  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) {
    if (parsed.getHours() === 0 && parsed.getMinutes() === 0) {
      parsed.setHours(18, 0, 0, 0);
    }
    return parsed;
  }

  return null;
}

function parsePriority(text) {
  const lower = text.toLowerCase();
  if (/\bhigh\b|\burgent\b|\bcritical\b/.test(lower)) return "High";
  if (/\bbalanced\b|\bmedium\b|\bnormal\b/.test(lower)) return "Balanced";
  if (/\bflexible\b|\blow\b|\blighter\b/.test(lower)) return "Flexible";
  return null;
}

function extractConstraintHints(text) {
  const lower = text.toLowerCase();
  const hints = [];
  if (/\bweekday/.test(lower)) hints.push("Weekdays only");
  if (/\bweekend/.test(lower) && /\bavoid|no\b/.test(lower)) hints.push("Avoid weekends");
  if (/\bevening/.test(lower) && /\bavoid|no\b/.test(lower)) hints.push("Avoid late evenings");
  if (/\b1 hour\b|\bone hour\b/.test(lower)) hints.push("Plan around one hour per day");
  if (/\bafter 6\b/.test(lower)) hints.push("Avoid work after 6 PM");
  if (/\bmorning/.test(lower) && /\bonly\b/.test(lower)) hints.push("Morning-only schedule");
  return hints;
}

function splitConstraints(text) {
  return text
    .split(/,|;|\band\b/gi)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractGoalText(text) {
  const cleaned = text
    .replace(/^(help me|can you|please|i want to|i need to|create a goal to|plan|help me plan|goal:)\s+/i, "")
    .replace(/[.?!]+$/, "")
    .trim();

  if (
    !cleaned ||
    /^create (a )?new goal$/i.test(cleaned) ||
    /^help me create (a )?new goal$/i.test(cleaned) ||
    /^create a goal$/i.test(cleaned)
  ) {
    return "";
  }

  return cleaned;
}

function isGoalCreationIntent(text) {
  const lower = text.toLowerCase().trim();
  return (
    /create a goal|new goal|help me plan|plan this|my goal is|i want to|i need to|i'd like to/.test(lower) ||
    (!looksLikeQuestion(text) && /(launch|promot|prepare|learn|build|ship|become|grow|improve|deliver)/.test(lower))
  );
}

function looksLikeQuestion(text) {
  const lower = text.toLowerCase().trim();
  return lower.endsWith("?") || /^(what|how|when|which|show|list|do|am|is|are|can)/.test(lower);
}

function isApprovalIntent(text) {
  return /\bapprove\b|\byes\b|\blooks good\b|\bgo ahead\b|\bcreate it\b/.test(text.toLowerCase());
}

function isRevisionIntent(text) {
  return /\bedit\b|\brevise\b|\bchange\b|\badjust\b|\bmodify\b|\bnot yet\b|\bmake it\b/.test(text.toLowerCase());
}

function hasRevisionPayload(text) {
  const lower = text.toLowerCase();
  return isRevisionIntent(text) && lower.replace(/\b(edit|revise|change|adjust|modify|make it)\b/g, "").trim().length > 0;
}

function isCancelIntent(text) {
  return /\bcancel\b|\bstart over\b|\bdrop this\b/.test(text.toLowerCase());
}

function isRefreshIntent(text) {
  return /\brefresh\b|\bsync now\b|\breload\b/.test(text.toLowerCase());
}

function isNoneIntent(text) {
  return /^(none|no|no constraints|nothing)$/i.test(text.trim());
}

function isConflictIntent(text) {
  return /\bconflict\b|\bcheck conflicts\b|\bscan conflicts\b/.test(text.toLowerCase());
}

function isWeeklyReviewIntent(text) {
  return /\bweekly review\b|\breplan\b|\badapt plan\b|\breview progress\b/.test(text.toLowerCase());
}

function isNextActionQuery(text) {
  return /\bwhat should i do next\b|\bnext task\b|\bwhat next\b|\bnext step\b/.test(text.toLowerCase());
}

function isScheduleQuery(text) {
  return /\bschedule\b|\bcalendar\b|\bdue today\b|\bwhat'?s due today\b|\btoday\b|\btomorrow\b|\bupcoming events\b/.test(text.toLowerCase());
}

function isProgressQuery(text) {
  return /\bprogress\b|\bhow am i doing\b|\bstatus\b|\bcompletion\b/.test(text.toLowerCase());
}

function isTaskQuery(text) {
  return /\btasks\b|\bto-?do\b|\bbacklog\b/.test(text.toLowerCase());
}

function isGoalQuery(text) {
  return /\bgoals\b|\bactive goals\b|\bgoal status\b/.test(text.toLowerCase());
}

function isNoteQuery(text) {
  return /\bnotes\b|\bmemory\b|\bremembered\b/.test(text.toLowerCase());
}

function isSystemQuery(text) {
  return /\bsystem\b|\bsync\b|\bintegration\b|\bhealth\b|\bstatus of the app\b/.test(text.toLowerCase());
}

function isNoteCaptureIntent(text) {
  return /^(remember|note that|save note|capture note)/i.test(text.trim());
}

function extractNoteText(text) {
  return text.replace(/^(remember|note that|save note|capture note)\s*/i, "").trim();
}

function noteTitleFromContent(content) {
  const words = content.split(/\s+/).slice(0, 5).join(" ");
  return words ? `Note: ${words}` : "Operational note";
}

function isTaskUpdateIntent(text) {
  return /\bmark\b.+\b(done|complete|blocked|active|in progress)\b/.test(text.toLowerCase());
}

function parseTaskStatus(text) {
  const lower = text.toLowerCase();
  if (/\bblocked\b/.test(lower)) return "blocked";
  if (/\bactive\b|\bin progress\b/.test(lower)) return "active";
  if (/\bdone\b|\bcomplete\b/.test(lower)) return "done";
  return null;
}

function findTaskFromText(text) {
  const cleaned = text
    .toLowerCase()
    .replace(/mark|task|as|done|complete|completed|blocked|active|in progress/gi, "")
    .trim();
  if (!cleaned) return null;

  const candidates = [...(selectedGoal() ? tasksForGoal(state.selectedGoalId) : state.tasks)];
  let best = null;
  let bestScore = 0;

  candidates.forEach((task) => {
    const score = overlapScore(cleaned, task.title.toLowerCase());
    if (score > bestScore) {
      best = task;
      bestScore = score;
    }
  });

  return bestScore >= 2 ? best : null;
}

function overlapScore(query, title) {
  const tokens = query.split(/\s+/).filter((item) => item.length > 2);
  return tokens.reduce((count, token) => count + (title.includes(token) ? 1 : 0), 0);
}

function resolveQueryDate(text) {
  const lower = text.toLowerCase();
  const date = new Date();
  if (lower.includes("tomorrow")) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

function paragraphs(text) {
  return esc(text)
    .split(/\n{2,}/)
    .map((line) => `<p>${line.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function formatDate(value) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Unscheduled";
}

function formatTimeRange(start, end) {
  if (!start || !end) return "Unscheduled";
  const startDate = new Date(start);
  const endDate = new Date(end);
  const datePart = startDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const startPart = startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endPart = endDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${datePart} | ${startPart} - ${endPart}`;
}

function formatMessageTime(value) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function goalTitle(goalId) {
  return state.goals.find((goal) => goal.id === goalId)?.title || "Unknown goal";
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function sameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function prettyName(value) {
  return String(value || "devaraj")
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function userIdFromEmail(value) {
  return String(value || "")
    .split("@")[0]
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function initials(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function human(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readError(error) {
  return String(error?.message || error || "Unknown error.");
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
