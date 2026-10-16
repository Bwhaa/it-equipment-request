import { escapeLike } from './escape-like';

describe('escapeLike', () => {
  it('escapes %, _ and backslash', () => {
    expect(escapeLike('%')).toBe('\\%');
    expect(escapeLike('_')).toBe('\\_');
    expect(escapeLike('\\')).toBe('\\\\');
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('leaves ordinary text unchanged', () => {
    expect(escapeLike('Monitor 24-inch')).toBe('Monitor 24-inch');
    expect(escapeLike('')).toBe('');
  });
});
