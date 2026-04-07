"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Sparkles,
  User,
} from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";

type AuthMode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const { login, signup, startGoogleLogin, status } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/workspace");
    }
  }, [router, status]);

  const submitLabel = useMemo(
    () => (mode === "login" ? "Sign in" : "Create account"),
    [mode],
  );

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      if (mode === "login") {
        await login({ email, password });
      } else {
        await signup({ email, password, display_name: displayName });
      }
      router.replace("/workspace");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Authentication failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !isSubmitting) {
      void handleSubmit();
    }
  }

  return (
    <main className="relative grid min-h-screen bg-canvas text-text lg:grid-cols-[1.15fr_0.85fr]">
      {/* Ambient glow backgrounds */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-brand/[0.07] blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-success/[0.05] blur-[100px]" />
      </div>

      {/* ─── Left hero panel ─── */}
      <section className="relative z-10 hidden border-r border-border/60 px-14 py-12 lg:flex lg:flex-col">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/20 to-brand/5 ring-1 ring-brand/20 transition group-hover:ring-brand/40">
            <img
              src="/telova-mark.svg"
              alt="Telova"
              className="size-7"
            />
          </div>
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.3em] text-text/80">
              Telova
            </p>
            <p className="text-[11px] font-medium text-muted/70">Agent workspace</p>
          </div>
        </Link>

        {/* Hero content */}
        <div className="my-auto max-w-[540px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/[0.08] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.25em] text-brand">
            <Sparkles className="size-3.5" />
            Your AI control center
          </span>

          <h1 className="mt-7 text-[2.75rem] font-bold leading-[1.15] tracking-tight">
            From one goal prompt{" "}
            <span className="bg-gradient-to-r from-brand via-[#8b8fff] to-brand bg-clip-text text-transparent">
              to a live execution system.
            </span>
          </h1>

          <p className="mt-5 text-[15px] leading-8 text-muted">
            Sign in, enter the Agent Workspace, then connect Google Calendar, Tasks,
            and Keep so Telova can turn approved plans into action.
          </p>

          {/* Feature cards */}
          <div className="mt-10 space-y-3">
            {[
              {
                icon: "✉️",
                text: "Create or sign in with email and password",
              },
              {
                icon: "🔗",
                text: "Use Google login for instant account linking",
              },
              {
                icon: "📅",
                text: "Connect Calendar, Tasks & Keep in workspace",
              },
            ].map((item) => (
              <div
                key={item.text}
                className="group flex items-center gap-4 rounded-2xl border border-border/50 bg-white/[0.02] px-5 py-4 transition hover:border-brand/30 hover:bg-white/[0.04]"
              >
                <span className="text-base">{item.icon}</span>
                <p className="text-sm font-medium text-text/80">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted/50">
          © {new Date().getFullYear()} Telova · Privacy · Terms
        </p>
      </section>

      {/* ─── Right form panel ─── */}
      <section className="relative z-10 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[460px]">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/20 to-brand/5 ring-1 ring-brand/20">
              <img src="/telova-mark.svg" alt="Telova" className="size-6" />
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-text/80">
              Telova
            </p>
          </div>

          {/* Auth card */}
          <div className="rounded-3xl border border-border/60 bg-card/60 p-8 shadow-panel backdrop-blur-xl">
            {/* Mode toggle */}
            <div className="flex items-center gap-1 rounded-2xl border border-border/50 bg-panel/80 p-1">
              {(["login", "signup"] as AuthMode[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setMode(item);
                    setError(null);
                  }}
                  className={`relative flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
                    mode === item
                      ? "bg-brand text-white shadow-[0_4px_20px_rgba(111,124,255,0.35)]"
                      : "text-muted hover:text-text"
                  }`}
                >
                  {item === "login" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>

            {/* Header */}
            <div className="mt-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-brand/80">
                {mode === "login" ? "Welcome back" : "Get started"}
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">
                {mode === "login"
                  ? "Sign in to your workspace"
                  : "Create your account"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {mode === "login"
                  ? "Continue with your goals, plans, and connected tools."
                  : "Set up your account, then connect Google tools inside the workspace."}
              </p>
            </div>

            {/* Form fields */}
            <div className="mt-7 space-y-4" onKeyDown={handleKeyDown}>
              {mode === "signup" ? (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
                    Full name
                  </span>
                  <div
                    className={`flex items-center gap-3 rounded-xl border bg-panel/80 px-4 py-3.5 transition-all duration-200 ${
                      focusedField === "name"
                        ? "border-brand/60 ring-1 ring-brand/20"
                        : "border-border/60 hover:border-border"
                    }`}
                  >
                    <User className="size-4 text-muted/60" />
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      onFocus={() => setFocusedField("name")}
                      onBlur={() => setFocusedField(null)}
                      className="w-full bg-transparent text-sm text-text placeholder:text-muted/40 outline-none"
                      placeholder="Your full name"
                    />
                  </div>
                </label>
              ) : null}

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
                  Email address
                </span>
                <div
                  className={`flex items-center gap-3 rounded-xl border bg-panel/80 px-4 py-3.5 transition-all duration-200 ${
                    focusedField === "email"
                      ? "border-brand/60 ring-1 ring-brand/20"
                      : "border-border/60 hover:border-border"
                  }`}
                >
                  <Mail className="size-4 text-muted/60" />
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    className="w-full bg-transparent text-sm text-text placeholder:text-muted/40 outline-none"
                    placeholder="you@example.com"
                    type="email"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
                  Password
                </span>
                <div
                  className={`flex items-center gap-3 rounded-xl border bg-panel/80 px-4 py-3.5 transition-all duration-200 ${
                    focusedField === "password"
                      ? "border-brand/60 ring-1 ring-brand/20"
                      : "border-border/60 hover:border-border"
                  }`}
                >
                  <LockKeyhole className="size-4 text-muted/60" />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    className="w-full bg-transparent text-sm text-text placeholder:text-muted/40 outline-none"
                    placeholder="Enter your password"
                    type={showPassword ? "text" : "password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted/50 transition hover:text-muted"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </label>
            </div>

            {/* Error message */}
            {error ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3">
                <div className="mt-0.5 size-2 shrink-0 rounded-full bg-rose-400 animate-pulse" />
                <p className="text-sm text-rose-200/90">{error}</p>
              </div>
            ) : null}

            {/* Submit buttons */}
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
                className="group inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-brand to-[#8b8fff] px-5 py-3.5 text-sm font-bold text-white shadow-[0_4px_24px_rgba(111,124,255,0.3)] transition-all hover:shadow-[0_6px_30px_rgba(111,124,255,0.45)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <span className="inline-block size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    {submitLabel}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border/50" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-muted/50">
                  or
                </span>
                <div className="h-px flex-1 bg-border/50" />
              </div>

              {/* Google button */}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  void startGoogleLogin().catch((googleError) => {
                    setError(
                      googleError instanceof Error
                        ? googleError.message
                        : "Unable to start Google login.",
                    );
                  });
                }}
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-border/60 bg-white/[0.03] px-5 py-3.5 text-sm font-semibold text-text transition-all hover:border-border hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </button>
            </div>

            {/* Footer note */}
            <p className="mt-6 text-center text-xs leading-relaxed text-muted/60">
              By continuing you agree to Telova&apos;s Terms of Service
              and Privacy Policy.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
