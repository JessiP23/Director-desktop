import * as React from "react";
import { PANELS } from "./panels";
import { DEFAULT_LAYOUT, type LayoutState, type PanelId, type PanelPlacement } from "./layout-types";

const STORAGE_KEY = "director.layout.v1";

type LayoutContextValue = LayoutState & {
  /** Open/close a panel; routes to dock or overlay by its registry placement. */
  toggle: (id: PanelId) => void;
  open: (id: PanelId) => void;
  close: (placement: PanelPlacement) => void;
  isOpen: (id: PanelId) => boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  // Center tab host (presentational arrangement of open runs).
  openTab: (runId: string) => void;
  activateTab: (runId: string) => void;
  closeTab: (runId: string) => void;
  newTab: () => void;
  openToSide: (runId: string) => void;
  closeSplit: () => void;
};

const LayoutContext = React.createContext<LayoutContextValue | null>(null);

/** Restore only the durable bits (docked panel + sidebar). Overlays are transient. */
function loadPersisted(): LayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const saved = JSON.parse(raw) as Partial<LayoutState>;
    return {
      ...DEFAULT_LAYOUT,
      dock: saved.dock ?? null,
      sidebarCollapsed: saved.sidebarCollapsed ?? false,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

/**
 * Presentational layout store: which docked/overlay panel is open and whether
 * the sidebar is collapsed. Persists the durable bits to localStorage so the
 * arrangement restores. Owns zero business state.
 */
export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<LayoutState>(loadPersisted);

  React.useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ dock: state.dock, sidebarCollapsed: state.sidebarCollapsed }),
    );
  }, [state.dock, state.sidebarCollapsed]);

  const value = React.useMemo<LayoutContextValue>(() => {
    const slotOf = (id: PanelId): PanelPlacement => PANELS[id].placement;
    return {
      ...state,
      toggle: (id) =>
        setState((s) => {
          const slot = slotOf(id);
          return { ...s, [slot]: s[slot] === id ? null : id };
        }),
      open: (id) => setState((s) => ({ ...s, [slotOf(id)]: id })),
      close: (placement) => setState((s) => ({ ...s, [placement]: null })),
      isOpen: (id) => state[slotOf(id)] === id,
      setSidebarCollapsed: (collapsed) => setState((s) => ({ ...s, sidebarCollapsed: collapsed })),

      openTab: (runId) =>
        setState((s) => ({
          ...s,
          tabs: s.tabs.includes(runId) ? s.tabs : [...s.tabs, runId],
          activeTab: runId,
          split: s.split === runId ? null : s.split,
        })),
      activateTab: (runId) =>
        setState((s) => ({ ...s, activeTab: runId, split: s.split === runId ? null : s.split })),
      closeTab: (runId) =>
        setState((s) => {
          const tabs = s.tabs.filter((id) => id !== runId);
          const activeTab =
            s.activeTab === runId ? (tabs[tabs.length - 1] ?? null) : s.activeTab;
          return { ...s, tabs, activeTab, split: s.split === runId ? null : s.split };
        }),
      newTab: () => setState((s) => ({ ...s, activeTab: null })),
      openToSide: (runId) =>
        setState((s) => {
          const tabs = s.tabs.includes(runId) ? s.tabs : [...s.tabs, runId];
          // Comparing requires a distinct active run; otherwise just open it.
          if (!s.activeTab || s.activeTab === runId) return { ...s, tabs, activeTab: runId, split: null };
          return { ...s, tabs, split: runId };
        }),
      closeSplit: () => setState((s) => ({ ...s, split: null })),
    };
  }, [state]);

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout(): LayoutContextValue {
  const ctx = React.useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be used within <LayoutProvider>");
  return ctx;
}
