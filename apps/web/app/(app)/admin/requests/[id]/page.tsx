import type { Metadata } from 'next';
import type { RequestDetail } from '@app/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { ApiRequestError } from '@/lib/api-error';
import { getApprovalBlock } from '@/lib/approval';
import { EQUIPMENT_STATUS_LABEL, describeAuditEntry, formatDateTime } from '@/lib/format';
import type { SearchParamValue } from '@/lib/list-params';
import { isUuid } from '@/lib/roles';
import { ReviewPanel } from './review-panel';

export const metadata: Metadata = { title: 'ตรวจสอบคำขอ' };

/** Returns null on 404; every other error propagates. */
async function loadRequest(id: string): Promise<RequestDetail | null> {
  try {
    return await apiFetch<RequestDetail>(`/requests/${id}`);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}

const DONE_NOTICE: Record<string, string> = {
  approved: 'อนุมัติคำขอเรียบร้อยแล้ว',
  rejected: 'ปฏิเสธคำขอเรียบร้อยแล้ว',
};

export default async function AdminRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const request = await loadRequest(id);
  if (!request) notFound();

  const done = typeof sp.done === 'string' ? DONE_NOTICE[sp.done] : undefined;
  const block = getApprovalBlock(request);

  return (
    <section className="max-w-2xl space-y-4">
      <Link href="/admin/requests" className="text-sm underline">
        ← กลับไปคำขอทั้งหมด
      </Link>

      {done && <Alert variant="notice">{done}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">{request.equipment.name}</h1>
        <StatusBadge status={request.status} />
      </div>

      <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-neutral-600 dark:text-neutral-400">ผู้ขอ</dt>
        <dd>{request.requester.name}</dd>
        <dt className="text-neutral-600 dark:text-neutral-400">อุปกรณ์</dt>
        <dd>
          {request.equipment.name} ({request.equipment.category})
        </dd>
        <dt className="text-neutral-600 dark:text-neutral-400">สต็อก</dt>
        <dd>
          คงเหลือปัจจุบัน: {request.equipment.stockQuantity} ชิ้น · {EQUIPMENT_STATUS_LABEL[request.equipment.status]}
        </dd>
        <dt className="text-neutral-600 dark:text-neutral-400">จำนวนที่ขอ</dt>
        <dd>{request.quantity}</dd>
        <dt className="text-neutral-600 dark:text-neutral-400">เหตุผล</dt>
        <dd className="whitespace-pre-wrap break-words">{request.reason}</dd>
        <dt className="text-neutral-600 dark:text-neutral-400">วันที่ขอ</dt>
        <dd>{formatDateTime(request.createdAt)}</dd>
      </dl>

      {request.reviewer && request.reviewedAt && (
        <p className="text-sm">
          ผู้พิจารณา: {request.reviewer.name} · {formatDateTime(request.reviewedAt)}
        </p>
      )}

      {request.status === 'REJECTED' && request.rejectReason && (
        <div className="rounded border border-red-400 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-medium">เหตุผลที่ปฏิเสธ</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{request.rejectReason}</p>
        </div>
      )}

      <ReviewPanel id={request.id} block={block} reviewed={request.status !== 'PENDING'} />

      <div>
        <h2 className="mb-2 font-medium">ประวัติการดำเนินการ</h2>
        <ol className="space-y-2 border-l-2 border-neutral-300 pl-4 dark:border-neutral-700">
          {request.auditLogs.map((entry) => (
            <li key={entry.id} className="text-sm">
              <p className="font-medium">{describeAuditEntry(entry)}</p>
              <p className="text-neutral-600 dark:text-neutral-400">
                {entry.actor.name} · {formatDateTime(entry.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
