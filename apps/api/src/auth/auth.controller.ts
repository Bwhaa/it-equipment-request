import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { UserSummary } from '@app/shared';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<{ accessToken: string; user: UserSummary }> {
    return this.authService.login(dto.email, dto.password, req.ip);
  }

  @Get('me')
  @Roles('EMPLOYEE', 'ADMIN')
  me(@CurrentUser() user: AuthUser): Promise<UserSummary> {
    return this.authService.me(user.id);
  }
}
