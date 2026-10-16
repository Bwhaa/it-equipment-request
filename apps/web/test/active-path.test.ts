import { describe, expect, it } from 'vitest';
import { isActivePath } from '@/lib/active-path';

describe('isActivePath', () => {
  it.each([
    ['/admin/requests', '/admin/requests', true],
    ['/admin/requests/abc', '/admin/requests', true],
    ['/admin/requests/abc/deeper', '/admin/requests', true],
    ['/admin/requests-extra', '/admin/requests', false],
    ['/admin/request', '/admin/requests', false],
    ['/admin', '/admin/requests', false],
    ['/requests', '/admin/requests', false],
    ['/equipments', '/equipments', true],
    ['/equipments/x/request', '/equipments', true],
    ['/', '/', true],
    ['/equipments', '/', false],
  ])('%s vs %s -> %s', (pathname, href, expected) => {
    expect(isActivePath(pathname, href)).toBe(expected);
  });
});
