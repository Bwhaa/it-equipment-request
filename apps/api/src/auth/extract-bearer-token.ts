/** Accepts only `Bearer <token>` (scheme case-insensitive, one space, one non-empty token). */
export function extractBearerToken(header: string | string[] | undefined): string | undefined {
  if (typeof header !== 'string') return undefined;
  const parts = header.split(' ');
  if (parts.length !== 2) return undefined;
  const [scheme, token] = parts;
  if (scheme.toLowerCase() !== 'bearer' || token === '') return undefined;
  return token;
}
