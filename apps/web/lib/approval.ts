import type { EquipmentStatus, RequestStatus } from '@app/shared';

export interface ApprovalBlock {
  code: 'EQUIPMENT_INACTIVE' | 'INSUFFICIENT_STOCK';
  message: string;
}

/**
 * UX hint only: tells the admin why Approve would fail right now. The API stays the authority
 * (stock can change between render and click), so the form is still submittable on the server.
 */
export function getApprovalBlock(r: {
  status: RequestStatus;
  quantity: number;
  equipment: { status: EquipmentStatus; stockQuantity: number };
}): ApprovalBlock | null {
  if (r.status !== 'PENDING') return null;
  if (r.equipment.status !== 'ACTIVE') {
    return {
      code: 'EQUIPMENT_INACTIVE',
      message: 'อุปกรณ์นี้ถูกปิดใช้งาน ไม่สามารถอนุมัติได้ กรุณาปฏิเสธคำขอพร้อมระบุเหตุผล',
    };
  }
  if (r.equipment.stockQuantity < r.quantity) {
    return {
      code: 'INSUFFICIENT_STOCK',
      message: `คงเหลือ ${r.equipment.stockQuantity} ชิ้น น้อยกว่าจำนวนที่ขอ (${r.quantity} ชิ้น) ไม่สามารถอนุมัติได้`,
    };
  }
  return null;
}
