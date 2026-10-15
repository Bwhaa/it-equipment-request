import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UserSummary } from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';

const USER_SUMMARY = { id: true, name: true, email: true, role: true } as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; user: UserSummary }> {
    const found = await this.prisma.user.findUnique({
      where: { email },
      select: { ...USER_SUMMARY, passwordHash: true },
    });
    // Always run one compare (dummy hash when the email is unknown) so timing does not reveal existence.
    const ok = await this.passwordService.compare(password, found?.passwordHash ?? this.passwordService.dummyHash);
    if (!found || !ok) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
    }

    const accessToken = await this.jwtService.signAsync({ sub: found.id, role: found.role });
    return { accessToken, user: { id: found.id, name: found.name, email: found.email, role: found.role } };
  }

  async me(userId: string): Promise<UserSummary> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: USER_SUMMARY });
    if (!user) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Unauthorized' });
    return user;
  }
}
