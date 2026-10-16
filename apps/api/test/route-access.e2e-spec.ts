import { Controller, Get } from '@nestjs/common';
import { createTestApp } from './support/create-test-app';
import { findUndeclaredRoutes } from './support/route-access';

@Controller('__undeclared')
class UndeclaredController {
  @Get('open')
  open(): { ok: true } {
    return { ok: true };
  }
}

describe('route access declarations', () => {
  it('every route of the real application declares @Public() or @Roles(...)', async () => {
    const { app } = await createTestApp();
    try {
      expect(findUndeclaredRoutes(app)).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('detects a route that declares neither', async () => {
    const { app } = await createTestApp([UndeclaredController]);
    try {
      expect(findUndeclaredRoutes(app)).toEqual(['UndeclaredController.open']);
    } finally {
      await app.close();
    }
  });
});
