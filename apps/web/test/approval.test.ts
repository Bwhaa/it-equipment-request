import { describe, expect, it } from 'vitest';
import { getApprovalBlock } from '@/lib/approval';

const INACTIVE_MESSAGE = 'อุปกรณ์นี้ถูกปิดใช้งาน ไม่สามารถอนุมัติได้ กรุณาปฏิเสธคำขอพร้อมระบุเหตุผล';

type Input = Parameters<typeof getApprovalBlock>[0];
const make = (status: Input['status'], quantity: number, equipmentStatus: Input['equipment']['status'], stockQuantity: number): Input => ({
  status,
  quantity,
  equipment: { status: equipmentStatus, stockQuantity },
});

describe('getApprovalBlock', () => {
  it('PENDING + ACTIVE + enough stock -> null', () => {
    expect(getApprovalBlock(make('PENDING', 2, 'ACTIVE', 10))).toBeNull();
  });

  it('stock equal to the quantity is enough', () => {
    expect(getApprovalBlock(make('PENDING', 5, 'ACTIVE', 5))).toBeNull();
  });

  it('stock = quantity - 1 -> INSUFFICIENT_STOCK', () => {
    expect(getApprovalBlock(make('PENDING', 5, 'ACTIVE', 4))).toEqual({
      code: 'INSUFFICIENT_STOCK',
      message: 'คงเหลือ 4 ชิ้น น้อยกว่าจำนวนที่ขอ (5 ชิ้น) ไม่สามารถอนุมัติได้',
    });
  });

  it('exact message for stock 5 / quantity 8', () => {
    expect(getApprovalBlock(make('PENDING', 8, 'ACTIVE', 5))).toEqual({
      code: 'INSUFFICIENT_STOCK',
      message: 'คงเหลือ 5 ชิ้น น้อยกว่าจำนวนที่ขอ (8 ชิ้น) ไม่สามารถอนุมัติได้',
    });
  });

  it('INACTIVE equipment with plenty of stock -> EQUIPMENT_INACTIVE', () => {
    expect(getApprovalBlock(make('PENDING', 1, 'INACTIVE', 100))).toEqual({
      code: 'EQUIPMENT_INACTIVE',
      message: INACTIVE_MESSAGE,
    });
  });

  it('INACTIVE AND low stock -> EQUIPMENT_INACTIVE wins', () => {
    expect(getApprovalBlock(make('PENDING', 9, 'INACTIVE', 0))?.code).toBe('EQUIPMENT_INACTIVE');
  });

  it.each(['APPROVED', 'REJECTED'] as const)('%s is never blocked, whatever the stock', (status) => {
    expect(getApprovalBlock(make(status, 5, 'ACTIVE', 10))).toBeNull();
    expect(getApprovalBlock(make(status, 5, 'ACTIVE', 0))).toBeNull();
    expect(getApprovalBlock(make(status, 5, 'INACTIVE', 0))).toBeNull();
  });
});
