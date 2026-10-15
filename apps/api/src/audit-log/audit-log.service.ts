import { Injectable } from '@nestjs/common';
import type { AuditLog, Prisma, RequestStatus } from '@prisma/client';

export interface AuditLogEntry {
  requestId: string;
  actorId: string;
  from: RequestStatus | null;
  to: RequestStatus;
}

@Injectable()
export class AuditLogService {
  /** Takes the caller's transaction client so the row is written in the SAME transaction as the status change. */
  log(tx: Prisma.TransactionClient, e: AuditLogEntry): Promise<AuditLog> {
    return tx.auditLog.create({
      data: { requestId: e.requestId, actorId: e.actorId, fromStatus: e.from, toStatus: e.to },
    });
  }
}
