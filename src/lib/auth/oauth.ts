/**
 * Social sign-in (Google / Apple) — system browser + localhost loopback.
 *
 * Google and Apple block embedded webviews, so the consent screen opens in the
 * real browser. We start a temporary `http://localhost:<port>` server
 * (tauri-plugin-oauth) on a *pinned* port, point the OAuth redirect there, read
 * the `?code=` it receives, and exchange it for a session — the RFC 8252
 * native-app pattern (what GitHub CLI / gcloud / Figma desktop all use). The
 * browser then shows a "return to Director" page; the desktop app is already
 * signed in by that point.
 *
 * ── One-time Supabase setup (Authentication → URL Configuration → Redirect URLs) ──
 *   Add all three (the first free port is used; the others are fallbacks):
 *     http://localhost:8788   http://localhost:8789   http://localhost:8790
 *   If a redirect URL is NOT allow-listed, Supabase silently falls back to the
 *   Site URL (the web app) — which is exactly the "lands on wmstudio" symptom.
 *   Also enable the Google + Apple providers.
 */
import { start, cancel, onUrl } from "@fabianlars/tauri-plugin-oauth";
import { openUrl } from "@tauri-apps/plugin-opener";
import { supabase } from "./supabase";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Pinned loopback ports — keep in sync with the Supabase Redirect URLs above. */
const LOOPBACK_PORTS = [8788, 8789, 8790];

export type OAuthProvider = "google" | "apple";

/** Shown in the browser tab after the redirect; the app is already signed in. */
const SUCCESS_HTML = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Director</title><style>
  html,body{height:100%;margin:0;font-family:-apple-system,Segoe UI,sans-serif;
    background:#08080b;color:#ececf1;display:grid;place-items:center}
  .card{text-align:center;max-width:22rem;padding:2rem}
  h1{font-size:1.25rem;margin:0 0 .5rem}
  p{color:#a0a0ad;font-size:.9rem;line-height:1.5;margin:0}
  .dot{width:42px;height:42px;border-radius:9999px;background:#e6b15a;
    margin:0 auto 1.25rem;display:grid;place-items:center;color:#2a1d05;font-size:1.4rem}
</style></head><body><div class="card">
  <div class="dot">&#10003;</div>
  <h1>You're signed in</h1>
  <p>Authentication complete. You can close this tab and return to Director.</p>
</div></body></html>`;

/** Sign in with a provider. Resolves once the session is established. */
export async function signInWithProvider(provider: OAuthProvider): Promise<void> {
  console.info("[oauth] click", { provider, isTauri });

  if (!isTauri) {
    // Browser dev fallback: standard in-page redirect.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);
    if (data.url) window.location.href = data.url;
    return;
  }

  const port = await start({ ports: LOOPBACK_PORTS, response: SUCCESS_HTML });
  console.info("[oauth] loopback listening on", port);
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `http://localhost:${port}`, skipBrowserRedirect: true },
    });
    if (error) throw new Error(error.message);
    if (!data.url) throw new Error("Supabase returned no OAuth URL");

    const callbackUrl = await waitForCallback(data.url);
    console.info("[oauth] callback received");
    await completeOAuthFromUrl(callbackUrl);
    console.info("[oauth] session established");
  } finally {
    await cancel(port).catch(() => undefined);
  }
}

/** Register the loopback listener, open the consent page, resolve on redirect. */
function waitForCallback(authorizeUrl: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Sign-in timed out — no redirect was received")),
      300_000,
    );

    void onUrl((url: string) => {
      console.info("[oauth] onUrl", url);
      clearTimeout(timeout);
      resolve(url);
    })
      .then(() => {
        console.info("[oauth] opening system browser…");
        return openUrl(authorizeUrl);
      })
      .catch((err: unknown) => {
        clearTimeout(timeout);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });
}

/** Exchange the loopback callback URL for a Supabase session. */
export async function completeOAuthFromUrl(callbackUrl: string): Promise<void> {
  const parsed = new URL(callbackUrl);

  const code = parsed.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw new Error(error.message);
    return;
  }

  const oauthError = parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error");
  throw new Error(oauthError ?? "OAuth callback did not contain an authorization code");
}
