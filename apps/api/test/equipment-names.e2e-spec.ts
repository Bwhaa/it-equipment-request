import request from 'supertest';
import { EQUIPMENT_IDS, seed } from '../prisma/seed-data';
import { useTestApp } from './support/create-test-app';
import { bearer, loginAll, snapshot } from './support/fixtures';
import type { Tokens } from './support/fixtures';
import { resetDb } from './support/reset-db';

// Equipment names are unique ignoring letter case and surrounding spaces, INACTIVE items included. The rule is a
// database unique index on lower(btrim(name)), so two concurrent writers cannot both succeed.

const getCtx = useTestApp();
const prisma = () => getCtx().prisma;
const http = () => request(getCtx().app.getHttpServer());

let tokens: Tokens;
beforeAll(async () => {
  tokens = await loginAll(getCtx().app);
});
beforeEach(async () => {
  await resetDb(prisma());
});

const CONFLICT = {
  statusCode: 409,
  error: 'Conflict',
  message: 'An equipment with this name already exists',
  code: 'DUPLICATE_EQUIPMENT_NAME',
};
const VERSION_CONFLICT = {
  statusCode: 409,
  error: 'Conflict',
  message: 'ข้อมูลอุปกรณ์ถูกแก้ไขระหว่างนี้ กรุณาโหลดใหม่',
  code: 'VERSION_CONFLICT',
};

const valid = (name: string, extra: Record<string, unknown> = {}) => ({ name, category: 'Test', stockQuantity: 1, ...extra });
const create = (body: Record<string, unknown>) => http().post('/api/v1/equipments').set(bearer(tokens.admin)).send(body);
const update = (id: string, body: Record<string, unknown>) => http().patch(`/api/v1/equipments/${id}`).set(bearer(tokens.admin)).send(body);
const row = (id: string) => prisma().equipment.findUniqueOrThrow({ where: { id } });

interface Row {
  label: string;
  status: number;
  expected: string;
}
const rows: Row[] = [];
const record = (label: string, status: number, expected: string, ok: boolean): void => {
  rows.push({ label, status, expected: `${expected} ${ok ? 'GREEN' : 'RED'}` });
};
afterAll(() => {
  const lines = rows.map((r) => `${r.label.padEnd(86)} | got ${String(r.status).padEnd(3)} | expected ${r.expected}`);
  console.log(`REPRODUCTION TABLE\n${lines.join('\n')}`);
});

/** A rejected write: exact 409 body, a request id, and nothing changed in the database. */
async function expectDuplicate(label: string, run: () => request.Test, watchedId?: string): Promise<void> {
  const before = JSON.stringify([await snapshot(prisma()), watchedId ? await row(watchedId) : null]);
  const res = await run();
  record(label, res.status, '409', res.status === 409 && JSON.stringify(res.body) === JSON.stringify(CONFLICT));
  const after = JSON.stringify([await snapshot(prisma()), watchedId ? await row(watchedId) : null]);
  if (before !== after) await resetDb(prisma());
  expect(res.status).toBe(409);
  expect(res.body).toEqual(CONFLICT);
  expect(Object.keys(res.body as object).sort()).toEqual(['code', 'error', 'message', 'statusCode']);
  expect(res.headers['x-request-id']).toBeDefined();
  expect(after).toBe(before);
}

