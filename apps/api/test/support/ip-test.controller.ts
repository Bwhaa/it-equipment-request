import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../src/auth/decorators/public.decorator';

/** TEST-ONLY controller: registered via createTestApp({ controllers }), never in AppModule. */
@Public()
@Controller('__test')
export class IpTestController {
  @Get('ip')
  ip(@Req() request: Request): { ip: string | undefined } {
    return { ip: request.ip };
  }
}
