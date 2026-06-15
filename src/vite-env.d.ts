/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the WM Studio backend, e.g. https://app.wmstudio.com (no trailing slash). */
  readonly VITE_API_BASE_URL: string;
  /** Supabase project URL. */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase anon (publishable) key. */
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
