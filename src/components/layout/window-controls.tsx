import * as React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Custom min / maximize / close controls for the frameless Windows window
 * (decorations are off on Windows; macOS uses its native traffic lights). These
 * call only the window's own controls — no app/business logic. Rendered solely
 * on Windows by the title bar.
 */
export function WindowControls() {
  const run = React.useCallback((action: "minimize" | "toggleMaximize" | "close") => {
    void (async () => {
      try {
        const win = getCurrentWindow();
        if (action === "minimize") await win.minimize();
        else if (action === "toggleMaximize") await win.toggleMaximize();
        else await win.close();
      } catch {
        // Outside a Tauri runtime (e.g. browser dev) these are no-ops.
      }
    })();
  }, []);

  return (
    <div className="no-drag flex items-center">
      <button
        onClick={() => run("minimize")}
        aria-label="Minimize"
        className="grid h-11 w-12 place-items-center text-text-secondary transition-colors hover:bg-fill hover:text-text"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden><rect x="1.5" y="5" width="8" height="1" fill="currentColor" /></svg>
      </button>
      <button
        onClick={() => run("toggleMaximize")}
        aria-label="Maximize"
        className="grid h-11 w-12 place-items-center text-text-secondary transition-colors hover:bg-fill hover:text-text"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden><rect x="1.5" y="1.5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" /></svg>
      </button>
      <button
        onClick={() => run("close")}
        aria-label="Close"
        className="grid h-11 w-12 place-items-center text-text-secondary transition-colors hover:bg-danger hover:text-white"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden><path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.1" /></svg>
      </button>
    </div>
  );
}
