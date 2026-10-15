import request from 'supertest';
import { EQUIPMENT_IDS } from '../prisma/seed-data';
import { useTestApp } from './support/create-test-app';
import { approve, bearer, createPending, loginAll, reject, setStock } from './support/fixtures';
import type { Tokens } from './support/fixtures';

// Concurrency tests assert INVARIANTS that hold for any interleaving; they never depend on which request wins.
const getCtx = useTestApp();
const app = () => getCtx().app;
const prisma = () => getCtx().prisma;

const KEYBOARD = EQUIPMENT_IDS.keyboard;
const ITER = 20;
const FORBIDDEN_VERSION_CONFLICT = {
  statusCode: 409,
  error: 'Conflict',
  message: 'ข้อมูลอุปกรณ์ถูกแก้ไขระหว่างนี้ กรุณาโหลดใหม่',
  code: 'VERSION_CONFLICT',
};

let tokens: Tokens;
beforeAll(async () => {
  tokens = await loginAll(app());
});

const equipmentRow = () => prisma().equipment.findUniqueOrThrow({ where: { id: KEYBOARD } });
const requestRow = (id: string) => prisma().request.findUniqueOrThrow({ where: { id } });
const auditRows = (requestId: string) =>
  prisma().auditLog.findMany({ where: { requestId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
const trail = async (requestId: string) =>
  (await auditRows(requestId)).map((row) => `${row.fromStatus ?? 'null'}->${row.toStatus}`);
const sortedStatuses = (results: { status: number }[]) => results.map((result) => result.status).sort((a, b) => a - b);

function patchEquipment(body: object) {
  return request(app().getHttpServer()).patch(`/api/v1/equipments/${KEYBOARD}`).set(bearer(tokens.admin)).send(body);
}

/** Resets the shared scenario row (Keyboard) and returns its current version. */
async function prepare(stock: number): Promise<number> {
  await setStock(prisma(), KEYBOARD, stock);
  return (await equipmentRow()).version;
}

const summary = (name: string, iterations: number, tally: Record<string, number>) =>
  console.info(
    `${name}: ${iterations}/${iterations} iterations ok, ${Object.entries(tally)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ')}`,
  );

describe('concurrency and version conflict', () => {
  it('C1 oversubscription: stock 3, two requests of 2 -> one 200, one 409 "Only 1 left"', async () => {
    const tally = { '200s': 0, '409s': 0 };
    for (let i = 0; i < ITER; i += 1) {
      const v0 = await prepare(3);
      const a = await createPending(app(), tokens.employee1, KEYBOARD, 2);
      const b = await createPending(app(), tokens.employee2, KEYBOARD, 2);

      const results = await Promise.all([approve(app(), tokens.admin, a), approve(app(), tokens.admin, b)]);
      expect(sortedStatuses(results)).toEqual([200, 409]);
      const loser = results.find((result) => result.status === 409);
      expect(loser?.body).toMatchObject({ code: 'INSUFFICIENT_STOCK', message: 'Only 1 left' });

      const equipment = await equipmentRow();
      expect(equipment).toMatchObject({ stockQuantity: 1, version: v0 + 1 });
      expect(equipment.stockQuantity).toBeGreaterThanOrEqual(0);

      const [rowA, rowB] = [await requestRow(a), await requestRow(b)];
      const statuses = [rowA.status, rowB.status].sort();
      expect(statuses).toEqual(['APPROVED', 'PENDING']);
      const [winner, loserRow] = rowA.status === 'APPROVED' ? [rowA, rowB] : [rowB, rowA];
      expect(winner.reviewedById).not.toBeNull();
      expect(winner.approvedAt).not.toBeNull();
      expect(loserRow).toMatchObject({ reviewedById: null, reviewedAt: null, approvedAt: null });
      expect(await trail(winner.id)).toEqual(['null->PENDING', 'PENDING->APPROVED']);
      expect(await trail(loserRow.id)).toEqual(['null->PENDING']);
      tally['200s'] += 1;
      tally['409s'] += 1;
    }
    summary('C1 oversubscription', ITER, tally);
  });

  it('C2 double approve of one request -> [200, 409 INVALID_STATUS], stock deducted once', async () => {
    const tally = { '200s': 0, '409s': 0 };
    for (let i = 0; i < ITER; i += 1) {
      const v0 = await prepare(10);
      const id = await createPending(app(), tokens.employee1, KEYBOARD, 3);

      const results = await Promise.all([approve(app(), tokens.admin, id), approve(app(), tokens.admin, id)]);
      expect(sortedStatuses(results)).toEqual([200, 409]);
      expect(results.find((result) => result.status === 409)?.body.code).toBe('INVALID_STATUS');
      expect(await equipmentRow()).toMatchObject({ stockQuantity: 7, version: v0 + 1 });
      expect(await trail(id)).toEqual(['null->PENDING', 'PENDING->APPROVED']);
      tally['200s'] += 1;
      tally['409s'] += 1;
    }
    summary('C2 double approve', ITER, tally);
  });

  it('C3 approve versus reject of one request -> exactly one wins, state is consistent with the winner', async () => {
    const tally = { approveWon: 0, rejectWon: 0 };
    for (let i = 0; i < ITER; i += 1) {
      const v0 = await prepare(10);
      const id = await createPending(app(), tokens.employee1, KEYBOARD, 3);

      // Alternate which call is issued first so both orders are exercised; only invariants are asserted.
      const calls = [() => approve(app(), tokens.admin, id), () => reject(app(), tokens.admin, id, 'not needed anymore')];
      const results = await Promise.all((i % 2 === 0 ? calls : [...calls].reverse()).map((call) => call()));
      expect(sortedStatuses(results)).toEqual([200, 409]);
      expect(results.find((result) => result.status === 409)?.body.code).toBe('INVALID_STATUS');

      const row = await requestRow(id);
      const equipment = await equipmentRow();
      const logs = await trail(id);
      expect(logs).toHaveLength(2);
      if (row.status === 'APPROVED') {
        expect(equipment).toMatchObject({ stockQuantity: 7, version: v0 + 1 });
        expect(row.approvedAt).not.toBeNull();
        expect(row.rejectReason).toBeNull();
        expect(logs[1]).toBe('PENDING->APPROVED');
        tally.approveWon += 1;
      } else {
        expect(row.status).toBe('REJECTED');
        expect(equipment).toMatchObject({ stockQuantity: 10, version: v0 });
        expect(row.approvedAt).toBeNull();
        expect(row.rejectReason).not.toBeNull();
        expect(logs[1]).toBe('PENDING->REJECTED');
        tally.rejectWon += 1;
      }
    }
    summary('C3 approve vs reject', ITER, tally); // informational: which side won is NOT asserted
  });

  it('C4 many approvals: stock 4, ten requests of 1 -> four 200, six 409 INSUFFICIENT_STOCK', async () => {
    const iterations = 5;
    const tally = { '200s': 0, '409s': 0 };
    for (let i = 0; i < iterations; i += 1) {
      const v0 = await prepare(4);
      const ids: string[] = [];
      for (let n = 0; n < 10; n += 1) {
        ids.push(await createPending(app(), n % 2 === 0 ? tokens.employee1 : tokens.employee2, KEYBOARD, 1));
      }

      const results = await Promise.all(ids.map((id) => approve(app(), tokens.admin, id)));
      const ok = results.filter((result) => result.status === 200);
      const conflicts = results.filter((result) => result.status === 409);
      expect(ok).toHaveLength(4);
      expect(conflicts).toHaveLength(6);
      expect(conflicts.every((result) => result.body.code === 'INSUFFICIENT_STOCK')).toBe(true);

      const equipment = await equipmentRow();
      expect(equipment).toMatchObject({ stockQuantity: 0, version: v0 + 4 });
      expect(equipment.stockQuantity).toBeGreaterThanOrEqual(0);

      const rows = await Promise.all(ids.map((id) => requestRow(id)));
      expect(rows.filter((row) => row.status === 'APPROVED')).toHaveLength(4);
      expect(rows.filter((row) => row.status === 'PENDING')).toHaveLength(6);
      const approvedLogs = await prisma().auditLog.count({
        where: { requestId: { in: ids }, fromStatus: 'PENDING', toStatus: 'APPROVED' },
      });
      expect(approvedLogs).toBe(4);
      tally['200s'] += ok.length;
      tally['409s'] += conflicts.length;
    }
    summary('C4 many approvals', iterations, tally);
  });

  it('C5 approve versus edit: approve is always 200, the version arithmetic matches the PATCH outcome', async () => {
    const tally = { patch200: 0, patch409: 0 };
    for (let i = 0; i < ITER; i += 1) {
      const v0 = await prepare(10);
      const id = await createPending(app(), tokens.employee1, KEYBOARD, 2);
      const name = `Renamed-${i}`;

      const approveCall = () => approve(app(), tokens.admin, id);
      const patchCall = () => patchEquipment({ version: v0, name }).then((res) => ({ status: res.status, body: res.body as Record<string, unknown> }));
      // Alternate which call is issued first; only sequence-independent invariants are asserted.
      const [approved, patched] =
        i % 2 === 0
          ? await Promise.all([approveCall(), patchCall()])
          : await Promise.all([patchCall(), approveCall()]).then(([p, a]) => [a, p] as const);
      expect(approved.status).toBe(200);
      expect([200, 409]).toContain(patched.status);
      if (patched.status === 409) expect(patched.body).toEqual(FORBIDDEN_VERSION_CONFLICT);

      const patchWon = patched.status === 200;
      const equipment = await equipmentRow();
      expect(equipment.stockQuantity).toBe(8);
      expect(equipment.version).toBe(v0 + 1 + (patchWon ? 1 : 0));
      expect(equipment.name === name).toBe(patchWon);
      if (patchWon) tally.patch200 += 1;
      else tally.patch409 += 1;
    }
    summary('C5 approve vs edit', ITER, tally);
  });

  it('C6 lost update (sequential, §5.1): a stale form version is rejected after an approve', async () => {
    const tally = { '409s': 0, '200s': 0 };
    for (let i = 0; i < ITER; i += 1) {
      await prepare(10);
      const read = await request(app().getHttpServer()).get(`/api/v1/equipments/${KEYBOARD}`).set(bearer(tokens.admin)).expect(200);
      const v0 = (read.body as { version: number }).version;

      const id = await createPending(app(), tokens.employee1, KEYBOARD, 2);
      expect((await approve(app(), tokens.admin, id)).status).toBe(200);

      const stale = await patchEquipment({ version: v0, stockQuantity: 99 }).expect(409);
      expect(stale.body).toEqual(FORBIDDEN_VERSION_CONFLICT);
      expect((await equipmentRow()).stockQuantity).toBe(8);

      const fresh = await request(app().getHttpServer()).get(`/api/v1/equipments/${KEYBOARD}`).set(bearer(tokens.admin)).expect(200);
      const v1 = (fresh.body as { version: number }).version;
      expect(v1).toBe(v0 + 1);
      const ok = await patchEquipment({ version: v1, stockQuantity: 99 }).expect(200);
      expect(ok.body).toMatchObject({ stockQuantity: 99, version: v1 + 1 });
      tally['409s'] += 1;
      tally['200s'] += 1;
    }
    summary('C6 lost update', ITER, tally);
  });

  it('C7 two PATCHes with the same version -> exactly one 200 and one 409 VERSION_CONFLICT', async () => {
    const tally = { '200s': 0, '409s': 0 };
    for (let i = 0; i < ITER; i += 1) {
      const v0 = await prepare(10);
      const results = await Promise.all([
        patchEquipment({ version: v0, stockQuantity: 11 }),
        patchEquipment({ version: v0, stockQuantity: 22 }),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
      const loser = results.find((result) => result.status === 409);
      expect(loser?.body).toEqual(FORBIDDEN_VERSION_CONFLICT);
      const winner = results.find((result) => result.status === 200);
      const equipment = await equipmentRow();
      expect(equipment.version).toBe(v0 + 1);
      expect(equipment.stockQuantity).toBe((winner?.body as { stockQuantity: number }).stockQuantity);
      tally['200s'] += 1;
      tally['409s'] += 1;
    }
    summary('C7 same-version PATCH', ITER, tally);
  });
});
