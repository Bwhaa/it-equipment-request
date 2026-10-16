// No 'server-only' here: the middleware (Edge runtime) imports this file too.

// The same rule lives in apps/api/src/auth/auth.config.ts: the two copies must stay identical (the shared package is type-only).
const PLACEHOLDER_SECRET_PATTERN = /^(change[-_ ]?me|replace[-_ ]?me)/i;

export function getApiUrl(): string {
  const value = process.env.API_URL;
  if (!value) throw new Error('API_URL is not set');
  return value.replace(/\/+$/, '');
}

export function isCookieSecure(): boolean {
  return process.env.COOKIE_SECURE === 'true';
}

export function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }
  if (PLACEHOLDER_SECRET_PATTERN.test(secret.trim())) {
    throw new Error(
      'JWT_SECRET must not be the placeholder from .env.example. Generate a random value, for example: openssl rand -hex 32',
    );
  }
  return new TextEncoder().encode(secret);
}
