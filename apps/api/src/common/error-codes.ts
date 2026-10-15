import type { ErrorCode } from '@app/shared';

export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_STATUS: 409,
  INSUFFICIENT_STOCK: 409,
  EQUIPMENT_INACTIVE: 409,
  VERSION_CONFLICT: 409,
  EQUIPMENT_UNAVAILABLE: 422,
  INTERNAL_ERROR: 500,
} as const satisfies Record<ErrorCode, number>;

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_STATUS, value);
}
