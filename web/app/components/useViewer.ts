"use client";

import { useCallback, useEffect, useState } from "react";

export interface PublicUser {
  id: number;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_subscribed: boolean;
  subscription_expires_at: string | null;
}

export interface AuthState {
  user: PublicUser | null;
  accountsEnabled: boolean;
  googleEnabled: boolean;
  loading: boolean;
}

/** Who is signed in, plus which sign-in methods this deployment supports. */
export function useViewer() {
  const [state, setState] = useState<AuthState>({
    user: null, accountsEnabled: false, googleEnabled: false, loading: true,
  });

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const body = await res.json();
      setState({
        user: body.user ?? null,
        accountsEnabled: Boolean(body.accounts_enabled),
        googleEnabled: Boolean(body.google_enabled),
        loading: false,
      });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return { ...state, reload };
}

export function displayNameOf(u: PublicUser): string {
  return u.display_name || u.email || "Тоглогч";
}
