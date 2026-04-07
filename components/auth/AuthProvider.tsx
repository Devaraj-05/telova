"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  disconnectGoogleConnection,
  fetchCurrentUser,
  fetchGoogleAuthorizationUrl,
  fetchGoogleConnectionStatus,
  loginWithPassword,
  signupWithPassword,
} from "@/lib/auth/api";
import type {
  AuthResponse,
  AuthUser,
  GoogleCallbackResult,
  GoogleConnectionStatus,
  LoginPayload,
  SignupPayload,
} from "@/lib/auth/types";

const AUTH_STORAGE_KEY = "telova.app.token";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  token: string | null;
  googleConnection: GoogleConnectionStatus | null;
  login: (payload: LoginPayload) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => void;
  startGoogleLogin: () => Promise<void>;
  connectGoogleWorkspace: () => Promise<void>;
  disconnectGoogleWorkspace: () => Promise<void>;
  refreshGoogleConnection: () => Promise<void>;
  completeGoogleCallback: (fragment: string) => Promise<GoogleCallbackResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(AUTH_STORAGE_KEY);
}

function persistToken(token: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (token) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, token);
    return;
  }
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

function parseCallbackFragment(fragment: string) {
  const normalized = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  return new URLSearchParams(normalized);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [googleConnection, setGoogleConnection] =
    useState<GoogleConnectionStatus | null>(null);

  const clearSession = useCallback(() => {
    persistToken(null);
    setToken(null);
    setUser(null);
    setGoogleConnection(null);
    setStatus("unauthenticated");
  }, []);

  const refreshGoogleConnection = useCallback(async () => {
    if (!token) {
      setGoogleConnection(null);
      return;
    }

    try {
      const nextStatus = await fetchGoogleConnectionStatus(token);
      setGoogleConnection(nextStatus);
    } catch {
      setGoogleConnection(null);
    }
  }, [token]);

  const hydrateSession = useCallback(
    async (nextToken: string, knownUser?: AuthUser) => {
      persistToken(nextToken);
      setToken(nextToken);
      const resolvedUser = knownUser ?? (await fetchCurrentUser(nextToken));
      setUser(resolvedUser);
      setStatus("authenticated");
      try {
        const connection = await fetchGoogleConnectionStatus(nextToken);
        setGoogleConnection(connection);
      } catch {
        setGoogleConnection(null);
      }
    },
    [],
  );

  useEffect(() => {
    const storedToken = readStoredToken();
    if (!storedToken) {
      setStatus("unauthenticated");
      return;
    }

    void hydrateSession(storedToken).catch(() => {
      clearSession();
    });
  }, [clearSession, hydrateSession]);

  const applyAuthResponse = useCallback(
    async (response: AuthResponse) => {
      await hydrateSession(response.access_token, response.user);
    },
    [hydrateSession],
  );

  const login = useCallback(
    async (payload: LoginPayload) => {
      const response = await loginWithPassword(payload);
      await applyAuthResponse(response);
    },
    [applyAuthResponse],
  );

  const signup = useCallback(
    async (payload: SignupPayload) => {
      const response = await signupWithPassword(payload);
      await applyAuthResponse(response);
    },
    [applyAuthResponse],
  );

  const startGoogleLogin = useCallback(async () => {
    const redirectUri = `${window.location.origin}/auth/callback`;
    const response = await fetchGoogleAuthorizationUrl({
      mode: "login",
      redirectUri,
      includeKeep: true,
    });
    window.location.assign(response.authorization_url);
  }, []);

  const connectGoogleWorkspace = useCallback(async () => {
    if (!token) {
      throw new Error("You need to be logged in before connecting Google.");
    }
    const redirectUri = `${window.location.origin}/auth/callback`;
    const response = await fetchGoogleAuthorizationUrl({
      mode: "connect",
      redirectUri,
      includeKeep: true,
      token,
    });
    window.location.assign(response.authorization_url);
  }, [token]);

  const disconnectGoogleWorkspace = useCallback(async () => {
    if (!token) {
      return;
    }
    await disconnectGoogleConnection(token);
    await refreshGoogleConnection();
  }, [refreshGoogleConnection, token]);

  const completeGoogleCallback = useCallback(
    async (fragment: string): Promise<GoogleCallbackResult> => {
      const params = parseCallbackFragment(fragment);
      const flow = (params.get("flow") as "login" | "connect" | null) ?? "login";
      const callbackStatus =
        (params.get("status") as "success" | "error" | null) ?? "error";

      if (callbackStatus !== "success") {
        return {
          flow,
          status: "error",
          error:
            params.get("message") ??
            params.get("error") ??
            "Google authorization did not complete.",
        };
      }

      if (flow === "login") {
        const nextToken = params.get("app_token");
        if (!nextToken) {
          return {
            flow,
            status: "error",
            error: "Google login completed without an app session token.",
          };
        }
        await hydrateSession(nextToken);
        return { flow, status: "success" };
      }

      await refreshGoogleConnection();
      return { flow, status: "success" };
    },
    [hydrateSession, refreshGoogleConnection],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      token,
      googleConnection,
      login,
      signup,
      logout: clearSession,
      startGoogleLogin,
      connectGoogleWorkspace,
      disconnectGoogleWorkspace,
      refreshGoogleConnection,
      completeGoogleCallback,
    }),
    [
      clearSession,
      completeGoogleCallback,
      connectGoogleWorkspace,
      disconnectGoogleWorkspace,
      googleConnection,
      login,
      refreshGoogleConnection,
      signup,
      startGoogleLogin,
      status,
      token,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
