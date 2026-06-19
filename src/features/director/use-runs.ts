import * as React from "react";
import { directorApi, type CreateRunPayload } from "@/lib/api/director";
import type { DirectorRun } from "@/lib/director/contract/director";

/**
 * The sidebar's view of all Director runs: list, create, delete. Run *contents*
 * (events/streaming) are owned by `useRun`; this hook only tracks the index.
 */
export function useRuns() {
  const [runs, setRuns] = React.useState<DirectorRun[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const loaded = await directorApi.listRuns();
      console.info("[DESKTOP:runs] listRuns returned", loaded.length, "run(s)");
      loaded.forEach((r) => console.info(`[DESKTOP:runs] run id=${r.id} title="${r.title}" status=${r.status}`));
      setRuns(loaded);
      setError(null);
    } catch (err) {
      console.error("[runs] failed to load", err);
      setError(err instanceof Error ? err.message : "Failed to load runs");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const createRun = React.useCallback(async (payload: CreateRunPayload) => {
    console.info("[DESKTOP:runs] createRun called", { promptSnippet: payload.prompt.slice(0, 120) });
    const run = await directorApi.createRun(payload);
    console.info(`[DESKTOP:runs] createRun response id=${run.id} title="${run.title}"`);
    setRuns((prev) => [run, ...prev]);
    return run;
  }, []);

  const deleteRun = React.useCallback(async (runId: string) => {
    await directorApi.deleteRun(runId);
    setRuns((prev) => prev.filter((r) => r.id !== runId));
  }, []);

  /** Merge a run patch coming from the live stream into the index. */
  const patchRun = React.useCallback((runId: string, patch: Partial<DirectorRun>) => {
    if (patch.title !== undefined) console.info(`[DESKTOP:runs] patchRun id=${runId} new title="${patch.title}"`);
    setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, ...patch } : r)));
  }, []);

  return { runs, loading, error, refresh, createRun, deleteRun, patchRun };
}
