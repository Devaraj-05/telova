export type WorkspaceComposerMode = "goal" | "reply" | "editing";

export type SidebarItemId =
  | "workspace"
  | "dashboard"
  | "timeline"
  | "notes"
  | "replans"
  | "agents"
  | "settings";

export type AgentExecutionStatus =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "blocked";

export type ToolConnectionStatus = "connected" | "pending" | "disconnected";

export interface NavItem {
  id: SidebarItemId;
  label: string;
  href: string;
}

export interface SuggestionPrompt {
  label: string;
  value: string;
}

export interface AgentActivityItem {
  id: string;
  agentName: string;
  currentAction: string;
  status: AgentExecutionStatus;
}

export interface AnalysisData {
  goalDetected: string;
  timelineDetected: string;
  constraintsInferred: string[];
  syncRequirements: string[];
  likelyWorkflow: string;
}

export type FollowupField =
  | "background"
  | "deadline"
  | "dailyHours"
  | "includeWeekends"
  | "priority"
  | "calendarSync";

export interface QuickReplyOption {
  label: string;
  value: string;
}

export interface FollowupQuestion {
  id: string;
  field: FollowupField;
  prompt: string;
  helperText: string;
  options: QuickReplyOption[];
}

export interface PlanPreviewData {
  goalSummary: string;
  executionStrategy: string[];
  milestones: string[];
  assumptions: string[];
  riskIndicators: string[];
  estimatedEffort: {
    totalSessions: string;
    weeklyLoad: string;
    horizon: string;
  };
}

export interface TimelineItem {
  id: string;
  title: string;
  durationLabel: string;
  taskType: string;
  responsibleAgent: string;
  statusPreview: string;
  specificTasks?: string[];
}

export interface TimelineDayGroup {
  date: string; // ISO date string
  dayLabel: string; // e.g. "Monday, Apr 8"
  items: TimelineItem[];
}

export interface TimelineGroup {
  id: string;
  label: string; // "Week 1"
  dateRange?: string; // "Apr 8 – Apr 14"
  days: TimelineDayGroup[];
  items: TimelineItem[]; // flat list (for backward compat)
}

export interface TimelinePreviewData {
  groups: TimelineGroup[];
  totalWeeks?: number;
  goalTitle?: string;
}

export type ProposalActionType =
  | "proceed"
  | "request_changes"
  | "adjust_timeline"
  | "reduce_workload"
  | "add_weekends"
  | "edit_prompt"
  | "regenerate";

export interface ProposalActionOption {
  action: ProposalActionType;
  label: string;
}

export interface ProposalActionData {
  prompt: string;
  actions: ProposalActionOption[];
}

export type ProgressStepStatus = "pending" | "running" | "success" | "failed";

export interface ScheduleProgressStep {
  id: string;
  label: string;
  detail: string;
  status: ProgressStepStatus;
}

export interface ScheduleProgressData {
  title: string;
  steps: ScheduleProgressStep[];
}

export interface SyncSuccessMetric {
  label: string;
  value: string;
}

export interface SyncSuccessData {
  title: string;
  summary: string;
  metrics: SyncSuccessMetric[];
}

export interface ConnectedToolItem {
  id: string;
  name: string;
  detail: string;
  status: ToolConnectionStatus;
}

export interface CurrentGoalSummary {
  goalTitle: string;
  stage: string;
  planStatus: string;
  scheduleStatus: string;
  lastUpdated: string;
}

export interface QuickActionItem {
  id: string;
  label: string;
  action:
    | "open_dashboard"
    | "view_timeline"
    | "see_replans"
    | "revise"
    | "cancel_proposal";
}

export type ChatPhase =
  | "idle"
  | "asking_background"
  | "collecting_preferences"
  | "generating_plan"
  | "plan_shown"
  | "calendar_confirm"
  | "preview_shown";

