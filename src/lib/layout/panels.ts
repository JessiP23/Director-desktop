import type { PanelDef, PanelId } from "./layout-types";

/**
 * The single source of truth for the workspace's secondary surfaces. To add a
 * feature panel: add one entry here + its content in the shell's renderer. The
 * layout shell, toolbar buttons, and persistence all derive from this map — no
 * hardcoded panel lists anywhere else.
 */
export const PANELS: Record<PanelId, PanelDef> = {
  references: { id: "references", title: "References", icon: "references", placement: "overlay", scope: "run" },
  timeline: { id: "timeline", title: "Timeline", icon: "timeline", placement: "overlay", scope: "run" },
  library: { id: "library", title: "Library", icon: "library", placement: "overlay", scope: "user" },
  brief: { id: "brief", title: "Brief", icon: "notes", placement: "dock", scope: "run" },
};

export const PANEL_LIST: PanelDef[] = Object.values(PANELS);

/** Run-scoped panels surfaced as toggles in the run toolbar (registry-driven). */
export const RUN_TOOLBAR_PANELS: PanelDef[] = PANEL_LIST.filter((p) => p.scope === "run");
