import type { Equipment } from '@app/shared';
import type { Equipment as EquipmentModel } from '@prisma/client';

export function toEquipment(model: EquipmentModel): Equipment {
  return {
    id: model.id,
    name: model.name,
    category: model.category,
    stockQuantity: model.stockQuantity,
    status: model.status,
    version: model.version,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
  };
}
