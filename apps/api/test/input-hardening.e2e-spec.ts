import request from 'supertest';
import { EQUIPMENT_IDS, REQUEST_IDS } from '../prisma/seed-data';
import { useTestApp } from './support/create-test-app';
import { bearer, loginAll, snapshot } from './support/fixtures';
import type { Tokens } from './support/fixtures';
import { resetDb } from './support/reset-db';

// Input hardening: text the database cannot store, out-of-range numbers, length limits and login email
// normalisation must all be 400 VALIDATION_ERROR, never 500. Bodies marked RAW are sent as JSON text so that
// escapes such as 1e21, \u0000 and \ud800 reach the server exactly as written.

const getCtx = useTestApp();
const prisma = () => getCtx().prisma;
const http = () => request(getCtx().app.getHttpServer());

let tokens: Tokens;
beforeAll(async () => {
  tokens = await loginAll(getCtx().app);
});

type Who = 'admin' | 'employee1' | 'none';
type Method = 'get' | 'post' | 'patch';

interface Call {
  method: Method;
  path: string;
  who: Who;
  /** RAW JSON text, sent unchanged. */
  raw?: string;
  ip?: string;
}

let ipCounter = 0;
const nextIp = (): string => {
  ipCounter += 1;
  return `192.0.2.${ipCounter}`;
};

function send(call: Call): request.Test {
  const base = http();
  let req = call.method === 'get' ? base.get(call.path) : call.method === 'post' ? base.post(call.path) : base.patch(call.path);
  if (call.who !== 'none') req = req.set(bearer(tokens[call.who]));
  if (call.ip !== undefined) req = req.set('X-Forwarded-For', call.ip);
  if (call.raw !== undefined) req = req.set('Content-Type', 'application/json').send(call.raw);
  return req;
}

interface Row {
  name: string;
  status: number;
  expected: string;
}
const rows: Row[] = [];
const record = (name: string, status: number, expected: string, ok: boolean): void => {
  rows.push({ name, status, expected: `${expected} ${ok ? 'GREEN' : 'RED'}` });
};

afterAll(() => {
  const lines = rows.map((r) => `${r.name.padEnd(78)} | got ${String(r.status).padEnd(3)} | expected ${r.expected}`);
  console.log(`REPRODUCTION TABLE\n${lines.join('\n')}`);
});

/** Everything a rejected write must leave untouched. */
async function state(): Promise<string> {
  const [snap, mouse, pending] = await Promise.all([
    snapshot(prisma()),
    prisma().equipment.findUnique({ where: { id: EQUIPMENT_IDS.mouse } }),
    prisma().request.findUnique({ where: { id: REQUEST_IDS.r09 } }),
  ]);
  return JSON.stringify({ snap, mouse, pending });
}

function expectValidationError(res: request.Response): void {
  expect(res.status).toBe(400);
  expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request', code: 'VALIDATION_ERROR' });
  const message: unknown = (res.body as { message: unknown }).message;
  expect(typeof message === 'string' || (Array.isArray(message) && message.every((m) => typeof m === 'string'))).toBe(true);
  expect(res.headers['x-request-id']).toBeDefined();
}

/** Sends the call, records the outcome, and checks 400 + nothing changed (resetting the DB if something did). */
async function expectRejected(label: string, call: Call): Promise<void> {
  const before = await state();
  const res = await send(call);
  record(label, res.status, '400', res.status === 400);
  const after = await state();
  if (before !== after) await resetDb(prisma());
  expectValidationError(res);
  expect(after).toBe(before);
}

const EQUIPMENTS = '/api/v1/equipments';
const MOUSE = `${EQUIPMENTS}/${EQUIPMENT_IDS.mouse}`;
const REQUESTS = '/api/v1/requests';
const LOGIN = '/api/v1/auth/login';

type Case = [label: string, call: Call];

