import 'reflect-metadata';
import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { AuthUser } from '../auth/auth.types';
import type { PrismaService } from '../prisma/prisma.service';
import { RejectRequestDto } from './dto/reject-request.dto';
import type { RequestWithRelations } from './request.include';
import { RequestsService } from './requests.service';

const ADMIN: AuthUser = { id: 'a0000000-0000-4000-8000-000000000001', role: 'ADMIN' };
const REQUEST_ID = 'b0000000-0000-4000-8000-000000000009';
const EQUIPMENT_ID = 'e0000000-0000-4000-8000-000000000004';

const storedRequest = { id: REQUEST_ID, equipmentId: EQUIPMENT_ID, quantity: 2, status: 'PENDING' };

const reloaded: RequestWithRelations = {
  id: REQUEST_ID,
  requesterId: 'a0000000-0000-4000-8000-000000000002',
  equipmentId: EQUIPMENT_ID,
  quantity: 2,
  reason: 'need a mouse',
  status: 'APPROVED',
  rejectReason: null,
  reviewedById: ADMIN.id,
  reviewedAt: new Date('2026-10-15T00:00:00.000Z'),
  approvedAt: new Date('2026-10-15T00:00:00.000Z'),
  idempotencyKey: null,
  createdAt: new Date('2026-10-07T03:30:00.000Z'),
  updatedAt: new Date('2026-10-15T00:00:00.000Z'),
  requester: { id: 'a0000000-0000-4000-8000-000000000002', name: 'Employee One' },
  reviewer: { id: ADMIN.id, name: 'Admin' },
  equipment: { id: EQUIPMENT_ID, name: 'Mouse', category: 'Input Device', stockQuantity: 23, status: 'ACTIVE' },
};

function setup() {
  const tx = {
    request: {
      findUnique: jest.fn().mockResolvedValue(storedRequest),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(reloaded),
    },
    equipment: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn(),
    },
  };
  const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
  const auditLog = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new RequestsService(prisma as unknown as PrismaService, auditLog as unknown as AuditLogService);
  return { service, tx, prisma, auditLog };
}

async function failure(promise: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) {
      return { status: error.getStatus(), body: error.getResponse() as Record<string, unknown> };
    }
    throw error;
  }
  throw new Error('expected the promise to reject');
}

