import {
  backendFetch,
  clearSessionCookies,
  isSameOrigin,
  jsonError,
  readAccessToken,
} from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  if (!isSameOrigin(req)) return jsonError(403, 'Origin tidak diizinkan.');

  const accessToken = await readAccessToken();
  if (accessToken) {
    try {
      await backendFetch('/auth/logout', { method: 'POST' }, accessToken);
    } catch {
      // Backend tidak terjangkau; cookie lokal tetap harus dibersihkan.
    }
  }

  await clearSessionCookies();
  return new Response(null, { status: 204 });
}
