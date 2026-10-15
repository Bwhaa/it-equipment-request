import request from 'supertest';
import { USER_IDS } from '../prisma/seed-data';
import { useTestApp } from './support/create-test-app';
import { bearer, loginAll, snapshot } from './support/fixtures';
import type { Snapshot, Tokens } from './support/fixtures';
import { listRoutes } from './support/route-access';
import { replacePayload, signExpiredToken, signTokenWithWrongSecret } from './support/tokens';

type Access = 'public' | 'ALL' | 'ADMIN' | 'EMPLOYEE';
type Method = 'GET' | 'POST' | 'PATCH';

// The expected matrix, written by hand (13 routes). A new endpoint without a row here fails the completeness test.
const MATRIX: ReadonlyArray<readonly [Method, string, Access]> = [
  ['POST', '/api/v1/auth/login', 'public'],
  ['GET', '/api/v1/auth/me', 'ALL'],
  ['GET', '/api/v1/equipments', 'ALL'],
  ['GET', '/api/v1/equipments/categories', 'ALL'],
  ['GET', '/api/v1/equipments/:id', 'ALL'],
  ['POST', '/api/v1/equipments', 'ADMIN'],
  ['PATCH', '/api/v1/equipments/:id', 'ADMIN'],
  ['POST', '/api/v1/requests', 'EMPLOYEE'],
  ['GET', '/api/v1/requests/me', 'EMPLOYEE'],
  ['GET', '/api/v1/requests', 'ADMIN'],
  ['GET', '/api/v1/requests/:id', 'ALL'],
  ['PATCH', '/api/v1/requests/:id/approve', 'ADMIN'],
  ['PATCH', '/api/v1/requests/:id/reject', 'ADMIN'],
];
const PROTECTED = MATRIX.filter(([, , access]) => access !== 'public');

const NON_EXISTING_ID = '00000000-0000-4000-8000-00000000dead';
const UNAUTHORIZED = { statusCode: 401, error: 'Unauthorized', message: 'Unauthorized', code: 'UNAUTHORIZED' };
const FORBIDDEN = { statusCode: 403, error: 'Forbidden', message: 'Forbidden', code: 'FORBIDDEN' };

const getCtx = useTestApp();
let tokens: Tokens;
let startSnapshot: Snapshot;

beforeAll(async () => {
  tokens = await loginAll(getCtx().app);
  startSnapshot = await snapshot(getCtx().prisma);
});

const urlOf = (path: string) => path.replace(':id', NON_EXISTING_ID);
function call(method: Method, path: string, headers: Record<string, string> = {}): request.Test {
  const http = request(getCtx().app.getHttpServer());
  const url = urlOf(path);
  if (method === 'GET') return http.get(url).set(headers);
  return (method === 'POST' ? http.post(url) : http.patch(url)).set(headers).send({});
}

const allows = (access: Access, role: 'ADMIN' | 'EMPLOYEE') => access === 'ALL' || access === role;

describe('RBAC matrix', () => {
  it('discovers exactly the 13 routes of the matrix, with matching metadata', () => {
    const routes = listRoutes(getCtx().app);
    console.info(
      'RBAC routes:\n' +
        routes
          .map((route) => {
            const expected = MATRIX.find(([method, path]) => `${method} ${path}` === route.key)?.[2] ?? '???';
            return `  ${route.key.padEnd(40)} expected=${expected} metadata=${route.isPublic ? 'public' : route.roles.join('+')}`;
          })
          .join('\n'),
    );
    expect(routes.map((route) => route.key).sort()).toEqual(MATRIX.map(([method, path]) => `${method} ${path}`).sort());
    expect(routes).toHaveLength(13);

    for (const [method, path, access] of MATRIX) {
      const route = routes.find((candidate) => candidate.key === `${method} ${path}`);
      expect(route).toBeDefined();
      if (access === 'public') {
        expect(route?.isPublic).toBe(true);
      } else {
        expect(route?.isPublic).toBe(false);
        const expectedRoles = access === 'ALL' ? ['ADMIN', 'EMPLOYEE'] : [access];
        expect([...(route?.roles ?? [])].sort()).toEqual(expectedRoles);
      }
    }
  });

  it.each(PROTECTED)('no token on %s %s -> 401 (never 403)', async (method, path) => {
    const res = await call(method, path).expect(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  describe.each(PROTECTED)('bad tokens on %s %s', (method, path) => {
    it('expired token -> 401', async () => {
      const token = await signExpiredToken(getCtx().app, { sub: USER_IDS.admin, role: 'ADMIN' });
      expect((await call(method, path, bearer(token)).expect(401)).body).toEqual(UNAUTHORIZED);
    });

    it('token signed with another secret -> 401', async () => {
      const token = await signTokenWithWrongSecret(getCtx().app, { sub: USER_IDS.admin, role: 'ADMIN' });
      expect((await call(method, path, bearer(token)).expect(401)).body).toEqual(UNAUTHORIZED);
    });

    it('tampered payload role (signature kept) -> 401', async () => {
      const tampered = replacePayload(tokens.employee1, { sub: USER_IDS.employee1, role: 'ADMIN' });
      expect((await call(method, path, bearer(tampered)).expect(401)).body).toEqual(UNAUTHORIZED);
    });

    it('Basic scheme -> 401', async () => {
      expect((await call(method, path, { Authorization: 'Basic xxx' }).expect(401)).body).toEqual(UNAUTHORIZED);
    });

    it('Bearer with nothing after it -> 401', async () => {
      expect((await call(method, path, { Authorization: 'Bearer' }).expect(401)).body).toEqual(UNAUTHORIZED);
    });
  });

  describe.each(PROTECTED)('roles on %s %s', (method, path, access) => {
    it.each([
      ['ADMIN', () => tokens.admin],
      ['EMPLOYEE', () => tokens.employee1],
    ] as const)('%s', async (role, token) => {
      const res = await call(method, path, bearer(token()));
      if (allows(access, role)) {
        // The guards let it through; the handler then answers on its own merits (400/404/200 ...).
        expect([401, 403]).not.toContain(res.status);
      } else {
        expect(res.status).toBe(403);
        expect(res.body).toEqual(FORBIDDEN);
      }
    });
  });

  it('the public login route never answers 401/403, whatever Authorization header is sent', async () => {
    const headers: Record<string, string>[] = [{}, bearer(tokens.admin), { Authorization: 'Bearer garbage' }];
    for (const header of headers) {
      const res = await call('POST', '/api/v1/auth/login', header);
      expect(res.status).toBe(400); // empty body fails validation
    }
  });

  it('changed nothing in the database', async () => {
    expect(await snapshot(getCtx().prisma)).toEqual(startSnapshot);
  });
});
