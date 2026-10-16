import { EQUIPMENT_IDS } from '../prisma/seed-data';
import { useTestApp } from './support/create-test-app';

const getCtx = useTestApp();

describe('resetDb (A)', () => {
  it('starts from the seeded baseline, then mutates without cleaning up', async () => {
    const { prisma } = getCtx();
    expect(await prisma.user.count()).toBe(3);
    expect(await prisma.equipment.count()).toBe(8);
    expect(await prisma.request.count()).toBe(15);
    expect(await prisma.auditLog.count()).toBe(23);
    expect((await prisma.equipment.findUniqueOrThrow({ where: { id: EQUIPMENT_IDS.monitor24 } })).stockQuantity).toBe(10);

    await prisma.equipment.update({ where: { id: EQUIPMENT_IDS.monitor24 }, data: { stockQuantity: 1 } });
    await prisma.user.create({
      data: { email: 'leftover-a@company.com', passwordHash: 'x', name: 'Leftover A', role: 'EMPLOYEE' },
    });
  });
});
