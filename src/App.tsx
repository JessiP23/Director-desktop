import * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { Spinner } from "@/components/ui/spinner";
import { AppearanceProvider } from "@/lib/appearance/use-appearance";
import { AuthProvider } from "@/features/auth/auth-provider";
import { useAuth } from "@/features/auth/auth-context";
import { SignInScreen } from "@/features/auth/sign-in-screen";
import { DirectorWorkspace } from "@/features/director/director-workspace";

// Dev-only primitives gallery, loaded lazily so it never enters the shipped
// bundle. Open with the #gallery hash in `pnpm dev`; no effect in production.
const PrimitivesGallery = React.lazy(() =>
  import("@/features/gallery/primitives-gallery").then((m) => ({ default: m.PrimitivesGallery })),
);

function useGalleryRoute() {
  const [on, setOn] = React.useState(() => import.meta.env.DEV && window.location.hash === "#gallery");
  React.useEffect(() => {
    const sync = () => setOn(import.meta.env.DEV && window.location.hash === "#gallery");
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return on;
}

function Gate() {
  const { status } = useAuth();
  const gallery = useGalleryRoute();

  // The shell (and its platform-branched title bar + window controls) is always
  // present so every state — loading, sign-in, authed — is draggable and, on
  // frameless Windows, has working min/max/close controls.
  return (
    <AppShell>
      {gallery ? (
        <React.Suspense fallback={null}>
          <PrimitivesGallery />
        </React.Suspense>
      ) : status === "loading" ? (
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
