import type { RequestStatus } from '@app/shared';
import type { ReactNode } from 'react';
import { STATUS_LABEL } from '@/lib/format';

export type BadgeTone = 'neutral' | 'warning' | 'success' | 'danger';

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-chip-bg text-chip-text',
  warning: 'bg-pending-bg text-pending-text',
  success: 'bg-approved-bg text-approved-text',
  danger: 'bg-danger-bg text-danger-text',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-pill px-3 py-1 text-[13px] font-semibold ${TONE[tone]}`}>{children}</span>
  );
}

const STATUS_TONE: Record<RequestStatus, BadgeTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

/** Always shows the text label: colour is never the only signal. */
export function StatusBadge({ status }: { status: RequestStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
