export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="animate-pulse space-y-3 p-4">
      <span className="sr-only">กำลังโหลด…</span>
      <div className="h-6 w-1/3 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="h-4 w-2/3 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="h-4 w-1/2 rounded bg-neutral-200 dark:bg-neutral-800" />
    </div>
  );
}
