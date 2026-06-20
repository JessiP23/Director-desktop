import * as React from "react";
import { Canvas, Icon, type IconName } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { GROUP_LABELS, GROUP_ORDER, type BriefBlock, type BriefGroupKey } from "./brief-blocks";

// Radial geometry — ported from the React Flow tree: 4 groups around a center,
// sections radiating out. Straight edges, transform-only pan/zoom.
const GROUP_GEOMETRY: Record<BriefGroupKey, { angle: number; icon: IconName }> = {
  story: { angle: -Math.PI / 2, icon: "notes" },
  world: { angle: 0, icon: "visual" },
  production: { angle: Math.PI / 2, icon: "timeline" },
  continuity: { angle: Math.PI, icon: "continuity" },
};

type PlacedSection = BriefBlock & { x: number; y: number };
type PlacedGroup = { key: BriefGroupKey; label: string; icon: IconName; x: number; y: number; sections: PlacedSection[] };

function layout(blocks: BriefBlock[]): PlacedGroup[] {
  return GROUP_ORDER.map((key) => {
    const sections = blocks.filter((b) => b.group === key);
    if (sections.length === 0) return null;
    const { angle, icon } = GROUP_GEOMETRY[key];
    const gx = Math.cos(angle) * 270;
    const gy = Math.sin(angle) * 250;
    const spread = Math.min(Math.PI * 0.42, Math.PI * 0.16 * Math.max(sections.length - 1, 1));
    const placed = sections.map((block, i): PlacedSection => {
      const offset = sections.length === 1 ? 0 : -spread / 2 + (i * spread) / (sections.length - 1);
      const a = angle + offset;
      return { ...block, x: Math.cos(a) * 560, y: Math.sin(a) * 500 };
    });
    return { key, label: GROUP_LABELS[key], icon, x: gx, y: gy, sections: placed };
  }).filter((g): g is PlacedGroup => g !== null);
}

/**
 * The brief tree: the canvas design, rebuilt lightweight. A radial graph of
 * section cards on the transform-only `Canvas` (no React Flow). Few nodes, an
 * SVG edge layer, memoized layout — smooth pan/zoom, cheap to render.
 */
export function BriefTree({
  blocks,
  title,
  selectedKey,
  onSelect,
}: {
  blocks: BriefBlock[];
  title: string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const groups = React.useMemo(() => layout(blocks), [blocks]);

  return (
    <Canvas origin="center">
      <div className="relative">
        {/* Edges: center → group → section (straight, GPU-cheap). */}
        <svg style={{ overflow: "visible" }} width={1} height={1} className="pointer-events-none absolute left-0 top-0">
          {groups.map((g) => (
            <React.Fragment key={`edges-${g.key}`}>
              <line x1={0} y1={0} x2={g.x} y2={g.y} stroke="var(--separator)" strokeWidth={1.2} />
              {g.sections.map((s) => (
                <line key={`edge-${s.key}`} x1={g.x} y1={g.y} x2={s.x} y2={s.y} stroke="var(--separator)" strokeWidth={1} />
              ))}
            </React.Fragment>
          ))}
        </svg>

        <Node x={0} y={0}>
          <div className="flex items-center gap-2 whitespace-nowrap rounded-full bg-surface-2 px-3.5 py-2 shadow-[var(--shadow-hairline)]">
            <Icon name="references" size={16} className="text-accent" />
            <span className="text-sm font-semibold text-text">{title}</span>
          </div>
        </Node>

        {groups.map((g) => (
          <React.Fragment key={g.key}>
            <Node x={g.x} y={g.y}>
              <div className="flex items-center gap-1.5 whitespace-nowrap text-text-tertiary">
                <Icon name={g.icon} size={13} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">{g.label}</span>
              </div>
            </Node>
            {g.sections.map((s) => (
              <Node key={s.key} x={s.x} y={s.y}>
                <SectionNode block={s} selected={selectedKey === s.key} onSelect={() => onSelect(s.key)} />
              </Node>
            ))}
          </React.Fragment>
        ))}
      </div>
    </Canvas>
  );
}

/** Absolutely-positioned node centered on (x, y) in canvas coordinates. */
function Node({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div className="absolute" style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}>
      {children}
    </div>
  );
}

const SectionNode = React.memo(function SectionNode({
  block,
  selected,
  onSelect,
}: {
  block: BriefBlock;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group flex w-[172px] items-start gap-2.5 rounded-[14px] border bg-surface-1 px-3 py-2.5 text-left shadow-sm transition-[transform,border-color,background-color] duration-200 hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        selected ? "scale-[1.04] border-accent" : "border-separator",
      )}
    >
      <Icon name={block.icon} size={15} className={cn("mt-0.5 shrink-0", selected ? "text-accent" : "text-text-tertiary")} />
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold leading-tight text-text">{block.label}</span>
        <span className="mt-0.5 block truncate text-[10px] text-text-quaternary">{block.preview}</span>
      </span>
    </button>
  );
});
