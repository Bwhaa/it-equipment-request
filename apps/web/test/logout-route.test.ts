import { describe, expect, it } from 'vitest';
import { GET, POST } from '@/app/api/auth/logout/route';

function request(method: 'GET' | 'POST', path = '/api/auth/logout', headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost:3000${path}`, { method, headers: { host: 'localhost:3000', ...headers } });
}

const isDeleted = (response: Response) => {
  const cookie = response.headers.get('set-cookie') ?? '';
  return /access_token=;/.test(cookie) && /Max-Age=0/i.test(cookie) && /Path=\//.test(cookie);
};

describe('logout route', () => {
  it('GET -> 303 /login and the cookie is deleted', () => {
    const response = GET(request('GET'));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/login');
    expect(isDeleted(response)).toBe(true);
  });

  it('GET ?expired=1 -> 303 /login?expired=1', () => {
    const response = GET(request('GET', '/api/auth/logout?expired=1'));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/login?expired=1');
    expect(isDeleted(response)).toBe(true);
  });

  it('POST same-origin (and without Origin) -> 303 and the cookie is deleted', () => {
    for (const headers of [{}, { origin: 'http://localhost:3000' }] as Record<string, string>[]) {
      const response = POST(request('POST', '/api/auth/logout', headers));
      expect(response.status).toBe(303);
      expect(isDeleted(response)).toBe(true);
    }
  });

  it('POST cross-origin -> 403 and the cookie is not changed', () => {
    const response = POST(request('POST', '/api/auth/logout', { origin: 'http://evil.example' }));
    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('Location is always relative', () => {
    for (const response of [GET(request('GET')), GET(request('GET', '/api/auth/logout?expired=1')), POST(request('POST'))]) {
      expect(response.headers.get('location')?.startsWith('/')).toBe(true);
      expect(response.headers.get('location')).not.toMatch(/^https?:/);
    }
  });
});
