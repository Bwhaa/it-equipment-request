import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE, clearedAuthCookieOptions } from '@/lib/auth-constants';
import { getJwtSecretKey } from '@/lib/env';
import { decideRoute } from '@/lib/route-guard';
import { verifySession } from '@/lib/session';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const session = await verifySession(request.cookies.get(AUTH_COOKIE)?.value, getJwtSecretKey());
  const decision = decideRoute(request.nextUrl.pathname, session);

  let response: NextResponse;
  if (decision.action === 'redirect') {
    const target = request.nextUrl.clone();
    const [pathname, search] = decision.to.split('?');
    target.pathname = pathname;
    target.search = search ? `?${search}` : '';
    response = NextResponse.redirect(target);
  } else {
    response = NextResponse.next();
  }

  if (decision.clearCookie) response.cookies.set(AUTH_COOKIE, '', clearedAuthCookieOptions());
  return response;
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
