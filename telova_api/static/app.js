const state = {
  activeView: "dashboard",
  userId: "demo-user",
  profileName: "Devaraj",
  apiKey: "demo-pass",
  goals: [],
  tasks: [],
  notes: [],
  events: [],
  dashboard: { goals: [], recent_tasks: [], upcoming_events: [], notes: [] },
  systemStatus: null,
  goalDags: {},
  selectedGoalId: null,
  selectedTaskId: null,
  selectedNoteId: null,
  lastGoalPlan: null,
  latestConflictScan: [],
  latestWeeklyReviews: [],
  requestHistory: [],
  selectedPriority: "High",
  draftPreview: null,
  draftNoteTitle: "Operational brief",
  draftNote: "",
  scheduleDate: new Date(),
};

const VIEW_META = {
  dashboard: ["Command Center", () => `Hello, ${state.profileName}`, "Coordinate goals, schedules, tasks, memory, and adaptive planning from one command center."],
  goals: ["Goal Intake", () => "Goal Creation", "Capture a high-level objective and approve the next execution lane."],
  agents: ["Execution Graph", () => "AI Plan View", "Inspect task dependencies, milestone nodes, and specialist ownership."],
  calendar: ["Schedule Layer", () => "Calendar & Schedule", "Review time blocks, conflict pressure, and open execution windows."],
  tasks: ["Execution Board", () => "Task Board", "Track backlog, today, in-progress work, and completed output."],
  activity: ["Adaptation Engine", () => "Replan & Adaptation", "See missed work, deviation pressure, and revised execution sequences."],
  notes: ["Memory Layer", () => "Notes & Memory", "Store context packages, weekly reviews, and operational notes."],
  settings: ["Operational Telemetry", () => "API & System Status", "Monitor integrations, database mode, security posture, and workflow logs."],
};

const els = {};
let loadingTimer = null;
let searchTimer = null;

document.addEventListener("DOMContentLoaded", init);

function init() {
  [
    "welcomeScreen","enterWorkspaceButton","continueGoogleButton","welcomeEmail","welcomePassword","appShell","sidebarNav",
    "headerEyebrow","headerTitle","headerSubtitle","statusBanner","agentPulseRow","globalSearchInput","sidebarSearch","searchResults",
    "refreshWorkspaceButton","runConflictsButton","headerNewGoalButton","dashboardGoalOverview","metricActiveGoals","metricTaskVelocity",
    "dashboardSchedule","todayScheduleBadge","dashboardSuggestions","dashboardProgress","dashboardAgents","dashboardAlerts","dashboardOpenPlanButton",
    "dashboardWeeklyReviewButton","goalUserId","goalTextInput","goalDeadlineInput","goalHorizonInput","goalDescriptionInput","priorityRow",
    "generatePlanButton","draftPlanButton","previewModeChip","previewSummary","previewMilestones","previewSchedule","previewRisks",
    "approvePlanButton","editPreviewButton","planGoalSummary","planMilestones","planAgentAssignments","planGoalSelect","planToCalendarButton",
    "graphEdges","graphNodes","taskDetailPanel","scheduleDateInput","calendarSyncButton","calendarAddTaskButton","miniCalendar","deadlineList",
    "connectedToolsList","plannerGrid","calendarConflicts","calendarRecommendations","freeSlotsList","taskBoardSearch","taskBoardFilter",
    "backlogColumn","todayColumn","inProgressColumn","completedColumn","backlogCount","todayCount","progressCount","completedCount",
    "replanInsightCard","missedTaskTimeline","reasonTags","replanSummary","replanChanges","runWeeklyReviewButton","rejectReplanButton",
    "noteFolders","selectedNoteTitle","selectedNoteType","noteEditor","newNoteButton","saveNoteButton","linkedContext","systemAgents",
    "systemConnections","systemDatabase","systemWorkflowLogs","systemRequestHistory","systemHeartbeat","loadingModal","loadingTitle",
    "loadingMessage","adaptiveModal","adaptiveModalContent","closeAdaptiveModalButton","adaptiveGoDashboardButton","adaptiveOpenActivityButton",
    "profileName","profileRole","profileAvatar"
  ].forEach((id) => { els[id] = document.getElementById(id); });

  els.enterWorkspaceButton.addEventListener("click", enterWorkspace);
  els.continueGoogleButton.addEventListener("click", enterWorkspace);
  els.sidebarNav.addEventListener("click", (e) => { const b = e.target.closest("[data-view]"); if (b) switchView(b.dataset.view); });
  els.headerNewGoalButton.addEventListener("click", () => switchView("goals"));
  els.dashboardOpenPlanButton.addEventListener("click", () => switchView("agents"));
  els.dashboardWeeklyReviewButton.addEventListener("click", runWeeklyReview);
  els.runWeeklyReviewButton.addEventListener("click", runWeeklyReview);
  els.rejectReplanButton.addEventListener("click", () => { state.latestWeeklyReviews = []; renderReplan(); });
  els.refreshWorkspaceButton.addEventListener("click", refreshWorkspace);
  els.runConflictsButton.addEventListener("click", runConflictScan);
  els.goalTextInput.addEventListener("input", refreshDraftPreview);
  els.goalDescriptionInput.addEventListener("input", refreshDraftPreview);
  els.goalHorizonInput.addEventListener("change", refreshDraftPreview);
  els.goalDeadlineInput.addEventListener("change", refreshDraftPreview);
  els.priorityRow.addEventListener("click", handlePriorityClick);
  els.generatePlanButton.addEventListener("click", generateGoalPlan);
  els.draftPlanButton.addEventListener("click", refreshDraftPreview);
  els.approvePlanButton.addEventListener("click", approveGeneratedPlan);
  els.editPreviewButton.addEventListener("click", () => els.goalTextInput.focus());
  els.planGoalSelect.addEventListener("change", handleGoalSelection);
  els.planToCalendarButton.addEventListener("click", () => switchView("calendar"));
  els.scheduleDateInput.addEventListener("change", () => { state.scheduleDate = parseDate(els.scheduleDateInput.value) || new Date(); renderCalendar(); });
  els.calendarSyncButton.addEventListener("click", refreshWorkspace);
  els.calendarAddTaskButton.addEventListener("click", createCalendarBlock);
  els.taskBoardSearch.addEventListener("input", renderBoard);
  els.taskBoardFilter.addEventListener("change", renderBoard);
  els.globalSearchInput.addEventListener("input", runSearch);
  els.sidebarSearch.addEventListener("input", () => { els.globalSearchInput.value = els.sidebarSearch.value; runSearch(); });
  els.noteEditor.addEventListener("input", () => { state.draftNote = els.noteEditor.value; });
  els.newNoteButton.addEventListener("click", newNote);
  els.saveNoteButton.addEventListener("click", saveNote);
  els.closeAdaptiveModalButton.addEventListener("click", hideAdaptive);
  els.adaptiveGoDashboardButton.addEventListener("click", () => { hideAdaptive(); switchView("dashboard"); });
  els.adaptiveOpenActivityButton.addEventListener("click", () => { hideAdaptive(); switchView("activity"); });
  document.addEventListener("click", handleActionClick);

  const future = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
  els.goalDeadlineInput.value = toDateTimeInput(future);
  els.scheduleDateInput.value = toDateInput(new Date());
  refreshDraftPreview();
  renderAgents();
  updateHeader();
}

