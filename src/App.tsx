import * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { Spinner } from "@/components/ui/spinner";
import { AppearanceProvider } from "@/lib/appearance/use-appearance";
import { AuthProvider } from "@/features/auth/auth-provider";
import { useAuth } from "@/features/auth/auth-context";
import { SignInScreen } from "@/features/auth/sign-in-screen";
import { DirectorWorkspace } from "@/features/director/director-workspace";

// Dev-only galleries, loaded lazily so they never enter the shipped bundle.
// Open with #gallery (primitives) or #palmier (Palmier tokens) in `pnpm dev`.
const PrimitivesGallery = React.lazy(() =>
  import("@/features/gallery/primitives-gallery").then((m) => ({ default: m.PrimitivesGallery })),
);
const PalmierGallery = React.lazy(() =>
  import("@/features/gallery/palmier-gallery").then((m) => ({ default: m.PalmierGallery })),
);

/** The active dev gallery route (hash), or "" in production / no match. */
function useDevRoute() {
  const read = () => (import.meta.env.DEV ? window.location.hash.replace(/^#/, "") : "");
  const [route, setRoute] = React.useState(read);
  React.useEffect(() => {
    const sync = () => setRoute(read());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return route;
}

function Gate() {
  const { status } = useAuth();
  const route = useDevRoute();

  // The shell (and its platform-branched title bar + window controls) is always
  // present so every state — loading, sign-in, authed — is draggable and, on
  // frameless Windows, has working min/max/close controls.
  return (
    <AppShell>
      {route === "gallery" ? (
        <React.Suspense fallback={null}>
          <PrimitivesGallery />
        </React.Suspense>
      ) : route === "palmier" ? (
        <React.Suspense fallback={null}>
          <PalmierGallery />
        </React.Suspense>
      ) : route === "director" ? (
        <ErrorBoundary>
          <DirectorWorkspace />
        </ErrorBoundary>
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
