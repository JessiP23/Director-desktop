import { PalmierTokens } from "./palmier-tokens";
import { PalmierPrimitives } from "./palmier-primitives";

/**
 * Dev-only Palmier token gallery (#palmier in dev). Renders the transcribed
 * Palmier Pro design tokens on its own dark-only ramp — Phase 0 reference, not
 * a shipped surface. No layout/feature changes yet.
 */
export function PalmierGallery() {
  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--pm-bg-base)" }}>
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-8 py-10">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--pm-text-muted)" }}>
            Palmier Pro · tokens
          </p>
          <h1 className="mt-1 text-2xl font-semibold" style={{ color: "var(--pm-text-primary)" }}>
            Phase 0 — design tokens
          </h1>
          <p className="mt-1 text-[12px]" style={{ color: "var(--pm-text-tertiary)" }}>
            Transcribed from AppTheme.swift / Constants.swift. Accent: Palmier off-white + your brand-amber timecode. Dark-only.
          </p>
        </header>
        <PalmierTokens />
        <div className="h-px" style={{ background: "var(--pm-border-subtle)" }} />
        <header>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--pm-text-primary)" }}>Phase A — primitives</h1>
          <p className="mt-1 text-[12px]" style={{ color: "var(--pm-text-tertiary)" }}>
            Composed from the tokens above: PanelShell, header bar, icon rail, toolbar, tracks, inspector, starter cards.
          </p>
        </header>
        <PalmierPrimitives />
      </div>
    </div>
  );
}
