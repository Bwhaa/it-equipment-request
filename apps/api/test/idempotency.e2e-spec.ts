import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { request as httpRequest } from 'node:http';
import { Logger } from '@nestjs/common';
import request from 'supertest';
import { EQUIPMENT_IDS } from '../prisma/seed-data';
import { AuditLogService } from '../src/audit-log/audit-log.service';
import { useTestApp } from './support/create-test-app';
import { bearer, approve, loginAll, setStock, snapshot } from './support/fixtures';
import type { Tokens } from './support/fixtures';
import { resetDb } from './support/reset-db';

const getCtx = useTestApp();
const app = () => getCtx().app;
const prisma = () => getCtx().prisma;

const MONITOR27 = EQUIPMENT_IDS.monitor27;
const ITER = 10;
const REUSED = {
  statusCode: 422,
  error: 'Unprocessable Entity',
  message: 'Idempotency key was already used with a different request',
  code: 'IDEMPOTENCY_KEY_REUSED',
};
const DOCUMENTED_KEYS = [
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
].sort();

let tokens: Tokens;
beforeAll(async () => {
  tokens = await loginAll(app());
});
beforeEach(async () => {
  await resetDb(prisma());
});
afterEach(() => {
  jest.restoreAllMocks();
});

const BODY = { equipmentId: MONITOR27, quantity: 1, reason: 'idempotency test' };

function post(token: string | undefined, key: string | undefined, body: object = BODY) {
  let req = request(app().getHttpServer()).post('/api/v1/requests');
  if (token !== undefined) req = req.set(bearer(token));
  if (key !== undefined) req = req.set('Idempotency-Key', key);
  return req.send(body);
}

const counts = async () => ({ requests: await prisma().request.count(), audit: await prisma().auditLog.count() });
const sortedStatuses = (results: { status: number }[]) => results.map((r) => r.status).sort((a, b) => a - b);

describe('replays', () => {
  it('second identical POST -> 200, same id, replayed header, same body, +1 row, +1 audit', async () => {
    const key = randomUUID();
    const before = await counts();
    const first = await post(tokens.employee1, key);
    const second = await post(tokens.employee1, key);

    expect(first.status).toBe(201);
    expect(first.headers['idempotent-replayed']).toBeUndefined();
    expect(second.status).toBe(200);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect((second.body as { id: string }).id).toBe((first.body as { id: string }).id);
    expect(second.body).toEqual(first.body);
    const after = await counts();
    expect(after.requests).toBe(before.requests + 1);
    expect(after.audit).toBe(before.audit + 1);
  });

  it('the replay body has exactly the 11 documented keys and never exposes the key', async () => {
    const key = randomUUID();
    await post(tokens.employee1, key);
    const replay = await post(tokens.employee1, key);
    expect(replay.status).toBe(200);
    expect(Object.keys(replay.body as object).sort()).toEqual(DOCUMENTED_KEYS);
    const text = JSON.stringify(replay.body).toLowerCase();
    expect(text).not.toContain('idempotencykey');
    expect(text).not.toContain('idempotency_key');
    expect(text).not.toContain(key);
  });

  it('the key in UPPERCASE replays the same request', async () => {
    const key = randomUUID();
    const first = await post(tokens.employee1, key);
    const upper = await post(tokens.employee1, key.toUpperCase());
    expect(upper.status).toBe(200);
    expect((upper.body as { id: string }).id).toBe((first.body as { id: string }).id);
  });

  it('a reason with surrounding spaces replays (trimmed equals the stored reason)', async () => {
    const key = randomUUID();
    const first = await post(tokens.employee1, key);
    const replay = await post(tokens.employee1, key, { ...BODY, reason: '  idempotency test  ' });
    expect(replay.status).toBe(200);
    expect((replay.body as { id: string }).id).toBe((first.body as { id: string }).id);
  });

  it('replay still returns the original after the stock dropped to 0, a new key answers 422', async () => {
    const key = randomUUID();
    const first = await post(tokens.employee1, key);
    await setStock(prisma(), MONITOR27, 0);
    const replay = await post(tokens.employee1, key);
    expect(replay.status).toBe(200);
    expect((replay.body as { id: string }).id).toBe((first.body as { id: string }).id);
    const fresh = await post(tokens.employee1, randomUUID());
    expect(fresh.status).toBe(422);
    expect(fresh.body).toMatchObject({ code: 'EQUIPMENT_UNAVAILABLE' });
  });

  it('replay still returns the original after the equipment became INACTIVE, a new key answers 404', async () => {
    const key = randomUUID();
    const first = await post(tokens.employee1, key);
    await prisma().equipment.update({ where: { id: MONITOR27 }, data: { status: 'INACTIVE' } });
    const replay = await post(tokens.employee1, key);
    expect(replay.status).toBe(200);
    expect((replay.body as { id: string }).id).toBe((first.body as { id: string }).id);
    const fresh = await post(tokens.employee1, randomUUID());
    expect(fresh.status).toBe(404);
    expect(fresh.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('replay of a request an admin already APPROVED -> 200 with the current status', async () => {
    const key = randomUUID();
    const first = await post(tokens.employee1, key);
    const id = (first.body as { id: string }).id;
    expect((await approve(app(), tokens.admin, id)).status).toBe(200);
    const replay = await post(tokens.employee1, key);
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ id, status: 'APPROVED' });
  });
});

describe('different payload', () => {
  const variants: [string, object][] = [
    ['another quantity', { ...BODY, quantity: 2 }],
    ['another reason', { ...BODY, reason: 'a different reason' }],
    ['another equipmentId', { ...BODY, equipmentId: EQUIPMENT_IDS.monitor24 }],
  ];

  it.each(variants)('same key with %s -> 422 IDEMPOTENCY_KEY_REUSED, nothing changes', async (_name, body) => {
    const key = randomUUID();
    await post(tokens.employee1, key);
    const before = await snapshot(prisma());
    const res = await post(tokens.employee1, key, body);
    expect(res.status).toBe(422);
    expect(res.body).toEqual(REUSED);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['idempotent-replayed']).toBeUndefined();
    expect(await snapshot(prisma())).toEqual(before);
  });

  it('a payload that is also invalid (quantity 0) -> 400 VALIDATION_ERROR, validation runs first', async () => {
    const key = randomUUID();
    await post(tokens.employee1, key);
    const before = await snapshot(prisma());
    const res = await post(tokens.employee1, key, { ...BODY, quantity: 0 });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await snapshot(prisma())).toEqual(before);
  });
});

