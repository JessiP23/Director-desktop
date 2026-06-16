import * as React from "react";
import { directorApi } from "@/lib/api/director";
import type { DirectorEvent, DirectorRun } from "@/lib/director/contract/director";
import { buildStream, type StreamItem } from "@/lib/director/stream";
import { useDirectorRunStream } from "@/lib/director/use-director-run-stream";

export type SendState = "idle" | "sending";

/**
 * Owns a single run's conversation: loads the snapshot, subscribes to the live
 * SSE stream (which replays history then streams live turns), folds events into
 * `StreamItem`s, and exposes `send` to continue the run. Events are kept unique
 * by id and in arrival order — exactly what `buildStream` expects.
 */
export function useRun(
  runId: string | null,
  options: {
    onRunPatch?: (id: string, patch: Partial<DirectorRun>) => void;
    onBriefUpdated?: () => void;
  } = {},
) {
  const { onRunPatch, onBriefUpdated } = options;
  const [run, setRun] = React.useState<DirectorRun | null>(null);
  const [events, setEvents] = React.useState<DirectorEvent[]>([]);
  const [sendState, setSendState] = React.useState<SendState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const seenIds = React.useRef<Set<string>>(new Set());

  const appendEvent = React.useCallback((event: DirectorEvent) => {
    // The brief changed server-side — let the references panel refetch it.
    if (event.type === "brief.updated") onBriefUpdated?.();
    if (seenIds.current.has(event.id)) {
      // message.delta carries growing text under a stable id near the end of a
      // turn; replace in place so the active bubble keeps updating.
      setEvents((prev) => prev.map((e) => (e.id === event.id ? event : e)));
      return;
    }
    seenIds.current.add(event.id);
    setEvents((prev) => [...prev, event]);
  }, [onBriefUpdated]);

  const handleRunPatch = React.useCallback(
    (id: string, patch: Partial<DirectorRun>) => {
      setRun((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
      onRunPatch?.(id, patch);
    },
    [onRunPatch],
  );

  const { connect, close } = useDirectorRunStream({
    onEvent: appendEvent,
    onRunPatch: handleRunPatch,
    onError: () => setError("Connection lost. Reopen the conversation to reconnect."),
  });

  // Load + subscribe whenever the selected run changes.
  React.useEffect(() => {
    seenIds.current = new Set();
    setEvents([]);
    setRun(null);
    setError(null);
    if (!runId) return;

    let active = true;
    directorApi
      .getRun(runId)
      .then(({ run: loaded }) => {
        if (active) setRun(loaded);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : "Failed to load run"));

    void connect(runId);
    return () => {
      active = false;
      close();
    };
  }, [runId, connect, close]);

  const send = React.useCallback(
    async (prompt: string) => {
      if (!runId || !prompt.trim()) return;
      setSendState("sending");
      setError(null);
      try {
        const updated = await directorApi.continueRun(runId, { prompt: prompt.trim() });
        setRun(updated);
        // Stream the new turn (history already loaded; follow=1 scopes to it).
        void connect(runId, { followLatestTurn: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
      } finally {
        setSendState("idle");
      }
    },
    [runId, connect],
  );

  const cancel = React.useCallback(async () => {
    if (!runId) return;
    await directorApi.cancelRun(runId).catch(() => undefined);
  }, [runId]);

  const items: StreamItem[] = React.useMemo(() => buildStream(events), [events]);
  const isRunning = run?.status === "running" || run?.status === "queued";

  return { run, items, send, cancel, sendState, isRunning, error };
}
