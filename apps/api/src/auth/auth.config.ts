import type { ConfigService } from '@nestjs/config';

const MIN_SECRET_LENGTH = 32;
const EXPIRES_IN_PATTERN = /^\d+[smhd]$/;

export function readJwtConfig(config: ConfigService): { secret: string; expiresIn: string } {
  const secret = config.get<string>('JWT_SECRET');
  if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters long`);
  }

  const expiresIn = config.get<string>('JWT_EXPIRES_IN') ?? '1h';
  if (!EXPIRES_IN_PATTERN.test(expiresIn)) {
    throw new Error(`JWT_EXPIRES_IN must look like 15s, 30m, 1h or 7d (got "${expiresIn}")`);
  }

  return { secret, expiresIn };
}
