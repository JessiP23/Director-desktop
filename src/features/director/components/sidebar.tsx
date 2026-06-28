"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { RocketLaunchIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { cn } from "@/lib/utils/cn"
import type { DirectorRun } from "@/lib/director/contract/director"
import { iconForConversation } from "../lib/conversation-icons"
import { useUserPlan } from "@/features/auth/auth-context"
import { openUrl } from "@tauri-apps/plugin-opener"

type DirectorSidebarProps = {
  recentRuns: DirectorRun[]
  isLoadingRuns: boolean
  loadingRunId: string | null
  deletingRunId: string | null
  selectedRunId?: string
  onSelectRun: (runId: string) => void
  onDeleteRun: (runId: string) => void
  onNewProduction: () => void
}

const directorSidebarTheme = {
  "--sidebar-width": "14rem",
  "--sidebar": "#18181b",
  "--sidebar-foreground": "#71717a",
  "--sidebar-border": "rgba(39, 39, 42, 0.72)",
  "--sidebar-accent": "rgba(39, 39, 42, 0.86)",
  "--sidebar-accent-foreground": "#a1a1aa",
  "--sidebar-ring": "#71717a",
} as React.CSSProperties

const DIRECTOR_CTA_GRAIN_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='linear' slope='2.4' intercept='-0.45'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`
const DIRECTOR_CTA_GRAIN_URL = `url("data:image/svg+xml,${encodeURIComponent(DIRECTOR_CTA_GRAIN_SVG)}")`

export function DirectorSidebar({
  recentRuns,
  isLoadingRuns,
  loadingRunId,
  deletingRunId,
  selectedRunId,
  onSelectRun,
  onDeleteRun,
  onNewProduction,
}: DirectorSidebarProps) {
  return (
    <div
      style={directorSidebarTheme}
      className="flex h-full w-[14rem] flex-col border-r border-zinc-800 bg-zinc-900"
    >
      {/* Logo */}
      <div className="px-4 py-6">
        <img
          src="/wm.svg"
          alt="WM Studio"
          className="h-28 w-28"
          draggable={false}
        />
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-2">
        <button
          type="button"
          onClick={onNewProduction}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-all duration-200 hover:bg-white/4 hover:text-zinc-200"
        >
          <Plus className="h-4 w-4" />
          <span>New Production</span>
        </button>

        <div className="my-2 h-px bg-zinc-800" />

        <div className="px-2 py-1">
          <span className="text-[11px] font-medium tracking-wider text-zinc-500">Recent</span>
        </div>

        <RecentRunsList
          recentRuns={recentRuns}
          isLoadingRuns={isLoadingRuns}
          loadingRunId={loadingRunId}
          deletingRunId={deletingRunId}
          selectedRunId={selectedRunId}
          onSelectRun={onSelectRun}
          onDeleteRun={onDeleteRun}
        />
      </div>

      {/* CTA Card */}
      <div className="px-2 pb-2">
        <SidebarCtaCard />
      </div>
    </div>
  )
}

function SidebarCtaCard() {
  const { plan } = useUserPlan();
  const isPro = plan === "pro";

  if (isPro) return null;

  const handleUpgrade = async () => {
    try {
      await openUrl("https://wmstudio.io/dashboard/credits");
    } catch (error) {
      console.error("Failed to open URL:", error);
    }
  };

  return (
    <button
      type="button"
      onClick={handleUpgrade}
      className="group relative isolate w-full overflow-hidden rounded-xl bg-blue-600 px-3 py-3.5 text-left shadow-lg transition-all duration-300 hover:bg-blue-500 hover:shadow-xl"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/18 via-white/3 to-black/20" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-13 mix-blend-overlay"
        style={{ backgroundImage: DIRECTOR_CTA_GRAIN_URL, backgroundSize: "140px 140px" }}
      />
      <div className="relative z-10 mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/88">
          <RocketLaunchIcon className="h-3.5 w-3.5 shrink-0 text-white" />
          <span className="truncate">Pro Plan</span>
        </span>
        <span className="shrink-0 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white ring-1 ring-white/15">
          -40%
        </span>
      </div>

      <div className="relative z-10 space-y-1">
        <p className="text-[13px] font-semibold leading-tight text-white">Upgrade to Pro</p>
        <p className="text-[11px] leading-4 text-white/80">Get more credits and features</p>
      </div>

      <div className="relative z-10 mt-3 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[10px] leading-3 text-white/65">Limited time offer</span>
        <span className="inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded-md bg-white px-2 text-[11px] font-semibold text-blue-600 transition-colors group-hover:bg-white/90">
          <span>Upgrade</span>
        </span>
      </div>
    </button>
  )
}

function RecentRunsList({
  recentRuns,
  isLoadingRuns,
  loadingRunId,
  deletingRunId,
  selectedRunId,
  onSelectRun,
  onDeleteRun,
}: {
  recentRuns: DirectorRun[]
  isLoadingRuns: boolean
  loadingRunId: string | null
  deletingRunId: string | null
  selectedRunId?: string
  onSelectRun: (runId: string) => void
  onDeleteRun: (runId: string) => void
}) {
  if (recentRuns.length === 0 && isLoadingRuns) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-10 animate-pulse rounded-lg bg-zinc-800 transition-all duration-300"
            style={{ animationDelay: `${index * 100}ms` }}
          />
        ))}
      </div>
    )
  }

  if (recentRuns.length === 0) {
    return (
      <div className="px-2 py-6 text-center">
        <p className="text-sm font-medium text-zinc-400">No productions yet</p>
        <p className="mt-0.5 text-xs text-zinc-500">Start by creating a new production</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {recentRuns.map((recentRun) => {
        const isSelected = selectedRunId === recentRun.id
        const isLoadingThisRun = loadingRunId === recentRun.id
        const isDeletingThisRun = deletingRunId === recentRun.id
        const ConversationIcon = iconForConversation(recentRun.id, recentRun.metadata?.conversationIcon)
        
        return (
          <div key={recentRun.id} className="group relative flex items-center">
            <button
              type="button"
              onClick={() => onSelectRun(recentRun.id)}
              disabled={isLoadingThisRun || isDeletingThisRun}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-all duration-200 hover:bg-white/4 hover:text-zinc-200",
                isSelected && "bg-white/8 text-zinc-200",
                (isLoadingThisRun || isDeletingThisRun) && "opacity-50",
              )}
            >
              <ConversationIcon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">{recentRun.title || "Untitled production"}</span>
            </button>
            
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onDeleteRun(recentRun.id)
              }}
              disabled={isLoadingThisRun || isDeletingThisRun}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100 disabled:opacity-0"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
