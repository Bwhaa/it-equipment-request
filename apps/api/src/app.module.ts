import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'test' ? [resolve(__dirname, '../.env.test')] : [resolve(__dirname, '../../../.env')],
    }),
    PrismaModule,
    AuthModule,
  ],
})
export class AppModule {}
