/**
 * Director connector (tools) contract — mirrors the backend's
 * `src/lib/production-agent/connectors.ts`. These are the Composio toolkits
 * (Slack, Gmail, Telegram, …) the Director may call. The desktop reads and
 * writes the user's selection through `/api/production-agent/connectors`.
 */

export type DirectorConnectorSettings = {
  /** Toolkit slugs the user has switched on (e.g. "gmail", "slack"). */
  enabledApps: string[];
  /** Per-toolkit explicit tool-slug selection; empty means "use the defaults". */
  selectedTools: Record<string, string[]>;
};

/** Shape returned by `GET /api/production-agent/connectors`. */
export type DirectorConnectorState = {
  settings: DirectorConnectorSettings;
  /** Curated default tool slugs per toolkit, keyed by lowercase toolkit slug. */
  defaultTools: Record<string, string[]>;
};

export type SaveDirectorConnectorSettingsInput = {
  enabledApps: string[];
  selectedTools: Record<string, string[]>;
};
