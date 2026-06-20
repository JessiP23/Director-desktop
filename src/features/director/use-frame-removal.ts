import * as React from "react";
import { directorApi } from "@/lib/api/director";
import type { DirectorBrief } from "@/lib/director/contract/brief";

/**
 * Optimistic removal of a saved keyframe (scriptImage) from the brief, reusing
 * the existing `patchBrief` action — the same flow the old references panel
 * used (including the 409 re-read on a version conflict). No new functionality.
 */
export function useFrameRemoval(runId: string | null, brief: DirectorBrief | null) {
  const [localBrief, setLocalBrief] = React.useState<DirectorBrief | null>(brief);
  const [removing, setRemoving] = React.useState<string | null>(null);

  React.useEffect(() => setLocalBrief(brief), [brief]);

  const removeFrame = React.useCallback(
    async (url: string) => {
      if (!runId || !localBrief) return;
      setRemoving(url);
      try {
        const updated = await directorApi.patchBrief(runId, {
          removeScriptImageUrls: [url],
          expectedVersion: localBrief.version,
          reason: "Frame removed from the references canvas",
        });
        setLocalBrief(updated);
      } catch (err) {
        const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 0;
        if (status === 409) {
          const fresh = await directorApi.getBrief(runId).catch(() => null);
          if (fresh) setLocalBrief(fresh);
        }
      } finally {
        setRemoving(null);
      }
    },
    [runId, localBrief],
  );

  return { brief: localBrief, removeFrame, removing };
}
