import { useEffect, useRef, useState } from "react";
import type { AgentRunRead } from "@/lib/workspace/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

export interface UseAgentStreamResult {
  runs: AgentRunRead[];
  connected: boolean;
  error: string | null;
}

/**
 * Opens an SSE connection to /api/v1/agent-runs/stream and accumulates
 * incoming agent-run events.  De-duplicates by run id so re-connects don't
 * produce duplicate rows.
 */
export function useAgentStream(userId: string | undefined): UseAgentStreamResult {
  const [runs, setRuns] = useState<AgentRunRead[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!userId) return;

    const url = `${API_BASE_URL}/api/v1/agent-runs/stream?user_id=${encodeURIComponent(userId)}`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.addEventListener("open", () => {
      setConnected(true);
      setError(null);
    });

    es.addEventListener("agent_run", (evt: MessageEvent) => {
      try {
        const run = JSON.parse(evt.data) as AgentRunRead;
        setRuns((prev) => {
          if (prev.some((r) => r.id === run.id)) return prev;
          return [run, ...prev].slice(0, 200);
        });
      } catch {
        // ignore malformed frames
      }
    });

    es.addEventListener("error", () => {
      setConnected(false);
      setError("Stream disconnected — will reconnect automatically.");
      // EventSource reconnects automatically after an error; we just reflect state.
    });

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [userId]);

  return { runs, connected, error };
}
