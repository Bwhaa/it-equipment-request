import request from 'supertest';
import { PasswordService } from '../src/auth/password.service';
import { createTestApp, useTestApp } from './support/create-test-app';

// One app per file => one in-memory limiter. Every test uses its own emails and its own
// X-Forwarded-For value (TRUST_PROXY=loopback in .env.test) so tests cannot interfere.
// Order matters for the three seeded users: tests that lock a seeded user run after the tests that need it.

const getCtx = useTestApp();
const http = () => request(getCtx().app.getHttpServer());

const TOO_MANY = {
  statusCode: 429,
  error: 'Too Many Requests',
  message: 'Too many failed login attempts. Try again later.',
  code: 'TOO_MANY_REQUESTS',
};

function login(email: string, password: string, ip: string) {
  return http().post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ email, password });
}

describe('login rate limiting', () => {
  it('requests that fail validation (400) do not count', async () => {
    for (let i = 0; i < 10; i += 1) {
      await http()
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '198.51.100.6')
        .send({ email: 'admin@company.com', password: '123' })
        .expect(400);
    }
    await login('admin@company.com', 'Admin@123', '198.51.100.6').expect(200);
  });

  it('locks an email after 5 failures: 6th attempt (correct password) -> 429 without a bcrypt compare', async () => {
    const ip = '198.51.100.1';
    for (let i = 0; i < 5; i += 1) {
      await login('employee2@company.com', 'Wrong@123', ip).expect(401);
    }
    const compareSpy = jest.spyOn(getCtx().app.get(PasswordService), 'compare');
    const res = await login('employee2@company.com', 'Employee@123', ip).expect(429);
    expect(res.body).toEqual(TOO_MANY);
    const retryAfter = Number(res.headers['retry-after']);
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(900);
    expect(compareSpy).not.toHaveBeenCalled();
    compareSpy.mockRestore();
  });

  it('other accounts keep working during a lockout', async () => {
    await login('admin@company.com', 'Admin@123', '198.51.100.2').expect(200);
  });

  it('case variants share one counter', async () => {
    const ip = '198.51.100.3';
    for (let i = 0; i < 3; i += 1) await login('Employee1@Company.com', 'Wrong@123', ip).expect(401);
    for (let i = 0; i < 2; i += 1) await login('employee1@company.com', 'Wrong@123', ip).expect(401);
    const upper = await login('Employee1@Company.com', 'Wrong@123', ip).expect(429);
    const lower = await login('employee1@company.com', 'Employee@123', ip).expect(429);
    expect(upper.body).toEqual(TOO_MANY);
    expect(lower.body).toEqual(TOO_MANY);
  });

  it('an unknown email is blocked with the same 429 shape', async () => {
    const ip = '198.51.100.4';
    for (let i = 0; i < 5; i += 1) await login('ghost@nowhere.example', 'Whatever1', ip).expect(401);
    const res = await login('ghost@nowhere.example', 'Whatever1', ip).expect(429);
    expect(res.body).toEqual(TOO_MANY);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('per IP: 8 failures with 8 different emails block the 9th email; other IPs and successes are unaffected/blocked as specified', async () => {
    const blockedIp = '203.0.113.9';
    for (let i = 0; i < 8; i += 1) await login(`ip-user-${i}@nowhere.example`, 'Whatever1', blockedIp).expect(401);

    const blocked = await login('ip-user-8@nowhere.example', 'Whatever1', blockedIp).expect(429);
    expect(blocked.body).toEqual(TOO_MANY);

    await login('ip-user-8@nowhere.example', 'Whatever1', '203.0.113.10').expect(401);

    // a successful credential from the blocked IP is still blocked: success never clears the IP counter
    await login('admin@company.com', 'Admin@123', blockedIp).expect(429);
  });

  it('a success resets the email counter (admin: 4 wrong, 1 correct, then 5 wrong, then blocked)', async () => {
    // Two different IPs so the per-IP limit (8) is not what this test measures: 4 + 5 failures from one IP would exceed it.
    for (let i = 0; i < 4; i += 1) await login('admin@company.com', 'Wrong@123', '198.51.100.5').expect(401);
    await login('admin@company.com', 'Admin@123', '198.51.100.5').expect(200);
    for (let i = 0; i < 5; i += 1) await login('admin@company.com', 'Wrong@123', '198.51.100.55').expect(401);
    const res = await login('admin@company.com', 'Admin@123', '198.51.100.55').expect(429);
    expect(res.body).toEqual(TOO_MANY);
  });
});

describe('per-IP limit needs a forwarded address', () => {
  // TRUST_PROXY=loopback and LOGIN_MAX_FAILURES_PER_IP=8 in .env.test. Without a real X-Forwarded-For every caller
  // would share the address of the BFF, so the IP limiter must stay out of the way.
  it('12 failed logins with 12 different emails and NO X-Forwarded-For are all 401 (never 429)', async () => {
    for (let i = 0; i < 12; i += 1) {
      const res = await http().post('/api/v1/auth/login').send({ email: `no-xff-${i}@nowhere.example`, password: 'Whatever1' });
      expect(res.status).toBe(401);
    }
  });

  it('a blank X-Forwarded-For header is treated like a missing one', async () => {
    for (let i = 0; i < 12; i += 1) {
      const res = await http()
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '   ')
        .send({ email: `blank-xff-${i}@nowhere.example`, password: 'Whatever1' });
      expect(res.status).toBe(401);
    }
  });
});

describe('login rate limit boot refusal', () => {
  const NAMES = ['LOGIN_MAX_FAILURES_PER_EMAIL', 'LOGIN_RATE_WINDOW_SECONDS'] as const;
  const saved = new Map<string, string | undefined>(NAMES.map((name) => [name, process.env[name]]));

  afterEach(() => {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it.each([
    ['LOGIN_MAX_FAILURES_PER_EMAIL', '0'],
    ['LOGIN_MAX_FAILURES_PER_EMAIL', 'abc'],
    ['LOGIN_RATE_WINDOW_SECONDS', '0'],
  ])('%s=%p -> app creation rejects naming the variable', async (name, value) => {
    process.env[name] = value;
    await expect(createTestApp()).rejects.toThrow(new RegExp(name));
  });
});
