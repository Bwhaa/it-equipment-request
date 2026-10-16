import Link from 'next/link';
import { EquipmentForm } from '../equipment-form';

export default function NewEquipmentPage() {
  return (
    <section className="max-w-xl">
      <Link href="/admin/equipments" className="text-sm underline">
        ← กลับไปจัดการอุปกรณ์
      </Link>
      <h1 className="mb-4 mt-3 text-lg font-semibold">เพิ่มอุปกรณ์</h1>
      <EquipmentForm mode="create" />
    </section>
  );
}
