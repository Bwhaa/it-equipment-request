import type { Role } from '@app/shared';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anchors, render, visibleText } from './support/render';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
const path = vi.hoisted(() => ({ current: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => path.current }));

import AppLayout from '@/app/(app)/layout';
import { apiFetch } from '@/lib/api';

const mockedFetch = vi.mocked(apiFetch);

const USERS: Record<Role, { id: string; name: string; email: string; role: Role }> = {
  EMPLOYEE: { id: 'a0000000-0000-4000-8000-000000000002', name: 'Employee One', email: 'e1@company.com', role: 'EMPLOYEE' },
  ADMIN: { id: 'a0000000-0000-4000-8000-000000000001', name: 'Admin', email: 'a@company.com', role: 'ADMIN' },
};
const ITEMS: Record<Role, [string, string][]> = {
  EMPLOYEE: [['/equipments', 'อุปกรณ์'], ['/requests', 'คำขอของฉัน']],
  ADMIN: [['/admin/requests', 'คำขอทั้งหมด'], ['/admin/equipments', 'จัดการอุปกรณ์']],
};
const ACTIVE_PATH: Record<Role, string> = { EMPLOYEE: '/equipments/abc', ADMIN: '/admin/requests' };
const ROLE_LABEL: Record<Role, string> = { EMPLOYEE: 'พนักงาน', ADMIN: 'ผู้ดูแลระบบ' };

beforeEach(() => {
  mockedFetch.mockReset();
});

async function renderLayout(role: Role): Promise<string> {
  mockedFetch.mockImplementation((async () => USERS[role]) as typeof apiFetch);
  path.current = ACTIVE_PATH[role];
  return render(await AppLayout({ children: createElement('p', null, 'page content') }));
}

const navOf = (html: string): string => /<nav\b[^>]*aria-label="เมนูหลัก"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? '';

describe.each(['EMPLOYEE', 'ADMIN'] as const)('app layout (%s)', (role) => {
  it('has exactly one main navigation, with the role items and hrefs in order', async () => {
    const html = await renderLayout(role);
    expect(html.match(/aria-label="เมนูหลัก"/g)).toHaveLength(1);
    expect(html.match(/<nav\b/g)).toHaveLength(1);
    const links = anchors(navOf(html));
    expect(links.map((link) => [link.href, link.text])).toEqual(ITEMS[role]);
  });

  it('the single nav is a fixed bottom tab bar below md and sits in the header from md up', async () => {
    const nav = /<nav\b[^>]*>/.exec(await renderLayout(role))?.[0] ?? '';
    const classes = (/class="([^"]*)"/.exec(nav)?.[1] ?? '').split(/\s+/);
    for (const cls of ['fixed', 'inset-x-0', 'bottom-0', 'z-20', 'grid', 'grid-cols-2', 'border-t', 'bg-surface', 'md:static', 'md:flex']) {
      expect(classes).toContain(cls);
    }
    expect(nav).toContain('pb-[max(0.5rem,env(safe-area-inset-bottom))]');
  });

  it('marks the active item with aria-current="page" and only that one', async () => {
    const html = await renderLayout(role);
    const current = anchors(navOf(html)).filter((link) => link.attrs.includes('aria-current="page"'));
    expect(current.map((link) => link.href)).toEqual([ITEMS[role][0][0]]);
  });

  it('has an icon (aria-hidden, md:hidden) inside every nav item and none elsewhere in the nav', async () => {
    const nav = navOf(await renderLayout(role));
    expect(nav.match(/<svg\b/g)).toHaveLength(ITEMS[role].length);
    expect(nav.match(/<span aria-hidden="true" class="md:hidden"><svg/g)).toHaveLength(ITEMS[role].length);
  });

  it('keeps the logout form, the user name, the role label and the avatar initial', async () => {
    const html = await renderLayout(role);
    expect(html).toMatch(/<form[^>]*action="\/api\/auth\/logout"[^>]*method="post"|<form[^>]*method="post"[^>]*action="\/api\/auth\/logout"/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>ออกจากระบบ<\/button>/);
    const text = visibleText(html);
    expect(text).toContain(USERS[role].name);
    expect(text).toContain(ROLE_LABEL[role]);
    expect(html).toMatch(new RegExp(`<span aria-hidden="true" class="[^"]*rounded-full[^"]*">${USERS[role].name[0]}</span>`));
  });

  it('wraps the page in a main with bottom padding for the tab bar', async () => {
    const html = await renderLayout(role);
    expect(html).toMatch(/<main class="[^"]*pb-28[^"]*md:pb-12[^"]*"><p>page content<\/p><\/main>/);
  });

  it('matches the snapshot', async () => {
    expect(await renderLayout(role)).toMatchSnapshot();
  });
});
