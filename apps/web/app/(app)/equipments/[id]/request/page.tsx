import { randomUUID } from 'node:crypto';
import type { Metadata } from 'next';
import type { Equipment } from '@app/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { apiFetch } from '@/lib/api';
import { ApiRequestError } from '@/lib/api-error';
import { isUuid } from '@/lib/roles';
import { RequestForm } from './request-form';

export const metadata: Metadata = { title: 'ขอเบิกอุปกรณ์' };

/** Returns null on 404 (unknown id or INACTIVE for an employee); every other error propagates. */
async function loadEquipment(id: string): Promise<Equipment | null> {
  try {
    return await apiFetch<Equipment>(`/equipments/${id}`);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}

export default async function RequestEquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const equipment = await loadEquipment(id);
  if (!equipment) notFound();
  // A new key per render: one page load = one logical request (a double submit or "back and submit again" reuses it).
  const idempotencyKey = randomUUID();

  return (
    <section className="max-w-xl">
      <Link href="/equipments" className="text-sm underline">
        ← กลับไปรายการอุปกรณ์
      </Link>
      <h1 className="mt-3 text-lg font-semibold">ขอเบิก: {equipment.name}</h1>
      <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
        หมวดหมู่ {equipment.category} · คงเหลือ {equipment.stockQuantity} ชิ้น
      </p>
      {equipment.stockQuantity === 0 ? (
        <Alert variant="warning">อุปกรณ์นี้หมดชั่วคราว ไม่สามารถขอเบิกได้</Alert>
      ) : (
        <RequestForm equipmentId={equipment.id} stockQuantity={equipment.stockQuantity} idempotencyKey={idempotencyKey} />
      )}
    </section>
  );
}
