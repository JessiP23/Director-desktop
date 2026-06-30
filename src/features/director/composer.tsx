import * as React from "react";
import { Icon, IconButton, Spinner, Tooltip } from "@/components/ui";
import type { DirectorQuality, DirectorReference } from "@/lib/director/contract/director";
import { cn } from "@/lib/utils/cn";
import { uploadAttachments } from "./editor/lib/upload-attachments";
import type { UploadedReference } from "./editor/components/editor-view";

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(Math.round(n)));

const TYPEWRITER_EXAMPLES = [
  "Create a 15-second social spot for a fintech startup",
  "Generate 10 lifestyle images for a premium gym",
  "Write 3 taglines for an urban sneaker launch",
  "Turn the brief into a cinematic storyboard",
  "Mood board fall fashion: dark, cinematic tone",
] as const;

const COMPOSER_ATTACHMENT_LIMIT = 8;
const ATTACHMENT_ACCEPT = "image/*,video/*,audio/*,.pdf,.txt,.md,.doc,.docx,.ppt,.pptx";

type ComposerAttachment = {
  id: string;
  file: File;
  status: "uploading" | "ready" | "error";
  reference?: DirectorReference;
  error?: string;
};

function createAttachment(file: File): ComposerAttachment {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${file.name}-${file.size}-${Date.now()}`,
    file,
    status: "uploading",
  };
}

function normalizeUploadedReference(reference: UploadedReference | undefined): DirectorReference | null {
  if (!reference?.url) return null;
  const allowedTypes = new Set<DirectorReference["type"]>(["image", "video", "audio", "document", "url"]);
  const type = allowedTypes.has(reference.type as DirectorReference["type"]) ? (reference.type as DirectorReference["type"]) : "document";
  return {
    id: reference.id || reference.url,
    type,
    url: reference.url,
    name: reference.name,
  };
}

function useTypewriterPlaceholder(examples: readonly string[], paused: boolean) {
  const [text, setText] = React.useState(examples[0] ?? "");

  React.useEffect(() => {
    if (paused || examples.length === 0) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    let exampleIndex = 0;
    let charIndex = examples[0].length;
    let phase: "pause-full" | "deleting" | "pause-empty" | "typing" = "pause-full";

    const tick = () => {
      const current = examples[exampleIndex];
      if (phase === "pause-full") {
        phase = "deleting";
        timeoutId = setTimeout(tick, 1600);
        return;
      }
      if (phase === "deleting") {
        charIndex = Math.max(0, charIndex - 1);
        setText(current.slice(0, charIndex));
        if (charIndex === 0) {
          phase = "pause-empty";
          timeoutId = setTimeout(tick, 380);
        } else {
          timeoutId = setTimeout(tick, 18);
        }
        return;
      }
      if (phase === "pause-empty") {
        exampleIndex = (exampleIndex + 1) % examples.length;
        charIndex = 0;
        phase = "typing";
        timeoutId = setTimeout(tick, 80);
        return;
      }
      const next = examples[exampleIndex];
      charIndex = Math.min(next.length, charIndex + 1);
      setText(next.slice(0, charIndex));
      if (charIndex === next.length) {
        phase = "pause-full";
        timeoutId = setTimeout(tick, 1600);
      } else {
        timeoutId = setTimeout(tick, 32);
      }
    };

    timeoutId = setTimeout(tick, 1600);
    return () => clearTimeout(timeoutId);
  }, [examples, paused]);

  return text;
}

/** Context-window usage ring (estimated tokens vs the agent's history budget),
 *  mirroring the web app. Turns amber near the limit, red when full. */
function ContextRing({ used, budget }: { used: number; budget: number }) {
  const frac = Math.min(used / Math.max(budget, 1), 1);
  const r = 7;
  const c = 2 * Math.PI * r;
  const color = frac >= 1 ? "#f87171" : frac >= 0.8 ? "#e6b15a" : "#71717a";
  return (
    <Tooltip label={`Context: ${fmt(used)} / ${fmt(budget)} tokens — older turns roll into the production summary`}>
      <span className="flex items-center gap-1.5 pr-0.5 text-[11px] tabular-nums" style={{ color }}>
        <svg width="18" height="18" viewBox="0 0 18 18" className="-rotate-90">
          <circle cx="9" cy="9" r={r} fill="none" stroke="rgba(244,244,245,0.14)" strokeWidth="2" />
          <circle cx="9" cy="9" r={r} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
        </svg>
        {fmt(used)}
      </span>
    </Tooltip>
  );
}

function AutoQualityLabel({ quality }: { quality: DirectorQuality }) {
  if (quality !== "premium") {
    return <span className="font-semibold text-zinc-100/55">Auto</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 font-semibold">
      <span className="text-zinc-100/55">Auto</span>
      <span
        className={cn(
          "inline-block bg-clip-text text-transparent motion-reduce:animate-none",
          "bg-[length:300%_100%] animate-[director-max-label-shimmer_7s_ease-in-out_infinite]",
          "bg-[linear-gradient(90deg,rgba(244,244,245,0.68),rgba(255,255,255,1),rgba(244,244,245,0.68))]",
        )}
      >
        Max
      </span>
    </span>
  );
}

function AutoQualitySelect({
  quality,
  onChange,
  disabled,
  direction = "down",
}: {
  quality: DirectorQuality;
  onChange: (value: DirectorQuality) => void;
  disabled?: boolean;
  direction?: "up" | "down";
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const options = [
    { value: "economic", label: "Auto", description: "Fast default generation" },
    { value: "premium", label: "Auto Max", description: "Higher-quality generation" },
  ] as const;

  return (
    <div ref={wrapperRef} className="relative">
      <Tooltip label="Auto mode">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((current) => !current)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-xs transition-colors duration-150 ease-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
            isOpen ? "bg-zinc-100/10 text-zinc-100" : "text-zinc-300 hover:bg-zinc-100/10 hover:text-zinc-100",
          )}
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          <AutoQualityLabel quality={quality} />
          <Icon name="chevronDown" size={12} className="text-zinc-400" />
        </button>
      </Tooltip>
      {isOpen && (
        <div
          style={{ backgroundColor: "#18181b" }}
          className={cn(
            "absolute left-0 z-30 w-64 overflow-hidden rounded-[14px] border border-zinc-800 shadow-2xl",
            direction === "up" ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
          role="menu"
          aria-label="Auto mode"
        >
          <ul className="px-1.5 py-1">
            {options.map((option) => {
              const isActive = option.value === quality;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-[10px] px-3 py-2.5 text-left transition-colors duration-150 ease-out",
                      isActive ? "text-zinc-100" : "text-zinc-400 hover:bg-zinc-100/10 hover:text-zinc-200",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{option.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-zinc-500">
                        {option.description}
                      </span>
                    </span>
                    {isActive && <Icon name="check" size={16} className="mt-0.5 shrink-0 text-zinc-100" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function AttachmentChip({ attachment, onRemove }: { attachment: ComposerAttachment; onRemove: () => void }) {
  const { file, status, error } = attachment;
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const previewUrl = React.useMemo(() => (isImage || isVideo ? URL.createObjectURL(file) : null), [file, isImage, isVideo]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div
      className={cn(
        "group relative h-14 w-14 overflow-visible rounded-[12px] border p-0.5 shadow-sm transition-all",
        status === "error" ? "border-red-400/55 bg-red-500/10" : "border-zinc-100/10 bg-zinc-100/8 hover:bg-zinc-100/10",
      )}
      title={error ? `${file.name} · ${error}` : file.name}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[10px] bg-zinc-900/50 shadow-inner">
        {status === "uploading" ? (
          <div className="absolute inset-0 overflow-hidden rounded-[10px] bg-[#242427]/70">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
          </div>
        ) : isImage && previewUrl ? (
          <img src={previewUrl} alt={file.name} className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
        ) : isVideo && previewUrl ? (
          <video src={previewUrl} muted playsInline className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-zinc-200/70">
            <Icon name={isVideo ? "video" : isImage ? "image" : "document"} size={16} />
            <span className="w-full truncate text-center text-[8px] font-medium leading-none text-zinc-300/55">{file.name}</span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-950/60 text-red-100">
            <Icon name="close" size={16} />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className={cn(
          "absolute -right-1.5 -top-1.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-black/60 text-zinc-100/90 shadow-lg opacity-0 transition hover:bg-red-500/90 hover:text-white group-hover:opacity-100",
          status === "error" && "opacity-100",
        )}
      >
        <Icon name="close" size={10} />
      </button>
    </div>
  );
}

/**
 * The prompt input. Auto-grows, submits on Enter (Shift+Enter for newline),
 * and disables while the run is responding. Attachments/drag-drop are a planned
 * enhancement (the backend already accepts references via the API).
 */
export function Composer({
  onSend,
  disabled,
  busy,
  onCancel,
  placeholder = "Describe the production you want to create…",
  contextUsage,
  quality = "premium",
  onQualityChange,
  qualitySelectDirection = "down",
  variant = "default",
}: {
  onSend: (text: string, references?: DirectorReference[]) => void;
  disabled?: boolean;
  busy?: boolean;
  onCancel?: () => void;
  placeholder?: string;
  contextUsage?: { usedTokens: number; budgetTokens: number };
  quality?: DirectorQuality;
  onQualityChange?: (value: DirectorQuality) => void;
  qualitySelectDirection?: "up" | "down";
  variant?: "default" | "web";
}) {
  const [value, setValue] = React.useState("");
  const [attachments, setAttachments] = React.useState<ComposerAttachment[]>([]);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const animatedPlaceholder = useTypewriterPlaceholder(TYPEWRITER_EXAMPLES, variant !== "web" || value.length > 0);
  const uploadingAttachments = attachments.some((attachment) => attachment.status === "uploading");
  const failedAttachments = attachments.some((attachment) => attachment.status === "error");
  const readyReferences = attachments
    .map((attachment) => attachment.reference)
    .filter((reference): reference is DirectorReference => Boolean(reference));
  const sendBlocked = disabled || !value.trim() || uploadingAttachments || failedAttachments;

  const resize = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  function submit() {
    const text = value.trim();
    if (!text || sendBlocked) return;
    onSend(text, readyReferences);
    setValue("");
    setAttachments([]);
    requestAnimationFrame(resize);
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }

  function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    const availableSlots = Math.max(0, COMPOSER_ATTACHMENT_LIMIT - attachments.length);
    const acceptedFiles = files.slice(0, availableSlots);
    if (acceptedFiles.length === 0) return;

    const pendingAttachments = acceptedFiles.map(createAttachment);
    setAttachments((current) => [...current, ...pendingAttachments]);

    for (const attachment of pendingAttachments) {
      void uploadAttachments([attachment.file])
        .then((references) => {
          const reference = normalizeUploadedReference(references[0]);
          if (!reference) throw new Error("Upload returned no reference");
          setAttachments((current) =>
            current.map((item) =>
              item.id === attachment.id ? { ...item, status: "ready", reference, error: undefined } : item,
            ),
          );
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : "Failed to upload reference";
          setAttachments((current) =>
            current.map((item) =>
              item.id === attachment.id ? { ...item, status: "error", error: message } : item,
            ),
          );
        });
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  if (variant === "web") {
    return (
      <div className="rounded-[26px] bg-[#1f1f22] shadow-[inset_0_1px_0_rgba(244,244,245,0.035)]">
        {attachments.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-3 pb-1 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {attachments.map((attachment) => (
              <AttachmentChip key={attachment.id} attachment={attachment} onRemove={() => removeAttachment(attachment.id)} />
            ))}
          </div>
        )}
        <div className="relative px-5 pt-3">
          <textarea
            ref={ref}
            rows={1}
            value={value}
            placeholder={animatedPlaceholder || placeholder}
            disabled={disabled && !busy}
            onChange={(e) => {
              setValue(e.target.value);
              resize();
            }}
            onKeyDown={onKeyDown}
            className="block max-h-60 min-h-[44px] w-full resize-none bg-transparent text-[14px] leading-6 text-zinc-100 outline-none placeholder:text-zinc-400 disabled:opacity-60"
          />
        </div>
        <div className="relative flex items-center gap-1.5 px-3 pb-3 pt-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              multiple
              className="hidden"
              onChange={(event) => {
                handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <Tooltip label="Attach files">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || busy || attachments.length >= COMPOSER_ATTACHMENT_LIMIT}
                aria-label="Attach files"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-100 transition-colors hover:bg-zinc-700 disabled:pointer-events-none disabled:opacity-45"
              >
                <Icon name="add" size={16} />
              </button>
            </Tooltip>
            {onQualityChange && (
              <AutoQualitySelect quality={quality} onChange={onQualityChange} disabled={disabled || busy} direction={qualitySelectDirection} />
            )}
            {contextUsage && contextUsage.usedTokens > 0 && (
              <ContextRing used={contextUsage.usedTokens} budget={contextUsage.budgetTokens} />
            )}
          </div>
          <div className="flex-1" />
          {busy && onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-8 w-8 min-w-8 items-center justify-center rounded-full bg-zinc-100 p-0 text-zinc-950 shadow-[0_4px_16px_-8px_rgba(244,244,245,0.65)] transition-all hover:bg-white active:scale-[0.95]"
              aria-label="Cancel"
            >
              <span className="h-3 w-3 rounded-[2px] bg-zinc-950" aria-hidden="true" />
            </button>
          ) : busy ? (
            <span className="grid h-8 w-8 shrink-0 place-items-center">
              <Spinner className="size-4 text-[#a1a1aa]" />
            </span>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={sendBlocked}
              className="inline-flex h-8 w-8 min-w-8 items-center justify-center rounded-full bg-zinc-100 p-0 text-zinc-950 shadow-[0_4px_16px_-8px_rgba(244,244,245,0.65)] transition-all hover:bg-white active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="Send"
            >
              <Icon name="send" size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 px-4 py-3.5 shadow-[inset_0_0.5px_0_var(--separator)]">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-separator bg-surface-1 px-3 py-2 shadow-sm transition-colors focus-within:border-accent/60">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            resize();
          }}
          onKeyDown={onKeyDown}
          className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-sm text-text outline-none placeholder:text-text-quaternary"
        />
        {contextUsage && contextUsage.usedTokens > 0 && (
          <span className="mb-1 self-center">
            <ContextRing used={contextUsage.usedTokens} budget={contextUsage.budgetTokens} />
          </span>
        )}
        {onQualityChange && (
          <span className="mb-0.5 self-center">
            <AutoQualitySelect quality={quality} onChange={onQualityChange} disabled={disabled || busy} direction={qualitySelectDirection} />
          </span>
        )}
        {busy ? (
          <span className="grid size-8 place-items-center">
            <Spinner className="size-4 text-text-tertiary" />
          </span>
        ) : (
          <IconButton
            name="send"
            label="Send"
            variant="secondary"
            onClick={submit}
            disabled={disabled || !value.trim()}
            className="bg-accent text-accent-fg hover:bg-accent-hover disabled:bg-fill disabled:text-text-quaternary"
          />
        )}
      </div>
    </div>
  );
}
