import request from 'supertest';
import { EQUIPMENT_IDS } from '../prisma/seed-data';
import { useTestApp } from './support/create-test-app';
import { resetDb } from './support/reset-db';
import { ADMIN_LOGIN, EMPLOYEE1_LOGIN, loginToken } from './support/tokens';

const getCtx = useTestApp();
const http = () => request(getCtx().app.getHttpServer());

let adminToken = '';
let employeeToken = '';
beforeAll(async () => {
  adminToken = await loginToken(getCtx().app, ADMIN_LOGIN);
  employeeToken = await loginToken(getCtx().app, EMPLOYEE1_LOGIN);
});

const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
const asEmployee = () => ({ Authorization: `Bearer ${employeeToken}` });

const EQUIPMENT_KEYS = ['category', 'createdAt', 'id', 'name', 'status', 'stockQuantity', 'updatedAt', 'version'];
const FORBIDDEN = { statusCode: 403, error: 'Forbidden', message: 'Forbidden', code: 'FORBIDDEN' };
const VERSION_CONFLICT = {
  statusCode: 409,
  error: 'Conflict',
  message: 'ข้อมูลอุปกรณ์ถูกแก้ไขระหว่างนี้ กรุณาโหลดใหม่',
  code: 'VERSION_CONFLICT',
};

