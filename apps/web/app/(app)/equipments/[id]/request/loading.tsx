import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="max-w-xl space-y-3">
      <span className="sr-only">กำลังโหลด…</span>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
