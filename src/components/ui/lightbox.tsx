import * as React from "react";
import { IconButton } from "./icon-button";

/**
 * Full-screen image viewer. Closes on backdrop click or Escape. Presentational —
 * the caller owns which url is shown. Used by the References canvas and any
 * surface that needs a quick zoom.
 */
export function Lightbox({ url, alt = "", onClose }: { url: string; alt?: string; onClose: () => void }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-8 backdrop-blur-sm"
    >
      <img
        src={url}
        alt={alt}
        decoding="async"
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain"
      />
      <div className="absolute right-4 top-4">
        <IconButton name="close" label="Close" onClick={onClose} className="bg-white/10 text-white hover:bg-white/20" />
      </div>
    </div>
  );
}