export interface GoalDraft {
  userId: string;
  prompt: string;
  description: string;
  background: string | null;
  deadlineIso: string | null;
  deadlineLabel: string | null;
  priority: string | null;
  constraints: string[];
  dailyHours: string | null;
  includeWeekends: boolean | null;
  calendarSync: boolean | null;
  detailedPlanText: string | null;
}

interface MessageBase {
  id: string;
  createdAt: string;
}

export type ChatMessage =
  | (MessageBase & { type: "welcome" })
  | (MessageBase & { type: "user"; text: string })
  | (MessageBase & { type: "agent_reply"; text: string })
  | (MessageBase & { type: "analysis"; data: AnalysisData })
  | (MessageBase & { type: "activity"; data: AgentActivityItem[] })
  | (MessageBase & { type: "followup"; data: FollowupQuestion })
  | (MessageBase & { type: "plan_preview"; data: PlanPreviewData })
  | (MessageBase & { type: "timeline_preview"; data: TimelinePreviewData })
  | (MessageBase & { type: "proposal_actions"; data: ProposalActionData })
  | (MessageBase & { type: "schedule_progress"; data: ScheduleProgressData })
  | (MessageBase & { type: "sync_success"; data: SyncSuccessData });

export interface GoalPreviewTaskRead {
  key: string;
  title: string;
  description: string;
  phase: string;
  estimated_minutes: number;
  depends_on: string[];
  scheduled_start: string | null;
  scheduled_end: string | null;
  milestone: boolean;
  order_index: number;
}

export interface GoalDagNode {
  key: string;
  title: string;
  phase: string;
  estimated_minutes: number;
  depends_on: string[];
  scheduled_start: string | null;
  scheduled_end: string | null;
  milestone: boolean;
}

export interface GoalDagEdge {
  from_node: string;
  to_node: string;
}

export interface GoalDagResponse {
  domain: string;
  nodes: GoalDagNode[];
  edges: GoalDagEdge[];
  milestones: string[];
}

export interface GoalPlanPreviewResponse {
  domain: string;
  deadline: string;
  summary: string;
  dag: GoalDagResponse;
  tasks: GoalPreviewTaskRead[];
}

export interface GoalRead {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  domain: string;
  status: string;
  deadline: string | null;
  deviation: number;
  created_at: string;
  updated_at: string;
}

export interface TaskRead {
  id: string;
  goal_id: string;
  user_id: string;
  title: string;
  description: string;
  phase: string;
  status: string;
  depends_on: string[];
  estimated_minutes: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
  completed_at: string | null;
  calendar_event_id: string | null;
  order_index: number;
}

export interface CalendarEventRead {
  id: string;
  user_id: string;
  goal_id: string | null;
  task_id: string | null;
  title: string;
  description: string;
  source: string;
  start_at: string;
  end_at: string;
  metadata_json: Record<string, unknown>;
}

export interface GoalPlanResponse {
  goal: GoalRead;
  dag: GoalDagResponse;
  tasks: TaskRead[];
  calendar_events: CalendarEventRead[];
}

export interface DashboardRead {
  goals: GoalRead[];
  recent_tasks: TaskRead[];
  upcoming_events: CalendarEventRead[];
  notes: Record<string, any>[];
}

export interface ToolConnectionRead {
  name: string;
  kind: string;
  status: string;
  detail: string;
}

export interface AgentHealthRead {
  name: string;
  role: string;
  status: string;
  detail: string;
  load_label: string;
}

export interface SystemStatusRead {
  app: string;
  environment: string;
  database: string;
  runtime_mode: string;
  orchestration_runtime: string;
  integration_backend: string;
  auth_mode: string;
  rate_limit: string;
  status: string;
  last_updated: string;
  agents: AgentHealthRead[];
  connections: ToolConnectionRead[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  goalPrompt: string;
}

export interface GoalCreatePayload {
  user_id: string;
  goal: string;
  description?: string | null;
  deadline?: string | null;
  priority?: string | null;
  constraints?: string[];
  detailed_plan_text?: string | null;
}