async function enterWorkspace() {
  state.profileName = prettyName(els.welcomeEmail.value || state.userId);
  state.userId = (els.goalUserId.value || userIdFromEmail(els.welcomeEmail.value) || "demo-user").trim();
  state.apiKey = (els.welcomePassword.value || "").trim();
  els.goalUserId.value = state.userId;
  els.profileName.textContent = state.profileName;
  els.profileRole.textContent = `Operator, ${state.userId}`;
  els.profileAvatar.textContent = initials(state.profileName);
  showLoading("Hydrating workspace", ["Syncing dashboard data.", "Loading graph, planner, and telemetry."]);
  try {
    await loadWorkspace();
    els.welcomeScreen.classList.add("is-hidden");
    els.appShell.classList.remove("is-hidden");
    switchView("dashboard");
    showStatus("Workspace ready.", "success");
  } catch (error) {
    showStatus(readError(error), "danger");
  } finally {
    hideLoading();
  }
}

async function refreshWorkspace() {
  showLoading("Refreshing workspace", ["Pulling latest API state.", "Updating command center surfaces."]);
  try {
    await loadWorkspace();
    showStatus("Workspace refreshed successfully.", "success");
  } catch (error) {
    showStatus(readError(error), "danger");
  } finally {
    hideLoading();
  }
}

async function loadWorkspace() {
  const user = currentUser();
  const q = encodeURIComponent(user);
  const [dashboard, goals, tasks, notes, events, systemStatus] = await Promise.all([
    fetchJson(`/api/v1/dashboard?user_id=${q}`),
    fetchJson(`/api/v1/goals?user_id=${q}`),
    fetchJson(`/api/v1/tasks?user_id=${q}`),
    fetchJson(`/api/v1/notes?user_id=${q}`),
    fetchJson(`/api/v1/calendar/events?user_id=${q}`),
    fetchJson(`/api/v1/system/status?user_id=${q}`),
  ]);
  Object.assign(state, { userId: user, dashboard, goals, tasks, notes, events, systemStatus });
  if (!state.selectedGoalId || !state.goals.some((g) => g.id === state.selectedGoalId)) state.selectedGoalId = state.goals[0]?.id || null;
  if (!state.selectedTaskId || !state.tasks.some((t) => t.id === state.selectedTaskId)) state.selectedTaskId = tasksForGoal(state.selectedGoalId)[0]?.id || state.tasks[0]?.id || null;
  if (!state.selectedNoteId || !state.notes.some((n) => n.id === state.selectedNoteId)) state.selectedNoteId = state.notes[0]?.id || null;
  if (state.selectedGoalId) await ensureGoalDag(state.selectedGoalId);
  if (state.selectedNoteId) state.draftNoteTitle = noteById(state.selectedNoteId)?.title || state.draftNoteTitle;
  if (!state.lastGoalPlan && state.selectedGoalId && state.goalDags[state.selectedGoalId]) state.lastGoalPlan = { goal: goal(), dag: state.goalDags[state.selectedGoalId], tasks: tasksForGoal(state.selectedGoalId), calendar_events: state.events.filter((e) => e.goal_id === state.selectedGoalId) };
  renderAll();
}

async function ensureGoalDag(goalId) { if (goalId && !state.goalDags[goalId]) state.goalDags[goalId] = await fetchJson(`/api/v1/goals/${goalId}/dag`); return state.goalDags[goalId]; }
function switchView(name) { state.activeView = name; document.querySelectorAll(".view").forEach((v) => v.classList.toggle("is-active", v.dataset.view === name)); document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("is-active", b.dataset.view === name)); updateHeader(); }
function updateHeader() { const [eyebrow, title, subtitle] = VIEW_META[state.activeView] || VIEW_META.dashboard; els.headerEyebrow.textContent = eyebrow; els.headerTitle.textContent = typeof title === "function" ? title() : title; els.headerSubtitle.textContent = subtitle; }
function renderAll() { renderAgents(); renderPreview(); renderDashboard(); renderPlan(); renderCalendar(); renderBoard(); renderReplan(); renderNotes(); renderSystem(); updateHeader(); }
function goal() { return state.goals.find((g) => g.id === state.selectedGoalId) || null; }
function noteById(id) { return state.notes.find((n) => n.id === id) || null; }
function taskById(id) { return state.tasks.find((t) => t.id === id) || null; }
function tasksForGoal(goalId) { return state.tasks.filter((t) => t.goal_id === goalId).sort((a, b) => a.order_index - b.order_index); }
function currentUser() { return (els.goalUserId?.value || state.userId || "demo-user").trim() || "demo-user"; }

function handlePriorityClick(e) {
  const b = e.target.closest("[data-priority]");
  if (!b) return;
  state.selectedPriority = b.dataset.priority;
  document.querySelectorAll(".priority-pill").forEach((pill) => pill.classList.toggle("is-active", pill.dataset.priority === state.selectedPriority));
  refreshDraftPreview();
}

async function handleGoalSelection(e) {
  state.selectedGoalId = e.target.value || null;
  await ensureGoalDag(state.selectedGoalId);
  state.selectedTaskId = tasksForGoal(state.selectedGoalId)[0]?.id || null;
  renderAll();
}

function refreshDraftPreview() { state.lastGoalPlan = null; state.draftPreview = buildDraft(); renderPreview(); }

