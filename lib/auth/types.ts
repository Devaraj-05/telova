export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  google_subject: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: AuthUser;
  access_token: string;
  token_type: string;
}

export interface GoogleAuthorizationUrlRead {
  authorization_url: string;
}

export interface GoogleConnectionStatus {
  status: "connected" | "partial" | "disconnected";
  provider_email: string | null;
  calendar_connected: boolean;
  tasks_connected: boolean;
  keep_connected: boolean;
  scopes: string[];
  connected_at: string | null;
  detail: string;
}

export interface SignupPayload {
  email: string;
  password: string;
  display_name?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface GoogleCallbackResult {
  flow: "login" | "connect";
  status: "success" | "error";
  error?: string;
}
