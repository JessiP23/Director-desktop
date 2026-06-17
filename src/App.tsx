import { AppShell } from "@/components/layout/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { Spinner } from "@/components/ui/spinner";
import { AuthProvider } from "@/features/auth/auth-provider";
import { useAuth } from "@/features/auth/auth-context";
import { SignInScreen } from "@/features/auth/sign-in-screen";
import { DirectorWorkspace } from "@/features/director/director-workspace";

function Gate() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-fg-subtle">
        <Spinner className="size-5 text-accent" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <SignInScreen />;
  }

  return (
    <AppShell>
      <ErrorBoundary>
        <DirectorWorkspace />
      </ErrorBoundary>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
