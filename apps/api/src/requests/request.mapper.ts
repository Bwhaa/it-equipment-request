import type { AuditLog, EquipmentRequest, RequestDetail } from '@app/shared';
import type { RequestWithDetail, RequestWithRelations } from './request.include';

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

export function toEquipmentRequest(model: RequestWithRelations): EquipmentRequest {
  return {
    id: model.id,
    quantity: model.quantity,
    reason: model.reason,
    status: model.status,
    rejectReason: model.rejectReason,
    approvedAt: iso(model.approvedAt),
    reviewedAt: iso(model.reviewedAt),
    requester: { id: model.requester.id, name: model.requester.name },
    reviewer: model.reviewer ? { id: model.reviewer.id, name: model.reviewer.name } : null,
    equipment: {
      id: model.equipment.id,
      name: model.equipment.name,
      category: model.equipment.category,
      stockQuantity: model.equipment.stockQuantity,
      status: model.equipment.status,
    },
    createdAt: model.createdAt.toISOString(),
  };
}

export function toRequestDetail(model: RequestWithDetail): RequestDetail {
  const auditLogs: AuditLog[] = model.auditLogs.map((log) => ({
    id: log.id,
    fromStatus: log.fromStatus,
    toStatus: log.toStatus,
    actor: { id: log.actor.id, name: log.actor.name },
    createdAt: log.createdAt.toISOString(),
  }));
  return { ...toEquipmentRequest(model), auditLogs };
}
