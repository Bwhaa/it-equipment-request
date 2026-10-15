import request from 'supertest';
import { EQUIPMENT_IDS, REQUEST_IDS, USER_IDS } from '../prisma/seed-data';
import { useTestApp } from './support/create-test-app';
import { resetDb } from './support/reset-db';
import { ADMIN_LOGIN, EMPLOYEE1_LOGIN, EMPLOYEE2_LOGIN, loginToken } from './support/tokens';

const getCtx = useTestApp();
const http = () => request(getCtx().app.getHttpServer());

let adminToken = '';
let employee1Token = '';
let employee2Token = '';
beforeAll(async () => {
  adminToken = await loginToken(getCtx().app, ADMIN_LOGIN);
  employee1Token = await loginToken(getCtx().app, EMPLOYEE1_LOGIN);
  employee2Token = await loginToken(getCtx().app, EMPLOYEE2_LOGIN);
});

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const asAdmin = () => bearer(adminToken);
const asEmployee1 = () => bearer(employee1Token);
const asEmployee2 = () => bearer(employee2Token);

const REQUEST_KEYS = [
  'approvedAt',
  'createdAt',
  'equipment',
  'id',
  'quantity',
  'reason',
  'rejectReason',
  'requester',
  'reviewedAt',
  'reviewer',
  'status',
];
const AUDIT_KEYS = ['actor', 'createdAt', 'fromStatus', 'id', 'toStatus'];
const FORBIDDEN = { statusCode: 403, error: 'Forbidden', message: 'Forbidden', code: 'FORBIDDEN' };
const UNKNOWN_ID = 'b0000000-0000-4000-8000-0000000000ff';
const UNKNOWN_EQUIPMENT_ID = 'e0000000-0000-4000-8000-0000000000ff';

