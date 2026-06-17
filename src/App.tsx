import { AppShell } from "@/components/layout/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { Spinner } from "@/components/ui/spinner";
import { AppearanceProvider } from "@/lib/appearance/use-appearance";
import { AuthProvider } from "@/features/auth/auth-provider";
import { useAuth } from "@/features/auth/auth-context";
import { SignInScreen } from "@/features/auth/sign-in-screen";
import { DirectorWorkspace } from "@/features/director/director-workspace";

function Gate() {
  const { status } = useAuth();

  // The shell (and its platform-branched title bar + window controls) is always
  // present so every state — loading, sign-in, authed — is draggable and, on
  // frameless Windows, has working min/max/close controls.
  return (
    <AppShell>
      {status === "loading" ? (
        <div className="flex h-full items-center justify-center text-text-tertiary">
          <Spinner className="size-5 text-accent" />
        </div>
      ) : status === "unauthenticated" ? (
        <SignInScreen />
      ) : (
        <ErrorBoundary>
          <DirectorWorkspace />
        </ErrorBoundary>
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <AppearanceProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </AppearanceProvider>
  );
}
