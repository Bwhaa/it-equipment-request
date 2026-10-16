import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

function envFileValue(file: string, key: string): string {
  const line = readFileSync(file, 'utf8')
    .split('\n')
    .find((candidate) => candidate.startsWith(`${key}=`));
  if (line === undefined) throw new Error(`${key} not found in ${file}`);
  return line.slice(key.length + 1).trim();
}

const ENV_EXAMPLE = join(__dirname, '../../../../.env.example');
const ENV_TEST = join(__dirname, '../../.env.test');

describe('placeholder JWT_SECRET', () => {
  it('rejects the value shipped in .env.example', () => {
    const placeholder = envFileValue(ENV_EXAMPLE, 'JWT_SECRET');
    expect(placeholder.length).toBeGreaterThanOrEqual(32);
    expect(() => readJwtConfig(configOf({ JWT_SECRET: placeholder }))).toThrow(/JWT_SECRET/);
    expect(() => readJwtConfig(configOf({ JWT_SECRET: placeholder }))).toThrow(/placeholder/);
  });

  it('accepts the secret of apps/api/.env.test', () => {
    const secret = envFileValue(ENV_TEST, 'JWT_SECRET');
    expect(readJwtConfig(configOf({ JWT_SECRET: secret })).secret).toBe(secret);
  });

  const tail = 'x'.repeat(40);
  it.each([
    [`CHANGE-ME-${tail}`],
    [`change_me_${tail}`],
    [`changeme${tail}`],
    [`replace-me-${tail}`],
    [`Replace_Me_${tail}`],
    [` change-me-${tail} `],
  ])('rejects the placeholder prefix in %j', (secret) => {
    expect(() => readJwtConfig(configOf({ JWT_SECRET: secret }))).toThrow(/JWT_SECRET/);
  });

  it.each([['f3a9c1d27b6e48f0a5c3d1e9b7a2f4c6d8e0b1a3c5d7e9f1a2b4c6d8e0f1a3b5'], ['my-change-me-in-the-middle-of-a-secret-value']])(
    'accepts %j (the check is a PREFIX check)',
    (secret) => {
      expect(readJwtConfig(configOf({ JWT_SECRET: secret })).secret).toBe(secret);
    },
  );
});