describe('numbers outside the supported range', () => {
  const pageValues = ['100001', '2147483647', '99999999999', '1e21'];
  const lists: [string, Who][] = [
    [EQUIPMENTS, 'employee1'],
    [REQUESTS, 'admin'],
    [`${REQUESTS}/me`, 'employee1'],
  ];
  const pageCases: Case[] = lists.flatMap(([path, who]) => [
    ...pageValues.map((value): Case => [`GET ${path}?page=${value}`, { method: 'get', path: `${path}?page=${value}`, who }]),
    [`GET ${path}?page=21474838&limit=100`, { method: 'get', path: `${path}?page=21474838&limit=100`, who }] as Case,
  ]);
  it.each(pageCases)('%s -> 400', (label, call) => expectRejected(label, call));

  const versionCases: Case[] = [
    '{"version":2147483648,"name":"x"}',
    '{"version":1e21,"name":"x"}',
    '{"version":99999999999999999999,"name":"x"}',
  ].map((raw): Case => [`PATCH equipment ${raw}`, { method: 'patch', path: MOUSE, who: 'admin', raw }]);
  it.each(versionCases)('%s -> 400', (label, call) => expectRejected(label, call));

  it('BOUNDARY version 2147483647 is a normal stale version: 409 VERSION_CONFLICT', async () => {
    const before = await state();
    const res = await send({ method: 'patch', path: MOUSE, who: 'admin', raw: '{"version":2147483647,"name":"x"}' });
    record('PATCH equipment {"version":2147483647}', res.status, '409', res.status === 409);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      statusCode: 409,
      error: 'Conflict',
      message: 'ข้อมูลอุปกรณ์ถูกแก้ไขระหว่างนี้ กรุณาโหลดใหม่',
      code: 'VERSION_CONFLICT',
    });
    expect(await state()).toBe(before);
  });

  it.each(lists)('BOUNDARY page=100000 on %s -> 200 with an empty list', async (path, who) => {
    const res = await send({ method: 'get', path: `${path}?page=100000`, who });
    record(`GET ${path}?page=100000`, res.status, '200', res.status === 200);
    expect(res.status).toBe(200);
    const body = res.body as { data: unknown[]; meta: { page: number } };
    expect(body.data).toEqual([]);
    expect(body.meta.page).toBe(100000);
  });
});

describe('NUL characters', () => {
  const nulCases: Case[] = [
    ['POST equipment name NUL', { method: 'post', path: EQUIPMENTS, who: 'admin', raw: String.raw`{"name":"a\u0000b","category":"Test","stockQuantity":1}` }],
    ['POST equipment category NUL', { method: 'post', path: EQUIPMENTS, who: 'admin', raw: String.raw`{"name":"Valid","category":"a\u0000b","stockQuantity":1}` }],
    ['PATCH equipment name NUL', { method: 'patch', path: MOUSE, who: 'admin', raw: String.raw`{"version":1,"name":"a\u0000b"}` }],
    ['PATCH equipment category NUL', { method: 'patch', path: MOUSE, who: 'admin', raw: String.raw`{"version":1,"category":"a\u0000b"}` }],
    [
      'POST request reason NUL',
      { method: 'post', path: REQUESTS, who: 'employee1', raw: String.raw`{"equipmentId":"${EQUIPMENT_IDS.mouse}","quantity":1,"reason":"valid reason\u0000more"}` },
    ],
    [
      'PATCH reject rejectReason NUL',
      { method: 'patch', path: `${REQUESTS}/${REQUEST_IDS.r09}/reject`, who: 'admin', raw: String.raw`{"rejectReason":"valid reason\u0000more"}` },
    ],
    ['GET equipments?search=%00', { method: 'get', path: `${EQUIPMENTS}?search=%00`, who: 'employee1' }],
    ['GET equipments?category=%00', { method: 'get', path: `${EQUIPMENTS}?category=%00`, who: 'employee1' }],
    ['GET requests?search=%00', { method: 'get', path: `${REQUESTS}?search=%00`, who: 'admin' }],
    ['GET requests/me?status=%00', { method: 'get', path: `${REQUESTS}/me?status=%00`, who: 'employee1' }],
    ['GET equipments/%00', { method: 'get', path: `${EQUIPMENTS}/%00`, who: 'employee1' }],
    ['POST login email NUL', { method: 'post', path: LOGIN, who: 'none', ip: nextIp(), raw: String.raw`{"email":"a\u0000b@company.com","password":"Admin@123"}` }],
    [
      'POST login password NUL',
      { method: 'post', path: LOGIN, who: 'none', ip: nextIp(), raw: String.raw`{"email":"nul-password@company.com","password":"secret\u0000secret"}` },
    ],
    [
      'POST equipment NUL in nested array element',
      { method: 'post', path: EQUIPMENTS, who: 'admin', raw: String.raw`{"name":"ok","category":"ok","stockQuantity":1,"extra":{"deep":["x\u0000y"]}}` },
    ],
    ['POST equipment NUL in a property NAME', { method: 'post', path: EQUIPMENTS, who: 'admin', raw: String.raw`{"na\u0000me":"x"}` }],
  ];
  it.each(nulCases)('%s -> 400', (label, call) => expectRejected(label, call));

});

