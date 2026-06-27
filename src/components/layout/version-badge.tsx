import * as React from "react";
import { getVersion } from "@tauri-apps/api/app";
import { cn } from "@/lib/utils/cn";

/** True when running inside the Tauri WebView (vs a plain browser tab). */
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Small, quiet version chip next to the wordmark. It reads the *running* app
 * version from Tauri, so after an auto-update installs and relaunches, the
 * number visibly changes (e.g. 0.1.0 → 0.2.0) — a clear, honest confirmation
 * that the new build is live. Distinct from the (version-free) Update button.
 */
export function VersionBadge({ className }: { className?: string }) {
  const [version, setVersion] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isTauri) return;
    void getVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);

  if (!version) return null;

  return (
    <span
      className={cn(
        "rounded-full bg-fill-secondary px-1.5 py-0.5 text-[10px] font-medium leading-none text-text-tertiary tabular-nums",
        className,
      )}
      title={`Director ${version}`}
    >
      v{version}
    </span>
  );
}
