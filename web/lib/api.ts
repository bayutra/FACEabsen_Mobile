export type SessionUser = {
  id: string;
  email: string;
  roles: string[];
  permissions?: string[];
  isActive?: boolean;
  totpEnabled?: boolean;
};

export type LoginResponse = {
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

/**
 * Browser requests go to same-origin Next.js route handlers. Those handlers
 * hold the access/refresh tokens in httpOnly cookies and forward the call to
 * the NestJS API, so tokens are never exposed to client-side JavaScript.
 */
const BASE = '/api/proxy';
const SESSION_BASE = '/api/session';

export class ApiError extends Error {
  status: number;
  reason?: string;

  constructor(status: number, message: string, reason?: string) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

function buildUrl(base: string, path: string, query?: Query): string {
  const url = `${base}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function send(url: string, options: ApiOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  return fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
    credentials: 'same-origin',
  });
}

async function toApiError(res: Response): Promise<ApiError> {
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
  return new ApiError(res.status, message, reason);
}

async function parseBody<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function redirectToLogin(): void {
  if (
    typeof window !== 'undefined' &&
    !window.location.pathname.startsWith('/login')
  ) {
    window.location.href = '/login';
  }
}

async function request(
  path: string,
  options: ApiOptions,
): Promise<Response> {
  const res = await send(buildUrl(BASE, path, options.query), options);

  if (res.status === 401 && !path.startsWith('/auth/')) {
    redirectToLogin();
    throw new ApiError(401, 'Sesi berakhir. Silakan masuk kembali.');
  }

  if (!res.ok) throw await toApiError(res);
  return res;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  return parseBody<T>(await request(path, options));
}

/**
 * Session endpoints live outside the API proxy because they create/destroy the
 * httpOnly cookies rather than forward an authenticated request.
 */
export async function sessionApi<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const res = await send(buildUrl(SESSION_BASE, path, options.query), options);
  if (!res.ok) throw await toApiError(res);
  return parseBody<T>(res);
}

export async function downloadFile(
  path: string,
  query: Query,
  fallbackName: string,
): Promise<void> {
  const res = await request(path, { query });
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
