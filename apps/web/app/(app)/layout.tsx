import type { ReactNode } from 'react';
import type { Role, UserSummary } from '@app/shared';
import { apiFetch } from '@/lib/api';
import { BoxIcon, CheckIcon, ListIcon } from '@/components/nav-icons';
import { Button } from '@/components/ui/button';
import { NavLink } from '@/components/ui/nav-link';

const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: 'พนักงาน',
  ADMIN: 'ผู้ดูแลระบบ',
};

const NAV: Record<Role, { href: string; label: string; icon: ReactNode }[]> = {
  EMPLOYEE: [
    { href: '/equipments', label: 'อุปกรณ์', icon: <BoxIcon /> },
    { href: '/requests', label: 'คำขอของฉัน', icon: <ListIcon /> },
  ],
  ADMIN: [
    { href: '/admin/requests', label: 'คำขอทั้งหมด', icon: <ListIcon /> },
    { href: '/admin/equipments', label: 'จัดการอุปกรณ์', icon: <BoxIcon /> },
  ],
};

const AVATAR: Record<Role, string> = {
  EMPLOYEE: 'bg-brand-tint text-approved-text',
  ADMIN: 'bg-inverse text-on-inverse',
};

// Literal class names so Tailwind sees them; every role currently has two items.
const GRID_COLS: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };

const initialOf = (name: string): string => (Array.from(name.trim())[0] ?? '?').toUpperCase();

export default async function AppLayout({ children }: { children: ReactNode }) {
  const me = await apiFetch<UserSummary>('/auth/me');
  const items = NAV[me.role];

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1120px] items-center gap-3 px-4 py-3 md:gap-4 md:px-8">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-[11px] bg-brand text-on-brand">
              <CheckIcon />
            </span>
            <span className="hidden font-bold sm:inline">ระบบเบิกอุปกรณ์ไอที</span>
          </div>
          <nav
            aria-label="เมนูหลัก"
            className={`fixed inset-x-0 bottom-0 z-20 grid ${GRID_COLS[items.length] ?? 'grid-cols-2'} gap-1 border-t border-line bg-surface p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:static md:z-auto md:flex md:flex-1 md:items-center md:gap-1 md:border-t-0 md:bg-transparent md:p-0 md:pb-0`}
          >
            {items.map((item) => (
              <NavLink key={item.href} href={item.href} icon={item.icon}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`hidden size-10 items-center justify-center rounded-full font-bold md:flex ${AVATAR[me.role]}`}
              >
                {initialOf(me.name)}
              </span>
              <div className="min-w-0 leading-tight">
                <p className="max-w-[9rem] truncate text-sm font-semibold md:max-w-none">{me.name}</p>
                <p className="hidden text-[13px] text-muted md:block">{ROLE_LABEL[me.role]}</p>
              </div>
            </div>
            <form action="/api/auth/logout" method="post">
              <Button type="submit" variant="secondary" size="sm">
                ออกจากระบบ
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1120px] px-4 py-6 pb-28 md:px-8 md:py-10 md:pb-12">{children}</main>
    </div>
  );
}
