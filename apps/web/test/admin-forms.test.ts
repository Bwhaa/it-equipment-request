import { describe, expect, it } from 'vitest';
import {
  CATEGORY_ERROR,
  NAME_ERROR,
  STATUS_ERROR,
  STOCK_ERROR,
  parseVersion,
  validateEquipmentForm,
} from '@/lib/equipment-form';
import { REJECT_REASON_ERROR, validateRejectReason } from '@/lib/reject-form';

const fileLike = () => new File(['x'], 'a.txt');

describe('validateRejectReason', () => {
  it.each([
    ['abcde', 'abcde'],
    ['  because  ', 'because'],
    ['a'.repeat(500), 'a'.repeat(500)],
    [`  ${'b'.repeat(500)}  `, 'b'.repeat(500)],
    ['ไม่ได้ใช้แล้ว', 'ไม่ได้ใช้แล้ว'],
  ])('%j is valid', (input, value) => {
    expect(validateRejectReason(input)).toEqual({ ok: true, value });
  });

  it.each([
    [''],
    ['    '],
    ['abcd'],
    ['  abcd  '],
    ['a'.repeat(501)],
    [null],
    [undefined],
    [12345],
    [fileLike()],
    [{}],
  ])('%j is invalid', (input) => {
    expect(validateRejectReason(input)).toEqual({ ok: false, error: REJECT_REASON_ERROR });
  });
});

const valid = { name: 'Headset', category: 'Audio', stockQuantity: '8', status: 'ACTIVE' };

describe('validateEquipmentForm', () => {
  it('returns trimmed strings and a numeric stock', () => {
    expect(validateEquipmentForm({ ...valid, name: '  Test Item  ', category: ' Cat ', stockQuantity: ' 7 ' })).toEqual({
      ok: true,
      value: { name: 'Test Item', category: 'Cat', stockQuantity: 7, status: 'ACTIVE' },
    });
  });

  it.each([['0', 0], ['100000', 100000], ['007', 7]])('stockQuantity %j is valid -> %j', (input, expected) => {
    expect(validateEquipmentForm({ ...valid, stockQuantity: input })).toMatchObject({ ok: true, value: { stockQuantity: expected } });
  });

  it.each(['', ' ', '-1', '1.5', '1e2', '+3', 'abc', '1 2', '100001', '0x10'])('stockQuantity %j is invalid', (input) => {
    expect(validateEquipmentForm({ ...valid, stockQuantity: input })).toEqual({ ok: false, fieldErrors: { stockQuantity: STOCK_ERROR } });
  });

  it('name and category boundaries', () => {
    expect(validateEquipmentForm({ ...valid, name: 'n'.repeat(120), category: 'c'.repeat(60) }).ok).toBe(true);
    expect(validateEquipmentForm({ ...valid, name: 'n'.repeat(121) })).toEqual({ ok: false, fieldErrors: { name: NAME_ERROR } });
    expect(validateEquipmentForm({ ...valid, category: 'c'.repeat(61) })).toEqual({ ok: false, fieldErrors: { category: CATEGORY_ERROR } });
    expect(validateEquipmentForm({ ...valid, name: '   ' })).toEqual({ ok: false, fieldErrors: { name: NAME_ERROR } });
    expect(validateEquipmentForm({ ...valid, category: '' })).toEqual({ ok: false, fieldErrors: { category: CATEGORY_ERROR } });
  });

  it.each(['ACTIVE', 'INACTIVE'])('status %s is valid', (status) => {
    expect(validateEquipmentForm({ ...valid, status })).toMatchObject({ ok: true, value: { status } });
  });

  it.each(['BROKEN', '', 'active', ' ACTIVE ', null, undefined, 1])('status %j is invalid', (status) => {
    expect(validateEquipmentForm({ ...valid, status })).toEqual({ ok: false, fieldErrors: { status: STATUS_ERROR } });
  });

  it('non-string inputs are invalid in every field', () => {
    for (const bad of [null, undefined, 5, fileLike(), {}, ['a']]) {
      const result = validateEquipmentForm({ name: bad, category: bad, stockQuantity: bad, status: bad });
      expect(result).toEqual({
        ok: false,
        fieldErrors: { name: NAME_ERROR, category: CATEGORY_ERROR, stockQuantity: STOCK_ERROR, status: STATUS_ERROR },
      });
    }
  });
});

describe('parseVersion', () => {
  it.each([
    ['1', 1],
    [' 2 ', 2],
    ['2147483647', 2147483647],
  ])('%j -> %j', (input, expected) => {
    expect(parseVersion(input)).toBe(expected);
  });

  it.each(['0', '-1', '1.5', 'abc', '', '2147483648', '1e3', '+1', null, undefined, 3, fileLike()])('%j -> undefined', (input) => {
    expect(parseVersion(input)).toBeUndefined();
  });
});
