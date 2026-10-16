import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { isApiError, makeApiError } from '@/lib/api-error';
import { getApiUrl, getJwtSecretKey, isCookieSecure } from '@/lib/env';
import { retryAfterMinutes } from '@/lib/retry-after';
import { isRole, isUuid } from '@/lib/roles';
import { isSameOrigin } from '@/lib/same-origin';

const saved = { api: process.env.API_URL, secret: process.env.JWT_SECRET, secure: process.env.COOKIE_SECURE };
afterEach(() => {
  for (const [name, value] of [
    ['API_URL', saved.api],
    ['JWT_SECRET', saved.secret],
    ['COOKIE_SECURE', saved.secure],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('isSameOrigin', () => {
  const headers = (init: Record<string, string>) => new Headers(init);
  it('no Origin -> true (curl, server-to-server)', () => {
    expect(isSameOrigin(headers({ host: 'localhost:3000' }))).toBe(true);
  });
  it('same host -> true', () => {
    expect(isSameOrigin(headers({ host: 'localhost:3000', origin: 'http://localhost:3000' }))).toBe(true);
  });
  it('other host -> false', () => {
    expect(isSameOrigin(headers({ host: 'localhost:3000', origin: 'http://evil.example' }))).toBe(false);
    expect(isSameOrigin(headers({ host: 'localhost:3000', origin: 'http://localhost:4000' }))).toBe(false);
  });
  it('garbage Origin -> false', () => {
    expect(isSameOrigin(headers({ host: 'localhost:3000', origin: 'not a url' }))).toBe(false);
  });
});

describe('retryAfterMinutes', () => {
  it.each([
    ['1', 1],
    ['60', 1],
    ['61', 2],
    ['900', 15],
    [null, 1],
    [undefined, 1],
    ['abc', 1],
    ['0', 1],
  ])('%p -> %p', (input, expected) => {
    expect(retryAfterMinutes(input)).toBe(expected);
  });
});

describe('isApiError', () => {
  const valid = makeApiError(409, 'VERSION_CONFLICT', 'conflict');
  it('accepts a valid ApiError (string or string[] message)', () => {
    expect(isApiError(valid)).toBe(true);
    expect(isApiError({ ...valid, message: ['a', 'b'] })).toBe(true);
  });
  it('rejects a missing field and an unknown code', () => {
    const withoutError = { statusCode: valid.statusCode, message: valid.message, code: valid.code };
    expect(isApiError(withoutError)).toBe(false);
    expect(isApiError({ ...valid, code: 'NOPE' })).toBe(false);
    expect(isApiError({ ...valid, message: 5 })).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError('x')).toBe(false);
  });
  it('knows all twelve codes', () => {
    for (const code of [
      'VALIDATION_ERROR',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'INVALID_STATUS',
      'INSUFFICIENT_STOCK',
      'EQUIPMENT_INACTIVE',
      'VERSION_CONFLICT',
      'EQUIPMENT_UNAVAILABLE',
      'TOO_MANY_REQUESTS',
      'INTERNAL_ERROR',
      'DUPLICATE_EQUIPMENT_NAME',
    ] as const) {
      expect(isApiError(makeApiError(400, code, 'm'))).toBe(true);
    }
  });
});

describe('env helpers', () => {
  it('getApiUrl strips trailing slashes and throws when unset', () => {
    process.env.API_URL = 'http://api.test/api/v1///';
    expect(getApiUrl()).toBe('http://api.test/api/v1');
    delete process.env.API_URL;
    expect(() => getApiUrl()).toThrow(/API_URL/);
  });

  it('getJwtSecretKey encodes a long enough secret and rejects a short or missing one', () => {
    process.env.JWT_SECRET = 'x'.repeat(32);
    expect(getJwtSecretKey()).toEqual(new TextEncoder().encode('x'.repeat(32)));
    process.env.JWT_SECRET = 'x'.repeat(31);
    expect(() => getJwtSecretKey()).toThrow(/JWT_SECRET/);
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecretKey()).toThrow(/JWT_SECRET/);
  });

  it('isCookieSecure is true only for the string "true"', () => {
    process.env.COOKIE_SECURE = 'true';
    expect(isCookieSecure()).toBe(true);
    process.env.COOKIE_SECURE = 'false';
    expect(isCookieSecure()).toBe(false);
    delete process.env.COOKIE_SECURE;
    expect(isCookieSecure()).toBe(false);
  });
});

describe('roles', () => {
  it('isRole and isUuid', () => {
    expect(isRole('ADMIN')).toBe(true);
    expect(isRole('EMPLOYEE')).toBe(true);
    expect(isRole('SUPERADMIN')).toBe(false);
    expect(isUuid('a0000000-0000-4000-8000-000000000001')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid(5)).toBe(false);
  });
});

const placeholderFromEnvExample = (): string => {
  const text = readFileSync(fileURLToPath(new URL('../../../.env.example', import.meta.url)), 'utf8');
  const line = text.split('\n').find((candidate) => candidate.startsWith('JWT_SECRET='));
  return (line ?? '').slice('JWT_SECRET='.length).trim();
};

describe('placeholder JWT_SECRET (must stay identical to apps/api/src/auth/auth.config.ts)', () => {
  it('getJwtSecretKey rejects the value shipped in .env.example', () => {
    const placeholder = placeholderFromEnvExample();
    expect(placeholder.length).toBeGreaterThanOrEqual(32);
    process.env.JWT_SECRET = placeholder;
    expect(() => getJwtSecretKey()).toThrow(/JWT_SECRET/);
    expect(() => getJwtSecretKey()).toThrow(/placeholder/);
  });

  it.each([['CHANGE-ME-'], ['change_me_'], ['changeme'], ['replace-me-'], [' change-me-']])('rejects the prefix %j', (prefix) => {
    process.env.JWT_SECRET = `${prefix}${'x'.repeat(40)}`;
    expect(() => getJwtSecretKey()).toThrow(/JWT_SECRET/);
  });

  it('accepts a 40-character random value and a value with change-me in the middle', () => {
    process.env.JWT_SECRET = 'q8Zr3KfV1mXw5TnB7yLc9PdH2sGj4UaE6oRiN0vC';
    expect(getJwtSecretKey()).toEqual(new TextEncoder().encode('q8Zr3KfV1mXw5TnB7yLc9PdH2sGj4UaE6oRiN0vC'));
    process.env.JWT_SECRET = 'my-change-me-in-the-middle-of-a-secret-value';
    expect(() => getJwtSecretKey()).not.toThrow();
  });
});
