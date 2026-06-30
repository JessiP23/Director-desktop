import * as React from "react";
import { Spinner } from "@/components/ui/spinner";
import { signInWithProvider, type OAuthProvider } from "@/lib/auth/oauth";

function GoogleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path
        d="M21.805 10.023h-9.753v3.955h5.615c-.242 1.27-.968 2.347-2.057 3.07v2.549h3.322c1.944-1.79 3.073-4.432 3.073-7.574 0-.665-.06-1.304-.2-2z"
        fill="#4285F4"
      />
      <path
        d="M12.052 22c2.79 0 5.133-.924 6.844-2.503l-3.322-2.55c-.923.624-2.103.995-3.522.995-2.692 0-4.972-1.818-5.787-4.266H2.836v2.63A10.34 10.34 0 0012.052 22z"
        fill="#34A853"
      />
      <path d="M6.265 13.676a6.227 6.227 0 010-3.952v-2.63H2.836a10.34 10.34 0 000 9.213l3.429-2.631z" fill="#FBBC05" />
      <path
        d="M12.052 6.059c1.52 0 2.886.523 3.958 1.549l2.97-2.97C17.18 2.963 14.842 2 12.052 2A10.34 10.34 0 002.836 7.094l3.429 2.63c.815-2.447 3.095-4.265 5.787-4.265z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
        fill="#F5F5F5"
      />
    </svg>
  );
}

function OAuthButton({
  icon,
  label,
  loading,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-14 w-full items-center justify-center gap-3.5 rounded-full border-0 bg-zinc-900/65 px-6 text-base font-medium text-zinc-100 shadow-none transition-colors hover:bg-zinc-800/90 hover:text-zinc-50 disabled:pointer-events-none disabled:opacity-60"
    >
      {loading ? <Spinner className="h-5 w-5 text-zinc-100" /> : icon}
      <span>{label}</span>
    </button>
  );
}

/**
 * Auth screen visually matched to wmstudio's web `/auth` page: centered OAuth
 * entry with the Explore hero video fading into the dark background.
 */
export function SignInScreen() {
  const [isLogin, setIsLogin] = React.useState(false);
  const [marketingConsent, setMarketingConsent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<OAuthProvider | null>(null);

  const resetMessages = () => {
    setError(null);
  };

  function setMode(nextIsLogin: boolean) {
    if (nextIsLogin === isLogin) return;
    setIsLogin(nextIsLogin);
    resetMessages();
  }

  async function onProvider(provider: OAuthProvider) {
    resetMessages();
    setBusy(provider);
    try {
      if (!isLogin) {
        try {
          localStorage.setItem("wm_signup_marketing", JSON.stringify({ consent: marketingConsent }));
        } catch {
          // Ignore private-mode storage failures.
        }
      }
      await signInWithProvider(provider);
    } catch (err) {
      console.error("[oauth] failed", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const disableActions = busy !== null;
  const title = isLogin ? "Welcome back" : "Create your account";
  const subtitle = isLogin ? "Continue with your WM Studio account" : "Start creating cinematic videos with WM Studio";

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-neutral-950 text-zinc-50">
      <div className="pointer-events-none absolute inset-x-0 -top-20 h-[68vh] overflow-hidden sm:-top-24 lg:-top-28">
        <video
          src="https://wmstudioassets2.blob.core.windows.net/public-assets/root/explore-videos/videohero.mov"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="WM Studio creative preview"
          className="absolute left-1/2 top-[-8%] h-[112%] w-[132%] -translate-x-1/2 scale-[1.06] object-cover object-top opacity-75 sm:w-[112%] lg:w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/10 via-neutral-950/42 to-neutral-950" />
        <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-b from-transparent to-neutral-950" />
        <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-neutral-950 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-neutral-950 to-transparent" />
      </div>

      <section className="relative z-10 flex h-full min-h-0 flex-col overflow-y-auto">
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-[430px] text-center">
            <img
              src="/brand/wm-symbol-white.svg"
              alt="WM Studio"
              className="mx-auto h-auto w-[124px] select-none"
              draggable={false}
            />
            <h1 className="-mt-6 text-4xl font-medium tracking-tight text-zinc-50 sm:text-5xl">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{subtitle}</p>

            <div className="mt-8 space-y-3">
              <OAuthButton
                onClick={() => void onProvider("google")}
                label={isLogin ? "Continue with Google" : "Sign up with Google"}
                icon={<GoogleIcon />}
                loading={busy === "google"}
                disabled={disableActions}
              />
              <OAuthButton
                onClick={() => void onProvider("apple")}
                label={isLogin ? "Continue with Apple" : "Sign up with Apple"}
                icon={<AppleIcon />}
                loading={busy === "apple"}
                disabled={disableActions}
              />
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200" aria-live="assertive">
                {error}
              </div>
            )}

            {!isLogin && (
              <label className="mt-5 flex cursor-pointer items-start justify-center gap-2 text-center text-xs leading-5 text-zinc-500">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(event) => setMarketingConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-600 bg-transparent accent-zinc-200"
                />
                <span>Send me product updates, tips and offers by email. You can unsubscribe anytime.</span>
              </label>
            )}

            <p className="mt-6 text-sm text-zinc-500">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => setMode(!isLogin)}
                className="font-medium text-zinc-100 transition-colors hover:text-white"
              >
                {isLogin ? "Sign Up" : "Sign In"}
              </button>
            </p>

            <div className="mt-8 text-center text-xs leading-5 text-zinc-500">
              By continuing, you agree to our{" "}
              <a href="https://wmstudio.ai/terms" target="_blank" rel="noreferrer" className="text-zinc-300 transition-colors hover:text-zinc-100">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="https://wmstudio.ai/privacy" target="_blank" rel="noreferrer" className="text-zinc-300 transition-colors hover:text-zinc-100">
                Privacy Policy
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