function buildDraft() {
  const text = (els.goalTextInput.value || "").trim() || "Declare a new command center goal";
  const desc = (els.goalDescriptionInput.value || "").trim();
  const horizon = els.goalHorizonInput.value || "6 months";
  const deadline = parseDateTime(els.goalDeadlineInput.value);
  const domain = /(promot|senior|career|staff|leadership)/i.test(text) ? "career" : /(launch|ship|deploy|release|mvp|product)/i.test(text) ? "product" : /(learn|practice|study|interview|prepare|skill)/i.test(text) ? "learning" : "generic";
  const table = { career: [["Clarify rubric","Map sponsors","Lead a visible initiative","Package the narrative"],["Calendar fragmentation can weaken focus","Evidence has to be captured weekly","Stakeholder alignment should happen early"]], product: [["Define scope","Validate users","Build the MVP","Harden and launch"],["Scope creep can dilute the MVP","Validation must happen before hardening","Late calendar pressure can starve test time"]], learning: [["Define target skill","Assess the baseline","Run deliberate practice","Apply and review"],["Practice without feedback can flatten progress","Skipping applied work weakens transfer","Recurring reviews prevent drift"]], generic: [["Define the outcome","Break into milestones","Reserve execution windows","Review and adapt"],["Vague goals create vague execution","Hidden dependencies break schedules","Missed reviews hide drift"]] };
  const [milestones, risks] = table[domain];
  return { mode: "draft", summary: `${text}. Priority lane: ${state.selectedPriority}. Horizon: ${horizon}.${deadline ? ` Target date: ${fmt(deadline.toISOString())}.` : ""}${desc ? ` Context: ${desc}` : ""}`, milestones, schedule: milestones.map((m, i) => `Phase ${i + 1}: ${m}`), risks };
}

function renderPreview() {
  const live = state.lastGoalPlan?.goal ? { mode: "live", summary: `Telova generated a ${human(goal().domain)} execution lane with ${state.lastGoalPlan.tasks.length} task nodes and ${state.lastGoalPlan.dag.milestones.length} milestones.`, milestones: state.lastGoalPlan.tasks.filter((t) => state.lastGoalPlan.dag.milestones.includes(t.id)).map((t) => `${t.title} | ${fmt(t.scheduled_start)}`), schedule: state.lastGoalPlan.tasks.slice(0, 5).map((t) => `${t.title} | ${fmt(t.scheduled_start)} -> ${fmt(t.scheduled_end)}`), risks: ["External commitments can trigger re-sequencing.", "Long blocks need protected focus time.", "Weekly reviews prevent hidden drift."] } : null;
  const p = live || state.draftPreview || buildDraft();
  els.previewModeChip.textContent = p.mode === "live" ? "Live Plan" : "Draft";
  els.previewSummary.textContent = p.summary;
  els.previewMilestones.innerHTML = listHtml(p.milestones);
  els.previewSchedule.innerHTML = listHtml(p.schedule);
  els.previewRisks.innerHTML = listHtml(p.risks, "warning");
  els.approvePlanButton.disabled = !live;
}

async function generateGoalPlan() {
  const payload = { user_id: currentUser(), goal: (els.goalTextInput.value || "").trim(), description: (els.goalDescriptionInput.value || "").trim() || null, deadline: parseDateTime(els.goalDeadlineInput.value)?.toISOString() || null };
  if (!payload.goal) return showStatus("Add a goal before generating a plan.", "warning");
  showLoading("Orchestrator planning", ["Building the dependency graph.", "Reserving execution windows."]);
  try {
    const plan = await fetchJson("/api/v1/goals", { method: "POST", body: JSON.stringify(payload) });
    state.lastGoalPlan = plan;
    state.selectedGoalId = plan.goal.id;
    state.selectedTaskId = plan.tasks[0]?.id || null;
    state.goalDags[plan.goal.id] = plan.dag;
    await loadWorkspace();
    showStatus(`Generated a live plan for "${plan.goal.title}".`, "success");
  } catch (error) {
    showStatus(readError(error), "danger");
  } finally {
    hideLoading();
  }
}

function approveGeneratedPlan() { if (!state.lastGoalPlan?.goal?.id) return showStatus("Generate a live plan before approving it.", "warning"); state.selectedGoalId = state.lastGoalPlan.goal.id; state.selectedTaskId = state.lastGoalPlan.tasks[0]?.id || null; switchView("agents"); renderPlan(); showStatus("Plan approved. Inspect the graph and task detail drawer.", "success"); }

function renderAgents() {
  const agents = state.systemStatus?.agents || [{ name: "Orchestrator", status: "active" }, { name: "Scheduler", status: "ready" }, { name: "Research", status: "ready" }, { name: "Memory", status: "ready" }, { name: "Execution", status: "monitoring" }];
  els.agentPulseRow.innerHTML = agents.map((a) => `<span class="agent-pill" style="color:${agentColor(a.name)}">${esc(a.name)} | ${esc(a.status)}</span>`).join("");
}

function renderDashboard() {
  const g = goal(); const tasks = g ? tasksForGoal(g.id) : []; const todayEvents = dayEvents(new Date()).slice(0, 6); const completion = percentDone(tasks); const alerts = dashboardAlerts(tasks);
  els.dashboardGoalOverview.innerHTML = g ? `<div class="detail-stack"><div><h3>${esc(g.title)}</h3><p class="support-copy">${esc(g.description || "No additional context captured yet.")}</p></div><div class="inline-metadata"><span class="hero-chip hero-chip-soft">${esc(human(g.domain))}</span><span class="hero-chip hero-chip-soft">Deadline | ${esc(fmt(g.deadline))}</span><span class="hero-chip hero-chip-soft">Deviation | ${Math.round(g.deviation * 100)}%</span></div><div class="progress-bar"><span style="width:${completion}%"></span></div></div>` : empty("No active goals yet.","Open Goal Creation to build the first execution lane.");
  els.metricActiveGoals.innerHTML = metric("Active goals", state.goals.filter((x) => x.status === "active").length, "Goal lanes currently monitored by the orchestrator.");
  els.metricTaskVelocity.innerHTML = metric("Task velocity", `${state.tasks.filter((x) => x.status === "done").length}/${state.tasks.length}`, "Completed tasks across the current workspace backlog.");
  els.todayScheduleBadge.textContent = `${todayEvents.length} blocks`;
  els.dashboardSchedule.innerHTML = todayEvents.length ? todayEvents.map((e) => `<div class="list-item"><strong>${esc(e.title)}</strong><p class="support-copy">${esc(time(e.start_at))} - ${esc(time(e.end_at))} | ${esc(e.source)}</p></div>`).join("") : empty("No time blocks for today.","Create a goal or add a calendar block.");
  els.dashboardSuggestions.innerHTML = [dashboardSuggestion(g, tasks), { title: tasks.some((t) => isOver(t)) ? "Address overdue work" : "Protect focus windows", detail: tasks.some((t) => isOver(t)) ? `${tasks.filter((t) => isOver(t)).length} overdue task(s) are compressing future milestones.` : "No overdue work right now. Keep long blocks clear of external meetings." }, { title: "Run a weekly review", detail: "The progress adaptor will re-sequence pending work if deviation crosses the threshold." }].map(card).join("");
  els.dashboardProgress.innerHTML = progressHtml(tasks);
  els.dashboardAgents.innerHTML = (state.systemStatus?.agents || []).map((a) => `<div class="list-item"><strong>${esc(a.name)}</strong><p class="support-copy">${esc(a.detail)}</p><div class="inline-metadata"><span class="task-chip active">${esc(a.status)}</span><span class="task-chip">${esc(a.load_label)}</span></div></div>`).join("") || empty("Agent telemetry is empty.","The workspace will populate agent load after data loads.");
  els.dashboardAlerts.innerHTML = alerts.length ? alerts.map(card).join("") : empty("No alerts right now.","Run a conflict scan or weekly review to generate adaptation signals.");
}

