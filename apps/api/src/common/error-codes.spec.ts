import { ERROR_STATUS, isErrorCode } from './error-codes';

describe('isErrorCode', () => {
  it.each(Object.keys(ERROR_STATUS))('true for %s', (code) => {
    expect(isErrorCode(code)).toBe(true);
  });

  it('covers exactly thirteen codes', () => {
    expect(Object.keys(ERROR_STATUS)).toHaveLength(13);
  });

  it('DUPLICATE_EQUIPMENT_NAME is a 409', () => {
    expect(ERROR_STATUS.DUPLICATE_EQUIPMENT_NAME).toBe(409);
  });

  it('IDEMPOTENCY_KEY_REUSED is a 422', () => {
    expect(ERROR_STATUS.IDEMPOTENCY_KEY_REUSED).toBe(422);
  });

  it.each(['NOPE', 5, null, undefined, 'toString', '__proto__'])('false for %p', (value) => {
    expect(isErrorCode(value)).toBe(false);
  });
});
