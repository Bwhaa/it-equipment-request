import { BadRequestException } from '@nestjs/common';
import { RejectNulCharactersPipe } from './reject-nul.pipe';

const pipe = new RejectNulCharactersPipe();
const MESSAGE = 'Null characters and unpaired surrogates are not allowed';

function rejection(value: unknown): unknown {
  try {
    pipe.transform(value);
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('RejectNulCharactersPipe', () => {
  it('throws exactly { code, message } as a BadRequestException', () => {
    const error = rejection('a\u0000b');
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toEqual({ code: 'VALIDATION_ERROR', message: MESSAGE });
  });

  it('passes a plain string and returns the very same value', () => {
    expect(pipe.transform('plain text')).toBe('plain text');
    const body = { name: 'ok', list: ['a', { deep: 'b' }] };
    expect(pipe.transform(body)).toBe(body);
  });

  it.each([
    ['a plain string', 'a\u0000b'],
    ['a nested object', { a: { b: { c: 'x\u0000' } } }],
    ['an array element', ['fine', 'x\u0000y']],
    ['an element of an array inside an object', { extra: { deep: ['x\u0000y'] } }],
    ['a property NAME', { 'na\u0000me': 'x' }],
    ['a nested property NAME', { a: [{ 'b\u0000': 1 }] }],
  ])('rejects NUL in %s', (_label, value) => {
    expect(rejection(value)).toBeInstanceOf(BadRequestException);
  });

  it('rejects NUL 50,000 levels deep without a RangeError', () => {
    let node: unknown = 'x\u0000';
    for (let i = 0; i < 50_000; i += 1) node = { a: node };
    expect(rejection(node)).toBeInstanceOf(BadRequestException);
  });

  it('walks 50,000 levels of clean data without a RangeError and returns it', () => {
    let node: unknown = 'clean';
    for (let i = 0; i < 50_000; i += 1) node = [node];
    expect(() => pipe.transform(node)).not.toThrow();
  });

  it('does not loop on a cyclic structure', () => {
    const cyclic: Record<string, unknown> = { name: 'ok' };
    cyclic.self = cyclic;
    expect(() => pipe.transform(cyclic)).not.toThrow();
  });

  it.each([
    ['a number', 42],
    ['a boolean', true],
    ['null', null],
    ['undefined', undefined],
    ['a Date', new Date('2026-10-15T00:00:00.000Z')],
    ['a Buffer', Buffer.from([0, 1, 2])],
  ])('lets %s through', (_label, value) => {
    expect(pipe.transform(value)).toBe(value);
  });

  describe('unpaired surrogates', () => {
    it.each([
      ['a lone high surrogate', 'a\ud800b'],
      ['a lone high surrogate at the end', 'valid\ud800'],
      ['a lone low surrogate', 'a\udc00b'],
      ['a lone low surrogate at the start', '\udc00 text'],
      ['a REVERSED pair', 'a\udc00\ud800b'],
      ['two high surrogates then a low one', '\ud800𐀀'],
    ])('rejects %s', (_label, value) => {
      expect(rejection(value)).toBeInstanceOf(BadRequestException);
      expect(rejection({ [value]: 1 })).toBeInstanceOf(BadRequestException);
      expect(rejection([value])).toBeInstanceOf(BadRequestException);
    });

    it.each([
      ['at the start', '\u{1F600} start'],
      ['in the middle', 'mid \u{1F600} dle'],
      ['at the end', 'end \u{1F600}'],
      ['Thai text', 'จอ 24 นิ้ว'],
    ])('accepts a valid pair %s', (_label, value) => {
      expect(pipe.transform(value)).toBe(value);
    });

    it('handles a 100 KB string quickly, with and without a lone surrogate at the end', () => {
      const clean = 'ก'.repeat(100_000);
      expect(pipe.transform(clean)).toBe(clean);
      expect(rejection(`${clean}\ud800`)).toBeInstanceOf(BadRequestException);
    });
  });
});
