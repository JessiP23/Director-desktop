import * as React from "react";
import type { User } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function useUserPlan(): { plan: string | null } {
  const { user } = useAuth();
  const plan = React.useMemo(() => {
    const planFromMetadata = user?.user_metadata?.plan as string | undefined;
    return planFromMetadata || null;
  }, [user]);
  return { plan };
}
