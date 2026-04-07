import {
  DashboardRead,
  GoalCreatePayload,
  GoalPlanPreviewResponse,
  GoalPlanResponse,
  SystemStatusRead,
} from "@/lib/workspace/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000";

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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
