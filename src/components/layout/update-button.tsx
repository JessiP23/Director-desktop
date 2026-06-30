import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";
import { useUpdater } from "@/lib/updater/use-updater";

/**
 * Auto-update control.
 *
 * Invisible when the app is already on the latest version — it only appears
 * once a newer signed build is published. On click it downloads, installs, and
 * relaunches (see {@link useUpdater}). Styled with the brand amber accent so an
 * available update reads as a gentle, on-brand call to action without shouting.
 */
export function UpdateButton({
  variant = "titlebar",
  collapsed = false,
  className,
}: {
  variant?: "titlebar" | "sidebar";
  collapsed?: boolean;
  className?: string;
}) {
  const { phase, progress, install } = useUpdater();

  // Render nothing until there is a real, installable update. The startup
  // "checking" phase also renders nothing, so the button never flashes in and
  // out — it only ever appears once, when an update is genuinely available.
  if (phase === "idle" || phase === "checking") return null;

  const busy =
    phase === "downloading" || phase === "installing" || phase === "relaunching";

  const label =
    phase === "available"
      ? "Update"
      : phase === "downloading"
        ? progress != null
          ? `Downloading ${progress}%`
          : "Downloading"
        : phase === "installing"
          ? "Installing"
          : phase === "relaunching"
            ? "Restarting"
            : "Retry update"; // phase === "error"

  const title =
    phase === "available"
      ? "An update is available — click to install"
      : phase === "error"
        ? "Update failed — click to try again"
        : label;
  const isSidebar = variant === "sidebar";

  return (
    <button
      type="button"
      onClick={() => void install()}
      disabled={busy}
      aria-label={title}
      title={title}
      className={cn(
        "no-drag inline-flex items-center gap-1.5 text-xs font-medium outline-none transition-colors",
        isSidebar
          ? cn(
              "h-8 rounded-[10px] text-[#f5f1eb]/90 focus-visible:ring-2 focus-visible:ring-[#f5f1eb]/40",
              collapsed ? "w-8 justify-center px-0" : "w-full justify-start px-2",
              phase === "error"
                ? "bg-red-500/10 text-red-200 hover:bg-red-500/15"
                : "bg-[#f5f1eb]/[0.06] hover:bg-[#f5f1eb]/[0.1]",
            )
          : cn(
              "h-7 rounded-md px-2.5 focus-visible:ring-2 focus-visible:ring-accent/60",
              phase === "error"
                ? "bg-danger/10 text-danger hover:bg-danger/15"
                : "bg-accent text-accent-ink shadow-sm hover:bg-accent-hover",
            ),
        busy && "cursor-default opacity-90",
        className,
      )}
    >
      {busy ? (
        <Spinner className="size-3.5 border-[1.5px]" />
      ) : (
        <Icon name="download" size={14} />
      )}
      {!collapsed && <span>{label}</span>}
    </button>
  );
}
