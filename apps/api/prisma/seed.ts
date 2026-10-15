import { PrismaClient } from '@prisma/client';
import { seed } from './seed-data';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seed(prisma);
    const [users, equipments, requests, auditLogs] = await Promise.all([
      prisma.user.count(),
      prisma.equipment.count(),
      prisma.request.count(),
      prisma.auditLog.count(),
    ]);
    console.log(`seed ok: users=${users} equipments=${equipments} requests=${requests} audit_logs=${auditLogs}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
