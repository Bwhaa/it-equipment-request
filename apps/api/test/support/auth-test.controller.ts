import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '../../src/auth/auth.types';
import { CurrentUser } from '../../src/auth/decorators/current-user.decorator';
import { Public } from '../../src/auth/decorators/public.decorator';
import { Roles } from '../../src/auth/decorators/roles.decorator';

/** TEST-ONLY controller: registered via createTestApp({ controllers }), never in AppModule. */
@Controller('__test')
export class AuthTestController {
  @Get('admin-only')
  @Roles('ADMIN')
  adminOnly(): { ok: true } {
    return { ok: true };
  }

  @Get('employee-only')
  @Roles('EMPLOYEE')
  employeeOnly(): { ok: true } {
    return { ok: true };
  }

  @Get('any')
  any(): { ok: true } {
    return { ok: true };
  }

  @Get('public')
  @Public()
  publicRoute(): { ok: true } {
    return { ok: true };
  }

  @Get('who')
  who(@CurrentUser() user: AuthUser): AuthUser {
    return { id: user.id, role: user.role };
  }
}