interface Item {
  id: string;
  name: string;
  category: string;
  stockQuantity: number;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

async function list(headers: Record<string, string>, query: Record<string, string | number> = {}) {
  const res = await http().get('/api/v1/equipments').set(headers).query(query).expect(200);
  return res.body as { data: Item[]; meta: { page: number; limit: number; total: number; totalPages: number } };
}

const names = (items: Item[]) => items.map((item) => item.name);
const equipmentCount = () => getCtx().prisma.equipment.count();

describe('access control', () => {
  const routes: [string, string][] = [
    ['get', '/api/v1/equipments'],
    ['get', '/api/v1/equipments/categories'],
    ['get', `/api/v1/equipments/${EQUIPMENT_IDS.monitor24}`],
    ['post', '/api/v1/equipments'],
    ['patch', `/api/v1/equipments/${EQUIPMENT_IDS.monitor24}`],
  ];

  it.each(routes)('no token on %s %s -> 401', async (method, path) => {
    const res = await (http() as unknown as Record<string, (p: string) => request.Test>)[method](path).expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('employee POST and PATCH -> exact 403 and the data is unchanged', async () => {
    const before = await getCtx().prisma.equipment.findMany({ orderBy: { id: 'asc' } });
    const post = await http()
      .post('/api/v1/equipments')
      .set(asEmployee())
      .send({ name: 'X', category: 'Y', stockQuantity: 1 })
      .expect(403);
    expect(post.body).toEqual(FORBIDDEN);
    const patch = await http()
      .patch(`/api/v1/equipments/${EQUIPMENT_IDS.monitor24}`)
      .set(asEmployee())
      .send({ version: 1, stockQuantity: 999 })
      .expect(403);
    expect(patch.body).toEqual(FORBIDDEN);
    expect(await getCtx().prisma.equipment.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
  });
});

describe('GET /equipments', () => {
  it('employee sees the 7 ACTIVE items only, and ?status is ignored', async () => {
    const plain = await list(asEmployee());
    expect(plain.meta.total).toBe(7);
    expect(plain.data.every((item) => item.status === 'ACTIVE')).toBe(true);
    expect(names(plain.data)).not.toContain('Projector');

    const forced = await list(asEmployee(), { status: 'INACTIVE' });
    expect(names(forced.data)).toEqual(names(plain.data));
  });

  it('admin sees all 8 and can filter by status', async () => {
    expect((await list(asAdmin())).meta.total).toBe(8);
    const inactive = await list(asAdmin(), { status: 'INACTIVE' });
    expect(names(inactive.data)).toEqual(['Projector']);
  });

  it('items have exactly the 8 keys, ISO dates, and are ordered by name ascending', async () => {
    const { data } = await list(asAdmin());
    for (const item of data) {
      expect(Object.keys(item).sort()).toEqual(EQUIPMENT_KEYS);
      expect(new Date(item.createdAt).toISOString()).toBe(item.createdAt);
      expect(new Date(item.updatedAt).toISOString()).toBe(item.updatedAt);
    }
    expect(names(data)).toEqual([...names(data)].sort());
  });

  it('paginates employee results 3/3/1 without duplicates', async () => {
    const pages = [await list(asEmployee(), { limit: 3, page: 1 }), await list(asEmployee(), { limit: 3, page: 2 }), await list(asEmployee(), { limit: 3, page: 3 })];
    expect(pages.map((page) => page.data.length)).toEqual([3, 3, 1]);
    for (const page of pages) expect(page.meta).toMatchObject({ total: 7, totalPages: 3, limit: 3 });
    const ids = pages.flatMap((page) => page.data.map((item) => item.id));
    expect(new Set(ids).size).toBe(7);
  });

  describe('search', () => {
    it('is case-insensitive and substring-based', async () => {
      expect(names((await list(asEmployee(), { search: 'monitor' })).data)).toEqual(['Monitor 24-inch', 'Monitor 27-inch']);
      expect(names((await list(asEmployee(), { search: 'MONITOR 27' })).data)).toEqual(['Monitor 27-inch']);
    });

    it('matches % and _ literally (no seeded name contains them)', async () => {
      expect((await list(asAdmin(), { search: '%' })).data).toEqual([]);
      expect((await list(asAdmin(), { search: '_' })).data).toEqual([]);
      expect((await list(asAdmin(), { search: '\\' })).data).toEqual([]);
    });

    it('treats a blank search as no filter and rejects 101 characters', async () => {
      expect((await list(asEmployee(), { search: '   ' })).meta.total).toBe(7);
      await http().get('/api/v1/equipments').set(asEmployee()).query({ search: 'a'.repeat(101) }).expect(400);
    });
  });

  describe('category', () => {
    it('is an exact match; employee never sees INACTIVE items', async () => {
      expect(names((await list(asEmployee(), { category: 'Display' })).data)).toEqual(['Monitor 24-inch', 'Monitor 27-inch']);
      expect(names((await list(asAdmin(), { category: 'Display' })).data)).toEqual(['Monitor 24-inch', 'Monitor 27-inch', 'Projector']);
      expect((await list(asAdmin(), { category: 'display' })).data).toEqual([]);
    });

    it('employee ?status=INACTIVE&category=Display -> the two active monitors', async () => {
      const res = await list(asEmployee(), { status: 'INACTIVE', category: 'Display' });
      expect(names(res.data)).toEqual(['Monitor 24-inch', 'Monitor 27-inch']);
    });
  });

  it.each([{ page: 0 }, { limit: 101 }, { status: 'BROKEN' }])('invalid query %j -> 400', async (query) => {
    const res = await http().get('/api/v1/equipments').set(asEmployee()).query(query).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /equipments/categories', () => {
  it('returns a sorted string[] without duplicates for both roles (and is not captured as :id)', async () => {
    for (const headers of [asEmployee(), asAdmin()]) {
      const res = await http().get('/api/v1/equipments/categories').set(headers).expect(200);
      const categories = res.body as string[];
      expect(Array.isArray(categories)).toBe(true);
      expect(categories).toEqual([...categories].sort());
      expect(new Set(categories).size).toBe(categories.length);
      expect(categories).toEqual(['Accessories', 'Audio', 'Display', 'Input Device', 'Video']);
    }
  });

  describe('data dependent', () => {
    beforeEach(async () => {
      await resetDb(getCtx().prisma);
    });

    it('a category that only has INACTIVE equipment is visible to admin but not to employee', async () => {
      await http()
        .post('/api/v1/equipments')
        .set(asAdmin())
        .send({ name: 'Old Fax', category: 'Archived-X', stockQuantity: 1, status: 'INACTIVE' })
        .expect(201);
      const admin = await http().get('/api/v1/equipments/categories').set(asAdmin()).expect(200);
      const employee = await http().get('/api/v1/equipments/categories').set(asEmployee()).expect(200);
      expect(admin.body).toContain('Archived-X');
      expect(employee.body).not.toContain('Archived-X');
    });
  });
});

describe('GET /equipments/:id', () => {
  it('employee gets 404 NOT_FOUND for the INACTIVE Projector, admin gets 200', async () => {
    const employee = await http().get(`/api/v1/equipments/${EQUIPMENT_IDS.projector}`).set(asEmployee()).expect(404);
    expect(employee.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    const admin = await http().get(`/api/v1/equipments/${EQUIPMENT_IDS.projector}`).set(asAdmin()).expect(200);
    expect(admin.body).toMatchObject({ id: EQUIPMENT_IDS.projector, status: 'INACTIVE' });
    expect(Object.keys(admin.body).sort()).toEqual(EQUIPMENT_KEYS);
  });

  it('employee can read an ACTIVE item', async () => {
    const res = await http().get(`/api/v1/equipments/${EQUIPMENT_IDS.monitor24}`).set(asEmployee()).expect(200);
    expect(res.body.name).toBe('Monitor 24-inch');
  });

  it('an unknown but valid UUID -> 404 for both roles', async () => {
    const id = 'e0000000-0000-4000-8000-0000000000ff';
    await http().get(`/api/v1/equipments/${id}`).set(asEmployee()).expect(404);
    await http().get(`/api/v1/equipments/${id}`).set(asAdmin()).expect(404);
  });

  it('a malformed id -> 400 VALIDATION_ERROR', async () => {
    const res = await http().get('/api/v1/equipments/not-a-uuid').set(asAdmin()).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /equipments', () => {
  beforeEach(async () => {
    await resetDb(getCtx().prisma);
  });

  it('creates with defaults, trims strings and returns the 8 keys', async () => {
    const res = await http()
      .post('/api/v1/equipments')
      .set(asAdmin())
      .send({ name: '  Laptop  ', category: '  Computer ', stockQuantity: 5 })
      .expect(201);
    expect(Object.keys(res.body).sort()).toEqual(EQUIPMENT_KEYS);
    expect(res.body).toMatchObject({ name: 'Laptop', category: 'Computer', stockQuantity: 5, status: 'ACTIVE', version: 1 });
  });

  it('honours an explicit INACTIVE status', async () => {
    const res = await http()
      .post('/api/v1/equipments')
      .set(asAdmin())
      .send({ name: 'Laptop', category: 'Computer', stockQuantity: 0, status: 'INACTIVE' })
      .expect(201);
    expect(res.body).toMatchObject({ status: 'INACTIVE', stockQuantity: 0 });
  });

  const base = { name: 'Valid', category: 'Cat', stockQuantity: 1 };
  const withoutName = { category: 'Cat', stockQuantity: 1 };
  it.each([
    ['stockQuantity -1', { ...base, stockQuantity: -1 }],
    ['stockQuantity 100001', { ...base, stockQuantity: 100001 }],
    ['stockQuantity 1.5', { ...base, stockQuantity: 1.5 }],
    ['stockQuantity "5"', { ...base, stockQuantity: '5' }],
    ['missing name', withoutName],
    ['blank name', { ...base, name: '   ' }],
    ['121-char name', { ...base, name: 'n'.repeat(121) }],
    ['61-char category', { ...base, category: 'c'.repeat(61) }],
    ['status BROKEN', { ...base, status: 'BROKEN' }],
    ['status null', { ...base, status: null }],
    ['extra field version', { ...base, version: 1 }],
    ['extra field id', { ...base, id: 'e0000000-0000-4000-8000-0000000000aa' }],
  ])('%s -> 400 and nothing is created', async (_label, body) => {
    const before = await equipmentCount();
    const res = await http().post('/api/v1/equipments').set(asAdmin()).send(body).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(await equipmentCount()).toBe(before);
  });
});

describe('PATCH /equipments/:id', () => {
  const url = (id: string = EQUIPMENT_IDS.monitor24) => `/api/v1/equipments/${id}`;
  const patch = (body: unknown, id?: string) => http().patch(url(id)).set(asAdmin()).send(body as object);

  beforeEach(async () => {
    await resetDb(getCtx().prisma);
  });

  it.each([
    ['no version', { name: 'X' }],
    ['only version', { version: 1 }],
    ['version 0', { version: 0, name: 'X' }],
    ['version "1"', { version: '1', name: 'X' }],
    ['unknown field', { version: 1, colour: 'red' }],
    ['name null', { version: 1, name: null }],
    ['status null', { version: 1, status: null }],
    ['stockQuantity null', { version: 1, stockQuantity: null }],
    ['stockQuantity -1', { version: 1, stockQuantity: -1 }],
  ])('%s -> 400 and the row is untouched', async (_label, body) => {
    const before = await getCtx().prisma.equipment.findUniqueOrThrow({ where: { id: EQUIPMENT_IDS.monitor24 } });
    const res = await patch(body).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(await getCtx().prisma.equipment.findUniqueOrThrow({ where: { id: EQUIPMENT_IDS.monitor24 } })).toEqual(before);
  });

  it('malformed id -> 400, unknown valid UUID -> 404', async () => {
    await http().patch('/api/v1/equipments/not-a-uuid').set(asAdmin()).send({ version: 1, name: 'X' }).expect(400);
    const res = await patch({ version: 1, name: 'X' }, 'e0000000-0000-4000-8000-0000000000ff').expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('REGRESSION: changing only the stock of an INACTIVE item keeps it INACTIVE (+1 version)', async () => {
    const res = await patch({ version: 1, stockQuantity: 9 }, EQUIPMENT_IDS.projector).expect(200);
    expect(res.body).toMatchObject({ status: 'INACTIVE', stockQuantity: 9, version: 2 });
  });

  it('applies the fields, trims, bumps the version and updatedAt, keeps createdAt', async () => {
    const before = await getCtx().prisma.equipment.findUniqueOrThrow({ where: { id: EQUIPMENT_IDS.monitor24 } });
    const res = await patch({ version: 1, name: '  Renamed  ', category: 'Screens', stockQuantity: 33 }).expect(200);
    expect(res.body).toMatchObject({ name: 'Renamed', category: 'Screens', stockQuantity: 33, version: 2, status: 'ACTIVE' });
    expect(res.body.createdAt).toBe(before.createdAt.toISOString());
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it('stockQuantity 0 and status INACTIVE are persisted', async () => {
    await patch({ version: 1, stockQuantity: 0 }).expect(200);
    const res = await patch({ version: 2, status: 'INACTIVE' }).expect(200);
    expect(res.body).toMatchObject({ stockQuantity: 0, status: 'INACTIVE', version: 3 });
    const row = await getCtx().prisma.equipment.findUniqueOrThrow({ where: { id: EQUIPMENT_IDS.monitor24 } });
    expect(row).toMatchObject({ stockQuantity: 0, status: 'INACTIVE', version: 3 });
  });

  it('a stale version -> exact 409 VERSION_CONFLICT and the data is unchanged', async () => {
    await patch({ version: 1, name: 'First' }).expect(200);
    const res = await patch({ version: 1, name: 'Second' }).expect(409);
    expect(res.body).toEqual(VERSION_CONFLICT);
    const row = await getCtx().prisma.equipment.findUniqueOrThrow({ where: { id: EQUIPMENT_IDS.monitor24 } });
    expect(row).toMatchObject({ name: 'First', version: 2 });
  });

  it('two simultaneous PATCHes with the same version -> exactly one 200 and one 409', async () => {
    const [a, b] = await Promise.all([patch({ version: 1, stockQuantity: 11 }), patch({ version: 1, stockQuantity: 22 })]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const row = await getCtx().prisma.equipment.findUniqueOrThrow({ where: { id: EQUIPMENT_IDS.monitor24 } });
    expect(row.version).toBe(2);
  });
});

