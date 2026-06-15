/**
 * Secure key/value storage backed by the OS keychain (macOS Keychain /
 * Windows Credential Manager) through Rust commands (`secure_get/set/delete`).
 *
 * Falls back to `localStorage` when not running inside Tauri (e.g. `vite dev`
 * in a plain browser) so the app stays runnable everywhere. The fallback is
 * clearly less secure and is only intended for development.
 */
import { invoke } from "@tauri-apps/api/core";

/** True when running inside the Tauri WebView (vs a plain browser tab). */
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const fallbackPrefix = "director.secure.";

export const secureStore = {
  async get(key: string): Promise<string | null> {
    if (isTauri) {
      try {
        return await invoke<string | null>("secure_get", { key });
      } catch {
        return null;
      }
    }
    return localStorage.getItem(fallbackPrefix + key);
  },

  async set(key: string, value: string): Promise<void> {
    if (isTauri) {
      await invoke("secure_set", { key, value });
      return;
    }
    localStorage.setItem(fallbackPrefix + key, value);
  },

  async delete(key: string): Promise<void> {
    if (isTauri) {
      try {
        await invoke("secure_delete", { key });
      } catch {
        // Deleting a missing key is not an error for our purposes.
      }
      return;
    }
    localStorage.removeItem(fallbackPrefix + key);
  },
};
