/**
 * Response headers for every page and Route Handler (applied from next.config.ts).
 * The CSP is limited to frame-ancestors on purpose (no script-src/default-src); HSTS is not set here because it
 * belongs to the TLS proxy.
 */
export const SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
