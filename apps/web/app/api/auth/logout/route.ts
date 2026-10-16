import { NextResponse } from 'next/server';
import { makeApiError } from '@/lib/api-error';
import { AUTH_COOKIE, clearedAuthCookieOptions } from '@/lib/auth-constants';
import { isSameOrigin } from '@/lib/same-origin';

export const dynamic = 'force-dynamic';

function logout(request: Request): NextResponse {
  const expired = new URL(request.url).searchParams.get('expired') === '1';
  // RELATIVE Location: request.url can carry the container's host inside Docker.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: expired ? '/login?expired=1' : '/login', 'Cache-Control': 'no-store' },
  });
  response.cookies.set(AUTH_COOKIE, '', clearedAuthCookieOptions());
  return response;
}

export function GET(request: Request): NextResponse {
  return logout(request);
}

export function POST(request: Request): NextResponse {
  if (!isSameOrigin(request.headers)) {
    return NextResponse.json(makeApiError(403, 'FORBIDDEN', 'Forbidden'), { status: 403 });
  }
  return logout(request);
}