describe('create', () => {
  it.each(['Mouse', 'mouse', 'MOUSE', 'MoUsE', '  Mouse  '])('POST name %j equals the seeded "Mouse" -> 409', (name) =>
    expectDuplicate(`POST ${JSON.stringify(name)} (seed: Mouse)`, () => create(valid(name))),
  );

  it.each(['ACTIVE', 'INACTIVE'])('POST "projector" with status %s equals the INACTIVE seed item -> 409', (status) =>
    expectDuplicate(`POST "projector" status ${status} (seed: INACTIVE Projector)`, () => create(valid('projector', { status }))),
  );

  it('an INACTIVE item created through the API also blocks its name', async () => {
    const created = await create(valid('Archived Gadget', { status: 'INACTIVE' }));
    expect(created.status).toBe(201);
    await expectDuplicate('POST "archived gadget" (created INACTIVE a moment ago)', () => create(valid('archived gadget')));
  });

  it('Thai names: the same name twice -> 201 then 409', async () => {
    const first = await create(valid('จอ 24 นิ้ว'));
    record('POST "จอ 24 นิ้ว" (first)', first.status, '201', first.status === 201);
    expect(first.status).toBe(201);
    await expectDuplicate('POST "จอ 24 นิ้ว" (second)', () => create(valid('จอ 24 นิ้ว')));
  });

  it('INFO Unicode case folding: "écran" after "ÉCRAN" is a duplicate on this database', async () => {
    const first = await create(valid('ÉCRAN'));
    expect(first.status).toBe(201);
    // REAL behaviour, pinned on purpose: lower() follows the database's lc_ctype (en_US.utf8 in the compose
    // image), which folds É/é. A database created with the C locale would answer 201 here: that is a documented
    // limitation (README), not something the application works around.
    const second = await create(valid('écran'));
    record('POST "écran" after "ÉCRAN" (informational)', second.status, '409', second.status === 409);
    expect(second.status).toBe(409);
    expect(second.body).toEqual(CONFLICT);
  });

  it('names that only share a prefix are different names -> 201', async () => {
    for (const name of ['Monitor', 'Mouse Pad', 'Monitor 24-inch Pro']) {
      const res = await create(valid(name));
      record(`POST ${JSON.stringify(name)} (prefix of an existing name)`, res.status, '201', res.status === 201);
      expect(res.status).toBe(201);
    }
  });

  it('INFO internal spaces count: "Monitor  24-inch" (two spaces) is a different name -> 201', async () => {
    const res = await create(valid('Monitor  24-inch'));
    record('POST "Monitor  24-inch" (two inner spaces, informational)', res.status, '201', res.status === 201);
    expect(res.status).toBe(201);
  });
});

describe('update', () => {
  it('PATCH Keyboard to name "mouse" -> 409 and the Keyboard row (name, stock, version) is unchanged', async () => {
    await expectDuplicate(
      'PATCH Keyboard name "mouse"',
      () => update(EQUIPMENT_IDS.keyboard, { version: 1, name: 'mouse' }),
      EQUIPMENT_IDS.keyboard,
    );
    expect(await row(EQUIPMENT_IDS.keyboard)).toMatchObject({ name: 'Keyboard', stockQuantity: 20, version: 1 });
  });

  it('PATCH any item to the name of the INACTIVE Projector -> 409', () =>
    expectDuplicate('PATCH Keyboard name "PROJECTOR"', () => update(EQUIPMENT_IDS.keyboard, { version: 1, name: 'PROJECTOR' }), EQUIPMENT_IDS.keyboard));

  it('PATCH Keyboard name "KEYBOARD" (only the case of its OWN name) -> 200 and stored as sent', async () => {
    const res = await update(EQUIPMENT_IDS.keyboard, { version: 1, name: 'KEYBOARD' });
    record('PATCH Keyboard name "KEYBOARD" (own name, other case)', res.status, '200', res.status === 200);
    expect(res.status).toBe(200);
    expect((res.body as { name: string }).name).toBe('KEYBOARD');
    expect((await row(EQUIPMENT_IDS.keyboard)).name).toBe('KEYBOARD');
  });

  it('PATCH Keyboard with only stockQuantity (name not sent) -> 200', async () => {
    const res = await update(EQUIPMENT_IDS.keyboard, { version: 1, stockQuantity: 7 });
    record('PATCH Keyboard stockQuantity only', res.status, '200', res.status === 200);
    expect(res.status).toBe(200);
    expect(await row(EQUIPMENT_IDS.keyboard)).toMatchObject({ name: 'Keyboard', stockQuantity: 7, version: 2 });
  });

  it('PATCH Keyboard with its identical name -> 200', async () => {
    const res = await update(EQUIPMENT_IDS.keyboard, { version: 1, name: 'Keyboard' });
    record('PATCH Keyboard name "Keyboard" (identical)', res.status, '200', res.status === 200);
    expect(res.status).toBe(200);
  });

  it('a stale version WITH a duplicate name is reported as VERSION_CONFLICT (the version check finds 0 rows first)', async () => {
    const before = await snapshot(prisma());
    const res = await update(EQUIPMENT_IDS.keyboard, { version: 99, name: 'mouse' });
    record('PATCH Keyboard version 99 + duplicate name "mouse" (informational)', res.status, '409 VERSION_CONFLICT', res.status === 409 && JSON.stringify(res.body) === JSON.stringify(VERSION_CONFLICT));
    expect(res.status).toBe(409);
    expect(res.body).toEqual(VERSION_CONFLICT);
    expect(await snapshot(prisma())).toEqual(before);
  });
});

