"use client";

import type { ReactNode } from "react";

interface WorkspaceMainProps {
  header: ReactNode;
  chat: ReactNode;
  composer: ReactNode;
}

export function WorkspaceMain({
  header,
  chat,
  composer,
}: WorkspaceMainProps) {
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      {header}
      <div className="flex min-h-0 flex-1 flex-col">
        {chat}
        {composer}
      </div>
    </main>
  );
}
