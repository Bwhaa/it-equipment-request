import type { ConfigService } from '@nestjs/config';

const MIN_SECRET_LENGTH = 32;
const EXPIRES_IN_PATTERN = /^\d+[smhd]$/;
// The same rule lives in apps/web/lib/env.ts: the two copies must stay identical (the shared package is type-only).
const PLACEHOLDER_SECRET_PATTERN = /^(change[-_ ]?me|replace[-_ ]?me)/i;

export function readJwtConfig(config: ConfigService): { secret: string; expiresIn: string } {
  const secret = config.get<string>('JWT_SECRET');
  if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters long`);
  }
  if (PLACEHOLDER_SECRET_PATTERN.test(secret.trim())) {
    throw new Error(
      'JWT_SECRET must not be the placeholder from .env.example. Generate a random value, for example: openssl rand -hex 32',
    );
  }

  const expiresIn = config.get<string>('JWT_EXPIRES_IN') ?? '1h';
  if (!EXPIRES_IN_PATTERN.test(expiresIn)) {
    throw new Error(`JWT_EXPIRES_IN must look like 15s, 30m, 1h or 7d (got "${expiresIn}")`);
  }

  return { secret, expiresIn };
}
