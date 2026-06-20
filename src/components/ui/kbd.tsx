import { cn } from "@/lib/utils/cn";

/** A keyboard key cap. Purely presentational. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-[5px] px-1.5 py-0.5",
        "bg-fill text-[11px] font-medium text-text-tertiary",
        "shadow-[var(--shadow-hairline)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
