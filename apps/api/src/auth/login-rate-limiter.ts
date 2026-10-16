import { Inject, Injectable } from '@nestjs/common';
import type { LoginRateLimitConfig } from './rate-limit.config';

export const LOGIN_RATE_LIMIT_CONFIG = Symbol('LOGIN_RATE_LIMIT_CONFIG');

const SWEEP_THRESHOLD = 5000;

interface Counter {
  count: number;
  resetAt: number;
}

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export function normalizeEmailKey(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * In-memory limiter for FAILED logins: fixed windows per email and (optionally) per IP.
 * No timers: expired entries are pruned lazily.
 */
@Injectable()
export class LoginRateLimiter {
  private readonly emails = new Map<string, Counter>();
  private readonly ips = new Map<string, Counter>();

  constructor(@Inject(LOGIN_RATE_LIMIT_CONFIG) private readonly config: LoginRateLimitConfig) {}

  /** Number of tracked keys (for tests). */
  get trackedKeys(): number {
    return this.emails.size + this.ips.size;
  }

  check(emailKey: string, ip?: string): RateLimitDecision {
    const now = Date.now();
    this.sweepIfLarge(now);

    const blockedUntil: number[] = [];
    const emailCounter = this.live(this.emails, emailKey, now);
    if (emailCounter && emailCounter.count >= this.config.maxPerEmail) blockedUntil.push(emailCounter.resetAt);
    if (this.useIp(ip)) {
      const ipCounter = this.live(this.ips, ip, now);
      if (ipCounter && ipCounter.count >= this.config.maxPerIp) blockedUntil.push(ipCounter.resetAt);
    }

    if (blockedUntil.length === 0) return { allowed: true };
    const retryAfterSeconds = Math.max(1, Math.ceil((Math.max(...blockedUntil) - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  recordFailure(emailKey: string, ip?: string): void {
    const now = Date.now();
    this.increment(this.emails, emailKey, now);
    if (this.useIp(ip)) this.increment(this.ips, ip, now);
  }

  recordSuccess(emailKey: string): void {
    this.emails.delete(emailKey);
  }

  private useIp(ip: string | undefined): ip is string {
    return this.config.ipLimitEnabled && ip !== undefined && ip !== '';
  }

  private live(map: Map<string, Counter>, key: string, now: number): Counter | undefined {
    const counter = map.get(key);
    if (counter && counter.resetAt <= now) {
      map.delete(key);
      return undefined;
    }
    return counter;
  }

  private increment(map: Map<string, Counter>, key: string, now: number): void {
    const counter = this.live(map, key, now);
    if (counter) counter.count += 1;
    else map.set(key, { count: 1, resetAt: now + this.config.windowSeconds * 1000 });
  }

  private sweepIfLarge(now: number): void {
    if (this.emails.size + this.ips.size <= SWEEP_THRESHOLD) return;
    for (const map of [this.emails, this.ips]) {
      for (const [key, counter] of map) {
        if (counter.resetAt <= now) map.delete(key);
      }
    }
  }
}