function renderPlan() {
  els.planGoalSelect.innerHTML = state.goals.length ? state.goals.map((g) => `<option value="${esc(g.id)}" ${g.id === state.selectedGoalId ? "selected" : ""}>${esc(g.title)}</option>`).join("") : `<option value="">No goals</option>`;
  const g = goal(); const dag = g ? state.goalDags[g.id] : null; const tasks = g ? tasksForGoal(g.id) : [];
  els.planGoalSummary.innerHTML = g ? `<div class="detail-stack"><h3>${esc(g.title)}</h3><p class="support-copy">${esc(g.description || "No extra context supplied for this goal.")}</p><div class="inline-metadata"><span class="hero-chip hero-chip-soft">${esc(human(g.domain))}</span><span class="hero-chip hero-chip-soft">Deadline | ${esc(fmt(g.deadline))}</span></div></div>` : empty("No goal selected.","Generate or select a goal to inspect the AI plan view.");
  els.planMilestones.innerHTML = dag?.nodes?.length ? listHtml(dag.nodes.filter((n) => n.milestone).map((n) => `${n.title} | ${fmt(n.scheduled_start)}`)) : empty("No milestones yet.","Milestones appear after planning.");
  const counts = {}; tasks.forEach((t) => { const a = agentFor(t); counts[a] = (counts[a] || 0) + 1; });
  els.planAgentAssignments.innerHTML = Object.keys(counts).length ? Object.entries(counts).map(([a, c]) => `<div class="list-item"><strong>${esc(a)}</strong><p class="support-copy">${c} task(s) | ${esc(agentRole(a))}</p></div>`).join("") : empty("No assignments yet.","Agent workloads appear after planning.");
  renderGraph(dag, g); renderTaskDetail();
}

function renderGraph(dag, g) {
  if (!g || !dag?.nodes?.length) { els.graphNodes.innerHTML = empty("No graph to display.","Generate and approve a plan from Goal Creation."); els.graphEdges.innerHTML = ""; return; }
  const byId = Object.fromEntries(dag.nodes.map((n) => [n.task_id || n.key, n])); const levels = {}; const getLevel = (n) => levels[n.task_id || n.key] ?? (levels[n.task_id || n.key] = !n.depends_on?.length ? 1 : 1 + Math.max(...n.depends_on.map((d) => byId[d] ? getLevel(byId[d]) : 1)));
  dag.nodes.forEach(getLevel);
  const groups = {}; dag.nodes.forEach((n) => { const l = levels[n.task_id || n.key]; (groups[l] ||= []).push(n); });
  const rows = Object.keys(groups).map(Number).sort((a, b) => a - b); const width = Math.max(620, Math.max(...rows.map((r) => groups[r].length), 1) * 204 + 80); const height = Math.max(760, 240 + rows.length * 150); const root = { x: width / 2 - 110, y: 36, width: 220, height: 92 }; const pos = {};
  els.graphNodes.style.minWidth = `${width}px`; els.graphNodes.style.minHeight = `${height}px`; els.graphEdges.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const nodes = [`<div class="graph-node root-node" style="left:${root.x}px;top:${root.y}px;"><h4>${esc(g.title)}</h4><p>${esc(human(g.domain))} goal lane</p><div class="node-meta"><span class="task-chip active">${dag.nodes.length} nodes</span><span class="task-chip">${dag.milestones.length} milestones</span></div></div>`];
  rows.forEach((r) => { const row = groups[r]; const rowWidth = row.length * 180 + Math.max(0, row.length - 1) * 24; const startX = Math.max(40, (width - rowWidth) / 2); const y = 180 + (r - 1) * 150; row.forEach((n, i) => { const id = n.task_id || n.key; const x = startX + i * 204; pos[id] = { x, y, width: 180, height: 88 }; const t = taskById(id); nodes.push(`<button class="graph-node ${id === state.selectedTaskId ? "is-selected" : ""}" data-action="select-task" data-task-id="${esc(id)}" type="button" style="left:${x}px;top:${y}px;border-color:${agentColor(agentFor(t || n))}55;"><h4>${esc(n.title)}</h4><p>${Math.max(1, Math.round((n.estimated_minutes || 60) / 60))} hr | ${esc(agentFor(t || n))}</p><div class="node-meta"><span class="task-chip ${esc(t?.status || "pending")}">${esc(human(t?.status || "pending"))}</span><span class="task-chip">${esc(n.phase)}</span></div></button>`); }); });
  els.graphNodes.innerHTML = nodes.join("");
  els.graphEdges.innerHTML = dag.nodes.filter((n) => !n.depends_on?.length).map((n) => path(root.x + root.width / 2, root.y + root.height, pos[n.task_id || n.key].x + 90, pos[n.task_id || n.key].y, "#6D5EFC")).concat(dag.edges.map((e) => pos[e.from_node] && pos[e.to_node] ? path(pos[e.from_node].x + 90, pos[e.from_node].y + pos[e.from_node].height, pos[e.to_node].x + 90, pos[e.to_node].y, "#26324A") : "")).join("");
}

function renderTaskDetail() {
  const t = taskById(state.selectedTaskId); if (!t) return (els.taskDetailPanel.innerHTML = empty("No task selected.","Pick a node from the graph to inspect task details."));
  const deps = t.depends_on.map((id) => taskById(id)?.title).filter(Boolean).join(", ");
  els.taskDetailPanel.innerHTML = `<div class="detail-stack"><div><h3>${esc(t.title)}</h3><p class="support-copy">${esc(t.description || "No task description available.")}</p></div><div class="inline-metadata"><span class="task-chip ${esc(t.status)}">${esc(human(t.status))}</span><span class="task-chip">${esc(agentFor(t))}</span><span class="task-chip">${Math.max(1, Math.round(t.estimated_minutes / 60))} hr</span></div><div class="list-item"><strong>Scheduled window</strong><p class="support-copy">${esc(fmt(t.scheduled_start))} -> ${esc(fmt(t.scheduled_end))}</p></div><div class="list-item"><strong>Dependencies</strong><p class="support-copy">${esc(deps || "This node can start immediately.")}</p></div><div class="button-row"><button class="button button-primary" data-action="mark-task-done" data-task-id="${esc(t.id)}" type="button">Mark Completed</button><button class="button button-secondary" data-action="open-calendar" type="button">Open Schedule</button></div></div>`;
}

