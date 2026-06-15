import * as React from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "./auth-context";

/**
 * Email/password sign-in. OAuth (system browser → `director://` deep link) is
 * the planned next step; this keeps the desktop app usable end-to-end today.
 */
export function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="drag-region h-11 shrink-0" />
      <div className="flex flex-1 items-center justify-center px-6">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm rounded-2xl border border-line bg-ink-900/80 p-8 shadow-2xl backdrop-blur"
        >
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Director</h1>
            <p className="mt-1 text-sm text-fg-muted">Sign in to your WM Studio account</p>
          </div>

          <label className="mb-1.5 block text-xs font-medium text-fg-muted">Email</label>
          <input
            type="email"
            autoFocus
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

          <Button type="submit" variant="primary" size="md" disabled={submitting} className="w-full justify-center">
            {submitting ? <Spinner /> : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