describe('unpaired UTF-16 surrogates', () => {
  const cases: Case[] = [
    ['POST equipment name lone high', { method: 'post', path: EQUIPMENTS, who: 'admin', raw: String.raw`{"name":"a\ud800b","category":"Test","stockQuantity":1}` }],
    ['POST equipment category lone low', { method: 'post', path: EQUIPMENTS, who: 'admin', raw: String.raw`{"name":"Valid","category":"a\udc00b","stockQuantity":1}` }],
    ['PATCH equipment name lone high', { method: 'patch', path: MOUSE, who: 'admin', raw: String.raw`{"version":1,"name":"a\ud800b"}` }],
    [
      'POST request reason lone high at the end',
      { method: 'post', path: REQUESTS, who: 'employee1', raw: String.raw`{"equipmentId":"${EQUIPMENT_IDS.mouse}","quantity":1,"reason":"valid reason\ud800"}` },
    ],
    [
      'PATCH reject rejectReason lone low',
      { method: 'patch', path: `${REQUESTS}/${REQUEST_IDS.r09}/reject`, who: 'admin', raw: String.raw`{"rejectReason":"valid\udc00reason"}` },
    ],
    ['POST login email lone high', { method: 'post', path: LOGIN, who: 'none', ip: nextIp(), raw: String.raw`{"email":"a\ud800b@company.com","password":"Admin@123"}` }],
    [
      'POST login password lone high',
      { method: 'post', path: LOGIN, who: 'none', ip: nextIp(), raw: String.raw`{"email":"surrogate-password@company.com","password":"secret\ud800secret"}` },
    ],
    ['POST equipment lone high in a property NAME', { method: 'post', path: EQUIPMENTS, who: 'admin', raw: String.raw`{"na\ud800me":"x"}` }],
    [
      'POST equipment REVERSED pair in a name',
      { method: 'post', path: EQUIPMENTS, who: 'admin', raw: String.raw`{"name":"a\udc00\ud800b","category":"Test","stockQuantity":1}` },
    ],
  ];
  it.each(cases)('%s -> 400', (label, call) => expectRejected(label, call));

  it.each([
    ['an emoji (proper surrogate pair)', String.raw`😀 ok`, '\u{1F600} ok'],
    ['a Thai name', 'จอ 24 นิ้ว', 'จอ 24 นิ้ว'],
  ])('VALID text still passes: %s', async (label, jsonText, expected) => {
    const res = await send({
      method: 'post',
      path: EQUIPMENTS,
      who: 'admin',
      raw: `{"name":"${jsonText}","category":"Test","stockQuantity":1}`,
    });
    record(`POST equipment ${label}`, res.status, '201', res.status === 201);
    await resetDb(prisma());
    expect(res.status).toBe(201);
    expect((res.body as { name: string }).name).toBe(expected);
  });

  it('INFO query string ?search=%ED%A0%80 is never a 500', async () => {
    const res = await send({ method: 'get', path: `${EQUIPMENTS}?search=%ED%A0%80`, who: 'employee1' });
    record('GET equipments?search=%ED%A0%80 (informational)', res.status, 'not 500', res.status !== 500);
    expect(res.status).not.toBe(500);
  });
});

