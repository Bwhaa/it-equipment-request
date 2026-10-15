import type { Role, UserSummary } from '@app/shared';
import { apiFetch } from '@/lib/api';
import { NavLink } from '@/components/ui/nav-link';

const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: 'พนักงาน',
  ADMIN: 'ผู้ดูแลระบบ',
};

const NAV: Record<Role, { href: string; label: string }[]> = {
  EMPLOYEE: [
    { href: '/equipments', label: 'อุปกรณ์' },
    { href: '/requests', label: 'คำขอของฉัน' },
  ],
  ADMIN: [{ href: '/admin/requests', label: 'คำขอทั้งหมด' }],
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await apiFetch<UserSummary>('/auth/me');

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-neutral-300 px-4 py-3 dark:border-neutral-700">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-semibold">ระบบเบิกอุปกรณ์ไอที</span>
          <nav aria-label="เมนูหลัก" className="flex flex-wrap items-center gap-1">
            {NAV[me.role].map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
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
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
