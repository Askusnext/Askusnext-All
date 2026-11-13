'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthTokens } from '@askus/shared-types';

const STORAGE_KEY = 'askus.tokens';

export const tokenStore = {
  get(): AuthTokens | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthTokens) : null;
    } catch {
      return null;
    }
  },
  set(tokens: AuthTokens) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  },
  clear() {
    window.localStorage.removeItem(STORAGE_KEY);
  },
};

let refreshing: Promise<string | null> | null = null;

// Rotates the refresh token once even when several requests hit a 401 together.
export function refreshSession(baseUrl: string): Promise<string | null> {
  if (refreshing) return refreshing;
  const current = tokenStore.get();
  if (!current) return Promise.resolve(null);

  refreshing = (async () => {
    try {
      const res = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!res.ok) throw new Error('refresh failed');
      const next = (await res.json()) as AuthTokens;
      tokenStore.set(next);
      return next.accessToken;
    } catch {
      tokenStore.clear();
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

interface AuthContextValue {
  tokens: AuthTokens | null;
  ready: boolean;
  signIn: (tokens: AuthTokens) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTokens(tokenStore.get());
    setReady(true);
  }, []);

  const signIn = useCallback((next: AuthTokens) => {
    tokenStore.set(next);
    setTokens(next);
  }, []);

  const signOut = useCallback(() => {
    tokenStore.clear();
    setTokens(null);
  }, []);

  const value = useMemo(() => ({ tokens, ready, signIn, signOut }), [tokens, ready, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
