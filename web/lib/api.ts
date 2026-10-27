export type SessionUser = {
  id: string;
  email: string;
  roles: string[];
  permissions?: string[];
  isActive?: boolean;
  totpEnabled?: boolean;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  user: SessionUser;
  totpRequired?: boolean;
  totpToken?: string;
};

export type Query = Record<string, string | number | boolean | undefined | null>;

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
};

const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '/api/v1';

const ACCESS_KEY = 'fa_dashboard_access';
const REFRESH_KEY = 'fa_dashboard_refresh';
const USER_KEY = 'fa_dashboard_user';

export class ApiError extends Error {
  status: number;
  reason?: string;

  constructor(status: number, message: string, reason?: string) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

export function readAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function readRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function readStoredUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function writeStoredUser(user: SessionUser): void {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function writeSession(response: LoginResponse): void {
  window.localStorage.setItem(ACCESS_KEY, response.accessToken);
  window.localStorage.setItem(REFRESH_KEY, response.refreshToken);
  writeStoredUser(response.user);
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(USER_KEY);
}

function buildUrl(path: string, query?: Query): string {
  const url = `${BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = readRefreshToken();
  if (!refreshToken) return null;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearSession();
    return null;
  }
  const body = (await res.json()) as Partial<LoginResponse>;
  if (!body.accessToken || !body.refreshToken) {
    clearSession();
    return null;
  }
  window.localStorage.setItem(ACCESS_KEY, body.accessToken);
  window.localStorage.setItem(REFRESH_KEY, body.refreshToken);
  if (body.user) writeStoredUser(body.user);
  return body.accessToken;
}

async function request(
  path: string,
  options: ApiOptions,
  allowRetry: boolean,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const token = readAccessToken();
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  });

  if (res.status === 401 && allowRetry && !path.startsWith('/auth/')) {
    if (!refreshInFlight) refreshInFlight = refreshAccessToken();
    const fresh = await refreshInFlight;
    refreshInFlight = null;
    if (fresh) return request(path, options, false);
    clearSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Sesi berakhir. Silakan masuk kembali.');
  }

  if (!res.ok) {
    let message = `Permintaan gagal (${res.status})`;
    let reason: string | undefined;
    try {
      const body = (await res.json()) as {
        message?: string | string[];
        reason?: string;
      };
      if (Array.isArray(body.message)) message = body.message.join(', ');
      else if (typeof body.message === 'string') message = body.message;
      reason = body.reason;
    } catch {
      // Non-JSON error body (proxy failure, HTML page, ...).
    }
    throw new ApiError(res.status, message, reason);
  }

  return res;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const res = await request(path, options, true);
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function downloadFile(
  path: string,
  query: Query,
  fallbackName: string,
): Promise<void> {
  const res = await request(path, { query }, true);
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const quoted = /filename="([^"]+)"/i.exec(disposition);
  const plain = /filename=([^;]+)/i.exec(disposition);
  const filename = quoted?.[1] ?? plain?.[1]?.trim() ?? fallbackName;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const DASHBOARD_ROLES = ['SUPERVISOR', 'ADMIN', 'SUPER_ADMIN'];

export function hasDashboardRole(roles: string[] | undefined): boolean {
  return (roles ?? []).some((role) => DASHBOARD_ROLES.includes(role));
}

export function isAdmin(roles: string[] | undefined): boolean {
  return (roles ?? []).some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN');
}

export function isSuperAdmin(roles: string[] | undefined): boolean {
  return (roles ?? []).includes('SUPER_ADMIN');
}
