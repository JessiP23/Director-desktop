"use client"

import * as React from "react"
import { Paperclip, X, ChevronDown, Sparkles, Image, Video, Music } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { DirectorQuality } from "@/lib/director/contract/director"

export type ComposerAttachmentStatus = "uploading" | "ready" | "error"

export type ComposerAttachment = {
  id: string
  file: File
  status: ComposerAttachmentStatus
  error?: string
  reference?: {
    id: string
    type: string
    url?: string
    name?: string
  }
}

export type ComposerMentionAsset = {
  id: string
  kind: "image" | "video" | "audio"
  source: "approved" | "upload"
  label: string
  url: string
  prompt?: string
}

export const COMPOSER_ATTACHMENT_LIMIT = 8

export function createComposerAttachment(file: File, status: ComposerAttachmentStatus = "uploading"): ComposerAttachment {
  const randomId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return {
    id: `attachment-${Date.now()}-${randomId}`,
    file,
    status,
  }
}

type AdvancedComposerProps = {
  prompt: string
  onPromptChange: (value: string) => void
  model: string
  onModelChange: (value: string) => void
  attachments: ComposerAttachment[]
  onAttachmentsAdd: (files: File[]) => void
  onAttachmentRemove: (id: string) => void
  onSubmit: () => void
  isSubmitting: boolean
  disabled: boolean
  composerRef: React.RefObject<HTMLTextAreaElement | null>
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  autoProceed?: boolean
  onAutoProceedChange?: (value: boolean) => void
  quality?: DirectorQuality
  onQualityChange?: (value: DirectorQuality) => void
  selectedMentionAssets?: ComposerMentionAsset[]
  onMentionAssetRemove?: (assetId: string) => void
}

const MODEL_OPTIONS = [
  { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", provider: "anthropic" },
  { id: "gpt-4o", label: "GPT-4o", provider: "openai" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", provider: "google" },
]

export function AdvancedComposer({
  prompt,
  onPromptChange,
  model,
  onModelChange,
  attachments,
  onAttachmentsAdd,
  onAttachmentRemove,
  onSubmit,
  isSubmitting,
  disabled,
  composerRef,
  onKeyDown,
  placeholder = "Describe the production you want to create…",
  autoProceed = false,
  onAutoProceedChange,
  quality = "premium",
  onQualityChange,
  selectedMentionAssets = [],
  onMentionAssetRemove,
}: AdvancedComposerProps) {
  const [modelOpen, setModelOpen] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) {
      onAttachmentsAdd(files)
    }
    event.target.value = ""
  }

  const remainingSlots = COMPOSER_ATTACHMENT_LIMIT - attachments.length

  return (
    <div className="relative">
      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="group relative flex items-center gap-2 rounded-lg bg-zinc-800/50 px-2 py-1 text-sm"
            >
              <Paperclip className="h-3 w-3 text-zinc-400" />
              <span className="max-w-[120px] truncate text-zinc-300">{attachment.file.name}</span>
              {attachment.status === "uploading" && (
                <div className="h-3 w-3 animate-spin rounded-full border border-zinc-500 border-t-transparent" />
              )}
              {attachment.status === "error" && (
                <span className="text-xs text-red-400">Error</span>
              )}
              <button
                type="button"
                onClick={() => onAttachmentRemove(attachment.id)}
                className="ml-1 rounded-full p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Selected mentions */}
      {selectedMentionAssets.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedMentionAssets.map((asset) => (
            <div
              key={asset.id}
              className="group relative flex items-center gap-2 rounded-lg bg-zinc-800/50 px-2 py-1 text-sm"
            >
              {asset.kind === "image" && <Image className="h-3 w-3 text-zinc-400" />}
              {asset.kind === "video" && <Video className="h-3 w-3 text-zinc-400" />}
              {asset.kind === "audio" && <Music className="h-3 w-3 text-zinc-400" />}
              <span className="max-w-[120px] truncate text-zinc-300">{asset.label}</span>
              <button
                type="button"
                onClick={() => onMentionAssetRemove?.(asset.id)}
                className="ml-1 rounded-full p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer input */}
      <div className="relative rounded-[30px] bg-[rgba(39,39,42,0.62)] p-1 shadow-[0_18px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-[10px] backdrop-saturate-150">
        <div className="flex items-end gap-2">
          {/* Attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || remainingSlots <= 0}
            className={cn(
              "mb-2.5 ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
              disabled || remainingSlots <= 0
                ? "cursor-not-allowed text-zinc-600"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800",
            )}
            title={remainingSlots > 0 ? `Attach file (${remainingSlots} remaining)` : "Attachment limit reached"}
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Textarea */}
          <textarea
            ref={composerRef}
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="min-h-[44px] flex-1 resize-none bg-transparent py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            style={{ fieldSizing: "content" }}
          />

          {/* Model selector */}
          <div className="relative mb-2.5 mr-2">
            <button
              type="button"
              onClick={() => setModelOpen(!modelOpen)}
              disabled={disabled}
              className="flex items-center gap-1.5 rounded-full bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" />
              <span>{MODEL_OPTIONS.find((m) => m.id === model)?.label || "Model"}</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {modelOpen && (
              <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-lg bg-zinc-900 p-1 shadow-xl ring-1 ring-white/10">
                {MODEL_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onModelChange(option.id)
                      setModelOpen(false)
                    }}
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left text-xs transition-colors",
                      model === option.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quality toggle */}
          {onQualityChange && (
            <button
              type="button"
              onClick={() => onQualityChange(quality === "premium" ? "economic" : "premium")}
              disabled={disabled}
              className={cn(
                "mb-2.5 mr-2 flex h-8 shrink-0 items-center justify-center rounded-full px-3 text-xs font-medium transition-colors",
                quality === "premium"
                  ? "bg-zinc-100 text-zinc-950"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {quality === "premium" ? "Auto Max" : "Auto"}
            </button>
          )}

          {/* Auto-proceed toggle */}
          {onAutoProceedChange && (
            <button
              type="button"
              onClick={() => onAutoProceedChange(!autoProceed)}
              disabled={disabled}
              className={cn(
                "mb-2.5 mr-2 flex h-8 shrink-0 items-center justify-center rounded-full px-3 text-xs font-medium transition-colors",
                autoProceed
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              title="Auto-proceed through generations"
            >
              Auto
            </button>
          )}

          {/* Send button */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled || !prompt.trim() || isSubmitting}
            className={cn(
              "mb-2.5 mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
              disabled || !prompt.trim()
                ? "cursor-not-allowed bg-zinc-800 text-zinc-600"
                : "bg-zinc-100 text-zinc-950 hover:bg-white",
            )}
          >
            {isSubmitting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-4 w-4"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
