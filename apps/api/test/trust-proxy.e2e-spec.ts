import request from 'supertest';
import { createTestApp } from './support/create-test-app';
import type { TestApp } from './support/create-test-app';
import { IpTestController } from './support/ip-test.controller';

// Proves that configureApp applies TRUST_PROXY to Express (parseTrustProxy itself is unit-tested).
const ENV_NAMES = ['TRUST_PROXY', 'LOGIN_MAX_FAILURES_PER_IP', 'LOGIN_MAX_FAILURES_PER_EMAIL'] as const;
const original = new Map<string, string | undefined>(ENV_NAMES.map((name) => [name, process.env[name]]));
const LOOPBACK = /^(::1|127\.\d+\.\d+\.\d+|::ffff:127\.\d+\.\d+\.\d+)$/;

let current: TestApp | undefined;

afterEach(async () => {
  await current?.app.close();
  current = undefined;
  for (const [name, value] of original) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

async function appWith(trustProxy: string | undefined, extraEnv: Record<string, string> = {}): Promise<TestApp> {
  if (trustProxy === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = trustProxy;
  Object.assign(process.env, extraEnv);
  current = await createTestApp([IpTestController]);
  return current;
}

async function ipSeenFor(forwardedFor: string): Promise<string | undefined> {
  const res = await request(current?.app.getHttpServer()).get('/api/v1/__test/ip').set('X-Forwarded-For', forwardedFor).expect(200);
  return (res.body as { ip?: string }).ip;
}

describe('TRUST_PROXY wiring', () => {
  it.each([[undefined], ['false'], ['']])('TRUST_PROXY=%p: X-Forwarded-For is NOT trusted', async (value) => {
    await appWith(value);
    const ip = await ipSeenFor('203.0.113.9');
    expect(ip).not.toBe('203.0.113.9');
    expect(ip).toMatch(LOOPBACK);
  });

  it("'loopback': the client entry is used, a spoofed left entry is ignored, a non-trusted hop stops the walk", async () => {
    await appWith('loopback');
    expect(await ipSeenFor('203.0.113.9')).toBe('203.0.113.9');
    expect(await ipSeenFor('1.1.1.1, 203.0.113.9')).toBe('203.0.113.9');
    expect(await ipSeenFor('203.0.113.9, 10.0.0.1')).toBe('10.0.0.1');
  });

  it("'true': the left-most entry is used", async () => {
    await appWith('true');
    expect(await ipSeenFor('203.0.113.9, 10.0.0.1')).toBe('203.0.113.9');
  });

  it("'1': trusts exactly one hop", async () => {
    await appWith('1');
    expect(await ipSeenFor('1.1.1.1, 203.0.113.9')).toBe('203.0.113.9');
  });

  it("'loopback, linklocal, uniquelocal': a Docker-style private hop is trusted", async () => {
    await appWith('loopback, linklocal, uniquelocal');
    expect(await ipSeenFor('203.0.113.9, 10.1.2.3')).toBe('203.0.113.9');
  });

  it('the login rate limiter sees the forwarded address (per-IP limit 3)', async () => {
    await appWith('loopback', { LOGIN_MAX_FAILURES_PER_IP: '3', LOGIN_MAX_FAILURES_PER_EMAIL: '50' });
    const login = (email: string, forwardedFor: string) =>
      request(current?.app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', forwardedFor)
        .send({ email, password: 'Wrong@123' });

    for (const email of ['proxy-a@nowhere.example', 'proxy-b@nowhere.example', 'proxy-c@nowhere.example']) {
      await login(email, '203.0.113.50').expect(401);
    }
    const blocked = await login('proxy-d@nowhere.example', '203.0.113.50').expect(429);
    expect(blocked.body.code).toBe('TOO_MANY_REQUESTS');
    await login('proxy-d@nowhere.example', '203.0.113.51').expect(401);
  });
});
