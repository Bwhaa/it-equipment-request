import type { AuditLog, Equipment, EquipmentRequest, Paginated, RequestDetail } from '@app/shared';

export const IDS = {
  equipment: 'e0000000-0000-4000-8000-000000000001',
  request: 'b0000000-0000-4000-8000-000000000001',
  employee: 'a0000000-0000-4000-8000-000000000002',
  admin: 'a0000000-0000-4000-8000-000000000001',
};

export function makeEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: IDS.equipment,
    name: 'Monitor 24-inch',
    category: 'Display',
    stockQuantity: 10,
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

export function makeRequest(overrides: Partial<EquipmentRequest> = {}): EquipmentRequest {
  return {
    id: IDS.request,
    quantity: 2,
    reason: 'ต้องการจอเพิ่มสำหรับทำงานสองหน้าจอ',
    status: 'PENDING',
    rejectReason: null,
    approvedAt: null,
    reviewedAt: null,
    requester: { id: IDS.employee, name: 'Employee One' },
    reviewer: null,
    equipment: { id: IDS.equipment, name: 'Monitor 24-inch', category: 'Display', stockQuantity: 10, status: 'ACTIVE' },
    createdAt: '2026-09-21T02:15:00.000Z',
    ...overrides,
  };
}

const audit = (id: string, fromStatus: AuditLog['fromStatus'], toStatus: AuditLog['toStatus'], actor: string, createdAt: string): AuditLog => ({
  id,
  fromStatus,
  toStatus,
  actor: { id: actor === 'Admin' ? IDS.admin : IDS.employee, name: actor },
  createdAt,
});

export function makeDetail(overrides: Partial<RequestDetail> = {}): RequestDetail {
  return {
    ...makeRequest(),
    auditLogs: [audit('c0000000-0000-4000-8000-000000000001', null, 'PENDING', 'Employee One', '2026-09-21T02:15:00.000Z')],
    ...overrides,
  };
}

export const APPROVED_DETAIL: RequestDetail = makeDetail({
  status: 'APPROVED',
  approvedAt: '2026-09-22T03:00:00.000Z',
  reviewedAt: '2026-09-22T03:00:00.000Z',
  reviewer: { id: IDS.admin, name: 'Admin' },
  auditLogs: [
    audit('c0000000-0000-4000-8000-000000000001', null, 'PENDING', 'Employee One', '2026-09-21T02:15:00.000Z'),
    audit('c0000000-0000-4000-8000-000000000002', 'PENDING', 'APPROVED', 'Admin', '2026-09-22T03:00:00.000Z'),
  ],
});

export const REJECTED_DETAIL: RequestDetail = makeDetail({
  status: 'REJECTED',
  rejectReason: 'งบประมาณไตรมาสนี้ไม่เพียงพอ',
  reviewedAt: '2026-09-22T03:00:00.000Z',
  reviewer: { id: IDS.admin, name: 'Admin' },
  auditLogs: [
    audit('c0000000-0000-4000-8000-000000000001', null, 'PENDING', 'Employee One', '2026-09-21T02:15:00.000Z'),
    audit('c0000000-0000-4000-8000-000000000002', 'PENDING', 'REJECTED', 'Admin', '2026-09-22T03:00:00.000Z'),
  ],
});

/** Mirrors the API: totalPages is Math.ceil(total / limit), so it is 0 when there are no rows at all. */
export function paginated<T>(data: T[], total: number, page: number, limit: number): Paginated<T> {
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
