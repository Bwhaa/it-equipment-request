import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { assertTestDatabaseUrl } from './support/test-database';

export default async function globalSetup(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (run e2e through `pnpm --filter api test:e2e`)');
  const name = assertTestDatabaseUrl(url);

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
  let created = false;
  try {
    const rows = await admin.$queryRaw<{ exists: boolean }[]>`SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${name}) AS "exists"`;
    if (!rows[0]?.exists) {
      // name is validated by assertTestDatabaseUrl (/^[a-z0-9_]+_test$/), so interpolation is safe
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
      created = true;
    }
  } finally {
    await admin.$disconnect();
  }

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
  console.log(`\n[e2e] test database "${name}" ${created ? 'created' : 'already existed'}`);
}
