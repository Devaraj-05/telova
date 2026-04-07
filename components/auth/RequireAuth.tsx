"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-text">
        <div className="card-surface w-full max-w-md p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted">
            Telova
          </p>
          <h1 className="mt-4 text-2xl font-semibold">Preparing your workspace</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Restoring your session and loading the latest agent state.
          </p>
        </div>
      </div>
    );
  }

  if (status !== "authenticated") {
    return null;
  }

  return <>{children}</>;
}
