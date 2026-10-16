import type { ConfigService } from '@nestjs/config';

export interface LoginRateLimitConfig {
  windowSeconds: number;
  maxPerEmail: number;
  maxPerIp: number;
  ipLimitEnabled: boolean;
}

function readInteger(config: ConfigService, name: string, fallback: number, min: number, max?: number): number {
  const raw = config.get<string>(name);
  if (raw === undefined) return fallback;
  const trimmed = String(raw).trim();
  const value = /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  if (!Number.isSafeInteger(value) || value < min || (max !== undefined && value > max)) {
    const range = max === undefined ? `an integer >= ${min}` : `an integer between ${min} and ${max}`;
    throw new Error(`${name} must be ${range} (got "${raw}")`);
  }
  return value;
}

export function readLoginRateLimitConfig(config: ConfigService): LoginRateLimitConfig {
  return {
    windowSeconds: readInteger(config, 'LOGIN_RATE_WINDOW_SECONDS', 900, 1, 86400),
    maxPerEmail: readInteger(config, 'LOGIN_MAX_FAILURES_PER_EMAIL', 10, 1),
    maxPerIp: readInteger(config, 'LOGIN_MAX_FAILURES_PER_IP', 50, 1),
    ipLimitEnabled: (config.get<string>('TRUST_PROXY') ?? '').trim() !== '',
  };
}
