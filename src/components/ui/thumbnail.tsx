import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Icon, type IconName } from "./icon";

/**
 * Lazy, async-decoded image tile with an aspect box and graceful fallbacks
 * (skeleton while loading, icon on error). Never renders full-res eagerly —
 * safe for dense grids/canvases of many assets.
 */
export function Thumbnail({
  src,
  alt = "",
  aspect = "1 / 1",
  rounded = "rounded-lg",
  fallbackIcon = "image",
  className,
}: {
  src?: string;
  alt?: string;
  aspect?: string;
  rounded?: string;
  fallbackIcon?: IconName;
  className?: string;
}) {
  const [state, setState] = React.useState<"loading" | "ok" | "error">(src ? "loading" : "error");

  React.useEffect(() => setState(src ? "loading" : "error"), [src]);

  return (
    <div
      style={{ aspectRatio: aspect }}
      className={cn("relative w-full overflow-hidden bg-surface-2", rounded, className)}
    >
      {state !== "error" && src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className={cn(
            "size-full object-cover transition-opacity duration-200",
            state === "ok" ? "opacity-100" : "opacity-0",
          )}
        />
      )}
      {state === "loading" && <div className="absolute inset-0 animate-pulse bg-fill" />}
      {state === "error" && (
        <div className="absolute inset-0 grid place-items-center text-text-quaternary">
          <Icon name={fallbackIcon} size={20} />
        </div>
      )}
    </div>
  );
}
