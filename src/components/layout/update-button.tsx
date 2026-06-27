import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";
import { useUpdater } from "@/lib/updater/use-updater";

/**
 * Title-bar auto-update control.
 *
 * Invisible when the app is already on the latest version — it only appears
 * once a newer signed build is published. On click it downloads, installs, and
 * relaunches (see {@link useUpdater}). Styled with the brand amber accent so an
 * available update reads as a gentle, on-brand call to action without shouting.
 */
export function UpdateButton() {
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

  return (
    <button
      type="button"
      onClick={() => void install()}
      disabled={busy}
      aria-label={title}
      title={title}
      className={cn(
        "no-drag inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
        "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/60",
        phase === "error"
          ? "bg-danger/10 text-danger hover:bg-danger/15"
          : "bg-accent text-accent-ink shadow-sm hover:bg-accent-hover",
        busy && "cursor-default opacity-90",
      )}
    >
      {busy ? (
        <Spinner className="size-3.5 border-[1.5px]" />
      ) : (
        <Icon name="download" size={14} />
      )}
      <span>{label}</span>
    </button>
  );
}
