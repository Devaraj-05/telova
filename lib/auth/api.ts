import type {
  AuthResponse,
  AuthUser,
  GoogleAuthorizationUrlRead,
  GoogleConnectionStatus,
  LoginPayload,
  SignupPayload,
} from "@/lib/auth/types";

// Use a relative path so all API calls go through the Next.js proxy rewrite
// (/api/* → http://127.0.0.1:8000/api/*). This avoids CORS issues in any
// environment (local dev, Cloud Shell, Cloud Run, etc.).
// If NEXT_PUBLIC_API_BASE_URL is set to a full URL (e.g. for production),
// it takes precedence.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

function buildApiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

async function jsonRequest<T>(
  path: string,
  init?: RequestInit,
  token?: string | null,
): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
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

export function signupWithPassword(payload: SignupPayload) {
  return jsonRequest<AuthResponse>("/api/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginWithPassword(payload: LoginPayload) {
  return jsonRequest<AuthResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchCurrentUser(token: string) {
  return jsonRequest<AuthUser>("/api/v1/auth/me", undefined, token);
}

export function fetchGoogleAuthorizationUrl({
  mode,
  redirectUri,
  includeKeep,
  token,
}: {
  mode: "login" | "connect";
  redirectUri: string;
  includeKeep?: boolean;
  token?: string | null;
}) {
  const params = new URLSearchParams({
    mode,
    redirect_uri: redirectUri,
    include_keep: String(includeKeep ?? true),
  });
  return jsonRequest<GoogleAuthorizationUrlRead>(
    `/api/v1/auth/google/start?${params.toString()}`,
    undefined,
    token,
  );
}

export function fetchGoogleConnectionStatus(token: string) {
  return jsonRequest<GoogleConnectionStatus>(
    "/api/v1/auth/google/status",
    undefined,
    token,
  );
}

export function disconnectGoogleConnection(token: string) {
  return jsonRequest<{ status: string }>(
    "/api/v1/auth/google/disconnect",
    { method: "POST" },
    token,
  );
}
