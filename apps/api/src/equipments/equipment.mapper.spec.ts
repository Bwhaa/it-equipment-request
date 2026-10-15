import type { Equipment as EquipmentModel } from '@prisma/client';
import { toEquipment } from './equipment.mapper';

describe('toEquipment', () => {
  const model: EquipmentModel = {
    id: 'e0000000-0000-4000-8000-000000000001',
    name: 'Monitor',
    category: 'Display',
    stockQuantity: 4,
    status: 'ACTIVE',
    version: 2,
    createdAt: new Date('2026-09-20T00:00:00.000Z'),
    updatedAt: new Date('2026-09-21T01:02:03.004Z'),
  };

  it('returns exactly the 8 shared keys with ISO date strings', () => {
    const result = toEquipment(model);
    expect(Object.keys(result).sort()).toEqual(
      ['category', 'createdAt', 'id', 'name', 'status', 'stockQuantity', 'updatedAt', 'version'].sort(),
    );
    expect(result.createdAt).toBe('2026-09-20T00:00:00.000Z');
    expect(result.updatedAt).toBe('2026-09-21T01:02:03.004Z');
  });
});
