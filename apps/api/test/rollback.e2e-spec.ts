import { Logger } from '@nestjs/common';
import request from 'supertest';
import { EQUIPMENT_IDS, REQUEST_IDS } from '../prisma/seed-data';
import { AuditLogService } from '../src/audit-log/audit-log.service';
import { useTestApp } from './support/create-test-app';
import { approve, bearer, loginAll, reject, snapshot } from './support/fixtures';
import type { Tokens } from './support/fixtures';
import { resetDb } from './support/reset-db';

const getCtx = useTestApp();
const prisma = () => getCtx().prisma;

let tokens: Tokens;
beforeAll(async () => {
  tokens = await loginAll(getCtx().app);
});
beforeEach(async () => {
  await resetDb(prisma());
});
afterEach(() => {
  jest.restoreAllMocks();
});

const INTERNAL_ERROR = {
  statusCode: 500,
  error: 'Internal Server Error',
  message: 'Internal server error',
  code: 'INTERNAL_ERROR',
};

type Variant = 'before write' | 'after write';
const VARIANTS: Variant[] = ['before write', 'after write'];
const CAUSE: Record<Variant, string> = { 'before write': 'audit down', 'after write': 'after audit' };

/** Makes the next AuditLogService.log call fail, either before or after it inserted its row. */
function failNextAuditLog(variant: Variant): jest.SpyInstance {
  const service = getCtx().app.get(AuditLogService);
  if (variant === 'before write') {
    return jest.spyOn(service, 'log').mockRejectedValueOnce(new Error(CAUSE[variant]));
  }
  const real = service.log.bind(service);
  return jest.spyOn(service, 'log').mockImplementationOnce(async (tx, entry) => {
    await real(tx, entry);
    throw new Error(CAUSE[variant]);
  });
}

const requestRow = (id: string) => prisma().request.findUniqueOrThrow({ where: { id } });
const equipmentRow = (id: string) => prisma().equipment.findUniqueOrThrow({ where: { id } });
const auditCount = (requestId?: string) =>
  requestId === undefined ? prisma().auditLog.count() : prisma().auditLog.count({ where: { requestId } });
const PENDING_UNTOUCHED = { status: 'PENDING', reviewedById: null, reviewedAt: null, approvedAt: null, rejectReason: null };

describe.each(VARIANTS)('audit log failure (%s)', (variant) => {
  it(`APPROVE rolls back everything, then a retry succeeds [approve / ${variant}]`, async () => {
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const spy = failNextAuditLog(variant);

    const res = await request(getCtx().app.getHttpServer())
      .patch(`/api/v1/requests/${REQUEST_IDS.r09}/approve`)
      .set(bearer(tokens.admin));
    expect(res.status).toBe(500);
    expect(res.body).toEqual(INTERNAL_ERROR);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(JSON.stringify(res.body)).not.toContain(CAUSE[variant]);
    expect(spy).toHaveBeenCalledTimes(1);

    expect(await requestRow(REQUEST_IDS.r09)).toMatchObject(PENDING_UNTOUCHED);
    expect(await equipmentRow(EQUIPMENT_IDS.mouse)).toMatchObject({ stockQuantity: 25, version: 1 });
    expect(await auditCount()).toBe(23);
    expect(await auditCount(REQUEST_IDS.r09)).toBe(1);

    // the server logs the cause with the same request id; the client never sees it
    const logged = errorLog.mock.calls.map((call) => call.map(String).join(' ')).join('\n');
    expect(logged).toContain(res.headers['x-request-id']);
    expect(logged).toContain(CAUSE[variant]);

    // retry without the spy
    spy.mockRestore();
    const retry = await approve(getCtx().app, tokens.admin, REQUEST_IDS.r09);
    expect(retry.status).toBe(200);
    expect(await equipmentRow(EQUIPMENT_IDS.mouse)).toMatchObject({ stockQuantity: 23, version: 2 });
    expect(await auditCount(REQUEST_IDS.r09)).toBe(2);
  });

  it(`REJECT rolls back everything, then a retry succeeds [reject / ${variant}]`, async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const spy = failNextAuditLog(variant);

    const res = await request(getCtx().app.getHttpServer())
      .patch(`/api/v1/requests/${REQUEST_IDS.r10}/reject`)
      .set(bearer(tokens.admin))
      .send({ rejectReason: 'not needed anymore' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual(INTERNAL_ERROR);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(spy).toHaveBeenCalledTimes(1);

    expect(await requestRow(REQUEST_IDS.r10)).toMatchObject(PENDING_UNTOUCHED);
    expect(await equipmentRow(EQUIPMENT_IDS.keyboard)).toMatchObject({ stockQuantity: 20, version: 1 });
    expect(await auditCount()).toBe(23);
    expect(await auditCount(REQUEST_IDS.r10)).toBe(1);

    spy.mockRestore();
    const retry = await reject(getCtx().app, tokens.admin, REQUEST_IDS.r10, 'not needed anymore');
    expect(retry.status).toBe(200);
    expect(await auditCount(REQUEST_IDS.r10)).toBe(2);
  });

  it(`CREATE rolls the request insert back too, then a retry succeeds [create / ${variant}]`, async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const spy = failNextAuditLog(variant);
    const before = await equipmentRow(EQUIPMENT_IDS.monitor24);
    const create = () =>
      request(getCtx().app.getHttpServer())
        .post('/api/v1/requests')
        .set(bearer(tokens.employee1))
        .send({ equipmentId: EQUIPMENT_IDS.monitor24, quantity: 1, reason: 'one monitor please' });

    const res = await create();
    expect(res.status).toBe(500);
    expect(res.body).toEqual(INTERNAL_ERROR);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(spy).toHaveBeenCalledTimes(1);

    expect(await prisma().request.count()).toBe(15);
    expect(await auditCount()).toBe(23);
    const after = await equipmentRow(EQUIPMENT_IDS.monitor24);
    expect({ stock: after.stockQuantity, version: after.version }).toEqual({
      stock: before.stockQuantity,
      version: before.version,
    });

    spy.mockRestore();
    expect((await create()).status).toBe(201);
    expect(await prisma().request.count()).toBe(16);
    expect(await auditCount()).toBe(24);
  });
});

describe('other failures inside the approve transaction', () => {
  it.each([
    ['14 (Projector INACTIVE)', REQUEST_IDS.DEMO_INACTIVE, 'EQUIPMENT_INACTIVE'],
    ['15 (qty 8 > stock 5)', REQUEST_IDS.DEMO_OVER, 'INSUFFICIENT_STOCK'],
  ])('approve %s changes NOTHING in the database', async (_label, id, code) => {
    const before = await snapshot(prisma());
    const res = await approve(getCtx().app, tokens.admin, id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(code);
    expect(await snapshot(prisma())).toEqual(before);
    expect(await requestRow(id)).toMatchObject(PENDING_UNTOUCHED);
  });
});
