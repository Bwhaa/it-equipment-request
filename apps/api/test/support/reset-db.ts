import type { PrismaClient } from '@prisma/client';
import { seed } from '../../prisma/seed-data';

export async function resetDb(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  const name = rows[0]?.name ?? '';
  if (!/^[a-z0-9_]+_test$/.test(name)) {
    throw new Error(`Refusing to reset: connected database "${name}" does not end with _test`);
  }
  await prisma.$executeRawUnsafe('TRUNCATE audit_logs, requests, equipments, users');
  await seed(prisma);
}