describe('RequestsService.approve', () => {
  it('runs the exact Prisma calls inside one transaction, then logs the audit row', async () => {
    const { service, tx, prisma, auditLog } = setup();

    const result = await service.approve(REQUEST_ID, ADMIN);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.request.updateMany).toHaveBeenCalledTimes(1);
    const requestArgs = tx.request.updateMany.mock.calls[0][0] as {
      where: unknown;
      data: { status: string; approvedAt: Date; reviewedAt: Date; reviewedById: string };
    };
    expect(requestArgs).toEqual({
      where: { id: REQUEST_ID, status: 'PENDING' },
      data: { status: 'APPROVED', approvedAt: expect.any(Date), reviewedAt: expect.any(Date), reviewedById: ADMIN.id },
    });
    expect(requestArgs.data.reviewedAt).toBe(requestArgs.data.approvedAt); // the SAME Date instance

    expect(tx.equipment.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.equipment.updateMany).toHaveBeenCalledWith({
      where: { id: EQUIPMENT_ID, status: 'ACTIVE', stockQuantity: { gte: 2 } },
      data: { stockQuantity: { decrement: 2 }, version: { increment: 1 } },
    });

    expect(auditLog.log).toHaveBeenCalledTimes(1);
    expect(auditLog.log).toHaveBeenCalledWith(tx, {
      requestId: REQUEST_ID,
      actorId: ADMIN.id,
      from: 'PENDING',
      to: 'APPROVED',
    });
    const [requestOrder] = tx.request.updateMany.mock.invocationCallOrder;
    const [stockOrder] = tx.equipment.updateMany.mock.invocationCallOrder;
    const [auditOrder] = auditLog.log.mock.invocationCallOrder;
    expect(requestOrder).toBeLessThan(stockOrder);
    expect(stockOrder).toBeLessThan(auditOrder);

    expect(result.status).toBe('APPROVED');
    expect(result.equipment.stockQuantity).toBe(23);
  });

  it('missing request -> NOT_FOUND and no update runs', async () => {
    const { service, tx, auditLog } = setup();
    tx.request.findUnique.mockResolvedValue(null);
    const error = await failure(service.approve(REQUEST_ID, ADMIN));
    expect(error).toEqual({ status: 404, body: { code: 'NOT_FOUND', message: 'Request not found' } });
    expect(tx.request.updateMany).not.toHaveBeenCalled();
    expect(tx.equipment.updateMany).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('request no longer PENDING -> INVALID_STATUS, stock and audit untouched', async () => {
    const { service, tx, auditLog } = setup();
    tx.request.updateMany.mockResolvedValue({ count: 0 });
    const error = await failure(service.approve(REQUEST_ID, ADMIN));
    expect(error).toEqual({ status: 409, body: { code: 'INVALID_STATUS', message: 'Request is not PENDING' } });
    expect(tx.equipment.updateMany).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('stock update matches 0 rows and equipment is INACTIVE -> EQUIPMENT_INACTIVE', async () => {
    const { service, tx, auditLog } = setup();
    tx.equipment.updateMany.mockResolvedValue({ count: 0 });
    tx.equipment.findUniqueOrThrow.mockResolvedValue({ id: EQUIPMENT_ID, status: 'INACTIVE', stockQuantity: 3 });
    const error = await failure(service.approve(REQUEST_ID, ADMIN));
    expect(error).toEqual({ status: 409, body: { code: 'EQUIPMENT_INACTIVE', message: 'Equipment is inactive' } });
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('stock update matches 0 rows and equipment is ACTIVE with stock 2 -> INSUFFICIENT_STOCK "Only 2 left"', async () => {
    const { service, tx, auditLog } = setup();
    tx.equipment.updateMany.mockResolvedValue({ count: 0 });
    tx.equipment.findUniqueOrThrow.mockResolvedValue({ id: EQUIPMENT_ID, status: 'ACTIVE', stockQuantity: 2 });
    const error = await failure(service.approve(REQUEST_ID, ADMIN));
    expect(error).toEqual({ status: 409, body: { code: 'INSUFFICIENT_STOCK', message: 'Only 2 left' } });
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('an audit-log failure propagates unchanged (nothing swallows it)', async () => {
    const { service, auditLog } = setup();
    const boom = new Error('audit failed');
    auditLog.log.mockRejectedValue(boom);
    await expect(service.approve(REQUEST_ID, ADMIN)).rejects.toBe(boom);
  });
});

describe('RequestsService.reject', () => {
  const dto = Object.assign(new RejectRequestDto(), { rejectReason: 'not needed anymore' });

  it('uses the exact Prisma arguments, never touches the equipment, and logs PENDING -> REJECTED', async () => {
    const { service, tx, prisma, auditLog } = setup();

    await service.reject(REQUEST_ID, dto, ADMIN);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.request.updateMany).toHaveBeenCalledWith({
      where: { id: REQUEST_ID, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        rejectReason: 'not needed anymore',
        reviewedAt: expect.any(Date),
        reviewedById: ADMIN.id,
      },
    });
    expect(tx.equipment.updateMany).not.toHaveBeenCalled();
    expect(tx.equipment.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(auditLog.log).toHaveBeenCalledTimes(1);
    expect(auditLog.log).toHaveBeenCalledWith(tx, {
      requestId: REQUEST_ID,
      actorId: ADMIN.id,
      from: 'PENDING',
      to: 'REJECTED',
    });
    const [requestOrder] = tx.request.updateMany.mock.invocationCallOrder;
    const [auditOrder] = auditLog.log.mock.invocationCallOrder;
    expect(requestOrder).toBeLessThan(auditOrder);
  });

  it('request no longer PENDING -> INVALID_STATUS and no audit row', async () => {
    const { service, tx, auditLog } = setup();
    tx.request.updateMany.mockResolvedValue({ count: 0 });
    const error = await failure(service.reject(REQUEST_ID, dto, ADMIN));
    expect(error).toEqual({ status: 409, body: { code: 'INVALID_STATUS', message: 'Request is not PENDING' } });
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('missing request -> NOT_FOUND and no update runs', async () => {
    const { service, tx, auditLog } = setup();
    tx.request.findUnique.mockResolvedValue(null);
    const error = await failure(service.reject(REQUEST_ID, dto, ADMIN));
    expect(error).toEqual({ status: 404, body: { code: 'NOT_FOUND', message: 'Request not found' } });
    expect(tx.request.updateMany).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });
});

describe('RejectRequestDto', () => {
  const check = async (rejectReason: unknown) => {
    const dto = plainToInstance(RejectRequestDto, { rejectReason });
    return { dto, errors: await validate(dto, { whitelist: true, forbidNonWhitelisted: true }) };
  };

  it('trims the value', async () => {
    const { dto, errors } = await check('  hello  ');
    expect(errors).toHaveLength(0);
    expect(dto.rejectReason).toBe('hello');
  });

  it.each([['empty', ''], ['blank', '    '], ['4 chars', 'abcd'], ['501 chars', 'r'.repeat(501)], ['number', 123], ['undefined', undefined]])(
    'rejects %s',
    async (_label, value) => {
      expect((await check(value)).errors.length).toBeGreaterThan(0);
    },
  );

  it.each([['5 chars', 'abcde'], ['500 chars', 'r'.repeat(500)]])('accepts %s', async (_label, value) => {
    expect((await check(value)).errors).toHaveLength(0);
  });
});

describe('RequestsService.create (idempotency key)', () => {
  const EMPLOYEE: AuthUser = { id: 'a0000000-0000-4000-8000-000000000002', role: 'EMPLOYEE' };
  const KEY = '3f2b8c1e-5d6a-4f7b-9c8d-0123456789ab';
  const dto = { equipmentId: EQUIPMENT_ID, quantity: 2, reason: 'need a mouse' };
  const existing: RequestWithRelations = { ...reloaded, status: 'PENDING', idempotencyKey: KEY, requesterId: EMPLOYEE.id };
  const created: RequestWithRelations = { ...existing, id: 'b0000000-0000-4000-8000-000000000099' };
  const p2002 = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });

  function setupCreate() {
    const tx = {
      equipment: {
        findFirst: jest.fn().mockResolvedValue({ id: EQUIPMENT_ID, status: 'ACTIVE', stockQuantity: 10 }),
      },
      request: { create: jest.fn().mockResolvedValue(created) },
    };
    const prisma = {
      request: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new RequestsService(prisma as unknown as PrismaService, auditLog as unknown as AuditLogService);
    return { service, tx, prisma, auditLog };
  }

  it('no key: no lookup, behaves as before and reports replayed=false', async () => {
    const { service, prisma, tx } = setupCreate();
    const result = await service.create(dto, EMPLOYEE);
    expect(result.replayed).toBe(false);
    expect(prisma.request.findUnique).not.toHaveBeenCalled();
    const data = (tx.request.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.idempotencyKey).toBeUndefined();
  });

  it('a key with no existing row: stores the key and logs the audit row', async () => {
    const { service, prisma, tx, auditLog } = setupCreate();
    const result = await service.create(dto, EMPLOYEE, KEY);
    expect(result.replayed).toBe(false);
    expect(prisma.request.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { requesterId_idempotencyKey: { requesterId: EMPLOYEE.id, idempotencyKey: KEY } } }),
    );
    expect((tx.request.create.mock.calls[0][0] as { data: Record<string, unknown> }).data).toMatchObject({ idempotencyKey: KEY });
    expect(auditLog.log).toHaveBeenCalledTimes(1);
  });

  it('the lookup happens BEFORE the equipment check', async () => {
    const { service, prisma, tx } = setupCreate();
    await service.create(dto, EMPLOYEE, KEY);
    const [lookup] = prisma.request.findUnique.mock.invocationCallOrder;
    const [equipmentCheck] = tx.equipment.findFirst.mock.invocationCallOrder;
    expect(lookup).toBeLessThan(equipmentCheck);
  });

  it('an existing row with the same payload is a replay: no transaction, no audit row', async () => {
    const { service, prisma, auditLog } = setupCreate();
    prisma.request.findUnique.mockResolvedValue(existing);
    const result = await service.create(dto, EMPLOYEE, KEY);
    expect(result.replayed).toBe(true);
    expect(result.request.id).toBe(existing.id);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
    expect(JSON.stringify(result.request)).not.toContain(KEY);
  });

  it.each([
    ['quantity', { ...dto, quantity: 3 }],
    ['reason', { ...dto, reason: 'something else' }],
    ['equipmentId', { ...dto, equipmentId: 'e0000000-0000-4000-8000-000000000001' }],
  ])('an existing row with another %s -> IDEMPOTENCY_KEY_REUSED', async (_name, other) => {
    const { service, prisma } = setupCreate();
    prisma.request.findUnique.mockResolvedValue(existing);
    const error = await failure(service.create(other, EMPLOYEE, KEY));
    expect(error).toEqual({
      status: 422,
      body: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'Idempotency key was already used with a different request' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('P2002 with a key and the same payload -> reads the existing row and replays', async () => {
    const { service, prisma } = setupCreate();
    prisma.request.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    prisma.$transaction.mockRejectedValueOnce(p2002());
    const result = await service.create(dto, EMPLOYEE, KEY);
    expect(result.replayed).toBe(true);
    expect(result.request.id).toBe(existing.id);
    expect(prisma.request.findUnique).toHaveBeenCalledTimes(2);
  });

  it('P2002 with a key and another payload -> IDEMPOTENCY_KEY_REUSED', async () => {
    const { service, prisma } = setupCreate();
    prisma.request.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    prisma.$transaction.mockRejectedValueOnce(p2002());
    const error = await failure(service.create({ ...dto, quantity: 4 }, EMPLOYEE, KEY));
    expect(error.status).toBe(422);
    expect(error.body).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('P2002 WITHOUT a key is rethrown unchanged', async () => {
    const { service, prisma } = setupCreate();
    const original = p2002();
    prisma.$transaction.mockRejectedValueOnce(original);
    await expect(service.create(dto, EMPLOYEE)).rejects.toBe(original);
    expect(prisma.request.findUnique).not.toHaveBeenCalled();
  });

  it('P2002 with a key but no existing row -> the ORIGINAL error is rethrown', async () => {
    const { service, prisma } = setupCreate();
    const original = p2002();
    prisma.$transaction.mockRejectedValueOnce(original);
    await expect(service.create(dto, EMPLOYEE, KEY)).rejects.toBe(original);
  });

  it('any other Prisma error code is rethrown', async () => {
    const { service, prisma } = setupCreate();
    const other = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: 'test' });
    prisma.$transaction.mockRejectedValueOnce(other);
    await expect(service.create(dto, EMPLOYEE, KEY)).rejects.toBe(other);
    expect(prisma.request.findUnique).toHaveBeenCalledTimes(1);
  });

  it('a non-Prisma error is rethrown', async () => {
    const { service, prisma } = setupCreate();
    const boom = new Error('boom');
    prisma.$transaction.mockRejectedValueOnce(boom);
    await expect(service.create(dto, EMPLOYEE, KEY)).rejects.toBe(boom);
  });
});
