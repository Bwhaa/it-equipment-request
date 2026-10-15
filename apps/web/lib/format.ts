import type { AuditLog, RequestStatus } from '@app/shared';

const DATE_TIME = new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Bangkok',
});

/** Fixed locale, calendar and time zone so the server and the browser render identical text. */
export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

export const STATUS_LABEL: Record<RequestStatus, string> = {
  PENDING: 'รออนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ปฏิเสธ',
};

export function describeAuditEntry(entry: AuditLog): string {
  const { fromStatus, toStatus } = entry;
  if (fromStatus === null && toStatus === 'PENDING') return 'สร้างคำขอ';
  if (fromStatus === 'PENDING' && toStatus === 'APPROVED') return 'อนุมัติคำขอ';
  if (fromStatus === 'PENDING' && toStatus === 'REJECTED') return 'ปฏิเสธคำขอ';
  return `${fromStatus ?? '-'} → ${toStatus}`;
}
