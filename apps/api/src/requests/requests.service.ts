import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { EquipmentRequest, Paginated, RequestDetail } from '@app/shared';
import { Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { AuthUser } from '../auth/auth.types';
import { escapeLike } from '../common/escape-like';
import { buildPaginated, toSkipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import { MyRequestsQueryDto } from './dto/my-requests-query.dto';
import { RejectRequestDto } from './dto/reject-request.dto';
import { requestDetailInclude, requestInclude } from './request.include';
import type { RequestWithRelations } from './request.include';
import { toEquipmentRequest, toRequestDetail } from './request.mapper';

export interface CreateRequestResult {
  request: EquipmentRequest;
  replayed: boolean;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Soft stock check: stock is never changed here (only approve deducts it).
   * With an Idempotency-Key the replay lookup runs BEFORE the stock checks; a P2002 from the
   * (requester_id, idempotency_key) unique index is handled OUTSIDE the transaction (it is aborted by then).
   */
  async create(dto: CreateRequestDto, user: AuthUser, idempotencyKey?: string): Promise<CreateRequestResult> {
    if (idempotencyKey !== undefined) {
      const existing = await this.findByKey(user.id, idempotencyKey);
      if (existing) return this.replayOf(existing, dto);
    }

    try {
      const request = await this.prisma.$transaction(async (tx) => {
        const equipment = await tx.equipment.findFirst({ where: { id: dto.equipmentId, status: 'ACTIVE' } });
        if (!equipment) {
          throw new NotFoundException({ code: 'NOT_FOUND', message: 'Equipment not found' });
        }
        if (equipment.stockQuantity === 0) {
          throw new UnprocessableEntityException({ code: 'EQUIPMENT_UNAVAILABLE', message: 'Equipment is out of stock' });
        }
        if (dto.quantity > equipment.stockQuantity) {
          throw new UnprocessableEntityException({
            code: 'EQUIPMENT_UNAVAILABLE',
            message: `Only ${equipment.stockQuantity} left`,
          });
        }

        const created = await tx.request.create({
          data: {
            requesterId: user.id,
            equipmentId: equipment.id,
            quantity: dto.quantity,
            reason: dto.reason,
            status: 'PENDING',
            idempotencyKey,
          },
          include: requestInclude,
        });
        await this.auditLog.log(tx, { requestId: created.id, actorId: user.id, from: null, to: 'PENDING' });
        return toEquipmentRequest(created);
      });
      return { request, replayed: false };
    } catch (error) {
      if (idempotencyKey !== undefined && isUniqueViolation(error)) {
        const existing = await this.findByKey(user.id, idempotencyKey);
        if (existing) return this.replayOf(existing, dto);
      }
      throw error;
    }
  }

  private findByKey(requesterId: string, idempotencyKey: string): Promise<RequestWithRelations | null> {
    return this.prisma.request.findUnique({
      where: { requesterId_idempotencyKey: { requesterId, idempotencyKey } },
      include: requestInclude,
    });
  }

  private replayOf(existing: RequestWithRelations, dto: CreateRequestDto): CreateRequestResult {
    const same =
      existing.equipmentId === dto.equipmentId && existing.quantity === dto.quantity && existing.reason === dto.reason;
    if (!same) {
      throw new UnprocessableEntityException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'Idempotency key was already used with a different request',
      });
    }
    return { request: toEquipmentRequest(existing), replayed: true };
  }

  async listMine(query: MyRequestsQueryDto, user: AuthUser): Promise<Paginated<EquipmentRequest>> {
    const where: Prisma.RequestWhereInput = { requesterId: user.id };
    if (query.status) where.status = query.status;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.request.findMany({
        where,
        include: requestInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
      }),
      this.prisma.request.count({ where }),
    ]);
    return buildPaginated(rows.map(toEquipmentRequest), total, query.page, query.limit);
  }

  async listAll(query: ListRequestsQueryDto): Promise<Paginated<EquipmentRequest>> {
    const where: Prisma.RequestWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      const contains = { contains: escapeLike(query.search), mode: 'insensitive' as const };
      where.OR = [{ equipment: { name: contains } }, { requester: { name: contains } }];
    }
    const dir = query.sort === 'createdAt:asc' ? 'asc' : 'desc';

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.request.findMany({
        where,
        include: requestInclude,
        orderBy: [{ createdAt: dir }, { id: dir }],
        ...toSkipTake(query),
      }),
      this.prisma.request.count({ where }),
    ]);
    return buildPaginated(rows.map(toEquipmentRequest), total, query.page, query.limit);
  }

  async findOne(id: string, user: AuthUser): Promise<RequestDetail> {
    const found = await this.prisma.request.findFirst({
      where: { id, ...(user.role === 'EMPLOYEE' ? { requesterId: user.id } : {}) },
      include: requestDetailInclude,
    });
    if (!found) throw this.requestNotFound();
    return toRequestDetail(found);
  }

  /**
   * Approve (docs §5): status lock + atomic stock deduction + audit log in ONE transaction.
   * Any throw rolls everything back; there is no read-then-write on stock.
   */
  approve(id: string, admin: AuthUser): Promise<EquipmentRequest> {
    return this.prisma.$transaction(async (tx) => {
      const req = await tx.request.findUnique({ where: { id } });
      if (!req) throw this.requestNotFound();

      const now = new Date();
      const updated = await tx.request.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'APPROVED', approvedAt: now, reviewedAt: now, reviewedById: admin.id },
      });
      if (updated.count === 0) throw this.notPending();

      const stock = await tx.equipment.updateMany({
        where: { id: req.equipmentId, status: 'ACTIVE', stockQuantity: { gte: req.quantity } },
        data: { stockQuantity: { decrement: req.quantity }, version: { increment: 1 } },
      });
      if (stock.count === 0) {
        // Re-read only to pick the right error; throwing rolls back the status update above.
        const equipment = await tx.equipment.findUniqueOrThrow({ where: { id: req.equipmentId } });
        throw equipment.status !== 'ACTIVE'
          ? new ConflictException({ code: 'EQUIPMENT_INACTIVE', message: 'Equipment is inactive' })
          : new ConflictException({ code: 'INSUFFICIENT_STOCK', message: `Only ${equipment.stockQuantity} left` });
      }

      await this.auditLog.log(tx, { requestId: id, actorId: admin.id, from: 'PENDING', to: 'APPROVED' });
      return toEquipmentRequest(await tx.request.findUniqueOrThrow({ where: { id }, include: requestInclude }));
    });
  }

  /** Reject: status lock + audit log in ONE transaction; stock is never touched. */
  reject(id: string, dto: RejectRequestDto, admin: AuthUser): Promise<EquipmentRequest> {
    return this.prisma.$transaction(async (tx) => {
      const req = await tx.request.findUnique({ where: { id } });
      if (!req) throw this.requestNotFound();

      const updated = await tx.request.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'REJECTED', rejectReason: dto.rejectReason, reviewedAt: new Date(), reviewedById: admin.id },
      });
      if (updated.count === 0) throw this.notPending();

      await this.auditLog.log(tx, { requestId: id, actorId: admin.id, from: 'PENDING', to: 'REJECTED' });
      return toEquipmentRequest(await tx.request.findUniqueOrThrow({ where: { id }, include: requestInclude }));
    });
  }

  private requestNotFound(): NotFoundException {
    return new NotFoundException({ code: 'NOT_FOUND', message: 'Request not found' });
  }

  private notPending(): ConflictException {
    return new ConflictException({ code: 'INVALID_STATUS', message: 'Request is not PENDING' });
  }
}
