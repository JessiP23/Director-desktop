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
    <div className="relative min-h-screen overflow-hidden bg-neutral-950">
      <div className="relative grid min-h-screen w-full items-stretch lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative hidden h-screen bg-neutral-950 p-3 lg:sticky lg:top-0 lg:flex">
          <div className="relative flex w-full overflow-hidden rounded-[24px] bg-zinc-900">
            <video
              src="/assets/videos/auto-cinematic.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/20 via-zinc-950/28 to-zinc-950/70" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_46%)]" />

            <div className="relative z-10 flex w-full flex-col justify-between p-7">
              <div />
              <div className="space-y-3">
                <p className="text-4xl font-semibold tracking-tight text-zinc-50">Vibe production at your service</p>
                <p className="max-w-xl text-base text-zinc-300">From brief to deliverable. In seconds.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-full flex-col">
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-xl space-y-5">
              <div className="text-center">
                <img
                  src="/wm.svg"
                  alt="WM Studio"
                  className="mx-auto h-auto w-[120px]"
                />
                <h1 className="-mt-6 text-4xl font-medium tracking-tight text-zinc-50 sm:text-5xl">
                  Welcome back
                </h1>
                <p className="mt-3 text-sm text-zinc-400">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    className="text-sm font-medium text-zinc-100 transition-colors hover:text-white"
                  >
                    Sign up
                  </button>
                </p>
              </div>

              <div className="mx-auto w-full max-w-[420px] space-y-3">
                <Button
                  type="button"
                  onClick={() => onProvider("google")}
                  disabled={busy !== null}
                  className="h-14 w-full justify-center gap-3.5 rounded-full border-0 bg-zinc-900/65 px-6 text-base font-medium text-zinc-100 shadow-none hover:bg-zinc-800/90 hover:text-zinc-50"
                >
                  {busy === "google" ? <Spinner /> : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-6 w-6">
                        <path
                          d="M21.805 10.023h-9.753v3.955h5.615c-.242 1.27-.968 2.347-2.057 3.07v2.549h3.322c1.944-1.79 3.073-4.432 3.073-7.574 0-.665-.06-1.304-.2-2z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12.052 22c2.79 0 5.133-.924 6.844-2.503l-3.322-2.55c-.923.624-2.103.995-3.522.995-2.692 0-4.972-1.818-5.787-4.266H2.836v2.63A10.34 10.34 0 0012.052 22z"
                          fill="#34A853"
                        />
                        <path
                          d="M6.265 13.676a6.227 6.227 0 010-3.952v-2.63H2.836a10.34 10.34 0 000 9.213l3.429-2.631z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12.052 6.059c1.52 0 2.886.523 3.958 1.549l2.97-2.97C17.18 2.963 14.842 2 12.052 2A10.34 10.34 0 002.836 7.094l3.429 2.63c.815-2.447 3.095-4.265 5.787-4.265z"
                          fill="#EA4335"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => onProvider("apple")}
                  disabled={busy !== null}
                  className="h-14 w-full justify-center gap-3.5 rounded-full border-0 bg-zinc-900/65 px-6 text-base font-medium text-zinc-100 shadow-none hover:bg-zinc-800/90 hover:text-zinc-50"
                >
                  {busy === "apple" ? <Spinner /> : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-6 w-6">
                        <path
                          d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                          fill="#F5F5F5"
                        />
                      </svg>
                      <span>Continue with Apple</span>
                    </>
                  )}
                </Button>
              </div>

              <div className="mx-auto w-full max-w-[420px]">
                <div className="my-5 flex items-center gap-3 text-xs text-zinc-500">
                  <span className="h-px flex-1 bg-zinc-800" />
                  or
                  <span className="h-px flex-1 bg-zinc-800" />
                </div>

                <form onSubmit={onSubmit}>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mb-4 w-full rounded-xl border border-zinc-700 bg-zinc-900/50 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition-colors focus:border-zinc-500"
                    placeholder="you@studio.com"
                  />

                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mb-5 w-full rounded-xl border border-zinc-700 bg-zinc-900/50 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition-colors focus:border-zinc-500"
                    placeholder="••••••••"
                  />

                  {error && (
                    <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
                  )}

                  <Button type="submit" variant="primary" size="md" disabled={busy !== null} className="w-full justify-center h-14 rounded-full">
                    {busy === "email" ? <Spinner /> : "Sign in"}
                  </Button>
                </form>
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-400" aria-live="assertive">
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="pb-4 text-center text-xs text-zinc-500">
            By continuing, you agree to our{" "}
            <a href="https://wmstudio.io/terms" target="_blank" rel="noopener noreferrer" className="text-zinc-300 transition-colors hover:text-zinc-100">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="https://wmstudio.io/privacy" target="_blank" rel="noopener noreferrer" className="text-zinc-300 transition-colors hover:text-zinc-100">
              Privacy Policy
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
