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
      console.info("[runs] loaded", loaded.length, "production(s)");
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
    const run = await directorApi.createRun(payload);
    setRuns((prev) => [run, ...prev]);
    return run;
  }, []);

  const deleteRun = React.useCallback(async (runId: string) => {
    await directorApi.deleteRun(runId);
    setRuns((prev) => prev.filter((r) => r.id !== runId));
  }, []);

  /** Merge a run patch coming from the live stream into the index. */
  const patchRun = React.useCallback((runId: string, patch: Partial<DirectorRun>) => {
    setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, ...patch } : r)));
  }, []);

  return { runs, loading, error, refresh, createRun, deleteRun, patchRun };
}
