import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="กำลังโหลด" className="max-w-2xl space-y-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-10 w-40" />
    </div>
  );
}
