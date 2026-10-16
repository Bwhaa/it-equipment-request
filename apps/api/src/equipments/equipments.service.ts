import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Equipment, Paginated } from '@app/shared';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { escapeLike } from '../common/escape-like';
import { buildPaginated, toSkipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { EquipmentQueryDto } from './dto/equipment-query.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { toEquipment } from './equipment.mapper';

@Injectable()
export class EquipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: EquipmentQueryDto, user: AuthUser): Promise<Paginated<Equipment>> {
    const where: Prisma.EquipmentWhereInput = {};
    if (user.role === 'EMPLOYEE') where.status = 'ACTIVE';
    else if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.search) where.name = { contains: escapeLike(query.search), mode: 'insensitive' };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.equipment.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.equipment.count({ where }),
    ]);
    return buildPaginated(rows.map(toEquipment), total, query.page, query.limit);
  }

  async categories(user: AuthUser): Promise<string[]> {
    const rows = await this.prisma.equipment.findMany({
      where: user.role === 'EMPLOYEE' ? { status: 'ACTIVE' } : {},
      select: { category: true },
      distinct: ['category'],
    });
    return rows.map((row) => row.category).sort();
  }

  async findOne(id: string, user: AuthUser): Promise<Equipment> {
    const found = await this.prisma.equipment.findFirst({
      where: { id, ...(user.role === 'EMPLOYEE' ? { status: 'ACTIVE' as const } : {}) },
    });
    if (!found) throw this.notFound();
    return toEquipment(found);
  }

  async create(dto: CreateEquipmentDto): Promise<Equipment> {
    try {
      const created = await this.prisma.equipment.create({
        data: { name: dto.name, category: dto.category, stockQuantity: dto.stockQuantity, status: dto.status },
      });
      return toEquipment(created);
    } catch (error) {
      throw this.isUniqueViolation(error) ? this.duplicateName() : error;
    }
  }

  async update(id: string, dto: UpdateEquipmentDto): Promise<Equipment> {
    const { version, ...data } = dto;
    const values = Object.values(data);
    if (values.every((value) => value === undefined)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'At least one field besides version is required',
      });
    }
    // PartialType makes every field optional, which lets null through class-validator.
    if (values.some((value) => value === null)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Fields must not be null' });
    }

    let res: Prisma.BatchPayload;
    try {
      res = await this.prisma.equipment.updateMany({
        where: { id, version },
        data: { ...data, version: { increment: 1 } },
      });
    } catch (error) {
      throw this.isUniqueViolation(error) ? this.duplicateName() : error;
    }
    if (res.count === 0) {
      const exists = await this.prisma.equipment.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw this.notFound();
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'ข้อมูลอุปกรณ์ถูกแก้ไขระหว่างนี้ กรุณาโหลดใหม่',
      });
    }
    return toEquipment(await this.prisma.equipment.findUniqueOrThrow({ where: { id } }));
  }

  /**
   * The only unique constraint besides the primary key is the expression index on lower(btrim(name)): its
   * `meta.target` can be empty, so the error code alone identifies it. Never rely on a pre-check query instead.
   */
  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private duplicateName(): ConflictException {
    return new ConflictException({ code: 'DUPLICATE_EQUIPMENT_NAME', message: 'An equipment with this name already exists' });
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ code: 'NOT_FOUND', message: 'Equipment not found' });
  }
}
