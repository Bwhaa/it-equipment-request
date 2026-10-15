import { parseTrustProxy } from './trust-proxy';

describe('parseTrustProxy', () => {
  it.each([undefined, '', '   '])('%p -> undefined (Express default)', (value) => {
    expect(parseTrustProxy(value)).toBeUndefined();
  });

  it("'true' / 'false' -> booleans", () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy(' false ')).toBe(false);
  });

  it('digits only -> number of hops', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
  });

  it('anything else -> trimmed string', () => {
    expect(parseTrustProxy('loopback')).toBe('loopback');
    expect(parseTrustProxy(' loopback, linklocal, uniquelocal ')).toBe('loopback, linklocal, uniquelocal');
    expect(parseTrustProxy('10.0.0.0/8')).toBe('10.0.0.0/8');
  });
});
