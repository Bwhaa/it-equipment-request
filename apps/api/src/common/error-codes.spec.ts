import { ERROR_STATUS, isErrorCode } from './error-codes';

describe('isErrorCode', () => {
  it.each(Object.keys(ERROR_STATUS))('true for %s', (code) => {
    expect(isErrorCode(code)).toBe(true);
  });

  it('covers exactly eleven codes', () => {
    expect(Object.keys(ERROR_STATUS)).toHaveLength(11);
  });

  it.each(['NOPE', 5, null, undefined, 'toString', '__proto__'])('false for %p', (value) => {
    expect(isErrorCode(value)).toBe(false);
  });
});
