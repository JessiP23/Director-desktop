import { Brand } from "@/components/ui/brand";
import { useAuth } from "@/features/auth/auth-context";
import { isMac, isWindows } from "@/lib/platform";
import { AppearanceToggle } from "./appearance-toggle";
import { UpdateButton } from "./update-button";
import { WindowControls } from "./window-controls";

/**
 * Unified, platform-branched title bar.
 *
 * The whole strip is a Tauri drag region (`data-tauri-drag-region`); interactive
 * controls opt out via `.no-drag`. It uses the toolbar vibrancy material — on
 * macOS the transparent window + NSVisualEffect reveal the desktop blur; on
 * Windows/Linux it's a translucent material over the opaque body.
 *
 * Layout per OS:
 *   macOS   → 80px gutter clears the native traffic lights (Overlay style).
 *   Windows → no gutter; custom min/max/close controls on the right.
 */
export function TitleBar() {
  const { user, signOut } = useAuth();

  return (
    <header
      data-tauri-drag-region
      className={`material flex h-11 shrink-0 items-center justify-between bg-material-toolbar shadow-[inset_0_-0.5px_0_var(--separator)] select-none ${
        isMac ? "pl-20 pr-3" : "pl-3 pr-0"
      }`}
    >
      <Brand />

      <div className="no-drag flex items-center gap-1.5">
        <UpdateButton />
        <AppearanceToggle />
        {user && (
          <button
            onClick={() => void signOut()}
            className="rounded-md px-2 py-1 text-xs font-medium text-text-tertiary transition-colors hover:bg-fill hover:text-text"
            title={user.email ?? undefined}
          >
            Sign out
          </button>
        )}
        {isWindows && <WindowControls />}
      </div>
    </header>
  );
}
