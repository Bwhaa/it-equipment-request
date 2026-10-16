import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-3">
      <span className="sr-only">กำลังโหลด…</span>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}
