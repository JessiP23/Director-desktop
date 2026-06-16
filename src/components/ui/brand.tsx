import { cn } from "@/lib/utils/cn";

/**
 * Director identity mark: a small aperture-like ring with a warm core (a nod to
 * a lens/record light) + the wordmark. Distinctive but quiet — used in the
 * title bar and sidebar header.
 */
export function Brand({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 select-none", className)}>
      <span className="relative grid size-3.5 place-items-center">
        <span className="absolute inset-0 rounded-full border border-accent/70" />
        <span className="size-1.5 rounded-full bg-accent" />
      </span>
      {showWordmark && (
        <span className="text-sm font-semibold tracking-tight text-fg">Director</span>
      )}
    </span>
  );
}
