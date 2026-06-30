import * as React from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/auth/supabase";
import { AuthContext, type AuthStatus } from "./auth-context";

function readOAuthCallback() {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (!code && !error) return null;

  url.searchParams.delete("code");
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);

  return { code, error };
}

/**
 * Owns the Supabase session lifecycle. Restores a persisted session on launch
 * (from the keychain), then keeps `user`/`status` in sync via Supabase's auth
 * state subscription. Token refresh is handled by the Supabase client itself.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<AuthStatus>("loading");
  const [user, setUser] = React.useState<User | null>(null);

  React.useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const callback = readOAuthCallback();
        if (callback?.error) throw new Error(callback.error);
        if (callback?.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(callback.code);
          if (error) throw new Error(error.message);
        }

        const { data } = await supabase.auth.getSession();
        if (!active) return;
        setUser(data.session?.user ?? null);
        setStatus(data.session ? "authenticated" : "unauthenticated");
      } catch (err) {
        console.error("[auth] session restore failed", err);
        if (!active) return;
        setUser(null);
        setStatus("unauthenticated");
      }
    }

    void restoreSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setStatus(session ? "authenticated" : "unauthenticated");
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signUp = React.useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = React.useMemo(
    () => ({ status, user, signIn, signUp, signOut }),
    [status, user, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
