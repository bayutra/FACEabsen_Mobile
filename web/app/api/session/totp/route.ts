import {
  backendFetch,
  isSameOrigin,
  jsonError,
  setSessionCookies,
  type BackendSessionResponse,
} from '@/lib/server/session';

export const dynamic = 'force-dynamic';

type TotpBody = {
  totpToken?: unknown;
  code?: unknown;
};

export async function POST(req: Request): Promise<Response> {
  if (!isSameOrigin(req)) return jsonError(403, 'Origin tidak diizinkan.');

  const body = (await req.json().catch(() => null)) as TotpBody | null;
  if (typeof body?.totpToken !== 'string' || typeof body.code !== 'string') {
    return jsonError(400, 'Token dan kode autentikator wajib diisi.');
  }

  const res = await backendFetch('/auth/totp/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ totpToken: body.totpToken, code: body.code }),
  });

  const data = (await res.json().catch(() => null)) as
    | (BackendSessionResponse & { message?: string | string[]; reason?: string })
    | null;

  if (!res.ok) {
    return Response.json(data ?? { message: 'Verifikasi gagal.' }, { status: res.status });
  }

  if (!data?.accessToken || !data.refreshToken || !data.user) {
    return jsonError(502, 'Respons autentikasi tidak valid.');
  }

  await setSessionCookies(data);
  return Response.json({ user: data.user });
}
