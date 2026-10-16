import type { ConfigService } from '@nestjs/config';
import { readJwtConfig } from './auth.config';

function configOf(env: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

const SECRET_32 = 's'.repeat(32);

describe('readJwtConfig', () => {
  it('rejects a 31-character secret and mentions JWT_SECRET', () => {
    expect(() => readJwtConfig(configOf({ JWT_SECRET: 's'.repeat(31) }))).toThrow(/JWT_SECRET/);
  });

  it('accepts a 32-character secret', () => {
    expect(readJwtConfig(configOf({ JWT_SECRET: SECRET_32 })).secret).toBe(SECRET_32);
  });

  it('rejects a missing secret', () => {
    expect(() => readJwtConfig(configOf({}))).toThrow(/JWT_SECRET/);
  });

  it.each(['1h', '15s', '7d', '30m'])('accepts JWT_EXPIRES_IN %p', (expiresIn) => {
    expect(readJwtConfig(configOf({ JWT_SECRET: SECRET_32, JWT_EXPIRES_IN: expiresIn })).expiresIn).toBe(expiresIn);
  });

  it.each(['1 hour', 'abc', ''])('rejects JWT_EXPIRES_IN %p', (expiresIn) => {
    expect(() => readJwtConfig(configOf({ JWT_SECRET: SECRET_32, JWT_EXPIRES_IN: expiresIn }))).toThrow(
      /JWT_EXPIRES_IN/,
    );
  });

  it('defaults JWT_EXPIRES_IN to 1h when unset', () => {
    expect(readJwtConfig(configOf({ JWT_SECRET: SECRET_32 })).expiresIn).toBe('1h');
  });
});
