import type { Role } from '@app/shared';
import { jwtVerify } from 'jose';
import { isRole, isUuid } from './roles';

export type Session =
  | { status: 'none' }
  | { status: 'invalid' }
  | { status: 'expired' }
  | { status: 'valid'; role: Role };

function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
}

/** Edge-safe: only jose (no jsonwebtoken). UX decision only; the real authorization is the NestJS guards. */
export async function verifySession(token: string | undefined, secret: Uint8Array): Promise<Session> {
  if (token === undefined || token.trim() === '') return { status: 'none' };

  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] }));
  } catch (error) {
    return errorCode(error) === 'ERR_JWT_EXPIRED' ? { status: 'expired' } : { status: 'invalid' };
  }

  const { sub, role } = payload;
  if (!isUuid(sub) || !isRole(role)) return { status: 'invalid' };
  return { status: 'valid', role };
}