describe('lengths and normalisation', () => {
  const UNAUTHORIZED = { statusCode: 401, error: 'Unauthorized', message: 'Invalid email or password', code: 'UNAUTHORIZED' };
  const loginRaw = (email: string, password: string): Call => ({
    method: 'post',
    path: LOGIN,
    who: 'none',
    ip: nextIp(),
    raw: JSON.stringify({ email, password }),
  });

  it('password of 129 characters -> 400', () => expectRejected('POST login password 129 chars', loginRaw('employee2@company.com', 'x'.repeat(129))));

  it('password of 128 characters (wrong) -> 401 with the exact body', async () => {
    const res = await send(loginRaw('employee2@company.com', 'x'.repeat(128)));
    record('POST login password 128 chars (wrong)', res.status, '401', res.status === 401);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it('category is trimmed like search', async () => {
    const plain = await send({ method: 'get', path: `${EQUIPMENTS}?category=Display`, who: 'employee1' });
    const padded = await send({ method: 'get', path: `${EQUIPMENTS}?category=%20Display%20`, who: 'employee1' });
    const names = (res: request.Response): string[] => (res.body as { data: { name: string }[] }).data.map((item) => item.name);
    record('GET equipments?category=%20Display%20 equals category=Display', padded.status, '200 + same items', padded.status === 200 && names(padded).length > 0 && JSON.stringify(names(padded)) === JSON.stringify(names(plain)));
    expect(plain.status).toBe(200);
    expect(names(plain).length).toBeGreaterThan(0);
    expect(names(padded)).toEqual(names(plain));
  });

  it('search is trimmed on /requests', async () => {
    const plain = await send({ method: 'get', path: `${REQUESTS}?search=monitor`, who: 'admin' });
    const padded = await send({ method: 'get', path: `${REQUESTS}?search=%20monitor%20`, who: 'admin' });
    const ids = (res: request.Response): string[] => (res.body as { data: { id: string }[] }).data.map((item) => item.id);
    record('GET requests?search=%20monitor%20 equals search=monitor', padded.status, '200 + same items', padded.status === 200 && ids(padded).length > 0 && JSON.stringify(ids(padded)) === JSON.stringify(ids(plain)));
    expect(ids(plain).length).toBeGreaterThan(0);
    expect(ids(padded)).toEqual(ids(plain));
  });

  it('(D1) a wrong password with ADMIN@COMPANY.COM -> 401 with the exact body', async () => {
    const res = await send(loginRaw('ADMIN@COMPANY.COM', 'Wrong@123'));
    record('POST login ADMIN@COMPANY.COM wrong password', res.status, '401', res.status === 401);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it.each([
    ['ADMIN@Company.com'],
    [' admin@company.com '],
  ])('(D1) login with %j and the right password -> 200 and the stored lowercase email', async (email) => {
    const res = await send(loginRaw(email, 'Admin@123'));
    record(`POST login ${JSON.stringify(email)}`, res.status, '200', res.status === 200);
    expect(res.status).toBe(200);
    expect((res.body as { user: { email: string } }).user.email).toBe('admin@company.com');
  });

  it('(D1) case variants share ONE rate-limit counter', async () => {
    const ip = nextIp();
    const attempt = (email: string) => send({ method: 'post', path: LOGIN, who: 'none', ip, raw: JSON.stringify({ email, password: 'Wrong@123' }) });
    for (let i = 0; i < 3; i += 1) expect((await attempt('Mixed@Case.test')).status).toBe(401);
    for (let i = 0; i < 2; i += 1) expect((await attempt('mixed@case.test')).status).toBe(401);
    const upper = await attempt('Mixed@Case.test');
    const lower = await attempt('mixed@case.test');
    record('POST login 3x Mixed@Case.test + 2x mixed@case.test, then upper', upper.status, '429', upper.status === 429);
    record('... then lower', lower.status, '429', lower.status === 429);
    expect(upper.status).toBe(429);
    expect(lower.status).toBe(429);
  });
});
