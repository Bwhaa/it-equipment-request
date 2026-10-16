import { EquipmentStatus, RequestStatus, Role } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';

export const USER_IDS = {
  admin: 'a0000000-0000-4000-8000-000000000001',
  employee1: 'a0000000-0000-4000-8000-000000000002',
  employee2: 'a0000000-0000-4000-8000-000000000003',
} as const;

export const EQUIPMENT_IDS = {
  monitor24: 'e0000000-0000-4000-8000-000000000001',
  monitor27: 'e0000000-0000-4000-8000-000000000002',
  keyboard: 'e0000000-0000-4000-8000-000000000003',
  mouse: 'e0000000-0000-4000-8000-000000000004',
  headset: 'e0000000-0000-4000-8000-000000000005',
  dockingStation: 'e0000000-0000-4000-8000-000000000006',
  webcam: 'e0000000-0000-4000-8000-000000000007',
  projector: 'e0000000-0000-4000-8000-000000000008',
} as const;

const requestId = (n: number): string => `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const auditLogId = (n: number): string => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const REQUEST_IDS = {
  r01: requestId(1),
  r02: requestId(2),
  r03: requestId(3),
  r04: requestId(4),
  r05: requestId(5),
  r06: requestId(6),
  r07: requestId(7),
  r08: requestId(8),
  r09: requestId(9),
  r10: requestId(10),
  r11: requestId(11),
  r12: requestId(12),
  r13: requestId(13),
  r14: requestId(14),
  r15: requestId(15),
  /** PENDING on the INACTIVE equipment: approve -> 409 EQUIPMENT_INACTIVE */
  DEMO_INACTIVE: requestId(14),
  /** PENDING with quantity > stock: approve -> 409 INSUFFICIENT_STOCK */
  DEMO_OVER: requestId(15),
} as const;

const SEED_CREATED_AT = new Date('2026-09-20T00:00:00.000Z');

interface SeedUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: Role;
}

const USERS: SeedUser[] = [
  { id: USER_IDS.admin, email: 'admin@company.com', password: 'Admin@123', name: 'Admin', role: Role.ADMIN },
  { id: USER_IDS.employee1, email: 'employee1@company.com', password: 'Employee@123', name: 'Employee One', role: Role.EMPLOYEE },
  { id: USER_IDS.employee2, email: 'employee2@company.com', password: 'Employee@123', name: 'Employee Two', role: Role.EMPLOYEE },
];

interface SeedEquipment {
  id: string;
  name: string;
  category: string;
  stockQuantity: number;
  status: EquipmentStatus;
}

// stockQuantity is the value AFTER the seeded APPROVED requests were deducted.
const EQUIPMENTS: SeedEquipment[] = [
  { id: EQUIPMENT_IDS.monitor24, name: 'Monitor 24-inch', category: 'Display', stockQuantity: 10, status: EquipmentStatus.ACTIVE },
  { id: EQUIPMENT_IDS.monitor27, name: 'Monitor 27-inch', category: 'Display', stockQuantity: 5, status: EquipmentStatus.ACTIVE },
  { id: EQUIPMENT_IDS.keyboard, name: 'Keyboard', category: 'Input Device', stockQuantity: 20, status: EquipmentStatus.ACTIVE },
  { id: EQUIPMENT_IDS.mouse, name: 'Mouse', category: 'Input Device', stockQuantity: 25, status: EquipmentStatus.ACTIVE },
  { id: EQUIPMENT_IDS.headset, name: 'Headset', category: 'Audio', stockQuantity: 8, status: EquipmentStatus.ACTIVE },
  { id: EQUIPMENT_IDS.dockingStation, name: 'Docking Station', category: 'Accessories', stockQuantity: 4, status: EquipmentStatus.ACTIVE },
  { id: EQUIPMENT_IDS.webcam, name: 'Webcam', category: 'Video', stockQuantity: 0, status: EquipmentStatus.ACTIVE },
  { id: EQUIPMENT_IDS.projector, name: 'Projector', category: 'Display', stockQuantity: 3, status: EquipmentStatus.INACTIVE },
];

interface SeedRequest {
  id: string;
  requesterId: string;
  equipmentId: string;
  quantity: number;
  reason: string;
  status: RequestStatus;
  createdAt: string;
  reviewedAt?: string;
  rejectReason?: string;
}

const REQUESTS: SeedRequest[] = [
  { id: REQUEST_IDS.r01, requesterId: USER_IDS.employee1, equipmentId: EQUIPMENT_IDS.monitor24, quantity: 2, reason: 'ต้องการจอเพิ่มสำหรับทำงานสองหน้าจอ', status: RequestStatus.APPROVED, createdAt: '2026-09-21T02:15:00.000Z', reviewedAt: '2026-09-22T03:00:00.000Z' },
  { id: REQUEST_IDS.r02, requesterId: USER_IDS.employee2, equipmentId: EQUIPMENT_IDS.keyboard, quantity: 1, reason: 'คีย์บอร์ดเดิมพิมพ์ไม่ติดบางปุ่ม', status: RequestStatus.APPROVED, createdAt: '2026-09-23T03:20:00.000Z', reviewedAt: '2026-09-24T04:10:00.000Z' },
  { id: REQUEST_IDS.r03, requesterId: USER_IDS.employee1, equipmentId: EQUIPMENT_IDS.webcam, quantity: 3, reason: 'ใช้ประชุมออนไลน์กับลูกค้าประจำทีม', status: RequestStatus.APPROVED, createdAt: '2026-09-25T04:05:00.000Z', reviewedAt: '2026-09-26T02:30:00.000Z' },
  { id: REQUEST_IDS.r04, requesterId: USER_IDS.employee2, equipmentId: EQUIPMENT_IDS.dockingStation, quantity: 1, reason: 'ต่อโน้ตบุ๊กกับจอและอุปกรณ์ต่อพ่วงที่โต๊ะ', status: RequestStatus.APPROVED, createdAt: '2026-09-27T05:40:00.000Z', reviewedAt: '2026-09-28T06:00:00.000Z' },
  { id: REQUEST_IDS.r05, requesterId: USER_IDS.employee1, equipmentId: EQUIPMENT_IDS.headset, quantity: 2, reason: 'ใช้โทรคุยงานในออฟฟิศที่มีเสียงดัง', status: RequestStatus.APPROVED, createdAt: '2026-09-29T06:10:00.000Z', reviewedAt: '2026-09-30T03:45:00.000Z' },
  { id: REQUEST_IDS.r06, requesterId: USER_IDS.employee2, equipmentId: EQUIPMENT_IDS.mouse, quantity: 1, reason: 'เมาส์เดิมคลิกไม่เสถียร', status: RequestStatus.REJECTED, createdAt: '2026-10-01T07:00:00.000Z', reviewedAt: '2026-10-02T02:00:00.000Z', rejectReason: 'มีเมาส์สำรองที่แผนกอยู่แล้ว' },
  { id: REQUEST_IDS.r07, requesterId: USER_IDS.employee1, equipmentId: EQUIPMENT_IDS.monitor27, quantity: 1, reason: 'ต้องการจอขนาดใหญ่สำหรับงานออกแบบ', status: RequestStatus.REJECTED, createdAt: '2026-10-03T08:25:00.000Z', reviewedAt: '2026-10-04T03:15:00.000Z', rejectReason: 'งบประมาณไตรมาสนี้ไม่เพียงพอ' },
  { id: REQUEST_IDS.r08, requesterId: USER_IDS.employee2, equipmentId: EQUIPMENT_IDS.projector, quantity: 1, reason: 'ใช้นำเสนองานในห้องประชุมเล็ก', status: RequestStatus.REJECTED, createdAt: '2026-10-05T02:50:00.000Z', reviewedAt: '2026-10-06T05:20:00.000Z', rejectReason: 'ให้ใช้ห้องประชุมกลางที่มีโปรเจกเตอร์แทน' },
  { id: REQUEST_IDS.r09, requesterId: USER_IDS.employee1, equipmentId: EQUIPMENT_IDS.mouse, quantity: 2, reason: 'เมาส์สำหรับพนักงานใหม่ในทีม', status: RequestStatus.PENDING, createdAt: '2026-10-07T03:30:00.000Z' },
  { id: REQUEST_IDS.r10, requesterId: USER_IDS.employee2, equipmentId: EQUIPMENT_IDS.keyboard, quantity: 3, reason: 'คีย์บอร์ดสำหรับห้องฝึกอบรม', status: RequestStatus.PENDING, createdAt: '2026-10-08T04:45:00.000Z' },
  { id: REQUEST_IDS.r11, requesterId: USER_IDS.employee1, equipmentId: EQUIPMENT_IDS.headset, quantity: 1, reason: 'หูฟังเดิมไมค์เสีย', status: RequestStatus.PENDING, createdAt: '2026-10-09T05:10:00.000Z' },
  { id: REQUEST_IDS.r12, requesterId: USER_IDS.employee2, equipmentId: EQUIPMENT_IDS.monitor24, quantity: 2, reason: 'จอสำหรับโต๊ะทำงานที่ย้ายใหม่', status: RequestStatus.PENDING, createdAt: '2026-10-10T06:35:00.000Z' },
  { id: REQUEST_IDS.r13, requesterId: USER_IDS.employee1, equipmentId: EQUIPMENT_IDS.dockingStation, quantity: 2, reason: 'ใช้งานร่วมกับโน้ตบุ๊กของทีมสองเครื่อง', status: RequestStatus.PENDING, createdAt: '2026-10-11T07:20:00.000Z' },
  { id: REQUEST_IDS.DEMO_INACTIVE, requesterId: USER_IDS.employee2, equipmentId: EQUIPMENT_IDS.projector, quantity: 1, reason: 'ขอใช้โปรเจกเตอร์สำหรับงานสัมมนาภายใน', status: RequestStatus.PENDING, createdAt: '2026-10-12T08:05:00.000Z' },
  { id: REQUEST_IDS.DEMO_OVER, requesterId: USER_IDS.employee1, equipmentId: EQUIPMENT_IDS.monitor27, quantity: 8, reason: 'ต้องการจอสำหรับห้องปฏิบัติการใหม่', status: RequestStatus.PENDING, createdAt: '2026-10-13T09:15:00.000Z' },
];

export async function seed(prisma: PrismaClient): Promise<void> {
  const passwordHashes = new Map<string, string>();
  for (const user of USERS) {
    if (!passwordHashes.has(user.password)) {
      passwordHashes.set(user.password, hashSync(user.password, 10));
    }
  }

  for (const user of USERS) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email,
        passwordHash: passwordHashes.get(user.password) ?? '',
        name: user.name,
        role: user.role,
        createdAt: SEED_CREATED_AT,
        updatedAt: SEED_CREATED_AT,
      },
      update: {},
    });
  }

  for (const equipment of EQUIPMENTS) {
    await prisma.equipment.upsert({
      where: { id: equipment.id },
      create: {
        ...equipment,
        version: 1,
        createdAt: SEED_CREATED_AT,
        updatedAt: SEED_CREATED_AT,
      },
      update: {},
    });
  }

  let auditSeq = 0;
  for (const request of REQUESTS) {
    const createdAt = new Date(request.createdAt);
    const reviewedAt = request.reviewedAt ? new Date(request.reviewedAt) : null;
    const isApproved = request.status === RequestStatus.APPROVED;

    await prisma.request.upsert({
      where: { id: request.id },
      create: {
        id: request.id,
        requesterId: request.requesterId,
        equipmentId: request.equipmentId,
        quantity: request.quantity,
        reason: request.reason,
        status: request.status,
        rejectReason: request.rejectReason ?? null,
        reviewedById: reviewedAt ? USER_IDS.admin : null,
        reviewedAt,
        approvedAt: isApproved ? reviewedAt : null,
        createdAt,
        updatedAt: reviewedAt ?? createdAt,
      },
      update: {},
    });

    auditSeq += 1;
    await prisma.auditLog.upsert({
      where: { id: auditLogId(auditSeq) },
      create: {
        id: auditLogId(auditSeq),
        requestId: request.id,
        actorId: request.requesterId,
        fromStatus: null,
        toStatus: RequestStatus.PENDING,
        createdAt,
      },
      update: {},
    });

    if (reviewedAt) {
      auditSeq += 1;
      await prisma.auditLog.upsert({
        where: { id: auditLogId(auditSeq) },
        create: {
          id: auditLogId(auditSeq),
          requestId: request.id,
          actorId: USER_IDS.admin,
          fromStatus: RequestStatus.PENDING,
          toStatus: request.status,
          createdAt: reviewedAt,
        },
        update: {},
      });
    }
  }
}
