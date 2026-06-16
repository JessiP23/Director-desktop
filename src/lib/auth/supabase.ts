/**
 * Supabase client for the desktop app.
 *
 * Session persistence uses the WebView's localStorage (default). This avoids
 * the macOS Keychain access prompt during fast iteration — less hardened than
 * the OS keychain, but the session still survives restarts (Tauri persists the
 * WebView storage per app). To re-enable keychain storage later, pass a custom
 * `storage` adapter backed by `lib/tauri/secure-store.ts`.
 *
 * PKCE flow so social sign-in (system browser → loopback) works without a
 * client secret; the code verifier is stored alongside the session.
 */
import { createClient, type SupabaseClientOptions } from "@supabase/supabase-js";
import { config } from "@/lib/config";

const options: SupabaseClientOptions<"public"> = {
  auth: {
    storageKey: "director.session",
    persistSession: true,
    autoRefreshToken: true,
    // Desktop has no in-page redirect; the loopback flow exchanges the code
    // manually (lib/auth/oauth.ts).
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
