import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UserSummary } from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LoginRateLimiter, normalizeEmailKey } from './login-rate-limiter';
import { PasswordService } from './password.service';

const USER_SUMMARY = { id: true, name: true, email: true, role: true } as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly rateLimiter: LoginRateLimiter,
  ) {}

  async login(email: string, password: string, ip?: string): Promise<{ accessToken: string; user: UserSummary }> {
    const key = normalizeEmailKey(email);
    const decision = this.rateLimiter.check(key, ip);
    if (!decision.allowed) {
      throw new HttpException(
        {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many failed login attempts. Try again later.',
          retryAfter: decision.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const found = await this.prisma.user.findUnique({
      where: { email },
      select: { ...USER_SUMMARY, passwordHash: true },
    });
    // Always run one compare (dummy hash when the email is unknown) so timing does not reveal existence.
    const ok = await this.passwordService.compare(password, found?.passwordHash ?? this.passwordService.dummyHash);
    if (!found || !ok) {
      this.rateLimiter.recordFailure(key, ip);
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
    }

    this.rateLimiter.recordSuccess(key);
    const accessToken = await this.jwtService.signAsync({ sub: found.id, role: found.role });
    return { accessToken, user: { id: found.id, name: found.name, email: found.email, role: found.role } };
  }

  async me(userId: string): Promise<UserSummary> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: USER_SUMMARY });
    if (!user) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Unauthorized' });
    return user;
  }
}
