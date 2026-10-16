import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from '@/lib/security-headers';

describe('SECURITY_HEADERS', () => {
  it('is exactly the documented list', () => {
    expect(SECURITY_HEADERS).toEqual([
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ]);
  });

  it('never sets Strict-Transport-Security (that belongs to the TLS proxy)', () => {
    expect(SECURITY_HEADERS.some((header) => header.key.toLowerCase() === 'strict-transport-security')).toBe(false);
  });

  it('keeps the CSP limited to frame-ancestors (no script-src or default-src)', () => {
    const csp = SECURITY_HEADERS.find((header) => header.key === 'Content-Security-Policy');
    expect(csp?.value).toBe("frame-ancestors 'none'");
    expect(csp?.value).not.toMatch(/script-src|default-src/);
  });
});