function renderCalendar() {
  const selected = state.scheduleDate || new Date(); els.scheduleDateInput.value = toDateInput(selected);
  renderMiniCalendar(selected); renderDeadlines(); renderConnections(); renderPlanner(selected); renderCalendarSignals();
}

function renderMiniCalendar(selected) { const year = selected.getFullYear(); const month = selected.getMonth(); const first = new Date(year, month, 1); const start = new Date(first); start.setDate(1 - first.getDay()); const cells = Array.from({ length: 35 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return `<button class="mini-calendar-cell ${same(d, selected) ? "is-active" : ""}" data-action="select-date" data-date="${toDateInput(d)}" type="button">${d.getDate()}</button>`; }); els.miniCalendar.innerHTML = `<div class="detail-stack"><div class="metric-strip"><span>${selected.toLocaleString(undefined, { month: "long" })}</span><strong>${year}</strong></div><div class="mini-calendar-grid">${cells.join("")}</div></div>`; }
function renderDeadlines() { const deadlines = [...state.tasks].filter((t) => t.scheduled_end).sort((a, b) => new Date(a.scheduled_end) - new Date(b.scheduled_end)).slice(0, 5); els.deadlineList.innerHTML = deadlines.length ? deadlines.map((t) => `<div class="deadline-item"><strong>${esc(t.title)}</strong><p class="support-copy">${esc(fmt(t.scheduled_end))}</p></div>`).join("") : empty("No deadlines yet.","Scheduled tasks will surface upcoming deadlines here."); }
function renderConnections() { const items = state.systemStatus?.connections || []; els.connectedToolsList.innerHTML = items.length ? items.map((c) => `<div class="connection-card"><strong>${esc(c.name)}</strong><p class="support-copy">${esc(c.detail)}</p><div class="inline-metadata"><span class="task-chip ${esc(c.status)}">${esc(c.status)}</span><span class="task-chip">${esc(c.kind)}</span></div></div>`).join("") : empty("No tools connected.","System status will populate connected adapters here."); }
function renderPlanner(selected) { const rows = Array.from({ length: 15 }, (_, i) => `<div class="planner-row"><div class="planner-time">${hour(8 + i)}</div><div class="planner-slot"></div></div>`).join(""); const blocks = dayEvents(selected).map((e) => { const s = new Date(e.start_at), en = new Date(e.end_at); const top = ((s.getHours() + s.getMinutes() / 60) - 8) * 56; const h = Math.max(44, ((en - s) / 3600000) * 56); return `<div class="event-block ${esc(e.source)}" style="top:${top}px;height:${h}px;"><strong>${esc(e.title)}</strong><p>${esc(time(e.start_at))} - ${esc(time(e.end_at))}</p></div>`; }).join(""); els.plannerGrid.innerHTML = `<div class="planner-rows">${rows}</div><div class="planner-events">${blocks}</div>`; }
function renderCalendarSignals() { els.calendarConflicts.innerHTML = state.latestConflictScan.length ? state.latestConflictScan.map((a) => `<div class="list-item"><strong>${esc(a.task_title)}</strong><p class="support-copy">${esc(a.colliding_title)} overlaps ${esc(fmt(a.original_start))}.</p></div>`).join("") : empty("No conflict warnings.","Run the conflict detector to inspect the next 72-hour window."); const recs = []; const overdue = state.tasks.filter((t) => isOver(t)); if (overdue.length) recs.push({ title: "Recover overdue work", detail: `Reserve the next free slot for "${overdue[0].title}".` }); const replanned = state.latestWeeklyReviews.find((x) => x.replanned); if (replanned) recs.push({ title: "Review revised plan", detail: replanned.summary }); if (!recs.length) recs.push({ title: "Protect focus blocks", detail: "Long execution tasks perform best when external meetings stay outside core blocks." }); els.calendarRecommendations.innerHTML = recs.map(card).join(""); const windows = openWindows(selectedDay()).slice(0, 4).map((w) => ({ title: `${time(w.start)} - ${time(w.end)}`, detail: `${Math.round((w.end - w.start) / 60000)} minute window available for recovery or focus work.` })); els.freeSlotsList.innerHTML = windows.length ? windows.map(card).join("") : empty("No free slots found.","Create or move events to open recovery windows."); }

function renderBoard() {
  const filter = els.taskBoardFilter.value || "all"; const q = (els.taskBoardSearch.value || "").trim().toLowerCase();
  const filtered = state.tasks.filter((t) => (filter === "all" ? true : t.status === filter) && (!q || [t.title, t.description, t.phase].join(" ").toLowerCase().includes(q)));
  const buckets = { backlog: [], today: [], progress: [], completed: [] };
  filtered.forEach((t) => { if (t.status === "done") return buckets.completed.push(t); if (t.status === "active") return buckets.progress.push(t); return t.scheduled_start && same(new Date(t.scheduled_start), new Date()) ? buckets.today.push(t) : buckets.backlog.push(t); });
  [["backlogColumn","backlogCount","backlog"],["todayColumn","todayCount","today"],["inProgressColumn","progressCount","progress"],["completedColumn","completedCount","completed"]].forEach(([col, count, key]) => { els[col].innerHTML = buckets[key].length ? buckets[key].map(taskCard).join("") : empty("No tasks in this lane.",""); els[count].textContent = String(buckets[key].length); });
}

