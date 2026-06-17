/**
 * Synchronous platform detection for presentation-only chrome branching.
 *
 * We read `navigator.userAgent` rather than the async `@tauri-apps/plugin-os`
 * so the title bar knows the OS at first paint — no flicker between a default
 * layout and the corrected one, and no extra Rust capability surface. This is
 * used purely to choose window-chrome layout (traffic-light gutter vs custom
 * controls); it drives no business logic.
 */
export type Platform = "macos" | "windows" | "linux" | "other";

function detect(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/Mac OS X|Macintosh/.test(ua)) return "macos";
  if (/Windows/.test(ua)) return "windows";
  if (/Linux|X11/.test(ua)) return "linux";
  return "other";
}

export const platform: Platform = detect();
export const isMac = platform === "macos";
export const isWindows = platform === "windows";
