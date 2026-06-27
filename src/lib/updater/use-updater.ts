import * as React from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/** True when running inside the Tauri WebView (vs a plain browser tab). */
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type UpdaterPhase =
  | "idle" // no update found (or not yet checked)
  | "checking" // querying the release endpoint
  | "available" // a newer signed build exists
  | "downloading" // fetching + verifying the bundle
  | "installing" // writing the new bundle in place
  | "relaunching" // restarting into the new version
  | "error"; // check/download/install failed

export type UpdaterState = {
  phase: UpdaterPhase;
  /** Target version string when an update is available (e.g. "0.2.0"). */
  version: string | null;
  /** 0–100 while downloading, else null. */
  progress: number | null;
  error: string | null;
  /** True only when there is an update the user can install right now. */
  canUpdate: boolean;
  /** Begin download → install → relaunch. Safe to call once. */
  install: () => Promise<void>;
  /** Re-run the check (e.g. a manual "check for updates"). */
  recheck: () => Promise<void>;
};

export function useUpdater(): UpdaterState {
  const [phase, setPhase] = React.useState<UpdaterPhase>("idle");
  const [version, setVersion] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Hold the resolved Update handle so the click handler installs exactly the
  // build we surfaced to the user — no second network round-trip.
  const updateRef = React.useRef<Update | null>(null);

  const runCheck = React.useCallback(async () => {
    if (!isTauri) return;
    setPhase("checking");
    setError(null);
    try {
      const update = await check();
      if (update) {
        updateRef.current = update;
        setVersion(update.version);
        setPhase("available");
      } else {
        updateRef.current = null;
        setVersion(null);
        setPhase("idle");
      }
    } catch (err) {
      // A failed check must never block the app — just stay silent (no button).
      console.error("Update check failed", err);
      setError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    }
  }, []);

  const install = React.useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;
    try {
      setError(null);
      setPhase("downloading");
      setProgress(0);

      let downloaded = 0;
      let contentLength = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            setProgress(0);
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            setProgress(
              contentLength > 0
                ? Math.min(100, Math.round((downloaded / contentLength) * 100))
                : null,
            );
            break;
          case "Finished":
            setProgress(100);
            setPhase("installing");
            break;
        }
      });

      // Bundle installed and signature-verified — restart into it.
      setPhase("relaunching");
      await relaunch();
    } catch (err) {
      console.error("Update install failed", err);
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
      setProgress(null);
    }
  }, []);

  // Check once on startup. Run after first paint so it never delays the UI.
  React.useEffect(() => {
    void runCheck();
  }, [runCheck]);

  return {
    phase,
    version,
    progress,
    error,
    canUpdate: phase === "available",
    install,
    recheck: runCheck,
  };
}
