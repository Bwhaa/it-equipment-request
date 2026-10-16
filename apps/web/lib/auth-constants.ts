import { isCookieSecure } from './env';

export const AUTH_COOKIE = 'access_token';
export const COOKIE_MAX_AGE_SECONDS = 3600;

export function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isCookieSecure(),
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

/** Options that delete the auth cookie (same attributes, empty value, maxAge 0). */
export function clearedAuthCookieOptions() {
  return { ...authCookieOptions(), maxAge: 0 };
}
