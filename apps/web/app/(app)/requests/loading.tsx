import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="กำลังโหลด" className="space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-8 w-80" />
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}
