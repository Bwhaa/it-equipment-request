import { EQUIPMENT_IDS, REQUEST_IDS } from '../prisma/seed-data';
import { useTestApp } from './support/create-test-app';

const getCtx = useTestApp();

describe('resetDb (B)', () => {
  it('starts from the seeded baseline, then mutates without cleaning up', async () => {
    const { prisma } = getCtx();
    expect(await prisma.user.count()).toBe(3);
    expect(await prisma.equipment.count()).toBe(8);
    expect(await prisma.request.count()).toBe(15);
    expect(await prisma.auditLog.count()).toBe(23);
    expect((await prisma.equipment.findUniqueOrThrow({ where: { id: EQUIPMENT_IDS.monitor24 } })).stockQuantity).toBe(10);
    expect((await prisma.request.findUniqueOrThrow({ where: { id: REQUEST_IDS.r09 } })).status).toBe('PENDING');

    await prisma.request.update({ where: { id: REQUEST_IDS.r09 }, data: { status: 'APPROVED' } });
    await prisma.equipment.create({ data: { name: 'Leftover B', category: 'Test', stockQuantity: 5 } });
  });
});
