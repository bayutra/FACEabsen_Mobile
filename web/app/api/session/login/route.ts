import {
  backendFetch,
  isSameOrigin,
  jsonError,
  setSessionCookies,
  type BackendSessionResponse,
} from '@/lib/server/session';

export const dynamic = 'force-dynamic';

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

export async function POST(req: Request): Promise<Response> {
  if (!isSameOrigin(req)) return jsonError(403, 'Origin tidak diizinkan.');

  const dashboardSecret = process.env.DASHBOARD_CLIENT_SECRET?.trim();
  if (!dashboardSecret) {
    return jsonError(
      503,
      'DASHBOARD_CLIENT_SECRET belum dikonfigurasi pada server dashboard.',
    );
  }

  const body = (await req.json().catch(() => null)) as LoginBody | null;
  if (typeof body?.email !== 'string' || typeof body.password !== 'string') {
    return jsonError(400, 'Email dan kata sandi wajib diisi.');
  }

  const res = await backendFetch('/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-dashboard-secret': dashboardSecret,
    },
    body: JSON.stringify({
      email: body.email,
      password: body.password,
    }),
  });

  const data = (await res.json().catch(() => null)) as
    | (BackendSessionResponse & { message?: string | string[]; reason?: string })
    | null;

  if (!res.ok) {
    return Response.json(data ?? { message: 'Gagal masuk.' }, { status: res.status });
  }

  if (data?.totpRequired) {
    return Response.json({
      totpRequired: true,
      totpToken: data.totpToken ?? '',
      expiresIn: data.expiresIn,
    });
  }

  if (!data?.accessToken || !data.refreshToken || !data.user) {
    return jsonError(502, 'Respons autentikasi tidak valid.');
  }

  await setSessionCookies(data);
  return Response.json({ user: data.user, totpRequired: false });
}
