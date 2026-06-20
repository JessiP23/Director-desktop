import type { IconName } from "@/components/ui";

/**
 * The presentational layout vocabulary. Adding a new surface to the workspace
 * is a one-line entry in the PANELS registry (see panels.ts) — the shell reads
 * `placement`/`scope` to decide where and when it renders, so features stay
 * decoupled from the layout code.
 */
export type PanelId = "references" | "timeline" | "library" | "brief";

/** Where a panel lives: a docked, resizable right pane vs a full-height overlay. */
export type PanelPlacement = "dock" | "overlay";

/** Whether a panel needs an active run, or is user-global. */
export type PanelScope = "run" | "user";

export type PanelDef = {
  id: PanelId;
  title: string;
  icon: IconName;
  placement: PanelPlacement;
  scope: PanelScope;
};

/**
 * Presentational layout state only — never business data. One docked panel and
 * one overlay may be open at once (they occupy different regions); within each
 * region it's one-at-a-time.
 *
 * `tabs` holds the run ids open in the center pane host (ordered), `activeTab`
 * the focused one (null = the start screen), and `split` an optional second run
 * shown side-by-side for comparison. These reference business entities but are
 * pure arrangement — the runs themselves come from the run hooks.
 */
export type LayoutState = {
  dock: PanelId | null;
  overlay: PanelId | null;
  sidebarCollapsed: boolean;
  tabs: string[];
  activeTab: string | null;
  split: string | null;
};

export const DEFAULT_LAYOUT: LayoutState = {
  dock: null,
  overlay: null,
  sidebarCollapsed: false,
  tabs: [],
  activeTab: null,
  split: null,
};
