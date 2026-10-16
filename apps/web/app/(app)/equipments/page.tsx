import type { Metadata } from 'next';
import type { Equipment, Paginated } from '@app/shared';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { apiFetch } from '@/lib/api';
import { buildHref, parseCategory, parsePage, parseSearch } from '@/lib/list-params';
import type { SearchParamValue } from '@/lib/list-params';
import { FILTER_INPUT_CLASS } from '@/lib/ui-classes';

export const metadata: Metadata = { title: 'รายการอุปกรณ์' };

const PAGE_SIZE = 6;

export default async function EquipmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const sp = await searchParams;
  const search = parseSearch(sp.search);
  const category = parseCategory(sp.category);
  const page = parsePage(sp.page);

  const [result, categories] = await Promise.all([
    apiFetch<Paginated<Equipment>>('/equipments', { query: { search, category, page, limit: PAGE_SIZE } }),
    apiFetch<string[]>('/equipments/categories'),
  ]);
  const filterActive = search !== undefined || category !== undefined;

  return (
    <section>
      <h1 className="mb-4 text-lg font-semibold">รายการอุปกรณ์</h1>

      <form method="get" action="/equipments" className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="search" className="mb-1 block text-sm font-medium">
            ค้นหาชื่ออุปกรณ์
          </label>
          <input id="search" name="search" type="search" maxLength={100} defaultValue={search ?? ''} className={FILTER_INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium">
            หมวดหมู่
          </label>
          <select id="category" name="category" defaultValue={category ?? ''} className={FILTER_INPUT_CLASS}>
            <option value="">ทุกหมวดหมู่</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonClasses('primary')}>
          ค้นหา
        </button>
        {filterActive && (
          <Link href="/equipments" className="py-2 text-sm underline">
            ล้างตัวกรอง
          </Link>
        )}
      </form>

      {result.data.length === 0 ? (
        result.meta.total > 0 ? (
          <EmptyState title="ไม่มีรายการในหน้านี้" action={{ href: buildHref('/equipments', { search, category }, 1), label: 'กลับหน้าแรก' }} />
        ) : filterActive ? (
          <EmptyState
            title="ไม่พบอุปกรณ์ที่ตรงกับการค้นหา"
            description="ลองเปลี่ยนคำค้นหาหรือหมวดหมู่"
            action={{ href: '/equipments', label: 'ล้างตัวกรอง' }}
          />
        ) : (
          <EmptyState title="ยังไม่มีอุปกรณ์ให้เบิก" />
        )
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.data.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
              <h2 className="font-medium">{item.name}</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{item.category}</p>
              <p className="text-sm">
                คงเหลือ {item.stockQuantity} ชิ้น {item.stockQuantity === 0 && <Badge tone="danger">หมด</Badge>}
              </p>
              <div className="mt-auto pt-2">
                {item.stockQuantity === 0 ? (
                  <button type="button" disabled aria-disabled="true" className={buttonClasses('primary', true)}>
                    ขอเบิก
                  </button>
                ) : (
                  <Link href={`/equipments/${item.id}/request`} className={buttonClasses('primary')}>
                    ขอเบิก
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination basePath="/equipments" params={{ search, category }} page={page} totalPages={result.meta.totalPages} />
    </section>
  );
}
