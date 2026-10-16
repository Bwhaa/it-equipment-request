import type { ReactNode } from 'react';

export type AlertVariant = 'error' | 'notice' | 'warning';

const STYLE: Record<AlertVariant, string> = {
  error: 'border-danger-text bg-danger-bg text-danger-text',
  notice: 'border-brand bg-brand-tint text-approved-text',
  warning: 'border-pending-text bg-pending-bg text-pending-text',
};

/** Errors use role="alert"; notices and warnings use role="status". */
export function Alert({ variant = 'notice', title, children }: { variant?: AlertVariant; title?: string; children?: ReactNode }) {
  return (
    <div role={variant === 'error' ? 'alert' : 'status'} className={`rounded-field border p-4 text-sm ${STYLE[variant]}`}>
      {title && <p className="font-medium">{title}</p>}
      {children}
    </div>
  );
}
