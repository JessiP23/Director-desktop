import { SegmentedControl } from "@/components/ui";
import { useAppearance } from "@/lib/appearance/use-appearance";
import {
  ButtonsSection,
  CanvasSection,
  CardsSection,
  ContextMenuSection,
  ControlsSection,
  EmptyStateSection,
  IconsSection,
  PanelAndTabsSection,
  SplitSection,
} from "./gallery-sections";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-tertiary">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Dev-only primitives gallery (open with #gallery in dev). Every primitive
 * rendered against the real token system; flip the theme control to verify
 * light + dark. Not shipped in the app's user-facing surface.
 */
export function PrimitivesGallery() {
  const { mode, setMode } = useAppearance();
  return (
    <div className="h-full overflow-y-auto bg-surface-0">
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-8 py-10">
        <header className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-text-quaternary">WM Studio · Director</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text">Primitives</h1>
          </div>
          <SegmentedControl
            ariaLabel="Theme"
            value={mode}
            onChange={setMode}
            options={[
              { value: "auto", label: "Auto" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </header>

        <Section title="Icons (one set · lucide)"><IconsSection /></Section>
        <Section title="Buttons · IconButton · Tooltip · Kbd"><ButtonsSection /></Section>
        <Section title="SegmentedControl · Toolbar"><ControlsSection /></Section>
        <Section title="Card · Thumbnail · AssetTile"><CardsSection /></Section>
        <Section title="EmptyState"><EmptyStateSection /></Section>
        <Section title="ContextMenu"><ContextMenuSection /></Section>
        <Section title="Panel · Tabs"><PanelAndTabsSection /></Section>
        <Section title="SplitPane (resizable · persisted)"><SplitSection /></Section>
        <Section title="Canvas (pan · zoom)"><CanvasSection /></Section>
      </div>
    </div>
  );
}
