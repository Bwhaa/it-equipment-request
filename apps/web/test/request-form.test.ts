import { describe, expect, it } from 'vitest';
import { QUANTITY_ERROR, REASON_ERROR, validateRequestForm } from '@/lib/request-form';

const GOOD_REASON = 'need it for work';

describe('validateRequestForm', () => {
  it.each([
    ['1', 1],
    ['100', 100],
    [' 7 ', 7],
    ['007', 7],
  ])('accepts quantity %j', (quantity, expected) => {
    expect(validateRequestForm({ quantity, reason: GOOD_REASON })).toEqual({
      ok: true,
      value: { quantity: expected, reason: GOOD_REASON },
    });
  });

  it('accepts reasons of 5 and 500 characters and returns them trimmed', () => {
    expect(validateRequestForm({ quantity: '1', reason: 'abcde' }).ok).toBe(true);
    expect(validateRequestForm({ quantity: '1', reason: 'r'.repeat(500) }).ok).toBe(true);
    expect(validateRequestForm({ quantity: '1', reason: ' hello ' })).toEqual({
      ok: true,
      value: { quantity: 1, reason: 'hello' },
    });
  });

  it.each([
    [''],
    [' '],
    ['0'],
    ['-1'],
    ['1.5'],
    ['1e2'],
    ['abc'],
    ['+2'],
    ['101'],
    ['1 2'],
    [null],
    [undefined],
    [5],
    [{ name: 'a.txt', size: 3, type: 'text/plain' }],
  ])('rejects quantity %j', (quantity) => {
    expect(validateRequestForm({ quantity, reason: GOOD_REASON })).toEqual({
      ok: false,
      fieldErrors: { quantity: QUANTITY_ERROR },
    });
  });

  it.each([[''], ['    '], ['abcd'], ['r'.repeat(501)], [null], [123], [undefined]])('rejects reason %j', (reason) => {
    expect(validateRequestForm({ quantity: '1', reason })).toEqual({
      ok: false,
      fieldErrors: { reason: REASON_ERROR },
    });
  });

  it('reports both fields when both are invalid', () => {
    expect(validateRequestForm({ quantity: '0', reason: 'abc' })).toEqual({
      ok: false,
      fieldErrors: { quantity: QUANTITY_ERROR, reason: REASON_ERROR },
    });
  });

  it('does not compare the quantity with any stock (the API owns that check)', () => {
    expect(validateRequestForm({ quantity: '99', reason: GOOD_REASON }).ok).toBe(true);
  });
});
