import type { ApiError, ErrorCode } from '@app/shared';

// Exhaustive by type: adding an ErrorCode in @app/shared fails the build until it is listed here.
const ERROR_CODES: Record<ErrorCode, true> = {
  VALIDATION_ERROR: true,
  UNAUTHORIZED: true,
  FORBIDDEN: true,
  NOT_FOUND: true,
  INVALID_STATUS: true,
  INSUFFICIENT_STOCK: true,
  EQUIPMENT_INACTIVE: true,
  VERSION_CONFLICT: true,
  DUPLICATE_EQUIPMENT_NAME: true,
  EQUIPMENT_UNAVAILABLE: true,
  IDEMPOTENCY_KEY_REUSED: true,
  TOO_MANY_REQUESTS: true,
  INTERNAL_ERROR: true,
};

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_CODES, value);
}

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const message = candidate.message;
  return (
    typeof candidate.statusCode === 'number' &&
    typeof candidate.error === 'string' &&
    (typeof message === 'string' || (Array.isArray(message) && message.every((item) => typeof item === 'string'))) &&
    isErrorCode(candidate.code)
  );
}

export function makeApiError(statusCode: number, code: ErrorCode, message: string | string[]): ApiError {
  return { statusCode, error: STATUS_TEXT[statusCode] ?? 'Error', message, code };
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError,
  ) {
    super(Array.isArray(body.message) ? body.message.join('; ') : body.message);
    this.name = 'ApiRequestError';
  }
}
