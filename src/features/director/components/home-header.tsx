"use client"

import * as React from "react"
import { InformationCircleIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { HomeIcon } from "@heroicons/react/24/solid"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils/cn"

type HomeHeaderProps = {
  conversationTitle?: string
  isSavingConversationTitle?: boolean
  conversationIcon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  onConversationTitleChange?: (title: string) => Promise<void> | void
  centerSlot?: React.ReactNode
  rightAction?: React.ReactNode
  showHomeLink?: boolean
  onHomeClick?: () => void
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
}

export function HomeHeader({
  conversationTitle,
  conversationIcon: ConversationIcon,
  isSavingConversationTitle = false,
  onConversationTitleChange,
  centerSlot,
  rightAction,
  showHomeLink = true,
  onHomeClick,
  onToggleSidebar,
  sidebarCollapsed = false,
}: HomeHeaderProps) {
  const [showCreditsNotice, setShowCreditsNotice] = React.useState(true)
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [draftTitle, setDraftTitle] = React.useState(conversationTitle || "")
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const hasConversationTitle = Boolean(conversationTitle?.trim())
  const canEditConversationTitle = hasConversationTitle && Boolean(onConversationTitleChange)

  React.useEffect(() => {
    if (isEditingTitle) return
    setDraftTitle(conversationTitle || "")
  }, [conversationTitle, isEditingTitle])

  React.useEffect(() => {
    if (!isEditingTitle) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditingTitle])

  const saveConversationTitle = async () => {
    if (!canEditConversationTitle) return
    const nextTitle = draftTitle.trim()
    if (!nextTitle) {
      setDraftTitle(conversationTitle || "")
      setIsEditingTitle(false)
      return
    }
    if (nextTitle === conversationTitle) {
      setIsEditingTitle(false)
      return
    }
    try {
      await onConversationTitleChange?.(nextTitle)
      setIsEditingTitle(false)
    } catch {
      // Keep the input open so the user can retry after the parent surfaces the error.
    }
  }

  return (
    <div className="absolute inset-x-0 top-0 z-50 flex h-9 items-center justify-between bg-[#141416] px-3 sm:px-4">
      {onToggleSidebar && (
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#52525b] transition-colors hover:bg-[#27272a]/60 hover:text-[#d4d4d8]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/director/sidebar.png"
            alt=""
            aria-hidden="true"
            className={cn(
              "h-4 w-4 object-contain opacity-70 invert transition duration-200 group-hover:opacity-95",
              sidebarCollapsed && "scale-x-[-1]",
            )}
          />
        </button>
      )}

      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="pointer-events-auto flex min-w-0 max-w-[calc(100vw-12rem)] items-center justify-center">
        {centerSlot ? (
          centerSlot
        ) : hasConversationTitle ? (
          <div className="flex h-9 min-w-0 max-w-full items-center justify-center px-2 text-center">
            {isEditingTitle ? (
              <input
                ref={inputRef}
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={() => void saveConversationTitle()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void saveConversationTitle()
                  }
                  if (event.key === "Escape") {
                    event.preventDefault()
                    setDraftTitle(conversationTitle || "")
                    setIsEditingTitle(false)
                  }
                }}
                maxLength={120}
                disabled={isSavingConversationTitle}
                aria-label="Rename conversation"
                className="h-8 w-[min(520px,70vw)] rounded-full border border-white/[0.08] bg-[rgba(39,39,42,0.85)] px-3 text-center text-[13px] font-medium leading-none text-[#f4f4f5] outline-none backdrop-blur-[24px] transition focus:border-white/[0.2] disabled:opacity-60"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (canEditConversationTitle) setIsEditingTitle(true)
                }}
                disabled={!canEditConversationTitle || isSavingConversationTitle}
                title={canEditConversationTitle ? "Rename conversation" : undefined}
                className={cn(
                  "group inline-flex h-8 max-w-[min(520px,100%)] items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-medium leading-none text-[#d4d4d8] transition-colors",
                  canEditConversationTitle && "hover:bg-[#27272a]/60 hover:text-[#f4f4f5]",
                  !canEditConversationTitle && "cursor-default",
                )}
              >
                {ConversationIcon && (
                  <ConversationIcon className="h-4 w-4 shrink-0 text-[#71717a] transition-colors group-hover:text-[#f4f4f5]" />
                )}
                <span className="min-w-0 truncate">{conversationTitle}</span>
                {isSavingConversationTitle && (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[#52525b]" />
                )}
              </button>
            )}
          </div>
        ) : showCreditsNotice ? (
          <div className="flex h-9 min-w-0 items-center gap-1.5 text-[11px] leading-4 text-[#52525b]">
            <InformationCircleIcon className="h-3.5 w-3.5 shrink-0 stroke-1" />
            <span className="truncate">Credits apply to all generations</span>
            <button
              type="button"
              onClick={() => setShowCreditsNotice(false)}
              aria-label="Dismiss"
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[#3f3f46] transition-colors hover:text-[#a1a1aa]"
            >
              <XMarkIcon className="h-3.5 w-3.5 stroke-1" />
            </button>
          </div>
        ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2">
        {rightAction}
        {showHomeLink && onHomeClick && (
          <button
            type="button"
            onClick={onHomeClick}
            aria-label="Home"
            className={cn(
              "inline-flex h-8 items-center justify-center gap-2 rounded-full bg-[#27272a]/60 px-3 text-[13px] font-medium leading-none text-[#a1a1aa] transition-colors hover:bg-[#27272a] hover:text-[#f4f4f5]",
              hasConversationTitle && "px-2 sm:px-3",
            )}
          >
            <HomeIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Home</span>
          </button>
        )}
      </div>
    </div>
  )
}
