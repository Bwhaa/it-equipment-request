import type { EquipmentRequest, Paginated, RequestStatus } from '@app/shared';
import Link from 'next/link';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { apiFetch } from '@/lib/api';
import { getApprovalBlock } from '@/lib/approval';
import { STATUS_LABEL, formatDateTime } from '@/lib/format';
import { buildHref, parsePage, parseRequestStatus, parseSearch, parseSort } from '@/lib/list-params';
import type { SearchParamValue } from '@/lib/list-params';

const PAGE_SIZE = 10;
const BASE_PATH = '/admin/requests';
const TABS: { label: string; status: RequestStatus | undefined }[] = [
  { label: 'ทั้งหมด', status: undefined },
  { label: STATUS_LABEL.PENDING, status: 'PENDING' },
  { label: STATUS_LABEL.APPROVED, status: 'APPROVED' },
  { label: STATUS_LABEL.REJECTED, status: 'REJECTED' },
];
const BLOCK_BADGE = { EQUIPMENT_INACTIVE: 'อุปกรณ์ปิดใช้งาน', INSUFFICIENT_STOCK: 'สต็อกไม่พอ' } as const;
const inputClass =
  'rounded border border-neutral-400 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const sp = await searchParams;
  const status = parseRequestStatus(sp.status);
  const search = parseSearch(sp.search);
  const sort = parseSort(sp.sort);
  const page = parsePage(sp.page);

  const result = await apiFetch<Paginated<EquipmentRequest>>('/requests', {
    query: { status, search, sort, page, limit: PAGE_SIZE },
  });

  // `sort` is kept in the URL only when it is not the default.
  const params = { status, search, sort: sort === 'createdAt:desc' ? undefined : sort };
  const filtered = status !== undefined || search !== undefined;
  const active = filtered || sort !== 'createdAt:desc';
  const clearHref = BASE_PATH;

  return (
    <section>
      <h1 className="mb-4 text-lg font-semibold">คำขอทั้งหมด</h1>

      <nav aria-label="กรองตามสถานะ" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const current = tab.status === status;
          return (
            <Link
              key={tab.label}
              href={buildHref(BASE_PATH, { ...params, status: tab.status }, 1)}
              aria-current={current ? 'page' : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${current ? 'border-blue-600 bg-blue-600 text-white' : 'border-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <form method="get" action={BASE_PATH} className="mb-4 flex flex-wrap items-end gap-3">
        {status && <input type="hidden" name="status" value={status} />}
        <div>
          <label htmlFor="search" className="mb-1 block text-sm font-medium">
            ค้นหาจากชื่ออุปกรณ์หรือชื่อผู้ขอ
          </label>
          <input id="search" name="search" type="search" maxLength={100} defaultValue={search ?? ''} className={`${inputClass} w-64`} />
        </div>
        <div>
          <label htmlFor="sort" className="mb-1 block text-sm font-medium">
            เรียงตาม
          </label>
          <select id="sort" name="sort" defaultValue={sort} className={inputClass}>
            <option value="createdAt:desc">ใหม่ไปเก่า</option>
            <option value="createdAt:asc">เก่าไปใหม่</option>
          </select>
        </div>
        <Button type="submit">ค้นหา</Button>
        {active && (
          <Link href={clearHref} className="py-2 text-sm underline">
            ล้างตัวกรอง
          </Link>
        )}
      </form>

      {result.data.length === 0 ? (
        result.meta.total > 0 ? (
          <EmptyState title="ไม่มีรายการในหน้านี้" action={{ href: buildHref(BASE_PATH, params, 1), label: 'กลับหน้าแรก' }} />
        ) : filtered ? (
          <EmptyState title="ไม่พบคำขอที่ตรงกับการค้นหา" action={{ href: clearHref, label: 'ล้างตัวกรอง' }} />
        ) : (
          <EmptyState title="ยังไม่มีคำขอเบิก" />
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">รายการคำขอเบิกทั้งหมด</caption>
            <thead>
              <tr className="border-b border-neutral-300 dark:border-neutral-700">
                <th scope="col" className="py-2 pr-4 font-medium">
                  วันที่ขอ
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  ผู้ขอ
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  อุปกรณ์
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  จำนวน
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  สถานะ
                </th>
                <th scope="col" className="py-2 font-medium">
                  <span className="sr-only">ตรวจสอบ</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((request) => {
                const block = getApprovalBlock(request);
                return (
                  <tr key={request.id} className="border-b border-neutral-200 dark:border-neutral-800">
                    <td className="py-2 pr-4">{formatDateTime(request.createdAt)}</td>
                    <td className="py-2 pr-4">{request.requester.name}</td>
                    <td className="py-2 pr-4">{request.equipment.name}</td>
                    <td className="py-2 pr-4">{request.quantity}</td>
                    <td className="py-2 pr-4">
                      <span className="flex flex-wrap items-center gap-1">
                        <StatusBadge status={request.status} />
                        {block && <Badge tone="danger">{BLOCK_BADGE[block.code]}</Badge>}
                      </span>
                    </td>
                    <td className="py-2">
                      <Link href={`${BASE_PATH}/${request.id}`} className="underline">
                        ตรวจสอบ
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination basePath={BASE_PATH} params={params} page={page} totalPages={result.meta.totalPages} />
    </section>
  );
}
