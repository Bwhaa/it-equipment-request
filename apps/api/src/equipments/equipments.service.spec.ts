import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentsService } from './equipments.service';

const DUPLICATE_BODY = { code: 'DUPLICATE_EQUIPMENT_NAME', message: 'An equipment with this name already exists' };

function knownError(code: string, meta?: Record<string, unknown>): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`prisma ${code}`, { code, clientVersion: 'test', meta });
}

function setup() {
  const equipment = { create: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn() };
  const service = new EquipmentsService({ equipment } as unknown as PrismaService);
  return { equipment, service };
}

const createDto = Object.assign(new CreateEquipmentDto(), { name: 'Mouse', category: 'Input Device', stockQuantity: 5 });
const updateDto = Object.assign(new UpdateEquipmentDto(), { version: 1, name: 'Mouse' });

describe.each([
  ['create', 'create' as const, (service: EquipmentsService) => service.create(createDto)],
  ['update', 'updateMany' as const, (service: EquipmentsService) => service.update('e0000000-0000-4000-8000-000000000004', updateDto)],
])('EquipmentsService.%s maps the unique violation', (_name, prismaMethod, call) => {
  it.each([[undefined], [{ target: ['whatever'] }]])('P2002 (meta %j) -> 409 DUPLICATE_EQUIPMENT_NAME', async (meta) => {
    const { equipment, service } = setup();
    equipment[prismaMethod].mockRejectedValue(knownError('P2002', meta));
    const error: unknown = await call(service).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual(DUPLICATE_BODY);
  });

  it('any other Prisma error code is rethrown unchanged', async () => {
    const { equipment, service } = setup();
    const original = knownError('P2003');
    equipment[prismaMethod].mockRejectedValue(original);
    await expect(call(service)).rejects.toBe(original);
  });

  it('a non-Prisma error is rethrown unchanged', async () => {
    const { equipment, service } = setup();
    const original = new Error('connection lost');
    equipment[prismaMethod].mockRejectedValue(original);
    await expect(call(service)).rejects.toBe(original);
  });
});
