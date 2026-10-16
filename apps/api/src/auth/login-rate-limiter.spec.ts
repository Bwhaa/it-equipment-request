import { LOGIN_RATE_LIMIT_CONFIG, LoginRateLimiter, normalizeEmailKey } from './login-rate-limiter';
import type { LoginRateLimitConfig } from './rate-limit.config';

const BASE: LoginRateLimitConfig = { windowSeconds: 900, maxPerEmail: 3, maxPerIp: 5, ipLimitEnabled: true };

function make(overrides: Partial<LoginRateLimitConfig> = {}): LoginRateLimiter {
  return new LoginRateLimiter({ ...BASE, ...overrides });
}

function fail(limiter: LoginRateLimiter, email: string, times: number, ip?: string): void {
  for (let i = 0; i < times; i += 1) limiter.recordFailure(email, ip);
}

describe('normalizeEmailKey', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmailKey('  Employee1@Company.COM ')).toBe('employee1@company.com');
  });
});

describe('LoginRateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-15T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('LOGIN_RATE_LIMIT_CONFIG is a distinct injection token', () => {
    expect(typeof LOGIN_RATE_LIMIT_CONFIG).toBe('symbol');
  });

  it('allows up to N-1 recorded failures plus the Nth, then blocks the next check', () => {
    const limiter = make();
    fail(limiter, 'a@x.com', 2);
    expect(limiter.check('a@x.com')).toEqual({ allowed: true });
    limiter.recordFailure('a@x.com'); // the 3rd failure is allowed to be recorded
    expect(limiter.check('a@x.com')).toMatchObject({ allowed: false });
  });

  it('counts per email key independently', () => {
    const limiter = make();
    fail(limiter, 'a@x.com', 3);
    expect(limiter.check('b@x.com')).toEqual({ allowed: true });
  });

  it('window expiry restores access and starts a fresh window', () => {
    const limiter = make();
    fail(limiter, 'a@x.com', 3);
    expect(limiter.check('a@x.com').allowed).toBe(false);
    jest.advanceTimersByTime(900_000);
    expect(limiter.check('a@x.com')).toEqual({ allowed: true });
    fail(limiter, 'a@x.com', 2);
    expect(limiter.check('a@x.com')).toEqual({ allowed: true });
  });

  it('retryAfterSeconds is the remaining window, rounded up, at least 1', () => {
    const limiter = make();
    fail(limiter, 'a@x.com', 3);
    expect(limiter.check('a@x.com')).toEqual({ allowed: false, retryAfterSeconds: 900 });
    jest.advanceTimersByTime(100_500);
    expect(limiter.check('a@x.com')).toEqual({ allowed: false, retryAfterSeconds: 800 });
    jest.advanceTimersByTime(799_000);
    expect(limiter.check('a@x.com')).toEqual({ allowed: false, retryAfterSeconds: 1 });
    jest.advanceTimersByTime(499);
    expect(limiter.check('a@x.com')).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it('the window starts at the first failure and blocked attempts do not extend it', () => {
    const limiter = make({ windowSeconds: 100 });
    fail(limiter, 'a@x.com', 1);
    jest.advanceTimersByTime(60_000);
    fail(limiter, 'a@x.com', 2);
    expect(limiter.check('a@x.com')).toEqual({ allowed: false, retryAfterSeconds: 40 });
    jest.advanceTimersByTime(30_000);
    limiter.check('a@x.com'); // blocked checks never extend anything
    expect(limiter.check('a@x.com')).toEqual({ allowed: false, retryAfterSeconds: 10 });
    jest.advanceTimersByTime(10_000);
    expect(limiter.check('a@x.com')).toEqual({ allowed: true });
  });

  it('success clears the email counter but not the IP counter', () => {
    const limiter = make({ maxPerEmail: 3, maxPerIp: 3 });
    fail(limiter, 'a@x.com', 3, '1.2.3.4');
    expect(limiter.check('a@x.com', '1.2.3.4').allowed).toBe(false);
    limiter.recordSuccess('a@x.com');
    expect(limiter.check('a@x.com')).toEqual({ allowed: true }); // email counter gone
    expect(limiter.check('a@x.com', '1.2.3.4').allowed).toBe(false); // IP counter remains
    expect(limiter.check('a@x.com', '5.6.7.8')).toEqual({ allowed: true });
  });

  it('blocks per IP across different emails', () => {
    const limiter = make();
    for (let i = 0; i < 5; i += 1) limiter.recordFailure(`user${i}@x.com`, '9.9.9.9');
    expect(limiter.check('fresh@x.com', '9.9.9.9')).toMatchObject({ allowed: false });
    expect(limiter.check('fresh@x.com', '8.8.8.8')).toEqual({ allowed: true });
    expect(limiter.check('fresh@x.com')).toEqual({ allowed: true }); // no ip given
  });

  it('ignores the IP entirely when the IP limit is disabled', () => {
    const limiter = make({ ipLimitEnabled: false, maxPerIp: 1 });
    for (let i = 0; i < 10; i += 1) limiter.recordFailure(`user${i}@x.com`, '9.9.9.9');
    expect(limiter.check('fresh@x.com', '9.9.9.9')).toEqual({ allowed: true });
    expect(limiter.trackedKeys).toBe(10); // only email keys are stored
  });

  it('reports the later window when both counters block', () => {
    const limiter = make({ maxPerEmail: 1, maxPerIp: 1, windowSeconds: 100 });
    limiter.recordFailure('old@x.com', '1.1.1.1'); // t=0
    jest.advanceTimersByTime(50_000);
    limiter.recordFailure('new@x.com', '2.2.2.2'); // t=50s, its windows end at 150s
    limiter.recordFailure('new@x.com', '1.1.1.1'); // ip 1.1.1.1 window ends at 100s
    expect(limiter.check('new@x.com', '1.1.1.1')).toEqual({ allowed: false, retryAfterSeconds: 100 });
  });

  it('prunes expired entries lazily, with a full sweep above 5000 keys', () => {
    const limiter = make({ ipLimitEnabled: false });
    for (let i = 0; i < 5001; i += 1) limiter.recordFailure(`user${i}@x.com`);
    expect(limiter.trackedKeys).toBe(5001);
    jest.advanceTimersByTime(900_000);
    limiter.check('someone@x.com'); // triggers the sweep
    expect(limiter.trackedKeys).toBe(0);
  });

  it('prunes a touched expired key without a full sweep', () => {
    const limiter = make();
    fail(limiter, 'a@x.com', 1);
    fail(limiter, 'b@x.com', 1);
    jest.advanceTimersByTime(900_000);
    limiter.check('a@x.com');
    expect(limiter.trackedKeys).toBe(1); // a pruned on touch, b still stored (expired but untouched)
  });
});
