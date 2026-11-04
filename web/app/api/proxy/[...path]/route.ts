import {
  backendFetch,
  isSameOrigin,
  jsonError,
  readAccessToken,
  refreshSession,
} from '@/lib/server/session';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ path: string[] }> };

const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

async function proxy(req: Request, context: RouteContext): Promise<Response> {
  if (!isSameOrigin(req)) return jsonError(403, 'Origin tidak diizinkan.');

  const { path } = await context.params;
  const target = `/${path.map(encodeURIComponent).join('/')}${new URL(req.url).search}`;

  const body = BODYLESS_METHODS.has(req.method)
    ? undefined
    : await req.arrayBuffer();

  const headers = new Headers();
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  let accessToken = await readAccessToken();
  if (!accessToken) {
    const refreshed = await refreshSession();
    accessToken = refreshed?.accessToken ?? null;
  }

  const send = () =>
    backendFetch(
      target,
      { method: req.method, headers, body, redirect: 'manual' },
      accessToken,
    );

  let upstream = await send();

  if (upstream.status === 401 && accessToken) {
    const refreshed = await refreshSession();
    if (refreshed) {
      accessToken = refreshed.accessToken;
      upstream = await send();
    }
  }

  const outHeaders = new Headers();
  for (const name of ['content-type', 'content-disposition']) {
    const value = upstream.headers.get(name);
    if (value) outHeaders.set(name, value);
  }
  outHeaders.set('cache-control', 'no-store');

  return new Response(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
