/*
 * Adapted from wmstudio
 * `src/app/[locale]/dashboard/director/lib/use-director-run-stream.ts`.
 *
 * The web app uses the browser `EventSource`; here we use a fetch-based SSE
 * reader (`streamSse`) because we must send a Bearer JWT the native EventSource
 * can't carry. The fold/patch semantics are otherwise identical.
 */
import * as React from "react";
import type { DirectorEvent, DirectorEventType, DirectorRun } from "@/lib/director/contract/director";
import { directorApi } from "@/lib/api/director";
import { streamSse } from "@/lib/api/sse";
import { isTerminalEvent, parseDirectorEventData } from "@/lib/director/stream";

const STREAMED_EVENT_TYPES = new Set<DirectorEventType>([
  "user.message",
  "run.started",
  "message.delta",
  "tool.started",
  "tool.completed",
  "tool.failed",
  "brief.updated",
  "video.production.timeline.updated",
  "run.completed",
  "run.failed",
  "run.cancelled",
]);

function runPatchForEvent(event: DirectorEvent): Partial<DirectorRun> {
  const patch: Partial<DirectorRun> = {};
  if (event.type === "run.started") patch.status = "running";
  if (event.type === "run.completed") patch.status = "completed";
  if (event.type === "run.failed") {
    patch.status = "failed";
    patch.error = event.message;
  }
  return patch;
}

export type DirectorRunStreamCallbacks = {
  onEvent: (event: DirectorEvent) => void;
  onError?: (runId: string) => void;
  onRunPatch: (runId: string, patch: Partial<DirectorRun>) => void;
};

/**
 * Subscribes to a Director run's SSE stream. Returns a stable `connect(runId)`.
 * The underlying request is aborted on unmount, on terminal events, and when
 * `connect` is called again.
 */
export function useDirectorRunStream({ onEvent, onError, onRunPatch }: DirectorRunStreamCallbacks) {
  const abortRef = React.useRef<AbortController | null>(null);
  const onEventRef = React.useRef(onEvent);
  const onErrorRef = React.useRef(onError);
  const onRunPatchRef = React.useRef(onRunPatch);

  React.useEffect(() => {
    onEventRef.current = onEvent;
    onErrorRef.current = onError;
    onRunPatchRef.current = onRunPatch;
  }, [onError, onEvent, onRunPatch]);

  const close = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  React.useEffect(() => close, [close]);

  const connect = React.useCallback(
    async (runId: string, options: { followLatestTurn?: boolean } = {}) => {
      close();
      const controller = new AbortController();
      abortRef.current = controller;

      const { url, headers } = await directorApi.streamRequest(runId, options.followLatestTurn);

      void streamSse(url, {
        headers,
        signal: controller.signal,
        onFrame: ({ event: type, data }) => {
          if (!STREAMED_EVENT_TYPES.has(type as DirectorEventType)) return;
          const event = parseDirectorEventData(data);
          if (!event) return;

          onEventRef.current(event);

          const patch = runPatchForEvent(event);
          if (Object.keys(patch).length > 0) {
            onRunPatchRef.current(event.runId, patch);
          }

          if (isTerminalEvent(event)) controller.abort();
        },
        onError: () => {
          controller.abort();
          onErrorRef.current?.(runId);
        },
      });
    },
    [close],
  );

  return { connect, close };
}
