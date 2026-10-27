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
import {
  api,
  clearSession,
  readAccessToken,
  readStoredUser,
  writeSession,
  writeStoredUser,
  type LoginResponse,
  type SessionUser,
} from './api';

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

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      const stored = readStoredUser();
      if (!stored || !readAccessToken()) {
        if (active) setLoading(false);
        return;
      }
      if (active) setUser(stored);
      try {
        const me = await api<SessionUser>('/auth/me');
        if (!active) return;
        setUser(me);
        writeStoredUser(me);
      } catch {
        clearSession();
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
    const body = await api<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password, client: 'WEB' },
    });
    if (body.totpRequired) {
      return { totpRequired: true, totpToken: body.totpToken ?? '' } as const;
    }
    writeSession(body);
    setUser(body.user);
    return { totpRequired: false } as const;
  }, []);

  const verifyTotp = useCallback(async (totpToken: string, code: string) => {
    const body = await api<LoginResponse>('/auth/totp/verify', {
      method: 'POST',
      body: { totpToken, code },
    });
    writeSession(body);
    setUser(body.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Sesi mungkin sudah dicabut; tetap bersihkan penyimpanan lokal.
    }
    clearSession();
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
