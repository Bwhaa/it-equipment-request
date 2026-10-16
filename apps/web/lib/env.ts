// No 'server-only' here: the middleware (Edge runtime) imports this file too.

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
  return new TextEncoder().encode(secret);
}
