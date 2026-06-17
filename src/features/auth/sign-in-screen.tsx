import * as React from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { signInWithProvider, type OAuthProvider } from "@/lib/auth/oauth";
import { useAuth } from "./auth-context";

/**
 * Sign-in: Google / Apple (system browser → `director://` deep link) plus
 * email/password. OAuth completion is handled by the AuthProvider's deep-link
 * listener; here we just kick off the provider flow.
 */
export function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<null | "email" | OAuthProvider>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy("email");
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(null);
    }
  }

  async function onProvider(provider: OAuthProvider) {
    setError(null);
    setBusy(provider);
    try {
      await signInWithProvider(provider);
      // Stays on this screen until the loopback callback completes sign-in.
    } catch (err) {
      console.error("[oauth] failed", err);
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-ink-900/80 p-8 shadow-2xl backdrop-blur">
          <div className="mb-7 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Director</h1>
            <p className="mt-1 text-sm text-fg-muted">Sign in to your WM Studio account</p>
          </div>

          <div className="flex flex-col gap-2">
            <Button variant="secondary" className="justify-center" disabled={busy !== null} onClick={() => onProvider("google")}>
              {busy === "google" ? <Spinner /> : <>Continue with Google</>}
            </Button>
            <Button variant="secondary" className="justify-center" disabled={busy !== null} onClick={() => onProvider("apple")}>
              {busy === "apple" ? <Spinner /> : <>Continue with Apple</>}
            </Button>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-fg-subtle">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={onSubmit}>
            <label className="mb-1.5 block text-xs font-medium text-fg-muted">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded-xl border border-line-strong bg-ink-850 px-3.5 py-2.5 text-sm text-fg outline-none transition-colors focus:border-accent/70"
              placeholder="you@studio.com"
            />

            <label className="mb-1.5 block text-xs font-medium text-fg-muted">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-5 w-full rounded-xl border border-line-strong bg-ink-850 px-3.5 py-2.5 text-sm text-fg outline-none transition-colors focus:border-accent/70"
              placeholder="••••••••"
            />

            {error && (
              <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
            )}

            <Button type="submit" variant="primary" size="md" disabled={busy !== null} className="w-full justify-center">
              {busy === "email" ? <Spinner /> : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
