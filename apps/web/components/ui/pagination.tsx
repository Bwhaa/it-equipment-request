import Link from 'next/link';
import { buildHref } from '@/lib/list-params';

const LINK = 'rounded border border-neutral-400 px-3 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800';
const DISABLED = 'rounded border border-neutral-300 px-3 py-1 text-sm text-neutral-400';

export function Pagination({
  basePath,
  params,
  page,
  totalPages,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="การแบ่งหน้า" className="mt-6 flex items-center justify-center gap-3">
      {page > 1 ? (
        <Link href={buildHref(basePath, params, page - 1)} rel="prev" className={LINK}>
          ก่อนหน้า
        </Link>
      ) : (
        <span aria-disabled="true" className={DISABLED}>
          ก่อนหน้า
        </span>
      )}
      <span className="text-sm">
        หน้า {page} จาก {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={buildHref(basePath, params, page + 1)} rel="next" className={LINK}>
          ถัดไป
        </Link>
      ) : (
        <span aria-disabled="true" className={DISABLED}>
          ถัดไป
        </span>
      )}
    </nav>
  );
}