describe('scoping and no header', () => {
  it('employee2 can use the key employee1 used; employee1 still replays its own row', async () => {
    const key = randomUUID();
    const one = await post(tokens.employee1, key);
    const two = await post(tokens.employee2, key);
    expect(two.status).toBe(201);
    expect((two.body as { id: string }).id).not.toBe((one.body as { id: string }).id);
    const replay = await post(tokens.employee1, key);
    expect(replay.status).toBe(200);
    expect((replay.body as { id: string }).id).toBe((one.body as { id: string }).id);
  });

  it('two POSTs WITHOUT the header create two rows', async () => {
    const before = await counts();
    const a = await post(tokens.employee1, undefined);
    const b = await post(tokens.employee1, undefined);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect((a.body as { id: string }).id).not.toBe((b.body as { id: string }).id);
    expect((await counts()).requests).toBe(before.requests + 2);
  });

  it('a failed first attempt (quantity above stock) stores nothing; the retry with the same key -> 201', async () => {
    const key = randomUUID();
    const failed = await post(tokens.employee1, key, { ...BODY, quantity: 6 });
    expect(failed.status).toBe(422);
    expect(failed.body).toMatchObject({ code: 'EQUIPMENT_UNAVAILABLE' });
    const retry = await post(tokens.employee1, key);
    expect(retry.status).toBe(201);
  });
});

describe('header validation', () => {
  it.each([['not-a-uuid'], [''], [' '], [`${randomUUID()}x`]])('Idempotency-Key %j -> 400 VALIDATION_ERROR', async (value) => {
    const before = await snapshot(prisma());
    const res = await post(tokens.employee1, value);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await snapshot(prisma())).toEqual(before);
  });

  it('two Idempotency-Key headers sent together -> 400 VALIDATION_ERROR', async () => {
    const before = await snapshot(prisma());
    const server = app().getHttpServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const port = (server.address() as AddressInfo).port;
      const payload = JSON.stringify(BODY);
      const result = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const req = httpRequest(
          {
            host: '127.0.0.1',
            port,
            path: '/api/v1/requests',
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(payload),
              authorization: `Bearer ${tokens.employee1}`,
              'idempotency-key': [randomUUID(), randomUUID()],
            },
          },
          (res) => {
            let body = '';
            res.on('data', (chunk: Buffer) => (body += chunk.toString()));
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
          },
        );
        req.on('error', reject);
        req.end(payload);
      });
      expect(result.status).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({ code: 'VALIDATION_ERROR' });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    expect(await snapshot(prisma())).toEqual(before);
  });
});

