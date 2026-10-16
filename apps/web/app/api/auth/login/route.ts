import type { ApiError, UserSummary } from '@app/shared';
import { NextResponse } from 'next/server';
import { isApiError, makeApiError } from '@/lib/api-error';
import { AUTH_COOKIE, authCookieOptions } from '@/lib/auth-constants';
import { getApiUrl } from '@/lib/env';
import { API_TIMEOUT_MS } from '@/lib/http-constants';
import { isRole, isUuid } from '@/lib/roles';
import { isSameOrigin } from '@/lib/same-origin';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

function errorResponse(body: ApiError, extraHeaders: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, { status: body.statusCode, headers: { ...NO_STORE, ...extraHeaders } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface LoginSuccess {
  accessToken: string;
  user: UserSummary;
}

function parseLoginSuccess(value: unknown): LoginSuccess | undefined {
  if (!isRecord(value) || typeof value.accessToken !== 'string' || value.accessToken === '') return undefined;
  const user = value.user;
  if (
    !isRecord(user) ||
    !isUuid(user.id) ||
    typeof user.name !== 'string' ||
    typeof user.email !== 'string' ||
    !isRole(user.role)
  ) {
    return undefined;
  }
  return { accessToken: value.accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOrigin(request.headers)) {
    return errorResponse(makeApiError(403, 'FORBIDDEN', 'Forbidden'));
  }
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return errorResponse(makeApiError(415, 'VALIDATION_ERROR', 'Content-Type must be application/json'));
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(makeApiError(400, 'VALIDATION_ERROR', 'Invalid JSON body'));
  }
  if (!isRecord(body) || typeof body.email !== 'string' || typeof body.password !== 'string') {
    return errorResponse(makeApiError(400, 'VALIDATION_ERROR', 'email and password are required'));
  }

  // Only what the API needs: never forward the client's Cookie / Authorization / other headers.
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor !== null && forwardedFor.trim() !== '') headers['X-Forwarded-For'] = forwardedFor;

  let upstream: Response;
  try {
    upstream = await fetch(`${getApiUrl()}/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: body.email, password: body.password }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch {
    return errorResponse(makeApiError(502, 'INTERNAL_ERROR', 'Cannot reach the API'));
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    payload = undefined;
  }

  if (!upstream.ok) {
    if (isApiError(payload)) {
      const retryAfter = upstream.headers.get('retry-after');
      return errorResponse(payload, upstream.status === 429 && retryAfter ? { 'Retry-After': retryAfter } : {});
    }
    return errorResponse(makeApiError(502, 'INTERNAL_ERROR', 'Unexpected response from the API'));
  }

  const success = parseLoginSuccess(payload);
  if (!success) {
    return errorResponse(makeApiError(502, 'INTERNAL_ERROR', 'Unexpected response from the API'));
  }

  // The token goes into the httpOnly cookie only; the browser receives { user } and nothing else.
  const response = NextResponse.json({ user: success.user }, { status: 200, headers: NO_STORE });
  response.cookies.set(AUTH_COOKIE, success.accessToken, authCookieOptions());
  return response;
}