function renderReplan() {
  const overdue = state.tasks.filter((t) => isOver(t)); const replanned = state.latestWeeklyReviews.filter((x) => x.replanned).length; const slots = openWindows(selectedDay()).length;
  els.replanInsightCard.innerHTML = `<div class="detail-stack"><h3>You missed ${overdue.length} task(s)</h3><p class="support-copy">The scheduler found ${slots} free slot(s) in the selected day window and the execution lane is watching for drift.</p><div class="inline-metadata"><span class="hero-chip hero-chip-soft">${replanned} revised plan(s)</span><span class="hero-chip hero-chip-soft">${overdue.length} overdue</span></div></div>`;
  els.missedTaskTimeline.innerHTML = overdue.length ? overdue.map((t) => `<div class="timeline-item"><strong>${esc(t.title)}</strong><p class="support-copy">Missed ${esc(fmt(t.scheduled_end))}</p><div class="inline-metadata"><span class="task-chip pending">${esc(t.phase)}</span><span class="task-chip">${esc(agentFor(t))}</span></div></div>`).join("") : empty("No missed tasks.","The execution timeline is stable right now.");
  const reasons = [...new Set(overdue.map((t) => /planning/i.test(t.phase) ? "Planning backlog" : /(tracking|delivery)/i.test(t.phase) ? "Review cadence drift" : "Execution compression"))];
  els.reasonTags.innerHTML = reasons.length ? `<div class="reason-tags">${reasons.map((r) => `<span class="task-chip blocked">${esc(r)}</span>`).join("")}</div>` : empty("No reason tags yet.","Overdue work or missed dependencies will surface tags here.");
  els.replanSummary.innerHTML = state.latestWeeklyReviews.length ? state.latestWeeklyReviews.map((r) => `<div class="list-item"><strong>${esc(goalTitle(r.goal_id))}</strong><p class="support-copy">${esc(r.summary)}</p><div class="inline-metadata"><span class="task-chip ${r.replanned ? "active" : "done"}">${r.replanned ? "Replanned" : "Stable"}</span><span class="task-chip">${Math.round(r.deviation_pct * 100)}% deviation</span></div></div>`).join("") : empty("No replan data yet.","Run the weekly review to generate an adaptive recommendation.");
  els.replanChanges.innerHTML = state.latestWeeklyReviews.length ? state.latestWeeklyReviews.map((r) => `<div class="list-item"><strong>${r.updated_task_ids.length} task(s) updated</strong><p class="support-copy">${r.updated_task_ids.length ? "The plan has fresh schedule windows applied." : "No schedule changes were required."}</p></div>`).join("") : "";
}

function renderNotes() {
  els.noteFolders.innerHTML = state.notes.length ? state.notes.map((n) => `<div class="folder-item ${n.id === state.selectedNoteId ? "is-active" : ""}" data-action="select-note" data-note-id="${esc(n.id)}"><strong>${esc(human(n.note_type))}</strong><p class="support-copy">${esc(n.title)}</p></div>`).join("") : empty("No notes yet.","Context packages and status reports appear after goal switches or weekly reviews.");
  const n = noteById(state.selectedNoteId); if (n) state.draftNoteTitle = n.title;
  els.selectedNoteTitle.textContent = n?.title || state.draftNoteTitle || "Memory workspace";
  els.selectedNoteType.textContent = human(n?.note_type || "manual");
  els.noteEditor.value = state.draftNote || n?.content || "";
  const relatedGoal = n?.goal_id ? state.goals.find((g) => g.id === n.goal_id) : null; const relatedTasks = n?.goal_id ? tasksForGoal(n.goal_id).slice(0,3) : []; const relatedEvents = n?.goal_id ? state.events.filter((e) => e.goal_id === n.goal_id).slice(0,3) : [];
  const linked = []; if (relatedGoal) linked.push({ title: "Linked goal", detail: relatedGoal.title }); if (relatedTasks.length) linked.push({ title: "Linked tasks", detail: relatedTasks.map((t) => t.title).join(", ") }); if (relatedEvents.length) linked.push({ title: "Meetings and blocks", detail: relatedEvents.map((e) => e.title).join(", ") });
  els.linkedContext.innerHTML = linked.length ? linked.map(card).join("") : empty("No linked context yet.","Select a note to inspect related goals, tasks, and time blocks.");
}

function renderSystem() {
  const s = state.systemStatus; if (!s) return;
  els.systemAgents.innerHTML = s.agents.map((a) => `<div class="agent-health-card"><strong>${esc(a.name)}</strong><p class="support-copy">${esc(a.detail)}</p><div class="inline-metadata"><span class="task-chip active">${esc(a.status)}</span><span class="task-chip">${esc(a.load_label)}</span></div></div>`).join("");
  els.systemConnections.innerHTML = s.connections.map((c) => `<div class="connection-card"><strong>${esc(c.name)}</strong><p class="support-copy">${esc(c.detail)}</p><div class="inline-metadata"><span class="task-chip ${esc(c.status)}">${esc(c.status)}</span><span class="task-chip">${esc(c.kind)}</span></div></div>`).join("");
  els.systemDatabase.innerHTML = `<div class="detail-stack"><div class="metric-strip"><span>${esc(s.database)}</span><strong>${esc(s.status)}</strong></div><p class="support-copy">Environment: ${esc(s.environment)} | DB Mode: ${esc(s.runtime_mode)}</p><div class="inline-metadata"><span class="task-chip active">${esc(human(s.integration_backend))}</span><span class="task-chip">${esc(human(s.orchestration_runtime))}</span><span class="task-chip">${esc(s.auth_mode)}</span></div><p class="support-copy">Rate limit: ${esc(s.rate_limit)}</p>${s.metrics.map((m) => `<div class="metric-strip"><span>${esc(m.label)}</span><strong>${m.value}</strong></div>`).join("")}</div>`;
  els.systemWorkflowLogs.innerHTML = s.workflows.map((w) => `<div class="workflow-log"><strong>${esc(w.title)}</strong><p class="support-copy">${esc(w.detail)}</p><div class="inline-metadata"><span class="task-chip">${esc(human(w.status))}</span><span class="task-chip">${esc(w.timestamp ? fmt(w.timestamp) : "No timestamp")}</span></div></div>`).join("");
  els.systemRequestHistory.innerHTML = state.requestHistory.length ? state.requestHistory.slice(0,8).map((r) => `<div class="workflow-log"><strong>${esc(r.method)} ${esc(r.url)}</strong><p class="support-copy">Status ${r.status} | ${r.duration} ms | ${esc(fmt(r.at))}</p></div>`).join("") : empty("No frontend requests yet.","Request history is populated after the workspace starts loading data.");
  els.systemHeartbeat.innerHTML = `<div class="detail-stack"><div class="metric-strip"><span>Application</span><strong>${esc(s.app)}</strong></div><p class="support-copy">Last update: ${esc(fmt(s.last_updated))}</p><div class="inline-metadata"><span class="task-chip active">${esc(human(s.integration_backend))}</span><span class="task-chip">${esc(human(s.orchestration_runtime))}</span></div>${s.readiness.map((r) => `<div class="list-item"><strong>${esc(r.name)}</strong><p class="support-copy">${esc(r.detail)}</p><div class="inline-metadata"><span class="task-chip ${r.status === "ready" ? "done" : "pending"}">${esc(human(r.status))}</span></div></div>`).join("")}</div>`;
}

