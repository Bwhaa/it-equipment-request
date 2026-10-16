import type { Metadata } from 'next';
import type { Equipment } from '@app/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { ApiRequestError } from '@/lib/api-error';
import { isUuid } from '@/lib/roles';
import { EquipmentForm } from '../../equipment-form';

export const metadata: Metadata = { title: 'แก้ไขอุปกรณ์' };

/** Returns null on 404; every other error propagates. */
async function loadEquipment(id: string): Promise<Equipment | null> {
  try {
    return await apiFetch<Equipment>(`/equipments/${id}`);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}

export default async function EditEquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const equipment = await loadEquipment(id);
  if (!equipment) notFound();

  return (
    <section className="max-w-xl">
      <Link href="/admin/equipments" className="text-sm underline">
        ← กลับไปจัดการอุปกรณ์
      </Link>
      <h1 className="mt-3 text-lg font-semibold">แก้ไขอุปกรณ์: {equipment.name}</h1>
      <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">เวอร์ชัน {equipment.version}</p>
      <EquipmentForm
        mode="edit"
        initial={{
          id: equipment.id,
          version: equipment.version,
          values: {
            name: equipment.name,
            category: equipment.category,
            stockQuantity: String(equipment.stockQuantity),
            status: equipment.status,
          },
        }}
      />
    </section>
  );
}
