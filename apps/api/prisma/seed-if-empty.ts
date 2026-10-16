import { PrismaClient } from '@prisma/client';
import { seed } from './seed-data';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const count = await prisma.user.count();
    if (count > 0) {
      console.log(`[seed] users exist (${count}); skipping seed`);
      return;
    }
    console.log('[seed] empty database; seeding');
    await seed(prisma);
    console.log('[seed] done');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
