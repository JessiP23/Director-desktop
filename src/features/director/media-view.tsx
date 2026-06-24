import * as React from "react";
import type { GenerationResultKind } from "@/lib/director/stream";
import { config } from "@/lib/config";

export function proxiedMediaUrl(url: string): string {
  if (!/^https:\/\//i.test(url)) return url;
  if (url.startsWith(`${config.apiBaseUrl}/api/editor/media-proxy`)) return url;
  return `${config.apiBaseUrl}/api/editor/media-proxy?url=${encodeURIComponent(url)}`;
}

/**
 * Renders a generated asset. Images open a full-screen lightbox on click;
 * video and audio get native players. Used by generation cards and could be
 * reused by a generations gallery later.
 */
export function GenerationMedia({
  url,
  kind,
  aspectRatio,
}: {
  url: string;
  kind?: GenerationResultKind;
  aspectRatio?: string;
}) {
  const [zoomed, setZoomed] = React.useState(false);
  const src = proxiedMediaUrl(url);

  if (kind === "video") {
    return (
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        className="max-h-[28rem] w-full rounded-xl bg-black"
        style={aspectRatio ? { aspectRatio: aspectRatio.replace(":", " / ") } : undefined}
      />
    );
  }

  if (kind === "audio") {
    return <audio src={src} controls className="w-full" />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="block w-full cursor-zoom-in overflow-hidden rounded-xl bg-black/40"
        aria-label="Expand image"
      >
        <img
          src={src}
          alt="Generated frame"
          loading="lazy"
          className="max-h-[28rem] w-full object-contain"
          style={aspectRatio ? { aspectRatio: aspectRatio.replace(":", " / ") } : undefined}
        />
      </button>

      {zoomed && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-8 backdrop-blur-sm"
          onClick={() => setZoomed(false)}
          role="dialog"
          aria-modal="true"
        >
          <img src={src} alt="Generated frame" className="max-h-full max-w-full rounded-lg object-contain" />
          <button
            type="button"
            onClick={() => setZoomed(false)}
            className="absolute right-5 top-5 rounded-lg bg-ink-800/80 px-3 py-1.5 text-sm text-fg hover:bg-ink-700"
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}
