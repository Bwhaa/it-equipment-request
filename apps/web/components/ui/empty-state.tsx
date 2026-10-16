import Link from 'next/link';
import { buttonClasses } from './button';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-card border border-dashed border-field-line bg-surface p-8 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {action && (
        <Link href={action.href} className={`${buttonClasses('secondary')} mt-4`}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
