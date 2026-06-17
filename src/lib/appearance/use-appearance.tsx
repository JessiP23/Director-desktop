import * as React from "react";

/**
 * Appearance store — presentational only. Owns the user's theme *preference*
 * (auto / light / dark), reflects it onto the root element's class, and
 * persists it. The CSS in globals.css does the actual theming:
 *   (no class) = auto → follows `prefers-color-scheme`
 *   .light / .dark     = forced
 *
 * The pre-paint script in index.html sets the initial class to avoid a
 * flash-of-wrong-theme; this provider keeps it in sync after hydration and
 * exposes the setter for the Phase-B "Match System / Light / Dark" control.
 * It holds no business state and touches no Tauri commands.
 */
export type AppearanceMode = "auto" | "light" | "dark";

const STORAGE_KEY = "director-appearance";

function applyMode(mode: AppearanceMode) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (mode === "light") root.classList.add("light");
  else if (mode === "dark") root.classList.add("dark");
  // "auto" → no class; CSS prefers-color-scheme drives it.
}

function readStored(): AppearanceMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "auto") return value;
  } catch {
    // localStorage unavailable — fall back to auto.
  }
  return "auto";
}

type AppearanceContextValue = {
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
};

const AppearanceContext = React.createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<AppearanceMode>(readStored);

  const setMode = React.useCallback((next: AppearanceMode) => {
    setModeState(next);
    applyMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort persistence; theme still applies for this session.
    }
  }, []);

  // Re-assert on mount in case the pre-paint script and React state diverge.
  React.useEffect(() => {
    applyMode(mode);
  }, [mode]);

  const value = React.useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const ctx = React.useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within an AppearanceProvider");
  return ctx;
}
