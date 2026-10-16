import Link from 'next/link';
import { buildHref } from '@/lib/list-params';

const PILL = 'inline-flex h-11 items-center rounded-pill px-5 text-[15px] font-semibold transition-colors';
const LINK = `${PILL} border border-ink bg-surface text-ink hover:bg-ground`;
const DISABLED = `${PILL} bg-disabled-bg text-disabled-text`;

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
      <span className="text-sm text-muted">
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
