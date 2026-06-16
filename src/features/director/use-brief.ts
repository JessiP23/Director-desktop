import * as React from "react";
import { directorApi } from "@/lib/api/director";
import type { DirectorBrief } from "@/lib/director/contract/brief";

export function useBrief(runId: string | null, refreshKey: number) {
  const [brief, setBrief] = React.useState<DirectorBrief | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!runId) {
      setBrief(null);
      return;
    }
    let active = true;
    setLoading(true);
    directorApi
      .getBrief(runId)
      .then((b) => active && setBrief(b))
      .catch(() => active && setBrief(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [runId, refreshKey]);

  return { brief, loading };
}