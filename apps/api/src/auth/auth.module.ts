import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { readJwtConfig } from './auth.config';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LOGIN_RATE_LIMIT_CONFIG, LoginRateLimiter } from './login-rate-limiter';
import { PasswordService } from './password.service';
import { readLoginRateLimitConfig } from './rate-limit.config';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { secret, expiresIn } = readJwtConfig(config);
        return {
          secret,
          signOptions: { algorithm: 'HS256', expiresIn: expiresIn as JwtSignOptions['expiresIn'] },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    {
      provide: LOGIN_RATE_LIMIT_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => readLoginRateLimitConfig(config),
    },
    LoginRateLimiter,
    // Order matters: JwtAuthGuard must run before RolesGuard.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
