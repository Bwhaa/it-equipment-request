import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { middleware, config } from '@/middleware';
import { verifySession } from '@/lib/session';

const SECRET = 'a-test-secret-that-is-exactly-forty-chars!';
const OTHER_SECRET = 'another-secret-that-is-also-forty-chars!!';
const ADMIN_ID = 'a0000000-0000-4000-8000-000000000001';
const key = (value: string) => new TextEncoder().encode(value);
const originalSecret = process.env.JWT_SECRET;

beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
});
afterEach(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

function sign(
  payload: Record<string, unknown>,
  options: { secret?: string; expiresAt?: number; sub?: string } = {},
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(options.sub ?? ADMIN_ID)
    .setIssuedAt()
    .setExpirationTime(options.expiresAt ?? Math.floor(Date.now() / 1000) + 600)
    .sign(key(options.secret ?? SECRET));
}

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

async function tokens() {
  const employee = await sign({ role: 'EMPLOYEE' });
  const admin = await sign({ role: 'ADMIN' });
  const [header, , signature] = employee.split('.');
  return {
    employee,
    admin,
    expired: await sign({ role: 'ADMIN' }, { expiresAt: Math.floor(Date.now() / 1000) - 60 }),
    otherSecret: await sign({ role: 'ADMIN' }, { secret: OTHER_SECRET }),
    none: `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: ADMIN_ID, role: 'ADMIN' })}.`,
    tampered: `${header}.${b64({ sub: ADMIN_ID, role: 'ADMIN' })}.${signature}`,
    superadmin: await sign({ role: 'SUPERADMIN' }),
    badSub: await sign({ role: 'ADMIN' }, { sub: 'not-a-uuid' }),
  };
}

function requestFor(pathname: string, token?: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`), {
    headers: token === undefined ? {} : { cookie: `access_token=${token}` },
  });
}

const isDeleted = (response: Response) => {
  const cookie = response.headers.get('set-cookie') ?? '';
  return /access_token=;/.test(cookie) && /Max-Age=0/i.test(cookie);
};

describe('verifySession', () => {
  it('classifies every kind of token', async () => {
    const t = await tokens();
    const secret = key(SECRET);
    expect(await verifySession(undefined, secret)).toEqual({ status: 'none' });
    expect(await verifySession('   ', secret)).toEqual({ status: 'none' });
    expect(await verifySession(t.employee, secret)).toEqual({ status: 'valid', role: 'EMPLOYEE' });
    expect(await verifySession(t.admin, secret)).toEqual({ status: 'valid', role: 'ADMIN' });
    expect(await verifySession(t.expired, secret)).toEqual({ status: 'expired' });
    for (const bad of [t.otherSecret, t.none, t.tampered, t.superadmin, t.badSub, 'garbage']) {
      expect(await verifySession(bad, secret)).toEqual({ status: 'invalid' });
    }
  });
});

describe('middleware (real jose)', () => {
  it.each([
    ['expired token', 'expired', '/login?expired=1'],
    ['token signed with another secret', 'otherSecret', '/login'],
    ['unsigned alg:none token', 'none', '/login'],
    ['tampered payload', 'tampered', '/login'],
    ['role SUPERADMIN', 'superadmin', '/login'],
    ['non-UUID sub', 'badSub', '/login'],
  ] as const)('%s -> 307 %s and the cookie is deleted', async (_label, name, location) => {
    const t = await tokens();
    const response = await middleware(requestFor('/equipments', t[name]));
    expect(response.status).toBe(307);
    const target = new URL(response.headers.get('location') ?? '');
    expect(`${target.pathname}${target.search}`).toBe(location);
    expect(isDeleted(response)).toBe(true);
  });

  it('a garbage cookie redirects to /login and deletes the cookie', async () => {
    const response = await middleware(requestFor('/equipments', 'garbage'));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/login');
    expect(isDeleted(response)).toBe(true);
  });

  it('no cookie: protected paths redirect to /login without touching cookies, /login passes', async () => {
    const redirect = await middleware(requestFor('/equipments'));
    expect(redirect.status).toBe(307);
    expect(new URL(redirect.headers.get('location') ?? '').pathname).toBe('/login');
    expect(redirect.headers.get('set-cookie')).toBeNull();
    const login = await middleware(requestFor('/login'));
    expect(login.headers.get('location')).toBeNull();
  });

  it('an invalid cookie on /login passes through and is deleted', async () => {
    const response = await middleware(requestFor('/login', 'garbage'));
    expect(response.headers.get('location')).toBeNull();
    expect(isDeleted(response)).toBe(true);
  });

  it('valid sessions pass through without deleting anything', async () => {
    const t = await tokens();
    for (const [path, token] of [
      ['/equipments', t.employee],
      ['/requests/xyz', t.employee],
      ['/admin/requests', t.admin],
      ['/foo', t.admin],
    ] as const) {
      const response = await middleware(requestFor(path, token));
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-next')).toBe('1');
      expect(isDeleted(response)).toBe(false);
      expect(response.headers.get('set-cookie')).toBeNull();
    }
  });

  it('valid sessions are redirected to their role home', async () => {
    const t = await tokens();
    const cases = [
      ['/', t.employee, '/equipments'],
      ['/login', t.employee, '/equipments'],
      ['/admin/requests', t.employee, '/equipments'],
      ['/', t.admin, '/admin/requests'],
      ['/login', t.admin, '/admin/requests'],
      ['/equipments', t.admin, '/admin/requests'],
      ['/requests', t.admin, '/admin/requests'],
    ] as const;
    for (const [path, token, expected] of cases) {
      const response = await middleware(requestFor(path, token));
      expect(response.status).toBe(307);
      expect(new URL(response.headers.get('location') ?? '').pathname).toBe(expected);
      expect(isDeleted(response)).toBe(false);
    }
  });

  it('the JWT_SECRET placeholder from .env.example makes the middleware throw an error naming JWT_SECRET', async () => {
    const text = readFileSync(fileURLToPath(new URL('../../../.env.example', import.meta.url)), 'utf8');
    const line = text.split('\n').find((candidate) => candidate.startsWith('JWT_SECRET='));
    process.env.JWT_SECRET = (line ?? '').slice('JWT_SECRET='.length).trim();
    await expect(middleware(requestFor('/equipments'))).rejects.toThrow(/JWT_SECRET/);
  });

  it.each([[undefined], ['short-secret']])('JWT_SECRET=%p makes the middleware throw an error naming JWT_SECRET', async (value) => {
    if (value === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = value;
    await expect(middleware(requestFor('/equipments'))).rejects.toThrow(/JWT_SECRET/);
  });

  it('the matcher skips api/auth, static assets and files with an extension', () => {
    const pattern = new RegExp(`^${config.matcher[0]}$`);
    for (const skipped of ['/api/auth/login', '/_next/static/x.js', '/_next/image', '/favicon.ico', '/logo.png']) {
      expect(pattern.test(skipped)).toBe(false);
    }
    for (const matched of ['/', '/login', '/equipments', '/admin/requests']) {
      expect(pattern.test(matched)).toBe(true);
    }
  });
});
