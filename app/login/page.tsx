"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Mail, Sparkles } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";

type AuthMode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const { login, signup, startGoogleLogin, status } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/workspace");
    }
  }, [router, status]);

  const submitLabel = useMemo(
    () => (mode === "login" ? "Login to Telova" : "Create account"),
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

  return (
    <main className="grid min-h-screen bg-canvas text-text lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden border-r border-border bg-panel/60 px-12 py-12 lg:flex lg:flex-col">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/telova-mark.svg"
            alt="Telova"
            className="size-11 rounded-2xl bg-white/5 p-1.5"
          />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-muted">
              Telova
            </p>
            <p className="text-xs text-muted">Agent workspace</p>
          </div>
        </Link>

        <div className="my-auto max-w-xl">
          <span className="inline-flex rounded-full border border-border bg-brandSoft px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-brand">
            Sign in to your control center
          </span>
          <h1 className="mt-6 text-5xl font-semibold leading-tight">
            From one goal prompt to a live execution system.
          </h1>
          <p className="mt-5 text-base leading-8 text-muted">
            Login, enter the Agent Workspace, then connect Google Calendar, Tasks,
            and Keep so Telova can turn approved plans into action.
          </p>
          <div className="mt-10 grid gap-4">
            {[
              "Create or sign in with email and password",
              "Use Google login if you want instant account linking",
              "Connect Calendar, Tasks, and Keep after entering the workspace",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-border bg-white/[0.03] px-4 py-4"
              >
                <Sparkles className="size-4 text-brand" />
                <p className="text-sm text-text">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-10">
        <div className="card-surface w-full max-w-xl p-8">
          <div className="flex items-center gap-2 rounded-full border border-border bg-white/[0.03] p-1">
            {(["login", "signup"] as AuthMode[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
                  mode === item
                    ? "bg-brand text-white"
                    : "text-muted hover:text-text"
                }`}
              >
                {item === "login" ? "Login" : "Sign up"}
              </button>
            ))}
          </div>

          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
              {mode === "login" ? "Welcome back" : "Create your workspace"}
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              {mode === "login"
                ? "Open your agent workspace"
                : "Start using Telova"}
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted">
              {mode === "login"
                ? "Sign in to continue with your goals, plans, and connected tools."
                : "Create an account, then connect Google tools inside the workspace."}
            </p>
          </div>

          <div className="mt-8 space-y-4">
            {mode === "signup" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-text">Name</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="w-full rounded-2xl border border-border bg-panel px-4 py-4 text-sm text-text outline-none transition focus:border-brand"
                  placeholder="Devaraj Padma"
                />
              </label>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-text">Email</span>
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-panel px-4 py-4">
                <Mail className="size-4 text-muted" />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-transparent text-sm text-text outline-none"
                  placeholder="you@example.com"
                  type="email"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-text">Password</span>
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-panel px-4 py-4">
                <LockKeyhole className="size-4 text-muted" />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent text-sm text-text outline-none"
                  placeholder="Enter a secure password"
                  type="password"
                />
              </div>
            </label>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitLabel}
              <ArrowRight className="size-4" />
            </button>
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
              className="w-full rounded-2xl border border-border bg-white/5 px-5 py-4 text-sm font-semibold text-text transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Continue with Google
            </button>
          </div>

          <p className="mt-6 text-sm text-muted">
            By continuing, you’ll enter the Agent Workspace first, then Telova will ask
            permission before connecting Calendar, Tasks, and Keep.
          </p>
        </div>
      </section>
    </main>
  );
}
