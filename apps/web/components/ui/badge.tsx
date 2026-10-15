import type { RequestStatus } from '@app/shared';
import type { ReactNode } from 'react';
import { STATUS_LABEL } from '@/lib/format';

export type BadgeTone = 'neutral' | 'warning' | 'success' | 'danger';

const TONE: Record<BadgeTone, string> = {
  neutral: 'border-neutral-400 bg-neutral-100 text-neutral-800',
  warning: 'border-amber-500 bg-amber-50 text-amber-900',
  success: 'border-green-600 bg-green-50 text-green-900',
  danger: 'border-red-600 bg-red-50 text-red-900',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[tone]}`}>{children}</span>
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
