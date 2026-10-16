import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'เข้าสู่ระบบ' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const expired = params.expired === '1';

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-300 p-6 shadow-sm dark:border-neutral-700">
        <h1 className="mb-1 text-xl font-semibold">ระบบเบิกอุปกรณ์ไอที</h1>
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">เข้าสู่ระบบเพื่อใช้งาน</p>
        {expired && (
          <p role="status" className="mb-4 rounded border border-amber-400 bg-amber-50 p-2 text-sm text-amber-900">
            เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
