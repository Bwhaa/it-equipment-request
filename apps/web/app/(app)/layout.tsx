import type { UserSummary } from '@app/shared';
import { apiFetch } from '@/lib/api';

const ROLE_LABEL: Record<UserSummary['role'], string> = {
  EMPLOYEE: 'พนักงาน',
  ADMIN: 'ผู้ดูแลระบบ',
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await apiFetch<UserSummary>('/auth/me');

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-300 px-4 py-3 dark:border-neutral-700">
        <span className="font-semibold">ระบบเบิกอุปกรณ์ไอที</span>
        <div className="flex items-center gap-3 text-sm">
          <span>
            {me.name} ({ROLE_LABEL[me.role]})
          </span>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="rounded border border-neutral-400 px-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
