import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { resetDb } from './reset-db';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
}

export async function createTestApp(controllers: Type<unknown>[] = []): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/**
 * Standard e2e lifecycle (CLAUDE.md): call once at the top of every e2e file.
 * Registers beforeAll (create app + resetDb) and afterAll (close app); returns accessors.
 */
export function useTestApp(controllers: Type<unknown>[] = []): () => TestApp {
  let ctx: TestApp | undefined;
  beforeAll(async () => {
    ctx = await createTestApp(controllers);
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx?.app.close();
  });
  return () => {
    if (!ctx) throw new Error('test app is not initialised yet');
    return ctx;
  };
}
