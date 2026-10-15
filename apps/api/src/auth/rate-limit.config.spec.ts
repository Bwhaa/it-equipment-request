import type { ConfigService } from '@nestjs/config';
import { readLoginRateLimitConfig } from './rate-limit.config';

function configOf(env: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

describe('readLoginRateLimitConfig', () => {
  it('uses the defaults and leaves the IP limit off', () => {
    expect(readLoginRateLimitConfig(configOf({}))).toEqual({
      windowSeconds: 900,
      maxPerEmail: 10,
      maxPerIp: 50,
      ipLimitEnabled: false,
    });
  });

  it('reads valid values', () => {
    expect(
      readLoginRateLimitConfig(
        configOf({
          LOGIN_RATE_WINDOW_SECONDS: '60',
          LOGIN_MAX_FAILURES_PER_EMAIL: '3',
          LOGIN_MAX_FAILURES_PER_IP: '8',
          TRUST_PROXY: 'loopback',
        }),
      ),
    ).toEqual({ windowSeconds: 60, maxPerEmail: 3, maxPerIp: 8, ipLimitEnabled: true });
  });

  it.each(['', '   '])('TRUST_PROXY %p keeps the IP limit off', (value) => {
    expect(readLoginRateLimitConfig(configOf({ TRUST_PROXY: value })).ipLimitEnabled).toBe(false);
  });

  it('accepts the window boundaries 1 and 86400', () => {
    expect(readLoginRateLimitConfig(configOf({ LOGIN_RATE_WINDOW_SECONDS: '1' })).windowSeconds).toBe(1);
    expect(readLoginRateLimitConfig(configOf({ LOGIN_RATE_WINDOW_SECONDS: '86400' })).windowSeconds).toBe(86400);
  });

  it.each([
    ['LOGIN_RATE_WINDOW_SECONDS', '0'],
    ['LOGIN_RATE_WINDOW_SECONDS', '86401'],
    ['LOGIN_RATE_WINDOW_SECONDS', 'abc'],
    ['LOGIN_RATE_WINDOW_SECONDS', '1.5'],
    ['LOGIN_RATE_WINDOW_SECONDS', ''],
    ['LOGIN_MAX_FAILURES_PER_EMAIL', '0'],
    ['LOGIN_MAX_FAILURES_PER_EMAIL', 'abc'],
    ['LOGIN_MAX_FAILURES_PER_EMAIL', '-1'],
    ['LOGIN_MAX_FAILURES_PER_IP', '0'],
    ['LOGIN_MAX_FAILURES_PER_IP', 'ten'],
  ])('%s=%p throws an error naming the variable', (name, value) => {
    expect(() => readLoginRateLimitConfig(configOf({ [name]: value }))).toThrow(new RegExp(name));
  });
});