interface Item {
  id: string;
  quantity: number;
  reason: string;
  status: string;
  rejectReason: string | null;
  approvedAt: string | null;
  reviewedAt: string | null;
  requester: { id: string; name: string };
  reviewer: { id: string; name: string } | null;
  equipment: { id: string; name: string; category: string; stockQuantity: number; status: string };
  createdAt: string;
  auditLogs?: { id: string; fromStatus: string | null; toStatus: string; actor: { id: string; name: string }; createdAt: string }[];
}
interface Page {
  data: Item[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

async function getPage(path: string, headers: Record<string, string>, query: Record<string, string | number> = {}): Promise<Page> {
  const res = await http().get(path).set(headers).query(query).expect(200);
  return res.body as Page;
}
const mine = (query: Record<string, string | number> = {}, headers = asEmployee1()) => getPage('/api/v1/requests/me', headers, query);
const all = (query: Record<string, string | number> = {}) => getPage('/api/v1/requests', asAdmin(), query);
const ids = (items: Item[]) => items.map((item) => item.id);

async function counts() {
  const { prisma } = getCtx();
  return { requests: await prisma.request.count(), auditLogs: await prisma.auditLog.count() };
}

describe('access control', () => {
  const routes: [string, string][] = [
    ['post', '/api/v1/requests'],
    ['get', '/api/v1/requests/me'],
    ['get', '/api/v1/requests'],
    ['get', `/api/v1/requests/${REQUEST_IDS.r01}`],
  ];

  it.each(routes)('no token on %s %s -> 401', async (method, path) => {
    const res = await (http() as unknown as Record<string, (p: string) => request.Test>)[method](path).expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('admin POST /requests -> exact 403 and nothing is created', async () => {
    const before = await counts();
    const res = await http()
      .post('/api/v1/requests')
      .set(asAdmin())
      .send({ equipmentId: EQUIPMENT_IDS.monitor24, quantity: 1, reason: 'admin tries' })
      .expect(403);
    expect(res.body).toEqual(FORBIDDEN);
    expect(await counts()).toEqual(before);
  });

  it('admin GET /requests/me -> 403; employee GET /requests -> 403', async () => {
    expect((await http().get('/api/v1/requests/me').set(asAdmin()).expect(403)).body).toEqual(FORBIDDEN);
    expect((await http().get('/api/v1/requests').set(asEmployee1()).expect(403)).body).toEqual(FORBIDDEN);
  });

  it('employee can read their own request by id', async () => {
    await http().get(`/api/v1/requests/${REQUEST_IDS.r01}`).set(asEmployee1()).expect(200);
  });
});

describe('GET /requests/me', () => {
  it('returns only the caller’s requests: employee1 8, employee2 7', async () => {
    const one = await mine();
    expect(one.meta.total).toBe(8);
    expect(one.data.every((item) => item.requester.id === USER_IDS.employee1)).toBe(true);
    expect((await mine({}, asEmployee2())).meta.total).toBe(7);
  });

  it('status filter is consistent with the seed (employee1: 4 PENDING / 3 APPROVED / 1 REJECTED)', async () => {
    expect((await mine({ status: 'PENDING' })).meta.total).toBe(4);
    expect((await mine({ status: 'APPROVED' })).meta.total).toBe(3);
    expect((await mine({ status: 'REJECTED' })).meta.total).toBe(1);
  });

  it('is ordered newest first (strictly descending createdAt)', async () => {
    const { data } = await mine();
    for (let i = 1; i < data.length; i += 1) expect(data[i - 1].createdAt > data[i].createdAt).toBe(true);
  });

  it('paginates 3/3/2 with no duplicates', async () => {
    const pages = [await mine({ limit: 3, page: 1 }), await mine({ limit: 3, page: 2 }), await mine({ limit: 3, page: 3 })];
    expect(pages.map((page) => page.data.length)).toEqual([3, 3, 2]);
    for (const page of pages) expect(page.meta).toMatchObject({ total: 8, totalPages: 3, limit: 3 });
    expect(new Set(pages.flatMap((page) => ids(page.data))).size).toBe(8);
  });

  it('items have exactly the 11 keys', async () => {
    for (const item of (await mine()).data) expect(Object.keys(item).sort()).toEqual(REQUEST_KEYS);
  });

  it.each([{ page: 0 }, { limit: 101 }, { status: 'BROKEN' }, { search: 'x' }])('invalid query %j -> 400', async (query) => {
    const res = await http().get('/api/v1/requests/me').set(asEmployee1()).query(query).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /requests (admin)', () => {
  it('lists all 15 and filters by status (7 / 5 / 3)', async () => {
    expect((await all()).meta.total).toBe(15);
    expect((await all({ status: 'PENDING' })).meta.total).toBe(7);
    expect((await all({ status: 'APPROVED' })).meta.total).toBe(5);
    expect((await all({ status: 'REJECTED' })).meta.total).toBe(3);
  });

  it('search by requester name and by equipment name (case-insensitive)', async () => {
    const byUser = await all({ search: 'Employee One', limit: 100 });
    expect(byUser.meta.total).toBe(8);
    expect(byUser.data.every((item) => item.requester.id === USER_IDS.employee1)).toBe(true);

    for (const term of ['monitor', 'MONITOR', 'Monitor']) {
      const byEquipment = await all({ search: term, limit: 100 });
      expect(ids(byEquipment.data).sort()).toEqual(
        [REQUEST_IDS.r01, REQUEST_IDS.r12, REQUEST_IDS.r07, REQUEST_IDS.r15].sort(),
      );
    }
  });

  it.each(['%', '_', '\\'])('search %p is matched literally -> 0 items', async (search) => {
    expect((await all({ search })).data).toEqual([]);
  });

  it('combines status and search; blank search is no filter; 101-char search -> 400', async () => {
    const combined = await all({ status: 'PENDING', search: 'monitor' });
    expect(ids(combined.data).sort()).toEqual([REQUEST_IDS.r12, REQUEST_IDS.r15].sort());
    expect((await all({ search: '   ' })).meta.total).toBe(15);
    await http().get('/api/v1/requests').set(asAdmin()).query({ search: 'a'.repeat(101) }).expect(400);
  });

  it('paginates: limit 10, page 2 -> 5 items, totalPages 2', async () => {
    const page = await all({ limit: 10, page: 2 });
    expect(page.data).toHaveLength(5);
    expect(page.meta).toMatchObject({ total: 15, totalPages: 2, page: 2, limit: 10 });
  });

  it('sort=createdAt:asc is exactly the reverse of the default order', async () => {
    const desc = await all({ limit: 100 });
    const asc = await all({ limit: 100, sort: 'createdAt:asc' });
    expect(ids(asc.data)).toEqual(ids(desc.data).reverse());
  });

  it.each([{ sort: 'foo' }, { limit: 101 }, { status: 'BROKEN' }])('invalid query %j -> 400', async (query) => {
    const res = await http().get('/api/v1/requests').set(asAdmin()).query(query).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('items have exactly the 11 keys and the equipment carries stockQuantity and status', async () => {
    for (const item of (await all({ limit: 100 })).data) {
      expect(Object.keys(item).sort()).toEqual(REQUEST_KEYS);
      expect(Object.keys(item.equipment).sort()).toEqual(['category', 'id', 'name', 'status', 'stockQuantity']);
    }
  });
});

describe('GET /requests/:id', () => {
  it('employee1 reads own APPROVED request with 2 audit items in order', async () => {
    const res = await http().get(`/api/v1/requests/${REQUEST_IDS.r01}`).set(asEmployee1()).expect(200);
    const body = res.body as Item;
    expect(Object.keys(body).sort()).toEqual([...REQUEST_KEYS, 'auditLogs'].sort());
    expect(body.status).toBe('APPROVED');
    expect(body.auditLogs).toHaveLength(2);
    for (const log of body.auditLogs ?? []) expect(Object.keys(log).sort()).toEqual(AUDIT_KEYS);
    expect(body.auditLogs?.[0]).toMatchObject({ fromStatus: null, toStatus: 'PENDING', actor: { id: USER_IDS.employee1 } });
    expect(body.auditLogs?.[1]).toMatchObject({ fromStatus: 'PENDING', toStatus: 'APPROVED', actor: { id: USER_IDS.admin } });
  });

  it("another employee's request is 404, identical to an unknown id; the owner and admin get 200", async () => {
    const foreign = await http().get(`/api/v1/requests/${REQUEST_IDS.r02}`).set(asEmployee1()).expect(404);
    const unknown = await http().get(`/api/v1/requests/${UNKNOWN_ID}`).set(asEmployee1()).expect(404);
    expect(foreign.body).toEqual(unknown.body);
    expect(foreign.body.code).toBe('NOT_FOUND');

    await http().get(`/api/v1/requests/${REQUEST_IDS.r02}`).set(asEmployee2()).expect(200);
    await http().get(`/api/v1/requests/${REQUEST_IDS.r02}`).set(asAdmin()).expect(200);
    await http().get(`/api/v1/requests/${REQUEST_IDS.r01}`).set(asAdmin()).expect(200);
    await http().get(`/api/v1/requests/${UNKNOWN_ID}`).set(asAdmin()).expect(404);
  });

  it('a malformed id -> 400, and /requests/me is not captured by :id', async () => {
    const res = await http().get('/api/v1/requests/not-a-uuid').set(asAdmin()).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    await http().get('/api/v1/requests/me').set(asEmployee1()).expect(200);
  });
});

describe('POST /requests', () => {
  const valid = { equipmentId: EQUIPMENT_IDS.monitor24, quantity: 2, reason: 'need a second screen' };
  const post = (body: unknown, headers = asEmployee1()) => http().post('/api/v1/requests').set(headers).send(body as object);

  beforeEach(async () => {
    await resetDb(getCtx().prisma);
  });

  it('creates a PENDING request with one audit row and leaves the stock untouched', async () => {
    const before = await counts();
    const stockBefore = (await getCtx().prisma.equipment.findUniqueOrThrow({ where: { id: EQUIPMENT_IDS.monitor24 } })).stockQuantity;

    const res = await post(valid).expect(201);
    const body = res.body as Item;
    expect(Object.keys(body).sort()).toEqual(REQUEST_KEYS);
    expect(body).toMatchObject({
      status: 'PENDING',
      quantity: 2,
      requester: { id: USER_IDS.employee1, name: 'Employee One' },
      reviewer: null,
      approvedAt: null,
      reviewedAt: null,
      rejectReason: null,
    });
    expect(Object.keys(body.equipment).sort()).toEqual(['category', 'id', 'name', 'status', 'stockQuantity']);

    const after = await counts();
    expect(after).toEqual({ requests: before.requests + 1, auditLogs: before.auditLogs + 1 });
    const equipment = await getCtx().prisma.equipment.findUniqueOrThrow({ where: { id: EQUIPMENT_IDS.monitor24 } });
    expect(equipment.stockQuantity).toBe(stockBefore);
    expect(equipment.version).toBe(1);

    const logs = await getCtx().prisma.auditLog.findMany({ where: { requestId: body.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ fromStatus: null, toStatus: 'PENDING', actorId: USER_IDS.employee1 });
  });

  it('stores the trimmed reason; the detail of a new request has exactly 1 audit item', async () => {
    const res = await post({ ...valid, reason: ' hello world ' }).expect(201);
    expect(res.body.reason).toBe('hello world');
    const detail = await http().get(`/api/v1/requests/${res.body.id}`).set(asEmployee1()).expect(200);
    expect(detail.body.auditLogs).toHaveLength(1);
  });

  it('a just-created request appears first in /requests/me', async () => {
    const created = await post(valid).expect(201);
    const page = await mine();
    expect(page.data[0].id).toBe(created.body.id);
    expect(page.meta.total).toBe(9);
  });

  it('quantity equal to stock is allowed and several requests may exceed the stock together', async () => {
    const first = await post({ equipmentId: EQUIPMENT_IDS.monitor27, quantity: 5, reason: 'exactly the stock' }).expect(201);
    expect(first.body.equipment.stockQuantity).toBe(5);
    await post({ equipmentId: EQUIPMENT_IDS.monitor27, quantity: 5, reason: 'and again, soft check' }, asEmployee2()).expect(201);
    const equipment = await getCtx().prisma.equipment.findUniqueOrThrow({ where: { id: EQUIPMENT_IDS.monitor27 } });
    expect(equipment.stockQuantity).toBe(5);
  });

  const withoutKey = (key: keyof typeof valid) => {
    const copy: Record<string, unknown> = { ...valid };
    delete copy[key];
    return copy;
  };
  it.each([
    ['extra field requesterId', { ...valid, requesterId: USER_IDS.employee2 }],
    ['extra field status', { ...valid, status: 'APPROVED' }],
    ['extra unknown field', { ...valid, colour: 'red' }],
    ['quantity 0', { ...valid, quantity: 0 }],
    ['quantity -1', { ...valid, quantity: -1 }],
    ['quantity 1.5', { ...valid, quantity: 1.5 }],
    ['quantity "2"', { ...valid, quantity: '2' }],
    ['quantity 101', { ...valid, quantity: 101 }],
    ['blank reason', { ...valid, reason: '    ' }],
    ['4-char reason', { ...valid, reason: 'abcd' }],
    ['501-char reason', { ...valid, reason: 'r'.repeat(501) }],
    ['equipmentId not a uuid', { ...valid, equipmentId: 'not-a-uuid' }],
    ['missing equipmentId', withoutKey('equipmentId')],
    ['missing quantity', withoutKey('quantity')],
    ['missing reason', withoutKey('reason')],
  ])('%s -> 400 and nothing is created', async (_label, body) => {
    const before = await counts();
    const res = await post(body).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(await counts()).toEqual(before);
  });

  it('unknown equipment and INACTIVE equipment both -> the same 404', async () => {
    const before = await counts();
    const unknown = await post({ ...valid, equipmentId: UNKNOWN_EQUIPMENT_ID }).expect(404);
    const inactive = await post({ ...valid, equipmentId: EQUIPMENT_IDS.projector, quantity: 1 }).expect(404);
    expect(unknown.body).toEqual({ statusCode: 404, error: 'Not Found', message: 'Equipment not found', code: 'NOT_FOUND' });
    expect(inactive.body).toEqual(unknown.body);
    expect(await counts()).toEqual(before);
  });

  it('out of stock -> 422 EQUIPMENT_UNAVAILABLE; quantity above stock -> "Only 5 left"', async () => {
    const before = await counts();
    const out = await post({ ...valid, equipmentId: EQUIPMENT_IDS.webcam, quantity: 1 }).expect(422);
    expect(out.body).toEqual({
      statusCode: 422,
      error: 'Unprocessable Entity',
      message: 'Equipment is out of stock',
      code: 'EQUIPMENT_UNAVAILABLE',
    });
    const over = await post({ ...valid, equipmentId: EQUIPMENT_IDS.monitor27, quantity: 6 }).expect(422);
    expect(over.body).toEqual({
      statusCode: 422,
      error: 'Unprocessable Entity',
      message: 'Only 5 left',
      code: 'EQUIPMENT_UNAVAILABLE',
    });
    expect(await counts()).toEqual(before);
  });
});
