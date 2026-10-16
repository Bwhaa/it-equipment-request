import 'reflect-metadata';
import { buildPaginated, toSkipTake } from './pagination';

describe('toSkipTake', () => {
  it('computes skip and take', () => {
    expect(toSkipTake({ page: 1, limit: 10 })).toEqual({ skip: 0, take: 10 });
    expect(toSkipTake({ page: 3, limit: 25 })).toEqual({ skip: 50, take: 25 });
  });
});

describe('buildPaginated', () => {
  it('rounds totalPages up', () => {
    expect(buildPaginated(['a'], 15, 2, 10)).toEqual({
      data: ['a'],
      meta: { page: 2, limit: 10, total: 15, totalPages: 2 },
    });
  });

  it('handles exact multiples', () => {
    expect(buildPaginated([], 20, 1, 10).meta.totalPages).toBe(2);
  });

  it('total 0 -> totalPages 0', () => {
    expect(buildPaginated([], 0, 1, 10)).toEqual({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });
  });
});
