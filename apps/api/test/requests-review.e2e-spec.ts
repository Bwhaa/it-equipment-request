import request from 'supertest';
import { EQUIPMENT_IDS, REQUEST_IDS, USER_IDS } from '../prisma/seed-data';
import { AuditLogService } from '../src/audit-log/audit-log.service';
import { useTestApp } from './support/create-test-app';
import { resetDb } from './support/reset-db';
import { ADMIN_LOGIN, EMPLOYEE1_LOGIN, EMPLOYEE2_LOGIN, loginToken } from './support/tokens';

const getCtx = useTestApp();
const http = () => request(getCtx().app.getHttpServer());
const prisma = () => getCtx().prisma;

let adminToken = '';
let employee1Token = '';
let employee2Token = '';
beforeAll(async () => {
  adminToken = await loginToken(getCtx().app, ADMIN_LOGIN);
  employee1Token = await loginToken(getCtx().app, EMPLOYEE1_LOGIN);
  employee2Token = await loginToken(getCtx().app, EMPLOYEE2_LOGIN);
});
// Every test changes (or must prove it did not change) data: start each one from the seed.
beforeEach(async () => {
  await resetDb(prisma());
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
const FORBIDDEN = { statusCode: 403, error: 'Forbidden', message: 'Forbidden', code: 'FORBIDDEN' };
const NOT_PENDING = { statusCode: 409, error: 'Conflict', message: 'Request is not PENDING', code: 'INVALID_STATUS' };
const UNKNOWN_ID = 'b0000000-0000-4000-8000-0000000000ff';
const VALID_REASON = { rejectReason: 'not needed anymore' };

const approve = (id: string, headers: Record<string, string> = asAdmin()) =>
  http().patch(`/api/v1/requests/${id}/approve`).set(headers);
const reject = (id: string, body: unknown, headers: Record<string, string> = asAdmin()) =>
  http().patch(`/api/v1/requests/${id}/reject`).set(headers).send(body as object);

const snapshot = async () => ({
  requests: await prisma().request.findMany({ orderBy: { id: 'asc' } }),
  equipments: await prisma().equipment.findMany({ orderBy: { id: 'asc' } }),
  auditLogs: await prisma().auditLog.findMany({ orderBy: { id: 'asc' } }),
});
const without = <T extends { id: string }>(rows: T[], ...ids: string[]) => rows.filter((row) => !ids.includes(row.id));

const equipmentRow = (id: string) => prisma().equipment.findUniqueOrThrow({ where: { id } });
const requestRow = (id: string) => prisma().request.findUniqueOrThrow({ where: { id } });
const auditRows = (requestId: string) =>
  prisma().auditLog.findMany({ where: { requestId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });

function createRequest(equipmentId: string, quantity: number, headers = asEmployee1()) {
  return http().post('/api/v1/requests').set(headers).send({ equipmentId, quantity, reason: 'created by the e2e test' });
}

describe('PATCH /requests/:id/approve', () => {
  it('approves 09 (Mouse x2): response, stock, version, audit rows, and nothing else changes', async () => {
    const before = await snapshot();

    const res = await approve(REQUEST_IDS.r09).expect(200);
    const body = res.body as {
      status: string;
      rejectReason: string | null;
      approvedAt: string;
      reviewedAt: string;
      reviewer: { id: string; name: string };
      requester: { id: string };
      equipment: { stockQuantity: number };
    };
    expect(Object.keys(body).sort()).toEqual(REQUEST_KEYS);
    expect(body.status).toBe('APPROVED');
    expect(body.rejectReason).toBeNull();
    expect(body.approvedAt).not.toBeNull();
    expect(body.approvedAt).toBe(body.reviewedAt);
    expect(body.reviewer).toEqual({ id: USER_IDS.admin, name: 'Admin' });
    expect(body.requester.id).toBe(USER_IDS.employee1);
    expect(body.equipment.stockQuantity).toBe(23);

    const mouse = await equipmentRow(EQUIPMENT_IDS.mouse);
    expect(mouse).toMatchObject({ stockQuantity: 23, version: 2, status: 'ACTIVE' });
    const row = await requestRow(REQUEST_IDS.r09);
    expect(row.status).toBe('APPROVED');
    expect(row.approvedAt).toEqual(row.reviewedAt);
    expect(row.reviewedById).toBe(USER_IDS.admin);

    const logs = await auditRows(REQUEST_IDS.r09);
    expect(logs.map((log) => [log.fromStatus, log.toStatus, log.actorId])).toEqual([
      [null, 'PENDING', USER_IDS.employee1],
      ['PENDING', 'APPROVED', USER_IDS.admin],
    ]);

    const after = await snapshot();
    expect(after.auditLogs).toHaveLength(before.auditLogs.length + 1);
    expect(without(after.requests, REQUEST_IDS.r09)).toEqual(without(before.requests, REQUEST_IDS.r09));
    expect(without(after.equipments, EQUIPMENT_IDS.mouse)).toEqual(without(before.equipments, EQUIPMENT_IDS.mouse));
  });

  it('a second approve of the same request -> exact 409 INVALID_STATUS and no further change', async () => {
    await approve(REQUEST_IDS.r09).expect(200);
    const before = await snapshot();
    const res = await approve(REQUEST_IDS.r09).expect(409);
    expect(res.body).toEqual(NOT_PENDING);
    expect(await snapshot()).toEqual(before);
    expect(await equipmentRow(EQUIPMENT_IDS.mouse)).toMatchObject({ stockQuantity: 23, version: 2 });
  });

  it.each([
    ['01 (APPROVED)', REQUEST_IDS.r01],
    ['06 (REJECTED)', REQUEST_IDS.r06],
  ])('approving %s -> 409 INVALID_STATUS and nothing changes', async (_label, id) => {
    const before = await snapshot();
    const res = await approve(id).expect(409);
    expect(res.body).toEqual(NOT_PENDING);
    expect(await snapshot()).toEqual(before);
  });

  it('approving 14 (Projector INACTIVE) -> 409 EQUIPMENT_INACTIVE with a FULL rollback', async () => {
    const before = await snapshot();
    const res = await approve(REQUEST_IDS.DEMO_INACTIVE).expect(409);
    expect(res.body).toEqual({
      statusCode: 409,
      error: 'Conflict',
      message: 'Equipment is inactive',
      code: 'EQUIPMENT_INACTIVE',
    });
    const row = await requestRow(REQUEST_IDS.DEMO_INACTIVE);
    expect(row).toMatchObject({ status: 'PENDING', reviewedById: null, reviewedAt: null, approvedAt: null });
    expect(await equipmentRow(EQUIPMENT_IDS.projector)).toMatchObject({ stockQuantity: 3, version: 1 });
    expect(await prisma().auditLog.count()).toBe(before.auditLogs.length);
    expect(await snapshot()).toEqual(before);
  });

  it('approving 15 (qty 8 > stock 5) -> 409 INSUFFICIENT_STOCK "Only 5 left" with a FULL rollback', async () => {
    const before = await snapshot();
    const res = await approve(REQUEST_IDS.DEMO_OVER).expect(409);
    expect(res.body).toEqual({
      statusCode: 409,
      error: 'Conflict',
      message: 'Only 5 left',
      code: 'INSUFFICIENT_STOCK',
    });
    const row = await requestRow(REQUEST_IDS.DEMO_OVER);
    expect(row).toMatchObject({ status: 'PENDING', reviewedById: null, reviewedAt: null, approvedAt: null });
    expect(await equipmentRow(EQUIPMENT_IDS.monitor27)).toMatchObject({ stockQuantity: 5, version: 1 });
    expect(await prisma().auditLog.count()).toBe(before.auditLogs.length);
    expect(await snapshot()).toEqual(before);
  });

  it('a rolled-back audit failure leaves request, stock and version untouched', async () => {
    const spy = jest.spyOn(getCtx().app.get(AuditLogService), 'log').mockRejectedValueOnce(new Error('audit down'));
    const before = await snapshot();
    const res = await approve(REQUEST_IDS.r09).expect(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(await snapshot()).toEqual(before);
    spy.mockRestore();
  });

  it('stock exactly consumed: stock 0 stays ACTIVE, new requests -> 422, the over-sized seed request -> "Only 0 left"', async () => {
    const created = await createRequest(EQUIPMENT_IDS.monitor27, 5).expect(201);
    await approve(created.body.id).expect(200);
    expect(await equipmentRow(EQUIPMENT_IDS.monitor27)).toMatchObject({ stockQuantity: 0, status: 'ACTIVE' });

    const more = await createRequest(EQUIPMENT_IDS.monitor27, 1).expect(422);
    expect(more.body.code).toBe('EQUIPMENT_UNAVAILABLE');

    const over = await approve(REQUEST_IDS.DEMO_OVER).expect(409);
    expect(over.body).toMatchObject({ code: 'INSUFFICIENT_STOCK', message: 'Only 0 left' });
  });

  it('two sequential approvals on one equipment: stock 10 -> 6 and version 1 -> 3', async () => {
    await approve(REQUEST_IDS.r12).expect(200);
    const created = await createRequest(EQUIPMENT_IDS.monitor24, 2, asEmployee2()).expect(201);
    await approve(created.body.id).expect(200);
    expect(await equipmentRow(EQUIPMENT_IDS.monitor24)).toMatchObject({ stockQuantity: 6, version: 3 });
  });

  it('unknown id -> 404, malformed id -> 400', async () => {
    const missing = await approve(UNKNOWN_ID).expect(404);
    expect(missing.body).toEqual({ statusCode: 404, error: 'Not Found', message: 'Request not found', code: 'NOT_FOUND' });
    const malformed = await approve('not-a-uuid').expect(400);
    expect(malformed.body.code).toBe('VALIDATION_ERROR');
  });

  it('no token -> 401; employee (even the owner) -> exact 403 and nothing changes', async () => {
    const before = await snapshot();
    expect((await approve(REQUEST_IDS.r09, {}).expect(401)).body.code).toBe('UNAUTHORIZED');
    expect((await approve(REQUEST_IDS.r09, asEmployee1()).expect(403)).body).toEqual(FORBIDDEN);
    expect(await snapshot()).toEqual(before);
  });
});

describe('PATCH /requests/:id/reject', () => {
  it('rejects 10 with a trimmed reason; the stock is never touched', async () => {
    const before = await snapshot();

    const res = await reject(REQUEST_IDS.r10, { rejectReason: '  not needed anymore  ' }).expect(200);
    const body = res.body as {
      status: string;
      rejectReason: string;
      approvedAt: string | null;
      reviewedAt: string | null;
      reviewer: { id: string; name: string };
    };
    expect(Object.keys(body).sort()).toEqual(REQUEST_KEYS);
    expect(body).toMatchObject({ status: 'REJECTED', rejectReason: 'not needed anymore', approvedAt: null });
    expect(body.reviewedAt).not.toBeNull();
    expect(body.reviewer).toEqual({ id: USER_IDS.admin, name: 'Admin' });

    expect(await equipmentRow(EQUIPMENT_IDS.keyboard)).toMatchObject({ stockQuantity: 20, version: 1 });
    const logs = await auditRows(REQUEST_IDS.r10);
    expect(logs.map((log) => [log.fromStatus, log.toStatus, log.actorId])).toEqual([
      [null, 'PENDING', USER_IDS.employee2],
      ['PENDING', 'REJECTED', USER_IDS.admin],
    ]);

    const after = await snapshot();
    expect(after.auditLogs).toHaveLength(before.auditLogs.length + 1);
    expect(after.equipments).toEqual(before.equipments);
    expect(without(after.requests, REQUEST_IDS.r10)).toEqual(without(before.requests, REQUEST_IDS.r10));
  });

  it.each([
    ['empty object', {}],
    ['empty reason', { rejectReason: '' }],
    ['blank reason', { rejectReason: '    ' }],
    ['4-char reason', { rejectReason: 'abcd' }],
    ['501-char reason', { rejectReason: 'r'.repeat(501) }],
    ['numeric reason', { rejectReason: 123 }],
    ['null reason', { rejectReason: null }],
    ['extra field', { rejectReason: 'valid reason', status: 'APPROVED' }],
  ])('invalid body (%s) on a PENDING request -> 400 and nothing changes', async (_label, body) => {
    const before = await snapshot();
    const res = await reject(REQUEST_IDS.r10, body).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(await snapshot()).toEqual(before);
  });

  it('a body that is not JSON -> 400 and nothing changes', async () => {
    const before = await snapshot();
    const res = await http()
      .patch(`/api/v1/requests/${REQUEST_IDS.r10}/reject`)
      .set(asAdmin())
      .set('Content-Type', 'application/json')
      .send('{not json')
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(await snapshot()).toEqual(before);
  });

  it('validation wins over state: an invalid body on an APPROVED request -> 400, not 409', async () => {
    const res = await reject(REQUEST_IDS.r01, { rejectReason: 'abcd' }).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    ['01 (APPROVED)', REQUEST_IDS.r01],
    ['06 (REJECTED)', REQUEST_IDS.r06],
  ])('rejecting %s with a valid body -> 409 INVALID_STATUS and nothing changes', async (_label, id) => {
    const before = await snapshot();
    const res = await reject(id, VALID_REASON).expect(409);
    expect(res.body).toEqual(NOT_PENDING);
    expect(await snapshot()).toEqual(before);
  });

  it('a request can only be decided once, in any order', async () => {
    await reject(REQUEST_IDS.r10, VALID_REASON).expect(200);
    expect((await reject(REQUEST_IDS.r10, VALID_REASON).expect(409)).body).toEqual(NOT_PENDING);
    expect((await approve(REQUEST_IDS.r10).expect(409)).body).toEqual(NOT_PENDING);

    await approve(REQUEST_IDS.r09).expect(200);
    const before = await snapshot();
    expect((await reject(REQUEST_IDS.r09, VALID_REASON).expect(409)).body).toEqual(NOT_PENDING);
    expect(await snapshot()).toEqual(before);
  });

  it('unknown id -> 404, malformed id -> 400, no token -> 401', async () => {
    expect((await reject(UNKNOWN_ID, VALID_REASON).expect(404)).body.code).toBe('NOT_FOUND');
    expect((await reject('not-a-uuid', VALID_REASON).expect(400)).body.code).toBe('VALIDATION_ERROR');
    expect((await reject(REQUEST_IDS.r10, VALID_REASON, {}).expect(401)).body.code).toBe('UNAUTHORIZED');
  });

  it('an employee -> exact 403 and the request is unchanged', async () => {
    const before = await snapshot();
    const res = await reject(REQUEST_IDS.r10, VALID_REASON, asEmployee2()).expect(403);
    expect(res.body).toEqual(FORBIDDEN);
    expect(await snapshot()).toEqual(before);
  });

  it('keeps the DB constraint satisfied and the owner sees rejectReason with a 2-item audit trail', async () => {
    await reject(REQUEST_IDS.r10, VALID_REASON).expect(200);
    const row = await requestRow(REQUEST_IDS.r10);
    expect(row.rejectReason?.trim().length).toBeGreaterThan(0);

    const detail = await http().get(`/api/v1/requests/${REQUEST_IDS.r10}`).set(asEmployee2()).expect(200);
    expect(detail.body).toMatchObject({ status: 'REJECTED', rejectReason: 'not needed anymore' });
    expect(detail.body.auditLogs).toHaveLength(2);
  });
});
