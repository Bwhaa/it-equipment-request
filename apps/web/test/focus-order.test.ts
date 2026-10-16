import { describe, expect, it } from 'vitest';
import { firstFieldWithError } from '@/lib/focus-order';

const ORDER = ['name', 'category', 'stockQuantity', 'status'] as const;

describe('firstFieldWithError', () => {
  it('returns the first field of the ORDER that has an error, not the first key of the object', () => {
    expect(firstFieldWithError({ status: 'bad', category: 'bad' }, ORDER)).toBe('category');
    expect(firstFieldWithError({ stockQuantity: 'bad', name: 'bad' }, ORDER)).toBe('name');
  });

  it('ignores undefined and empty messages', () => {
    expect(firstFieldWithError({ name: undefined, category: '', stockQuantity: 'bad' }, ORDER)).toBe('stockQuantity');
  });

  it('returns undefined when there is no error', () => {
    expect(firstFieldWithError({}, ORDER)).toBeUndefined();
    expect(firstFieldWithError({ name: undefined, status: '' }, ORDER)).toBeUndefined();
    expect(firstFieldWithError(undefined, ORDER)).toBeUndefined();
  });

  it('ignores keys that are not in the order', () => {
    const errors: Record<string, string | undefined> = { unknown: 'bad', other: 'bad' };
    expect(firstFieldWithError(errors, ORDER)).toBeUndefined();
    expect(firstFieldWithError({ ...errors, status: 'bad' }, ORDER)).toBe('status');
  });

  it('works with an empty order', () => {
    expect(firstFieldWithError({ name: 'bad' }, [])).toBeUndefined();
  });
});
