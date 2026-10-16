import { extractBearerToken } from './extract-bearer-token';

describe('extractBearerToken', () => {
  it.each([
    ['Bearer abc', 'abc'],
    ['bearer abc', 'abc'],
    ['BEARER abc', 'abc'],
  ])('%p -> %p', (header, expected) => {
    expect(extractBearerToken(header)).toBe(expected);
  });

  it.each(['Bearer', 'Bearer ', 'Bearer a b', 'Bearer  abc', 'Basic abc', '', ' Bearer abc'])(
    '%p -> undefined',
    (header) => {
      expect(extractBearerToken(header)).toBeUndefined();
    },
  );

  it('undefined -> undefined', () => {
    expect(extractBearerToken(undefined)).toBeUndefined();
  });

  it('array header -> undefined', () => {
    expect(extractBearerToken(['Bearer abc'])).toBeUndefined();
  });
});
