/**
 * Supabase client for the desktop app.
 *
 * The session (incl. refresh token) is persisted in the OS keychain via a
 * custom async storage adapter, not in localStorage — so credentials survive
 * reinstalls and aren't sitting in plaintext web storage. PKCE is used so the
 * OAuth path (system browser → deep link) can be added without a client secret.
 */
import { createClient, type SupabaseClientOptions } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import { secureStore } from "@/lib/tauri/secure-store";

const keychainStorage = {
  getItem: (key: string) => secureStore.get(key),
  setItem: (key: string, value: string) => secureStore.set(key, value),
  removeItem: (key: string) => secureStore.delete(key),
};

const options: SupabaseClientOptions<"public"> = {
  auth: {
    storage: keychainStorage,
    storageKey: "director.session",
    persistSession: true,
    autoRefreshToken: true,
    // No URL session detection: desktop has no redirect-in-page; tokens arrive
    // via email/password now and via deep link (PKCE) later.
    detectSessionInUrl: false,
    flowType: "pkce",
  },
};

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, options);

/** Current access token (JWT) for `Authorization: Bearer`, or null if signed out. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
