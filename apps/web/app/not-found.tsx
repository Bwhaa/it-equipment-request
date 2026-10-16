import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'ไม่พบหน้า' };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
      <h1 className="text-lg font-semibold">ไม่พบหน้าที่ต้องการ</h1>
      <Link href="/" className="underline">
        กลับหน้าหลัก
      </Link>
    </main>
  );
}
