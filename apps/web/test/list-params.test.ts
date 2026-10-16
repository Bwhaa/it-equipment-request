import { describe, expect, it } from 'vitest';
import {
  buildHref,
  parseCategory,
  parseEquipmentStatus,
  parsePage,
  parseRequestStatus,
  parseSearch,
  parseSort,
} from '@/lib/list-params';

describe('parsePage', () => {
  it.each([
    ['1', 1],
    ['2', 2],
    ['0', 1],
    ['-1', 1],
    ['1.5', 1],
    ['abc', 1],
    ['', 1],
    [undefined, 1],
    [['3', '4'], 3],
    ['999999999', 1],
    ['100000', 100000],
    [' 7 ', 7],
  ])('%j -> %j', (input, expected) => {
    expect(parsePage(input)).toBe(expected);
  });
});

describe('parseSearch / parseCategory', () => {
  it('trims, blanks become undefined, arrays use the first value', () => {
    expect(parseSearch('  monitor  ')).toBe('monitor');
    expect(parseSearch('   ')).toBeUndefined();
    expect(parseSearch('')).toBeUndefined();
    expect(parseSearch(undefined)).toBeUndefined();
    expect(parseSearch(['a', 'b'])).toBe('a');
  });

  it('cuts search at 100 and category at 60 characters', () => {
    expect(parseSearch('x'.repeat(150))).toBe('x'.repeat(100));
    expect(parseCategory('c'.repeat(80))).toBe('c'.repeat(60));
    expect(parseCategory('  Display ')).toBe('Display');
    expect(parseCategory('')).toBeUndefined();
  });
});

describe('parseRequestStatus', () => {
  it.each(['PENDING', 'APPROVED', 'REJECTED'])('accepts %s', (value) => {
    expect(parseRequestStatus(value)).toBe(value);
  });

  it.each([['BROKEN'], [''], ['pending'], [undefined]])('ignores %j', (value) => {
    expect(parseRequestStatus(value)).toBeUndefined();
  });

  it('uses the first value of an array', () => {
    expect(parseRequestStatus(['APPROVED', 'PENDING'])).toBe('APPROVED');
    expect(parseRequestStatus(['BROKEN', 'PENDING'])).toBeUndefined();
  });
});

describe('buildHref', () => {
  it('omits page 1 and undefined params', () => {
    expect(buildHref('/equipments', {}, 1)).toBe('/equipments');
    expect(buildHref('/equipments', { search: undefined, category: undefined }, 1)).toBe('/equipments');
  });

  it('keeps defined params and adds page when above 1', () => {
    expect(buildHref('/equipments', { search: 'monitor', category: 'Display' }, 2)).toBe(
      '/equipments?search=monitor&category=Display&page=2',
    );
    expect(buildHref('/requests', { status: 'PENDING' }, 1)).toBe('/requests?status=PENDING');
    expect(buildHref('/requests', {}, 3)).toBe('/requests?page=3');
  });

  it('encodes values', () => {
    expect(buildHref('/equipments', { category: 'Input Device' }, 1)).toBe('/equipments?category=Input+Device');
    expect(buildHref('/equipments', { search: '%' }, 1)).toBe('/equipments?search=%25');
  });
});

describe('parseSort', () => {
  it.each([
    ['createdAt:asc', 'createdAt:asc'],
    ['createdAt:desc', 'createdAt:desc'],
    ['foo', 'createdAt:desc'],
    ['', 'createdAt:desc'],
    ['CREATEDAT:ASC', 'createdAt:desc'],
    [undefined, 'createdAt:desc'],
    [['createdAt:asc', 'x'], 'createdAt:asc'],
    [['foo', 'createdAt:asc'], 'createdAt:desc'],
  ])('%j -> %j', (input, expected) => {
    expect(parseSort(input)).toBe(expected);
  });
});

describe('parseEquipmentStatus', () => {
  it.each(['ACTIVE', 'INACTIVE'])('accepts %s', (value) => {
    expect(parseEquipmentStatus(value)).toBe(value);
  });

  it.each([['BROKEN'], [''], ['active'], [undefined], [['BROKEN', 'ACTIVE']]])('ignores %j', (value) => {
    expect(parseEquipmentStatus(value)).toBeUndefined();
  });

  it('uses the first value of an array', () => {
    expect(parseEquipmentStatus(['INACTIVE', 'ACTIVE'])).toBe('INACTIVE');
  });
});

describe('buildHref with admin filters', () => {
  it('keeps sort, search, status and category and drops page 1', () => {
    expect(buildHref('/admin/requests', { status: 'PENDING', search: 'monitor', sort: 'createdAt:asc' }, 1)).toBe(
      '/admin/requests?status=PENDING&search=monitor&sort=createdAt%3Aasc',
    );
    expect(buildHref('/admin/equipments', { search: 'x', category: 'Input Device', status: 'INACTIVE' }, 2)).toBe(
      '/admin/equipments?search=x&category=Input+Device&status=INACTIVE&page=2',
    );
  });
});
