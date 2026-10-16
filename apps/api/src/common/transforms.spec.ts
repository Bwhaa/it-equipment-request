import type { TransformFnParams } from 'class-transformer';
import { trim } from './transforms';

const run = (value: unknown) => trim({ value } as TransformFnParams);

describe('trim', () => {
  it('trims strings', () => {
    expect(run(' a ')).toBe('a');
  });

  it.each([5, undefined, null])('passes non-string %p through unchanged', (value) => {
    expect(run(value)).toBe(value);
  });
});