describe('concurrency (ITER = 10 per test)', () => {
  const ITER = 10;
  const statusesOf = (results: request.Response[]) => results.map((r) => r.status).sort((a, b) => a - b);

  it('two POSTs with the SAME new name -> exactly [201, 409] each time', async () => {
    const outcomes: string[] = [];
    for (let i = 1; i <= ITER; i += 1) {
      const before = await prisma().equipment.count();
      const results = await Promise.all([create(valid(`Race-${i}`)), create(valid(`Race-${i}`))]);
      outcomes.push(statusesOf(results).join('/'));
      record(`race POST x2 same name #${i}`, results[0]?.status ?? 0, '[201,409]', JSON.stringify(statusesOf(results)) === '[201,409]');
      expect(statusesOf(results)).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)?.body).toEqual(CONFLICT);
      expect(await prisma().equipment.count()).toBe(before + 1);
    }
    console.info(`[names] same name x2 POST: ${outcomes.length} iterations, outcomes ${[...new Set(outcomes)].join(',')}`);
  });

  it('two POSTs differing only by case and spaces -> exactly [201, 409] each time', async () => {
    const outcomes: string[] = [];
    for (let i = 1; i <= ITER; i += 1) {
      const before = await prisma().equipment.count();
      const results = await Promise.all([create(valid(`Case-${i}`)), create(valid(`  case-${i} `))]);
      outcomes.push(statusesOf(results).join('/'));
      expect(statusesOf(results)).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)?.body).toEqual(CONFLICT);
      expect(await prisma().equipment.count()).toBe(before + 1);
    }
    console.info(`[names] case/space variants x2 POST: ${ITER} iterations, outcomes ${[...new Set(outcomes)].join(',')}`);
  });

  it('a POST and a PATCH racing for the same new name -> exactly one success and one DUPLICATE_EQUIPMENT_NAME', async () => {
    const winners = { post: 0, patch: 0 };
    for (let i = 1; i <= ITER; i += 1) {
      const seedItem = await create(valid(`Seed-${i}`));
      expect(seedItem.status).toBe(201);
      const itemId = (seedItem.body as { id: string }).id;
      const [posted, patched] = await Promise.all([create(valid(`Race2-${i}`)), update(itemId, { version: 1, name: `Race2-${i}` })]);
      const statuses = [posted.status, patched.status];
      expect(statuses.filter((status) => status === 409)).toHaveLength(1);
      expect(statuses.filter((status) => status === 201 || status === 200)).toHaveLength(1);
      const loser = posted.status === 409 ? posted : patched;
      expect(loser.body).toEqual(CONFLICT);
      if (posted.status === 201) winners.post += 1;
      else winners.patch += 1;
      const same = await prisma().equipment.count({ where: { name: { equals: `Race2-${i}`, mode: 'insensitive' } } });
      expect(same).toBe(1);
    }
    console.info(`[names] POST vs PATCH race: ${ITER} iterations, POST won ${winners.post}, PATCH won ${winners.patch}`);
  });
});

describe('other', () => {
  it('the seed stays idempotent with the unique index (two runs, counts unchanged)', async () => {
    const before = await snapshot(prisma());
    await seed(prisma());
    await seed(prisma());
    expect(await snapshot(prisma())).toEqual(before);
  });
});
