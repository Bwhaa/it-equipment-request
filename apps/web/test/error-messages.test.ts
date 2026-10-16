import type { ErrorCode } from '@app/shared';
import { describe, expect, it } from 'vitest';
import { makeApiError } from '@/lib/api-error';
import { ERROR_TITLE, errorMessages } from '@/lib/error-messages';

const ALL_CODES: ErrorCode[] = [
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
];

describe('ERROR_TITLE', () => {
  it('has a non-empty Thai title for each of the twelve codes and nothing else', () => {
    expect(Object.keys(ERROR_TITLE).sort()).toEqual([...ALL_CODES].sort());
    for (const code of ALL_CODES) expect(ERROR_TITLE[code].trim().length).toBeGreaterThan(0);
  });
});

describe('DUPLICATE_EQUIPMENT_NAME', () => {
  it('has the agreed Thai title', () => {
    expect(ERROR_TITLE.DUPLICATE_EQUIPMENT_NAME).toBe('ชื่ออุปกรณ์นี้ถูกใช้แล้ว');
  });
});

describe('errorMessages', () => {
  it('wraps a string message in a list', () => {
    expect(errorMessages(makeApiError(422, 'EQUIPMENT_UNAVAILABLE', 'Only 5 left'))).toEqual(['Only 5 left']);
  });

  it('returns an array message as is', () => {
    expect(errorMessages(makeApiError(400, 'VALIDATION_ERROR', ['a', 'b']))).toEqual(['a', 'b']);
  });
});
