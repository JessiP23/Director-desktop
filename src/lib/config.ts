/**
 * Runtime configuration, sourced from Vite env vars (`.env.local`).
 *
 * The desktop app is a pure client of the WM Studio backend — it ships no
 * secrets beyond the Supabase anon key (which is public by design). All values
 * are validated once at startup so a missing var fails loudly instead of
 * surfacing as a confusing 404/401 later.
 */

function required(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  // Normalize away any accidental trailing slash on URLs.
  return value.replace(/\/+$/, "");
}

export const config = {
  /** Backend origin, e.g. https://app.wmstudio.com */
  apiBaseUrl: required("VITE_API_BASE_URL"),
  supabaseUrl: required("VITE_SUPABASE_URL"),
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
} as const;

if (!config.supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_ANON_KEY — see .env.example.");
}
