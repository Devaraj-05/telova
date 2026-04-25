import {
  AgentActivityItem,
  ConnectedToolItem,
  NavItem,
  ProposalActionData,
  QuickActionItem,
  SuggestionPrompt,
} from "@/lib/workspace/types";

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { id: "workspace", label: "Workspace", href: "/workspace" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "timeline", label: "Timeline", href: "/timeline" },
  { id: "analytics", label: "Analytics", href: "/analytics" },
  { id: "settings", label: "Settings", href: "/settings" },
];

export const WELCOME_PROMPTS: SuggestionPrompt[] = [
  {
    label: "Get a job in 3 months",
    value: "Help me get a software engineering job in 3 months.",
  },
  {
    label: "Launch my SaaS MVP in 30 days",
    value: "Help me launch my SaaS MVP in 30 days.",
  },
  {
    label: "Prepare for AWS certification",
    value: "Help me prepare for AWS Solutions Architect certification in 60 days.",
  },
  {
    label: "Build a fitness routine",
    value: "Help me build a consistent fitness routine and stick to it for 90 days.",
  },
];

export const DEFAULT_AGENT_FEED: AgentActivityItem[] = [
  {
    id: "orchestrator",
    agentName: "Orchestrator",
    currentAction: "Waiting for a goal prompt",
    status: "idle",
  },
  {
    id: "scheduler",
    agentName: "Scheduler",
    currentAction: "No active schedule evaluation",
    status: "idle",
  },
  {
    id: "research",
    agentName: "Research",
    currentAction: "Standing by for planning context",
    status: "idle",
  },
  {
    id: "memory",
    agentName: "Memory",
    currentAction: "No new preference updates",
    status: "idle",
  },
];

export const DEFAULT_TOOLS: ConnectedToolItem[] = [
  {
    id: "calendar",
    name: "Calendar",
    detail: "Ready for schedule sync",
    status: "connected",
  },
  {
    id: "notes",
    name: "Notes",
    detail: "Workspace notes available",
    status: "connected",
  },
  {
    id: "tasks",
    name: "Tasks",
    detail: "Task sync available",
    status: "connected",
  },
  {
    id: "database",
    name: "Database",
    detail: "AlloyDB or local data layer online",
    status: "connected",
  },
];

export const DEFAULT_PROPOSAL_ACTIONS: ProposalActionData = {
  prompt:
    "Here is the proposed plan and task timeline. Do you want me to make any changes before I schedule and sync it?",
  actions: [
    { action: "proceed", label: "Proceed" },
    { action: "adjust_timeline", label: "Adjust Timeline" },
    { action: "reduce_workload", label: "Reduce Workload" },
    { action: "add_weekends", label: "Add Weekends" },
    { action: "edit_prompt", label: "Edit Prompt" },
  ],
};

export const QUICK_ACTIONS: QuickActionItem[] = [
  { id: "open-dashboard", label: "Open Dashboard", action: "open_dashboard" },
  { id: "view-timeline", label: "View Timeline", action: "view_timeline" },
  { id: "see-replans", label: "See Replans", action: "see_replans" },
  { id: "revise", label: "Ask Agent to Revise", action: "revise" },
  {
    id: "cancel-proposal",
    label: "Cancel Current Proposal",
    action: "cancel_proposal",
  },
];
