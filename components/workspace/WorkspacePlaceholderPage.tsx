"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import type { SidebarItemId } from "@/lib/workspace/types";

interface WorkspacePlaceholderPageProps {
  activeItem: SidebarItemId;
  title: string;
  description: string;
}

export function WorkspacePlaceholderPage({
  activeItem,
  title,
  description,
}: WorkspacePlaceholderPageProps) {
  const { user, logout } = useAuth();

  return (
    <RequireAuth>
      <div className="flex min-h-screen bg-canvas text-text">
        <div className="hidden xl:block">
          <WorkspaceSidebar
            activeItem={activeItem}
            userName={user?.display_name}
            userEmail={user?.email}
            onLogout={logout}
          />
        </div>
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="card-surface max-w-3xl p-10">
            <span className="inline-flex rounded-full border border-border bg-brandSoft px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand">
              Telova
            </span>
            <h1 className="mt-6 text-4xl font-semibold">{title}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              {description}
            </p>
            <Link
              href="/workspace"
              className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand/90"
            >
              Return to Agent Workspace
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </main>
      </div>
    </RequireAuth>
  );
}
