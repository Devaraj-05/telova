"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { completeGoogleCallback } = useAuth();
  const [message, setMessage] = useState("Finalizing Google authorization...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fragment = window.location.hash;
    if (!fragment) {
      setError("Missing Google callback payload.");
      return;
    }

    void completeGoogleCallback(fragment)
      .then((result) => {
        if (result.status === "error") {
          setError(result.error ?? "Google authorization failed.");
          return;
        }
        setMessage(
          result.flow === "login"
            ? "Login complete. Opening your workspace..."
            : "Google tools connected. Returning to your workspace...",
        );
        router.replace("/workspace");
      })
      .catch((callbackError) => {
        setError(
          callbackError instanceof Error
            ? callbackError.message
            : "Google authorization failed.",
        );
      });
  }, [completeGoogleCallback, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 text-text">
      <div className="card-surface w-full max-w-lg p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted">
          Telova
        </p>
        <h1 className="mt-4 text-3xl font-semibold">
          {error ? "Authorization interrupted" : "Connecting Google"}
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted">
          {error ?? message}
        </p>
        {error ? (
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-2xl border border-border bg-white/5 px-5 py-3 text-sm font-semibold text-text transition hover:bg-white/10"
          >
            Return to login
          </Link>
        ) : null}
      </div>
    </main>
  );
}
