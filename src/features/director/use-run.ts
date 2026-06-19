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
 *
 * Live turns arrive as a burst of `message.delta` frames (often dozens per
 * second). Rather than committing a React render per frame — which rebuilds the
 * whole stream and re-parses every Markdown block each time — incoming events
 * are buffered and flushed once per animation frame. The transcript stays in
 * lock-step with the screen's refresh rate instead of thrashing ahead of it.
 */
export function useRun(
  runId: string | null,
  options: {
    onRunPatch?: (id: string, patch: Partial<DirectorRun>) => void;
    onBriefUpdated?: () => void;
    /**
     * Seeds the optimistic user bubble for a brand-new run whose first prompt
     * was already submitted before the run id existed (see the workspace's
     * "new production" flow). Cleared automatically once the real `user.message`
     * replays over the stream.
     */
    initialPendingPrompt?: string | null;
  } = {},
) {
  const { onRunPatch, onBriefUpdated, initialPendingPrompt } = options;
  const [run, setRun] = React.useState<DirectorRun | null>(null);
  const [events, setEvents] = React.useState<DirectorEvent[]>([]);
  const [sendState, setSendState] = React.useState<SendState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = React.useState<string | null>(null);
  const pendingPromptRef = React.useRef<string | null>(null);
  const sendingRef = React.useRef(false);

  // Read the latest seed without making it a stream dependency (it changes as
  // the workspace clears it, but we only want its value at connect-time).
  const initialPendingRef = React.useRef(initialPendingPrompt);
  initialPendingRef.current = initialPendingPrompt;

  // Events queued since the last frame, plus the scheduled flush handle.
  const eventBufferRef = React.useRef<DirectorEvent[]>([]);
  const rafRef = React.useRef<number | null>(null);

  const flush = React.useCallback(() => {
    rafRef.current = null;
    const buffered = eventBufferRef.current;
    if (buffered.length === 0) return;
    eventBufferRef.current = [];
    setEvents((prev) => {
      const next = prev.slice();
      // De-dupe by id off the array itself: `message.delta` carries growing
      // text under a stable id, so a later frame replaces the bubble in place.
      const indexById = new Map(next.map((e, i) => [e.id, i] as const));
      for (const event of buffered) {
        const idx = indexById.get(event.id);
        if (idx !== undefined) next[idx] = event;
        else {
          indexById.set(event.id, next.length);
          next.push(event);
        }
      }
      return next;
    });
  }, []);

  const appendEvent = React.useCallback(
    (event: DirectorEvent) => {
      // Side-effects must fire on arrival, not on the batched flush.
      // The brief changed server-side — let the references panel refetch it.
      if (event.type === "brief.updated") onBriefUpdated?.();
      // Drop the optimistic echo once the real user message arrives via the stream.
      if (event.type === "user.message" && event.message?.trim() === pendingPromptRef.current) {
        pendingPromptRef.current = null;
        setPendingPrompt(null);
      }
      eventBufferRef.current.push(event);
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(flush);
    },
    [onBriefUpdated, flush],
  );

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
    // Drop any buffered frames from the previous run before resetting state.
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    eventBufferRef.current = [];
    setEvents([]);
    setRun(null);
    setError(null);
    // Seed the optimistic first-prompt bubble (if any) so the transcript shows
    // the user's message instantly while the snapshot + stream catch up.
    const seed = initialPendingRef.current ?? null;
    setPendingPrompt(seed);
    pendingPromptRef.current = seed;
    if (!runId) return;

    let active = true;
    directorApi
      .getRun(runId)
      .then(({ run: loaded }) => {
        console.info(`[DESKTOP:run] getRun id=${loaded.id} title="${loaded.title}" status=${loaded.status}`);
        if (active) setRun(loaded);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : "Failed to load run"));

    void connect(runId);
    return () => {
      active = false;
      close();
    };
  }, [runId, connect, close]);

  const isRunning = run?.status === "running" || run?.status === "queued";
  const isRunningRef = React.useRef(isRunning);
  React.useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const send = React.useCallback(
    async (prompt: string) => {
      const text = prompt.trim();
      if (!runId || !text) return;
      // Guard against a concurrent turn (the backend returns 409 "already
      // responding"): ignore sends while one is in flight or running.
      if (sendingRef.current || isRunningRef.current) return;
      sendingRef.current = true;
      setSendState("sending");
      setError(null);
      // Optimistic echo: show the user's message instantly rather than waiting
      // ~2s for the POST + stream to replay it.
      pendingPromptRef.current = text;
      setPendingPrompt(text);
      try {
        console.info(`[DESKTOP:run] continueRun prompt="${text.slice(0, 120)}"`);
        const updated = await directorApi.continueRun(runId, { prompt: text });
        console.info(`[DESKTOP:run] continueRun response id=${updated.id} title="${updated.title}" status=${updated.status}`);
        setRun(updated);
        // Stream the new turn (history already loaded; follow=1 scopes to it).
        void connect(runId, { followLatestTurn: true });
      } catch (err) {
        const status =
          err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 0;
        if (status !== 409) {
          setError(err instanceof Error ? err.message : "Failed to send message");
        }
        pendingPromptRef.current = null;
        setPendingPrompt(null);
      } finally {
        sendingRef.current = false;
        setSendState("idle");
      }
    },
    [runId, connect],
  );

  const cancel = React.useCallback(async () => {
    if (!runId) return;
    await directorApi.cancelRun(runId).catch(() => undefined);
  }, [runId]);

  const items: StreamItem[] = React.useMemo(() => {
    const base = buildStream(events);
    if (pendingPrompt) {
      base.push({ kind: "user", id: "__pending__", text: pendingPrompt, timestamp: new Date().toISOString() });
    }
    return base;
  }, [events, pendingPrompt]);

  return { run, items, send, cancel, sendState, isRunning, error };
}
