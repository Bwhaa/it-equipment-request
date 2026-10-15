import type { ReactNode } from 'react';

export type AlertVariant = 'error' | 'notice' | 'warning';

const STYLE: Record<AlertVariant, string> = {
  error: 'border-red-400 bg-red-50 text-red-900',
  notice: 'border-green-500 bg-green-50 text-green-900',
  warning: 'border-amber-400 bg-amber-50 text-amber-900',
};

/** Errors use role="alert"; notices and warnings use role="status". */
export function Alert({ variant = 'notice', title, children }: { variant?: AlertVariant; title?: string; children?: ReactNode }) {
  return (
    <div role={variant === 'error' ? 'alert' : 'status'} className={`rounded border p-3 text-sm ${STYLE[variant]}`}>
      {title && <p className="font-medium">{title}</p>}
      {children}
    </div>
  );
}