async function runConflictScan() { showLoading("Conflict sentinel", ["Scanning the next 72 hours.", "Evaluating alternative windows and free slots."]); try { state.latestConflictScan = await fetchJson("/api/v1/webhooks/cron/conflict-check", { method: "POST", body: JSON.stringify({ user_id: currentUser(), auto_resolve: false }) }); renderDashboard(); renderCalendarSignals(); showStatus(state.latestConflictScan.length ? `Detected ${state.latestConflictScan.length} conflict(s).` : "No conflicts found in the next 72 hours.", state.latestConflictScan.length ? "warning" : "success"); } catch (error) { showStatus(readError(error), "danger"); } finally { hideLoading(); } }
async function runWeeklyReview() { showLoading("Progress adaptor", ["Reviewing due tasks and deviation percentages.", "Testing whether the plan needs a new sequence."]); try { state.latestWeeklyReviews = await fetchJson("/api/v1/webhooks/cron/weekly-review", { method: "POST", body: JSON.stringify({ user_id: currentUser() }) }); await loadWorkspace(); const replanned = state.latestWeeklyReviews.filter((x) => x.replanned); if (replanned.length) { els.adaptiveModalContent.innerHTML = replanned.map((r) => `<div class="list-item"><strong>${esc(goalTitle(r.goal_id))}</strong><p class="support-copy">${esc(r.summary)}</p></div>`).join(""); els.adaptiveModal.classList.remove("is-hidden"); showStatus("Weekly review generated a revised execution lane.", "warning"); } else showStatus("Weekly review completed. The current plan remains stable.", "success"); } catch (error) { showStatus(readError(error), "danger"); } finally { hideLoading(); } }
function hideAdaptive() { els.adaptiveModal.classList.add("is-hidden"); }
function runSearch() { const q = (els.globalSearchInput.value || "").trim(); els.sidebarSearch.value = q; if (searchTimer) clearTimeout(searchTimer); if (q.length < 2) { els.searchResults.classList.add("is-hidden"); els.searchResults.innerHTML = ""; return; } searchTimer = setTimeout(async () => { try { const results = await fetchJson(`/api/v1/tasks/search?q=${encodeURIComponent(q)}&user_id=${encodeURIComponent(currentUser())}`); els.searchResults.innerHTML = results.length ? results.map((t) => `<button class="search-result-card" data-action="select-search-task" data-task-id="${esc(t.id)}" type="button"><strong>${esc(t.title)}</strong><p class="support-copy">${esc(t.phase)} | ${esc(fmt(t.scheduled_start))}</p></button>`).join("") : empty("No task matches.","Try a broader search query."); els.searchResults.classList.remove("is-hidden"); } catch (error) { showStatus(readError(error), "danger"); } }, 220); }

async function handleActionClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) { if (!event.target.closest("#searchResults") && !event.target.closest("#globalSearchInput")) els.searchResults.classList.add("is-hidden"); return; }
  const action = target.dataset.action;
  if (action === "mark-task-done") return finishTask(target.dataset.taskId);
  if (action === "select-task") { state.selectedTaskId = target.dataset.taskId; return renderPlan(); }
  if (action === "select-note") { state.selectedNoteId = target.dataset.noteId; state.draftNote = ""; return renderNotes(); }
  if (action === "select-date") { state.scheduleDate = parseDate(target.dataset.date) || new Date(); return renderCalendar(); }
  if (action === "select-search-task") { state.selectedTaskId = target.dataset.taskId; const t = taskById(state.selectedTaskId); state.selectedGoalId = t?.goal_id || state.selectedGoalId; await ensureGoalDag(state.selectedGoalId); els.searchResults.classList.add("is-hidden"); switchView("agents"); return renderAll(); }
  if (action === "open-calendar") switchView("calendar");
}

