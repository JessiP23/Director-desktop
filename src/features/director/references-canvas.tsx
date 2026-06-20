import * as React from "react";
import { AssetTile, Canvas, EmptyState, IconButton, Lightbox, SlideOver } from "@/components/ui";
import type { DirectorBrief, DirectorBriefSections } from "@/lib/director/contract/brief";
import { cn } from "@/lib/utils/cn";
import { useFrameRemoval } from "./use-frame-removal";

type RefTile = { id: string; url: string; label: string; kind: "image" | "video"; removable?: boolean };
type RefGroup = { key: string; title: string; tiles: RefTile[] };

const REF_RE = /^\s*([a-z]+)\s*:\s*(https?:\/\/.+)$/i;
const refUrl = (value: string) => value.match(REF_RE)?.[2] ?? value.trim();

/** Pull the brief's visual assets into display groups (pure, cheap, memoizable). */
function buildGroups(sections?: DirectorBriefSections): RefGroup[] {
  if (!sections) return [];
  const groups: RefGroup[] = [];
  const refs = Object.entries(sections.referenceImages ?? {});
  if (refs.length)
    groups.push({
      key: "cast",
      title: "Cast, locations & props",
      tiles: refs.map(([name, v]) => ({ id: `ref-${name}`, url: refUrl(v), label: name, kind: "image" })),
    });
  if (sections.scriptImages?.length)
    groups.push({
      key: "frames",
      title: "Keyframes",
      tiles: sections.scriptImages.map((f, i) => ({ id: `frame-${f.url}`, url: f.url, label: f.scriptReference || `Frame ${i + 1}`, kind: "image", removable: true })),
    });
  if (sections.scriptClips?.length)
    groups.push({
      key: "clips",
      title: "Clips",
      tiles: sections.scriptClips.map((c, i) => ({ id: `clip-${c.url}`, url: c.url, label: c.scriptReference || `Clip ${i + 1}`, kind: "video" })),
    });
  if (sections.linkedAssets?.length)
    groups.push({
      key: "linked",
      title: "Imported",
      tiles: sections.linkedAssets.map((a, i) => ({ id: `linked-${a.url}`, url: a.url, label: a.name || `Asset ${i + 1}`, kind: "image" })),
    });
  return groups;
}

/**
 * References as a lightweight, pannable canvas (replaces the React Flow brief
 * graph). Each casting sheet / keyframe / clip is an `AssetTile` on a zoomable
 * board — transform-only pan/zoom, lazy async thumbnails, memoized tiles — so it
 * opens fast and stays smooth no matter how many assets the brief holds. Brief
 * *text* lives in the Brief dock; this surface is purely the visual references.
 */
export function ReferencesCanvas({
  runId,
  isOpen,
  onClose,
  brief,
}: {
  runId: string | null;
  isOpen: boolean;
  onClose: () => void;
  brief: DirectorBrief | null;
}) {
  const { brief: working, removeFrame, removing } = useFrameRemoval(runId, brief);
  const groups = React.useMemo(() => buildGroups(working?.sections), [working]);
  const [lightbox, setLightbox] = React.useState<string | null>(null);

  // Soft entrance: the board fades/lifts in (transform+opacity only) once open.
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    if (!isOpen) return setShown(false);
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  const total = groups.reduce((n, g) => n + g.tiles.length, 0);

  return (
    <SlideOver title="References" isOpen={isOpen} onClose={onClose} width="w-[clamp(640px,58vw,1120px)]">
      {total === 0 ? (
        <EmptyState
          name="references"
          title="No references yet"
          description="Casting sheets, keyframes, and imported images appear here as Director develops the brief."
        />
      ) : (
        <Canvas>
          <div
            className={cn(
              "flex w-[760px] flex-col gap-7 p-8 transition-[opacity,transform] duration-300 ease-out will-change-transform",
              shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
            )}
          >
            {groups.map((group) => (
              <section key={group.key} className="flex flex-col gap-3">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-tertiary">{group.title}</h3>
                <div className="grid grid-cols-3 gap-3">
                  {group.tiles.map((tile) => (
                    <div key={tile.id} className="group/tile relative">
                      <AssetTile
                        url={tile.url}
                        label={tile.label}
                        kind={tile.kind}
                        onSelect={tile.kind === "image" ? () => setLightbox(tile.url) : undefined}
                      />
                      {tile.removable && (
                        <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover/tile:opacity-100">
                          <IconButton
                            name="delete"
                            label="Remove frame"
                            size="sm"
                            disabled={removing === tile.url}
                            onClick={() => void removeFrame(tile.url)}
                            className="bg-black/55 text-white hover:bg-danger hover:text-white"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Canvas>
      )}
      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </SlideOver>
  );
}
