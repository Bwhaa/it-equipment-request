export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-800 ${className}`} />;
}
