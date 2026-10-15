import type { EquipmentRequest, Paginated, RequestStatus } from '@app/shared';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { apiFetch } from '@/lib/api';
import { STATUS_LABEL, formatDateTime } from '@/lib/format';
import { buildHref, parsePage, parseRequestStatus } from '@/lib/list-params';
import type { SearchParamValue } from '@/lib/list-params';

const PAGE_SIZE = 5;
const TABS: { label: string; status: RequestStatus | undefined }[] = [
  { label: 'ทั้งหมด', status: undefined },
  { label: STATUS_LABEL.PENDING, status: 'PENDING' },
  { label: STATUS_LABEL.APPROVED, status: 'APPROVED' },
  { label: STATUS_LABEL.REJECTED, status: 'REJECTED' },
];

export default async function MyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const sp = await searchParams;
  const status = parseRequestStatus(sp.status);
  const page = parsePage(sp.page);

  // /requests/me does not accept `search`: never send it.
  const result = await apiFetch<Paginated<EquipmentRequest>>('/requests/me', {
    query: { status, page, limit: PAGE_SIZE },
  });

  return (
    <section>
      <h1 className="mb-4 text-lg font-semibold">คำขอของฉัน</h1>

      <nav aria-label="กรองตามสถานะ" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = tab.status === status;
          return (
            <Link
              key={tab.label}
              href={buildHref('/requests', { status: tab.status }, 1)}
              aria-current={active ? 'page' : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${active ? 'border-blue-600 bg-blue-600 text-white' : 'border-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {result.data.length === 0 ? (
        result.meta.total > 0 ? (
          <EmptyState title="ไม่มีรายการในหน้านี้" action={{ href: buildHref('/requests', { status }, 1), label: 'กลับหน้าแรก' }} />
        ) : status ? (
          <EmptyState title="ไม่มีคำขอในสถานะนี้" />
        ) : (
          <EmptyState title="คุณยังไม่มีคำขอเบิก" action={{ href: '/equipments', label: 'ไปเลือกอุปกรณ์' }} />
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">รายการคำขอเบิกของฉัน</caption>
            <thead>
              <tr className="border-b border-neutral-300 dark:border-neutral-700">
                <th scope="col" className="py-2 pr-4 font-medium">
                  วันที่ขอ
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
                  <span className="sr-only">รายละเอียด</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((request) => (
                <tr key={request.id} className="border-b border-neutral-200 dark:border-neutral-800">
                  <td className="py-2 pr-4">{formatDateTime(request.createdAt)}</td>
                  <td className="py-2 pr-4">{request.equipment.name}</td>
                  <td className="py-2 pr-4">{request.quantity}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={request.status} />
                  </td>
                  <td className="py-2">
                    <Link href={`/requests/${request.id}`} className="underline">
                      ดูรายละเอียด
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination basePath="/requests" params={{ status }} page={page} totalPages={result.meta.totalPages} />
    </section>
  );
}