async function finishTask(taskId) { try { await fetchJson(`/api/v1/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status: "done" }) }); await loadWorkspace(); showStatus("Task marked as completed.", "success"); } catch (error) { showStatus(readError(error), "danger"); } }
function newNote() { state.selectedNoteId = null; state.draftNote = ""; state.draftNoteTitle = window.prompt("Note title", state.draftNoteTitle || "Operational brief") || "Operational brief"; renderNotes(); els.noteEditor.focus(); }
async function saveNote() { const content = (els.noteEditor.value || "").trim(); if (!content) return showStatus("Add note content before saving.", "warning"); const title = state.draftNoteTitle || noteById(state.selectedNoteId)?.title || "Operational brief"; try { if (state.selectedNoteId) await fetchJson(`/api/v1/notes/${state.selectedNoteId}`, { method: "PATCH", body: JSON.stringify({ title, content }) }); else { const created = await fetchJson("/api/v1/notes", { method: "POST", body: JSON.stringify({ user_id: currentUser(), title, content, goal_id: state.selectedGoalId, note_type: "manual" }) }); state.selectedNoteId = created.id; } state.draftNote = ""; await loadWorkspace(); showStatus("Note saved successfully.", "success"); } catch (error) { showStatus(readError(error), "danger"); } }
async function createCalendarBlock() { const slot = openWindows(selectedDay())[0]; const title = window.prompt("Block title", taskById(state.selectedTaskId)?.title ? `Focus block: ${taskById(state.selectedTaskId).title}` : "Manual focus block"); if (!title) return; let start = slot?.start || new Date(selectedDay().setHours(9,0,0,0)); let end = new Date(Math.min((slot?.end || new Date(start.getTime() + 3600000)).getTime(), start.getTime() + 3600000)); try { await fetchJson("/api/v1/calendar/events", { method: "POST", body: JSON.stringify({ user_id: currentUser(), title, description: "Created from the Telova command center.", start_at: start.toISOString(), end_at: end.toISOString(), goal_id: state.selectedGoalId, task_id: state.selectedTaskId }) }); await loadWorkspace(); showStatus("Calendar block created.", "success"); } catch (error) { showStatus(readError(error), "danger"); } }

async function fetchJson(url, options = {}) { const started = performance.now(); const method = options.method || "GET"; const headers = { "Content-Type": "application/json", ...(options.headers || {}) }; if (state.apiKey) headers["X-Telova-API-Key"] = state.apiKey; try { const res = await fetch(url, { ...options, headers }); const type = res.headers.get("content-type") || ""; const payload = type.includes("application/json") ? await res.json() : await res.text(); track(method, url, res.status, Math.round(performance.now() - started)); if (!res.ok) throw new Error(typeof payload === "string" ? payload : JSON.stringify(payload)); return payload; } catch (error) { track(method, url, "ERR", Math.round(performance.now() - started)); throw error; } }
function track(method, url, status, duration) { state.requestHistory.unshift({ method, url, status: String(status), duration: String(duration), at: new Date().toISOString() }); state.requestHistory = state.requestHistory.slice(0, 10); }
function showStatus(message, tone = "info") { els.statusBanner.textContent = message; els.statusBanner.className = `status-chip status-chip-${tone}`; }
function showLoading(title, messages) { clearLoading(); els.loadingTitle.textContent = title; els.loadingMessage.textContent = messages[0] || ""; els.loadingModal.classList.remove("is-hidden"); if (messages.length > 1) { let i = 0; loadingTimer = setInterval(() => { i = (i + 1) % messages.length; els.loadingMessage.textContent = messages[i]; }, 1000); } }
function hideLoading() { clearLoading(); els.loadingModal.classList.add("is-hidden"); }
function clearLoading() { if (loadingTimer) { clearInterval(loadingTimer); loadingTimer = null; } }

function dashboardSuggestion(g, tasks) { const pending = tasks.filter((t) => t.status === "pending"); return { title: g ? `Advance "${g.title}"` : "Create the first goal", detail: g ? pending[0] ? `The next best move is "${pending[0].title}" because it unlocks the critical path.` : "This goal is fully completed. Spin up a new lane when ready." : "A goal unlocks the graph view, schedule planner, and adaptive review loops." }; }
function dashboardAlerts(tasks) { const alerts = []; if (state.latestConflictScan.length) alerts.push({ title: `${state.latestConflictScan.length} conflict(s) detected`, detail: "Open Calendar to inspect collisions and suggested free windows." }); const overdue = tasks.filter((t) => isOver(t)); if (overdue.length) alerts.push({ title: `${overdue.length} overdue task(s)`, detail: `The most urgent item is "${overdue[0].title}".` }); if (state.latestWeeklyReviews.some((r) => r.replanned)) alerts.push({ title: "Revised plan available", detail: "Open Replan & Adaptation to review the new execution order." }); return alerts; }
function progressHtml(tasks) { if (!tasks.length) return empty("No tasks yet.","Generated plans will show execution progress here."); const counts = { pending: tasks.filter((t) => t.status === "pending").length, active: tasks.filter((t) => t.status === "active").length, done: tasks.filter((t) => t.status === "done").length, blocked: tasks.filter((t) => t.status === "blocked").length }; return Object.entries(counts).map(([k, v]) => `<div class="detail-stack"><div class="metric-strip"><span>${esc(human(k))}</span><strong>${v}</strong></div><div class="progress-bar"><span style="width:${Math.round((v / tasks.length) * 100)}%;background:${statusColor(k)}"></span></div></div>`).join(""); }
function metric(label, value, detail) { return `<div class="metric-strip"><span>${esc(label)}</span><strong>${value}</strong></div><p class="support-copy">${esc(detail)}</p>`; }
function card(item) { return `<div class="list-item"><strong>${esc(item.title)}</strong><p class="support-copy">${esc(item.detail)}</p></div>`; }
function taskCard(t) { return `<div class="task-card"><div class="task-card-top"><span class="task-chip ${esc(t.status)}">${esc(human(t.status))}</span><span class="task-chip">${esc(agentFor(t))}</span></div><div><h4>${esc(t.title)}</h4><p>${esc(t.description || "Task generated by the plan graph.")}</p></div><div class="task-card-bottom"><span class="support-copy">${esc(fmt(t.scheduled_start))}</span>${t.status !== "done" ? `<button class="button button-ghost" data-action="mark-task-done" data-task-id="${esc(t.id)}" type="button">Complete</button>` : ""}</div></div>`; }
function listHtml(items, tone = "info") { return items?.length ? items.map((x) => `<div class="list-item"><span class="status-chip status-chip-${tone}">${tone === "warning" ? "Risk" : "Item"}</span><p class="support-copy">${esc(x)}</p></div>`).join("") : empty("No items yet.",""); }
function empty(title, detail) { return `<div class="empty-state"><strong>${esc(title)}</strong>${detail ? `<p class="support-copy">${esc(detail)}</p>` : ""}</div>`; }
function path(x1, y1, x2, y2, stroke) { const cy = (y1 + y2) / 2; return `<path d="M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}" stroke="${stroke}" stroke-width="2" fill="none" stroke-linecap="round" />`; }
function agentFor(t) { const p = String(t?.phase || "").toLowerCase(); return /(plan|track|delivery)/.test(p) ? "Orchestrator" : /(discover|design|research)/.test(p) ? "Research" : /(validation|hardening|calendar)/.test(p) ? "Scheduler" : /(mentorship|review|context|memory)/.test(p) ? "Memory" : "Execution"; }
function agentRole(name) { return { Orchestrator: "Primary coordinator", Scheduler: "Conflict sentinel", Research: "Goal decomposer", Memory: "Context bridge", Execution: "Progress adaptor" }[name] || "Specialist"; }
function agentColor(name) { return { Orchestrator: "#8B5CF6", Scheduler: "#06B6D4", Research: "#F97316", Memory: "#22C55E", Execution: "#EC4899" }[name] || "#6D5EFC"; }
function statusColor(status) { return status === "done" ? "#22C55E" : status === "active" ? "#38BDF8" : status === "blocked" ? "#EF4444" : "#F59E0B"; }
function dayEvents(d) { return state.events.filter((e) => same(new Date(e.start_at), d)).sort((a, b) => new Date(a.start_at) - new Date(b.start_at)); }
function openWindows(d) { const events = dayEvents(d).map((e) => ({ start: new Date(e.start_at), end: new Date(e.end_at) })); const dayStart = new Date(d); dayStart.setHours(8,0,0,0); const dayEnd = new Date(d); dayEnd.setHours(22,0,0,0); const slots = []; let cursor = new Date(dayStart); events.forEach((e) => { if (e.start > cursor) slots.push({ start: new Date(cursor), end: new Date(e.start) }); if (e.end > cursor) cursor = new Date(e.end); }); if (cursor < dayEnd) slots.push({ start: cursor, end: dayEnd }); return slots.filter((s) => s.end - s.start >= 30 * 60000); }
function selectedDay() { return state.scheduleDate || new Date(); }
function percentDone(tasks) { return tasks.length ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100) : 0; }
function isOver(task) { return task?.scheduled_end && new Date(task.scheduled_end) < new Date() && task.status !== "done"; }
function prettyName(v) { return String(v || "devaraj").split("@")[0].replace(/[._-]+/g, " ").split(" ").filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(" "); }
function userIdFromEmail(v) { return String(v || "").split("@")[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "demo-user"; }
function initials(v) { return String(v || "").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join(""); }
function human(v) { return String(v || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function fmt(v) { return v ? new Date(v).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Unscheduled"; }
function time(v) { return v ? new Date(v).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "--"; }
function hour(h) { const d = new Date(); d.setHours(h, 0, 0, 0); return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
function parseDateTime(v) { return v ? new Date(v) : null; }
function parseDate(v) { return v ? new Date(`${v}T00:00:00`) : null; }
function toDateInput(d) { const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 10); }
function toDateTimeInput(d) { const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 16); }
function same(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function readError(error) { return String(error?.message || error || "Unknown error."); }
function goalTitle(id) { return state.goals.find((g) => g.id === id)?.title || "Unknown goal"; }
function esc(v) { return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"); }
