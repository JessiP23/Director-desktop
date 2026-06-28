"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Squares2X2Icon } from "@heroicons/react/24/solid"
import {
  MusicalNoteIcon,
  PhotoIcon,
  Squares2X2Icon as Squares2X2OutlineIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils/cn"

/** One generated media item produced in the current conversation. */
export type RunAsset = {
  id: string
  url: string
  kind: "image" | "video" | "audio" | "other"
  timestamp: string
  deletable?: boolean
}

type AssetFilter = "all" | "images" | "videos" | "music"

function matchesFilter(kind: RunAsset["kind"], filter: AssetFilter): boolean {
  switch (filter) {
    case "images":
      return kind === "image" || kind === "other"
    case "videos":
      return kind === "video"
    case "music":
      return kind === "audio"
    default:
      return true
  }
}

function AssetTile({ asset, onDelete }: { asset: RunAsset; onDelete?: (assetId: string) => void }) {
  const isVideo = asset.kind === "video"
  const isAudio = asset.kind === "audio"

  if (isAudio) {
    return (
      <div className="overflow-hidden rounded-[14px] bg-[#09090b] ring-1 ring-white/[0.05]">
        <audio src={asset.url} controls className="w-full p-3" />
      </div>
    )
  }

  return (
    <div className="group relative overflow-hidden rounded-[14px] bg-[#09090b] ring-1 ring-white/[0.05]">
      {isVideo ? (
        <video
          src={asset.url}
          className="w-full h-auto object-contain"
          controls
          preload="metadata"
        />
      ) : (
        <img
          src={asset.url}
          alt="Generated asset"
          className="w-full h-auto object-contain"
          loading="lazy"
        />
      )}
      {onDelete && asset.deletable !== false && (
        <button
          type="button"
          onClick={() => onDelete(asset.id)}
          className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
          aria-label="Delete asset"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

/**
 * Right-hand slide-in panel listing the generations made in the CURRENT conversation,
 * in chronological order.
 */
export function RunAssetsPanel({
  isOpen,
  onClose,
  assets,
  onDeleteAsset,
}: {
  isOpen: boolean
  onClose: () => void
  assets: RunAsset[]
  onDeleteAsset?: (assetId: string) => void
}) {
  const [activeFilter, setActiveFilter] = React.useState<AssetFilter>("all")
  const [columns, setColumns] = React.useState(3)

  const filters = React.useMemo(
    () => [
      { id: "all" as const, label: "All", icon: Squares2X2OutlineIcon },
      { id: "images" as const, label: "Images", icon: PhotoIcon },
      { id: "videos" as const, label: "Videos", icon: VideoCameraIcon },
      { id: "music" as const, label: "Music", icon: MusicalNoteIcon },
    ],
    [],
  )

  const filtered = React.useMemo(
    () => assets.filter((asset) => matchesFilter(asset.kind, activeFilter)),
    [assets, activeFilter],
  )

  const columnItems = React.useMemo(() => {
    const cols: RunAsset[][] = Array.from({ length: columns }, () => [])
    filtered.forEach((asset, index) => cols[index % columns].push(asset))
    return cols
  }, [filtered, columns])

  return (
    <div
      aria-hidden={!isOpen}
      className={cn(
        "fixed inset-y-3 right-0 z-50 flex w-[clamp(640px,56vw,1100px)] max-w-[96vw] flex-col overflow-hidden rounded-l-[20px] bg-[rgba(24,24,27,0.92)] text-[#f4f4f5] backdrop-blur-[72px] transition-transform duration-300 ease-out will-change-transform",
        isOpen ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <Squares2X2Icon className="h-4 w-4 text-[#f4f4f5]/70" />
          <h2 className="text-[15px] font-semibold text-[#f4f4f5]">Generations</h2>
          {assets.length > 0 && (
            <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[#f4f4f5]/70">
              {assets.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#27272a]/60 text-[#f4f4f5]/70 transition-colors hover:bg-[#27272a] hover:text-[#f4f4f5]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-5 pb-3">
        <div className="flex items-center gap-1">
          {filters.map((filter) => {
            const isActive = filter.id === activeFilter
            const Icon = filter.icon
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors",
                  isActive ? "bg-[#27272a] text-[#f4f4f5]" : "text-[#71717a] hover:text-[#d4d4d8]",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {filter.label}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2 text-[11px] text-[#71717a]">
          <Squares2X2OutlineIcon className="h-3.5 w-3.5" aria-hidden />
          <input
            type="range"
            min={2}
            max={6}
            step={1}
            value={columns}
            onChange={(e) => setColumns(Number(e.target.value))}
            className="w-24 cursor-pointer accent-zinc-400"
          />
          <span>{columns}</span>
        </div>
      </div>

      {/* Content */}
      <div className="scrollbar-hide relative min-h-0 flex-1 overflow-auto px-4 pb-6">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-[#f4f4f5]/55">No generations yet</div>
        ) : (
          <div className="flex w-full items-start gap-2">
            {columnItems.map((column, columnIndex) => (
              <div key={columnIndex} className="flex min-w-0 flex-1 flex-col gap-2">
                {column.map((asset) => (
                  <AssetTile
                    key={asset.id}
                    asset={asset}
                    onDelete={asset.deletable === false ? undefined : onDeleteAsset}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
