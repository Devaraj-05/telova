import {
  AgentRunRead,
  AnalyticsQueryResponse,
  DashboardRead,
  GoalCreatePayload,
  GoalPlanPreviewResponse,
  GoalPlanResponse,
  McpSyncLogRead,
  NoteRead,
  SystemStatusRead,
  TaskRead,
} from "@/lib/workspace/types";

// Empty string = use relative URLs routed through Next.js proxy rewrites
// (/api/* → http://127.0.0.1:8000/api/*).
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
const AUTH_STORAGE_KEY = "telova.app.token";

function readStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(AUTH_STORAGE_KEY);
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readStoredToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Authorization": `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchDashboard(userId: string) {
  return apiRequest<DashboardRead>(
    `/api/v1/dashboard?user_id=${encodeURIComponent(userId)}`,
  );
}

export function fetchSystemStatus(userId: string) {
  return apiRequest<SystemStatusRead>(
    `/api/v1/system/status?user_id=${encodeURIComponent(userId)}`,
  );
}

export function fetchTasks(userId: string) {
  return apiRequest<TaskRead[]>(
    `/api/v1/tasks?user_id=${encodeURIComponent(userId)}`,
  );
}

export function previewGoalPlan(payload: GoalCreatePayload) {
  return apiRequest<GoalPlanPreviewResponse>("/api/v1/goals/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createGoalPlan(payload: GoalCreatePayload) {
  return apiRequest<GoalPlanResponse>("/api/v1/goals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export function fetchNotes(userId: string) {
  return apiRequest<NoteRead[]>(
    `/api/v1/notes?user_id=${encodeURIComponent(userId)}`,
  );
}

export function fetchAgentRuns(userId: string, limit = 50) {
  return apiRequest<AgentRunRead[]>(
    `/api/v1/agent-runs?user_id=${encodeURIComponent(userId)}&limit=${limit}`,
  );
}

export function fetchSyncLogs(userId: string, limit = 100) {
  return apiRequest<McpSyncLogRead[]>(
    `/api/v1/sync-logs?user_id=${encodeURIComponent(userId)}&limit=${limit}`,
  );
}

export function analyticsQuery(
  userId: string,
  question: string,
  limit = 10,
) {
  return apiRequest<AnalyticsQueryResponse>("/api/v1/analytics/query", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, question, limit }),
  });
}

export async function sendChatMessage(
  message: string,
  history: ChatHistoryItem[] = [],
): Promise<string> {
  const res = await apiRequest<{ reply: string }>("/api/v1/auth/chat", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
  return res.reply;
}

export interface WorkspaceChatResponse {
  message: string;
  metadata: { agent: string; model: string; planning_mode: string };
}

export async function sendWorkspaceChatMessage(
  userId: string,
  message: string,
  history: ChatHistoryItem[] = [],
  goalId?: string,
): Promise<WorkspaceChatResponse> {
  return apiRequest<WorkspaceChatResponse>("/api/v1/workspace/chat", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, message, history, goal_id: goalId ?? null }),
  });
}

export type ChatSessionKind = "workspace" | "analytics";

export interface ChatSessionRead {
  id: string;
  user_id: string;
  kind: ChatSessionKind | string;
  title: string;
  goal_prompt: string | null;
  messages: Array<Record<string, unknown>>;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionCreatePayload {
  kind?: ChatSessionKind;
  title?: string;
  goal_prompt?: string | null;
  messages?: Array<Record<string, unknown>>;
  metadata_json?: Record<string, unknown>;
}

export interface ChatSessionUpdatePayload {
  title?: string;
  goal_prompt?: string | null;
  messages?: Array<Record<string, unknown>>;
  metadata_json?: Record<string, unknown>;
}

export function listChatSessions(
  kind: ChatSessionKind = "workspace",
  limit = 100,
) {
  return apiRequest<ChatSessionRead[]>(
    `/api/v1/chat-sessions?kind=${encodeURIComponent(kind)}&limit=${limit}`,
  );
}

export function createChatSession(payload: ChatSessionCreatePayload) {
  return apiRequest<ChatSessionRead>("/api/v1/chat-sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateChatSession(
  sessionId: string,
  payload: ChatSessionUpdatePayload,
) {
  return apiRequest<ChatSessionRead>(
    `/api/v1/chat-sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function deleteChatSession(sessionId: string) {
  return apiRequest<{ status: string; id: string }>(
    `/api/v1/chat-sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
  );
}
