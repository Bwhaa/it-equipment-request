import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { EquipmentRequest, Paginated, RequestDetail } from '@app/shared';
import type { Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { AuthUser } from '../auth/auth.types';
import { escapeLike } from '../common/escape-like';
import { buildPaginated, toSkipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import { MyRequestsQueryDto } from './dto/my-requests-query.dto';
import { requestDetailInclude, requestInclude } from './request.include';
import { toEquipmentRequest, toRequestDetail } from './request.mapper';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** Soft stock check: stock is never changed here (only approve deducts it). */
  create(dto: CreateRequestDto, user: AuthUser): Promise<EquipmentRequest> {
    return this.prisma.$transaction(async (tx) => {
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

      const request = await tx.request.create({
        data: {
          requesterId: user.id,
          equipmentId: equipment.id,
          quantity: dto.quantity,
          reason: dto.reason,
          status: 'PENDING',
        },
        include: requestInclude,
      });
      await this.auditLog.log(tx, { requestId: request.id, actorId: user.id, from: null, to: 'PENDING' });
      return toEquipmentRequest(request);
    });
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
    if (!found) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Request not found' });
    return toRequestDetail(found);
  }
}