describe('authorization order', () => {
  it('no token + key -> 401', async () => {
    const res = await post(undefined, randomUUID());
    expect(res.status).toBe(401);
  });

  it('no token + invalid key -> 401 (before header validation)', async () => {
    expect((await post(undefined, 'not-a-uuid')).status).toBe(401);
  });

  it('admin + key -> 403', async () => {
    const res = await post(tokens.admin, randomUUID());
    expect(res.status).toBe(403);
  });

  it('admin + invalid key -> 403 (before header validation)', async () => {
    expect((await post(tokens.admin, 'not-a-uuid')).status).toBe(403);
  });
});

describe('concurrency', () => {
  const info = (name: string, tally: Record<string, number>) =>
    console.info(
      `${name}: ${ITER}/${ITER} iterations ok, ${Object.entries(tally)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}`,
    );

  it('two identical POSTs with the same key -> [200, 201], same id, +1 row, +1 audit', async () => {
    const tally = { '201s': 0, '200s': 0 };
    for (let i = 0; i < ITER; i += 1) {
      const key = randomUUID();
      const before = await counts();
      const results = await Promise.all([post(tokens.employee1, key), post(tokens.employee1, key)]);
      expect(sortedStatuses(results)).toEqual([200, 201]);
      expect((results[0].body as { id: string }).id).toBe((results[1].body as { id: string }).id);
      const after = await counts();
      expect(after.requests).toBe(before.requests + 1);
      expect(after.audit).toBe(before.audit + 1);
      tally['201s'] += 1;
      tally['200s'] += 1;
    }
    info('IDEM-C1 two identical', tally);
  });

  it('five identical POSTs with the same key -> one 201, four 200, one row, one audit', async () => {
    const tally = { '201s': 0, '200s': 0 };
    for (let i = 0; i < ITER; i += 1) {
      const key = randomUUID();
      const before = await counts();
      const results = await Promise.all(Array.from({ length: 5 }, () => post(tokens.employee1, key)));
      expect(sortedStatuses(results)).toEqual([200, 200, 200, 200, 201]);
      expect(new Set(results.map((r) => (r.body as { id: string }).id)).size).toBe(1);
      const after = await counts();
      expect(after.requests).toBe(before.requests + 1);
      expect(after.audit).toBe(before.audit + 1);
      tally['201s'] += 1;
      tally['200s'] += 4;
    }
    info('IDEM-C2 five identical', tally);
  });

  it('same key with DIFFERENT quantities at once -> one 201, one 422 IDEMPOTENCY_KEY_REUSED, one row', async () => {
    const tally = { '201s': 0, '422s': 0 };
    for (let i = 0; i < ITER; i += 1) {
      const key = randomUUID();
      const before = await counts();
      const results = await Promise.all([
        post(tokens.employee1, key, { ...BODY, quantity: 1 }),
        post(tokens.employee1, key, { ...BODY, quantity: 2 }),
      ]);
      expect(sortedStatuses(results)).toEqual([201, 422]);
      const loser = results.find((r) => r.status === 422);
      expect(loser?.body).toEqual(REUSED);
      const after = await counts();
      expect(after.requests).toBe(before.requests + 1);
      expect(after.audit).toBe(before.audit + 1);
      tally['201s'] += 1;
      tally['422s'] += 1;
    }
    info('IDEM-C3 different quantities', tally);
  });

  it('two POSTs with DIFFERENT keys -> two rows (control)', async () => {
    const tally = { '201s': 0 };
    for (let i = 0; i < ITER; i += 1) {
      const before = await counts();
      const results = await Promise.all([post(tokens.employee1, randomUUID()), post(tokens.employee1, randomUUID())]);
      expect(sortedStatuses(results)).toEqual([201, 201]);
      expect((await counts()).requests).toBe(before.requests + 2);
      tally['201s'] += 2;
    }
    info('IDEM-C4 different keys', tally);
  });
});

describe('rollback interaction', () => {
  it('audit log failure on a keyed create -> 500, nothing stored, retry with the same key -> 201', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const key = randomUUID();
    const before = await snapshot(prisma());
    jest.spyOn(app().get(AuditLogService), 'log').mockRejectedValueOnce(new Error('audit down'));

    const res = await post(tokens.employee1, key);
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(await snapshot(prisma())).toEqual(before);

    const retry = await post(tokens.employee1, key);
    expect(retry.status).toBe(201);
  });
});
