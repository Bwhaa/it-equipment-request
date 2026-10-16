import { toEquipmentRequest, toRequestDetail } from './request.mapper';
import type { RequestWithDetail, RequestWithRelations } from './request.include';

const base: RequestWithRelations = {
  id: 'b0000000-0000-4000-8000-000000000001',
  requesterId: 'a0000000-0000-4000-8000-000000000002',
  equipmentId: 'e0000000-0000-4000-8000-000000000001',
  quantity: 2,
  reason: 'need a monitor',
  status: 'PENDING',
  rejectReason: null,
  reviewedById: null,
  reviewedAt: null,
  approvedAt: null,
  idempotencyKey: null,
  createdAt: new Date('2026-10-01T02:03:04.005Z'),
  updatedAt: new Date('2026-10-01T02:03:04.005Z'),
  requester: { id: 'a0000000-0000-4000-8000-000000000002', name: 'Employee One' },
  reviewer: null,
  equipment: {
    id: 'e0000000-0000-4000-8000-000000000001',
    name: 'Monitor 24-inch',
    category: 'Display',
    stockQuantity: 10,
    status: 'ACTIVE',
  },
};

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

describe('toEquipmentRequest', () => {
  it('returns exactly 11 keys with nulls for absent values', () => {
    const result = toEquipmentRequest(base);
    expect(Object.keys(result).sort()).toEqual(REQUEST_KEYS);
    expect(result).toMatchObject({ reviewer: null, reviewedAt: null, approvedAt: null, rejectReason: null });
    expect(result.createdAt).toBe('2026-10-01T02:03:04.005Z');
    expect(Object.keys(result.equipment).sort()).toEqual(['category', 'id', 'name', 'status', 'stockQuantity']);
  });

  it('maps reviewer and ISO dates when present', () => {
    const result = toEquipmentRequest({
      ...base,
      status: 'REJECTED',
      rejectReason: 'no budget',
      reviewedById: 'a0000000-0000-4000-8000-000000000001',
      reviewedAt: new Date('2026-10-02T00:00:00.000Z'),
      reviewer: { id: 'a0000000-0000-4000-8000-000000000001', name: 'Admin' },
    });
    expect(result.reviewer).toEqual({ id: 'a0000000-0000-4000-8000-000000000001', name: 'Admin' });
    expect(result.reviewedAt).toBe('2026-10-02T00:00:00.000Z');
    expect(result.rejectReason).toBe('no budget');
  });
});

describe('toRequestDetail', () => {
  it('adds auditLogs whose items have exactly 5 keys', () => {
    const detail: RequestWithDetail = {
      ...base,
      auditLogs: [
        {
          id: 'c0000000-0000-4000-8000-000000000001',
          requestId: base.id,
          actorId: 'a0000000-0000-4000-8000-000000000002',
          fromStatus: null,
          toStatus: 'PENDING',
          createdAt: new Date('2026-10-01T02:03:04.005Z'),
          actor: { id: 'a0000000-0000-4000-8000-000000000002', name: 'Employee One' },
        },
      ],
    };
    const result = toRequestDetail(detail);
    expect(Object.keys(result).sort()).toEqual([...REQUEST_KEYS, 'auditLogs'].sort());
    expect(Object.keys(result.auditLogs[0]).sort()).toEqual(['actor', 'createdAt', 'fromStatus', 'id', 'toStatus']);
    expect(result.auditLogs[0]).toMatchObject({
      fromStatus: null,
      toStatus: 'PENDING',
      actor: { id: 'a0000000-0000-4000-8000-000000000002', name: 'Employee One' },
      createdAt: '2026-10-01T02:03:04.005Z',
    });
  });
});
