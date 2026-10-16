import { describe, expect, it } from 'vitest';
import { decideRoute } from '@/lib/route-guard';
import type { RouteDecision } from '@/lib/route-guard';
import type { Session } from '@/lib/session';

const PATHS = [
  '/',
  '/login',
  '/equipments',
  '/equipments/abc',
  '/requests',
  '/requests/xyz',
  '/admin',
  '/admin/requests',
  '/admin/equipments',
  '/foo',
  '/requests-extra',
  '/administrator',
] as const;
type Path = (typeof PATHS)[number];

const next = (clearCookie: boolean): RouteDecision => ({ action: 'next', clearCookie });
const to = (target: string, clearCookie: boolean): RouteDecision => ({ action: 'redirect', to: target, clearCookie });

const EMPLOYEE_AREA: Path[] = ['/equipments', '/equipments/abc', '/requests', '/requests/xyz'];
const ADMIN_AREA: Path[] = ['/admin', '/admin/requests', '/admin/equipments'];
const OTHER: Path[] = ['/foo', '/requests-extra', '/administrator'];

function expectations(): Array<[string, Session, Record<Path, RouteDecision>]> {
  const everyPath = (decide: (path: Path) => RouteDecision) =>
    Object.fromEntries(PATHS.map((path) => [path, decide(path)])) as Record<Path, RouteDecision>;

  return [
    ['none', { status: 'none' }, everyPath((path) => (path === '/login' ? next(false) : to('/login', false)))],
    ['invalid', { status: 'invalid' }, everyPath((path) => (path === '/login' ? next(true) : to('/login', true)))],
    [
      'expired',
      { status: 'expired' },
      everyPath((path) => (path === '/login' ? next(true) : to('/login?expired=1', true))),
    ],
    [
      'employee',
      { status: 'valid', role: 'EMPLOYEE' },
      everyPath((path) => {
        if (path === '/' || path === '/login') return to('/equipments', false);
        if (ADMIN_AREA.includes(path)) return to('/equipments', false);
        if (EMPLOYEE_AREA.includes(path) || OTHER.includes(path)) return next(false);
        throw new Error(`unclassified path ${path}`);
      }),
    ],
    [
      'admin',
      { status: 'valid', role: 'ADMIN' },
      everyPath((path) => {
        if (path === '/' || path === '/login') return to('/admin/requests', false);
        if (EMPLOYEE_AREA.includes(path)) return to('/admin/requests', false);
        if (ADMIN_AREA.includes(path) || OTHER.includes(path)) return next(false);
        throw new Error(`unclassified path ${path}`);
      }),
    ],
  ];
}

describe('decideRoute', () => {
  for (const [label, session, table] of expectations()) {
    describe(`session: ${label}`, () => {
      it.each(PATHS)('%s', (path) => {
        expect(decideRoute(path, session)).toEqual(table[path]);
      });
    });
  }

  it('respects segment boundaries (/requests-extra and /administrator are not areas)', () => {
    expect(decideRoute('/requests-extra', { status: 'valid', role: 'ADMIN' })).toEqual(next(false));
    expect(decideRoute('/administrator', { status: 'valid', role: 'EMPLOYEE' })).toEqual(next(false));
  });

  it('never clears the cookie for a valid session', () => {
    for (const role of ['EMPLOYEE', 'ADMIN'] as const) {
      for (const path of PATHS) {
        expect(decideRoute(path, { status: 'valid', role }).clearCookie).toBe(false);
      }
    }
  });
});
