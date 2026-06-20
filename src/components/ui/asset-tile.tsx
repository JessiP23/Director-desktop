import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Card } from "./card";
import { Thumbnail } from "./thumbnail";
import { Icon, type IconName } from "./icon";

type AssetKind = "image" | "video" | "audio" | "other";

const kindIcon: Record<AssetKind, IconName> = {
  image: "image",
  video: "video",
  audio: "audio",
  other: "asset",
};

/**
 * A single asset/reference as a selectable tile: thumbnail + label + kind badge.
 * Composes Card + Thumbnail — used in reference grids and on the Canvas. Pure
 * presentation; `onSelect` feeds whatever flow the caller wires up.
 */
export const AssetTile = React.memo(function AssetTile({
  url,
  label,
  kind = "image",
  selected,
  onSelect,
  className,
}: {
  url?: string;
  label?: string;
  kind?: AssetKind;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
}) {
  const poster = kind === "image" || kind === "video" ? url : undefined;
  return (
    <Card selected={selected} onClick={onSelect} className={cn("group overflow-hidden", className)}>
      <div className="relative">
        <Thumbnail src={poster} aspect="4 / 3" rounded="rounded-none" fallbackIcon={kindIcon[kind]} />
        {kind !== "image" && (
          <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm">
            <Icon name={kindIcon[kind]} size={13} />
          </span>
        )}
        {selected && (
          <span className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-accent text-accent-fg">
            <Icon name="check" size={12} strokeWidth={2.5} />
          </span>
        )}
      </div>
      {label && (
        <div className="truncate px-2.5 py-2 text-xs font-medium text-text-secondary">{label}</div>
      )}
    </Card>
  );
});
