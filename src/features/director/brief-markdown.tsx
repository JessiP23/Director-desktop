import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Spinner } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import type { DirectorScriptImage } from "@/lib/director/contract/brief";

const IMG_URL = /\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i;

/** Rendered brief markdown; inline images open the lightbox via `onImageClick`. */
export function BriefMarkdown({ text, onImageClick }: { text: string; onImageClick?: (url: string) => void }) {
  const components = React.useMemo<React.ComponentProps<typeof ReactMarkdown>["components"]>(
    () => ({
      p: ({ children }) => <p className="mb-2 text-[13px] leading-relaxed text-text-secondary last:mb-0">{children}</p>,
      img: ({ src }) => (src ? <InlineImage url={String(src)} onClick={onImageClick} /> : null),
      a: ({ children, href }) =>
        href && IMG_URL.test(href) ? (
          <InlineImage url={href} onClick={onImageClick} />
        ) : (
          <a href={href} target="_blank" rel="noreferrer" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
            {children}
          </a>
        ),
      strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4 text-[13px] text-text-secondary last:mb-0">{children}</ul>,
      ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-4 text-[13px] text-text-secondary last:mb-0">{children}</ol>,
      h1: ({ children }) => <h3 className="mb-1 mt-3 text-sm font-semibold text-text first:mt-0">{children}</h3>,
      h2: ({ children }) => <h4 className="mb-1 mt-3 text-[13px] font-semibold text-text first:mt-0">{children}</h4>,
      hr: () => <hr className="my-3 border-separator" />,
      code: ({ children }) => <code className="rounded bg-fill px-1 py-0.5 font-mono text-[0.85em] text-text">{children}</code>,
    }),
    [onImageClick],
  );
  return (
    <div className="min-w-0 break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function InlineImage({ url, onClick }: { url: string; onClick?: (url: string) => void }) {
  return (
    <button type="button" onClick={() => onClick?.(url)} className="my-2 block w-fit max-w-full cursor-zoom-in">
      <img src={url} alt="" loading="lazy" decoding="async" className="block h-auto max-h-[220px] w-auto max-w-full rounded-[10px] object-contain" />
    </button>
  );
}

/** An approved keyframe with a two-step delete (arm, then confirm). */
export function ScriptFrameCard({
  image,
  deleting,
  onDelete,
  onOpen,
}: {
  image: DirectorScriptImage;
  deleting: boolean;
  onDelete: () => void;
  onOpen: (url: string) => void;
}) {
  const [confirming, setConfirming] = React.useState(false);
  React.useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-semibold text-text">{image.scriptReference}</span>
        <button
          type="button"
          disabled={deleting}
          onClick={() => (confirming ? onDelete() : setConfirming(true))}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50",
            confirming ? "bg-danger/15 text-danger hover:bg-danger/25" : "text-text-tertiary hover:bg-fill hover:text-text",
          )}
        >
          {deleting ? <Spinner className="size-3" /> : <span aria-hidden>✕</span>}
          {confirming && !deleting ? "Confirm" : null}
        </button>
      </div>
      <div className="mt-2 flex items-start gap-3">
        <button type="button" onClick={() => onOpen(image.url)} className="w-[110px] shrink-0 cursor-zoom-in">
          <img src={image.url} alt={image.scriptReference} loading="lazy" decoding="async" className="block h-auto w-full rounded-lg object-contain" />
        </button>
        {image.prompt && <p className="text-[12px] italic leading-relaxed text-text-tertiary">{image.prompt}</p>}
      </div>
    </div>
  );
}
