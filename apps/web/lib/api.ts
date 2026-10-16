import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiRequestError, isApiError, makeApiError } from './api-error';
import { AUTH_COOKIE } from './auth-constants';
import { getApiUrl } from './env';
import { API_TIMEOUT_MS } from './http-constants';

export interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

/**
 * The ONLY way the web app talks to the NestJS API (server-side). It never changes cookies:
 * on 401 it redirects to the logout Route Handler, which deletes the cookie.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) redirect('/login');

  const url = new URL(`${getApiUrl()}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  } catch {
    throw new ApiRequestError(503, makeApiError(503, 'INTERNAL_ERROR', 'Cannot reach the API'));
  }

  // redirect() works by throwing, so it must stay outside any try/catch.
  if (response.status === 401) redirect('/api/auth/logout?expired=1');

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    const body = isApiError(payload)
      ? payload
      : makeApiError(response.status, response.status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR', 'Unexpected response from the API');
    throw new ApiRequestError(response.status, body);
  }

  return (await response.json()) as T;
}
