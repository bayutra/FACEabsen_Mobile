import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/api';

// Route-level session presence check. Real authorization (roles/permissions)
// is enforced by the backend on every API call; the (app) layout revalidates
// the token server-side via /auth/me.
//
// NOTE: `proxy.ts` is the Next 16 successor of the deprecated `middleware.ts`
// convention (same matcher semantics, same edge runtime).
export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has(ACCESS_COOKIE);
  const { pathname } = req.nextUrl;

  if (pathname === '/login' && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  if (!hasSession && (pathname === '/' || !pathname.startsWith('/login'))) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Negative match: skip API routes, Next internals, and public assets
  // (robots.txt, sitemap.xml, and any dotted file like logo.svg) so a
  // logged-out visitor still receives static files instead of a 302.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'],
};
