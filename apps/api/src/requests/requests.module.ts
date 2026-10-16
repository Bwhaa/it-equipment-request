import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [AuditLogModule],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
