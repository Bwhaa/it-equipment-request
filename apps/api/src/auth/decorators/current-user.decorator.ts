import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser } from '../auth.types';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
  if (!user) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Unauthorized' });
  return user;
});
