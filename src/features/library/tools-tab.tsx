import * as React from "react";
import { Spinner } from "@/components/ui/spinner";
import { useResource } from "@/lib/data/resource-store";
import { connectors, connectorsStore } from "@/lib/data/library-stores";
import { Pill, StateHint, Toggle } from "./ui";

/** Prettify a toolkit slug for display ("google_calendar" → "Google Calendar"). */
function toolkitLabel(slug: string): string {
  return slug
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Connector tools (Composio toolkits) the Director may call. Toggling an app
 * writes the full enabledApps set back through a single PUT; the cached store
 * updates in place so the switch reflects instantly.
 */
export function ToolsTab() {
  const { data, loading, error } = useResource(connectorsStore);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  if (loading && !data) return <StateHint><Spinner /></StateHint>;
  if (error && !data) return <StateHint tone="danger">{error}</StateHint>;

  const settings = data?.settings ?? { enabledApps: [], selectedTools: {} };
  const enabled = new Set(settings.enabledApps.map((a) => a.toLowerCase()));
  // The catalog is the curated toolkits plus anything already enabled.
  const toolkits = Array.from(
    new Set([...Object.keys(data?.defaultTools ?? {}), ...settings.enabledApps.map((a) => a.toLowerCase())]),
  ).sort();

  async function toggle(slug: string, on: boolean) {
    setBusy(slug);
    setSaveError(null);
    const nextEnabled = on
      ? [...settings.enabledApps, slug]
      : settings.enabledApps.filter((a) => a.toLowerCase() !== slug);
    try {
      await connectors.save({ enabledApps: nextEnabled, selectedTools: settings.selectedTools });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <p className="text-xs text-text-tertiary">
        Connected apps the Director can act on (Slack, Gmail, …). Enabled tools load with each run.
      </p>
      {saveError && <p className="text-xs text-danger">{saveError}</p>}

      {toolkits.length === 0 ? (
        <StateHint>No connectors available. Connect apps in WM Studio to use them here.</StateHint>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {toolkits.map((slug) => {
            const on = enabled.has(slug);
            const toolCount = (settings.selectedTools[slug] ?? data?.defaultTools[slug] ?? []).length;
            return (
              <li
                key={slug}
                className="flex items-center gap-3 rounded-xl border border-line-strong bg-ink-800/60 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-fg">{toolkitLabel(slug)}</span>
                    {on && toolCount > 0 && <Pill>{toolCount} tools</Pill>}
                  </div>
                </div>
                {busy === slug ? (
                  <Spinner className="size-4 text-text-tertiary" />
                ) : (
                  <Toggle label={`Enable ${slug}`} checked={on} onChange={(next) => toggle(slug, next)} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
