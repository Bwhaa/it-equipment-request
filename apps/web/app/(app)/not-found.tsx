import Link from 'next/link';

export default function AppNotFound() {
  return (
    <section className="py-12 text-center">
      <h1 className="text-lg font-semibold">ไม่พบหน้าที่ต้องการ</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">รายการนี้ไม่มีอยู่ หรือคุณไม่มีสิทธิ์เข้าถึง</p>
      {/* "/" is redirected by the middleware to the role's home page */}
      <Link href="/" className="mt-4 inline-block underline">
        กลับหน้าหลัก
      </Link>
    </section>
  );
}
