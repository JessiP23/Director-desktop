import { Brand } from "@/components/ui/brand";
import { useAuth } from "@/features/auth/auth-context";

/**
 * Custom frameless title bar. The whole strip is a drag region; interactive
 * controls opt out with `.no-drag`. Left padding clears the macOS traffic
 * lights (overlay style); on Windows the strip simply reads as the app header.
 */
export function TitleBar() {
  const { user, signOut } = useAuth();

  return (
    <header className="drag-region flex h-11 shrink-0 items-center justify-between border-b border-line bg-ink-900/70 pl-20 pr-3 backdrop-blur select-none">
      <Brand />

      {user && (
        <button
          onClick={() => void signOut()}
          className="no-drag rounded-md px-2 py-1 font-mono text-[11px] uppercase tracking-wide text-fg-subtle transition-colors hover:bg-ink-800 hover:text-fg"
          title={user.email ?? undefined}
        >
          Sign out
        </button>
      )}
    </header>
  );
}
