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
import { api, sessionApi, type SessionUser } from './api';

export type LoginResult =
  | { totpRequired: true; totpToken: string }
  | { totpRequired: false };

type AuthState = {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyTotp: (totpToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
};

type SessionResponse = { user: SessionUser };

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const restore = async () => {
      try {
        // The cookie may still be valid even after a reload; ask the backend
        // who the session belongs to instead of trusting local state.
        const me = await api<SessionUser>('/auth/me');
        if (active) setUser(me);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void restore();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const body = await sessionApi<SessionResponse & {
      totpRequired?: boolean;
      totpToken?: string;
    }>('/login', {
      method: 'POST',
      body: { email, password, client: 'WEB' },
    });

    if (body.totpRequired) {
      return { totpRequired: true, totpToken: body.totpToken ?? '' } as const;
    }
    setUser(body.user);
    return { totpRequired: false } as const;
  }, []);

  const verifyTotp = useCallback(async (totpToken: string, code: string) => {
    const body = await sessionApi<SessionResponse>('/totp', {
      method: 'POST',
      body: { totpToken, code },
    });
    setUser(body.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await sessionApi('/logout', { method: 'POST' });
    } catch {
      // Sesi mungkin sudah dicabut; cookie tetap dibersihkan oleh route handler.
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, verifyTotp, logout }),
    [user, loading, login, verifyTotp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
