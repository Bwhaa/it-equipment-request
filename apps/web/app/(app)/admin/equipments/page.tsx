import type { Metadata } from 'next';
import type { Equipment, Paginated } from '@app/shared';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { apiFetch } from '@/lib/api';
import { EQUIPMENT_STATUS_LABEL } from '@/lib/format';
import { buildHref, parseCategory, parseEquipmentStatus, parsePage, parseSearch } from '@/lib/list-params';
import type { SearchParamValue } from '@/lib/list-params';
import { FILTER_INPUT_CLASS } from '@/lib/ui-classes';

export const metadata: Metadata = { title: 'จัดการอุปกรณ์' };

const PAGE_SIZE = 10;
const BASE_PATH = '/admin/equipments';
const DONE_NOTICE: Record<string, string> = {
  created: 'เพิ่มอุปกรณ์เรียบร้อยแล้ว',
  updated: 'บันทึกการแก้ไขเรียบร้อยแล้ว',
};

export default async function AdminEquipmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const sp = await searchParams;
  const search = parseSearch(sp.search);
  const category = parseCategory(sp.category);
  const status = parseEquipmentStatus(sp.status);
  const page = parsePage(sp.page);

  const [result, categories] = await Promise.all([
    apiFetch<Paginated<Equipment>>('/equipments', { query: { search, category, status, page, limit: PAGE_SIZE } }),
    apiFetch<string[]>('/equipments/categories'),
  ]);

  const params = { search, category, status };
  const filtered = search !== undefined || category !== undefined || status !== undefined;
  const done = typeof sp.done === 'string' ? DONE_NOTICE[sp.done] : undefined;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">จัดการอุปกรณ์</h1>
        <Link href={`${BASE_PATH}/new`} className={buttonClasses('primary')}>
          เพิ่มอุปกรณ์
        </Link>
      </div>

      {done && (
        <div className="mb-4">
          <Alert variant="notice">{done}</Alert>
        </div>
      )}

      <form method="get" action={BASE_PATH} className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="search" className="mb-1 block text-sm font-medium">
            ค้นหาชื่ออุปกรณ์
          </label>
          <input id="search" name="search" type="search" maxLength={100} defaultValue={search ?? ''} className={`${FILTER_INPUT_CLASS} w-56`} />
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
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium">
            สถานะ
          </label>
          <select id="status" name="status" defaultValue={status ?? ''} className={FILTER_INPUT_CLASS}>
            <option value="">ทุกสถานะ</option>
            <option value="ACTIVE">{EQUIPMENT_STATUS_LABEL.ACTIVE}</option>
            <option value="INACTIVE">{EQUIPMENT_STATUS_LABEL.INACTIVE}</option>
          </select>
        </div>
        <Button type="submit">ค้นหา</Button>
        {filtered && (
          <Link href={BASE_PATH} className="py-2 text-sm underline">
            ล้างตัวกรอง
          </Link>
        )}
      </form>

      {result.data.length === 0 ? (
        result.meta.total > 0 ? (
          <EmptyState title="ไม่มีรายการในหน้านี้" action={{ href: buildHref(BASE_PATH, params, 1), label: 'กลับหน้าแรก' }} />
        ) : filtered ? (
          <EmptyState title="ไม่พบอุปกรณ์ที่ตรงกับการค้นหา" action={{ href: BASE_PATH, label: 'ล้างตัวกรอง' }} />
        ) : (
          <EmptyState title="ยังไม่มีอุปกรณ์" action={{ href: `${BASE_PATH}/new`, label: 'เพิ่มอุปกรณ์' }} />
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="sr-only">รายการอุปกรณ์ทั้งหมด</caption>
            <thead>
              <tr className="border-b border-neutral-300 dark:border-neutral-700">
                <th scope="col" className="py-2 pr-4 font-medium">
                  ชื่ออุปกรณ์
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  หมวดหมู่
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  คงเหลือ
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  สถานะ
                </th>
                <th scope="col" className="py-2 font-medium">
                  <span className="sr-only">แก้ไข</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((equipment) => (
                <tr key={equipment.id} className="border-b border-neutral-200 dark:border-neutral-800">
                  <td className="py-2 pr-4">{equipment.name}</td>
                  <td className="py-2 pr-4">{equipment.category}</td>
                  <td className="py-2 pr-4">
                    <span className="flex items-center gap-2">
                      {equipment.stockQuantity}
                      {equipment.stockQuantity === 0 && <Badge tone="danger">หมด</Badge>}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge tone={equipment.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {EQUIPMENT_STATUS_LABEL[equipment.status]}
                    </Badge>
                  </td>
                  <td className="py-2">
                    <Link href={`${BASE_PATH}/${equipment.id}/edit`} className="underline">
                      แก้ไข
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination basePath={BASE_PATH} params={params} page={page} totalPages={result.meta.totalPages} />
    </section>
  );
}
