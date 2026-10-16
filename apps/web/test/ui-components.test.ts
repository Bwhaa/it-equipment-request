import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from './support/render';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh }),
  usePathname: () => '/equipments/123/request',
}));

import { Alert } from '@/components/ui/alert';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { NavLink } from '@/components/ui/nav-link';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';

describe('Button and buttonClasses', () => {
  it('primary and secondary variants render a <button type="button"> by default', () => {
    const primary = render(createElement(Button, null, 'บันทึก'));
    const secondary = render(createElement(Button, { variant: 'secondary' }, 'ยกเลิก'));
    expect(primary).toContain('type="button"');
    expect(primary).toContain('bg-brand');
    expect(secondary).toContain('border border-ink');
    expect(primary).not.toContain('disabled');
    expect(primary).not.toContain('aria-disabled');
    expect([primary, secondary]).toMatchSnapshot();
  });

  it('a disabled button carries disabled AND aria-disabled="true" and the dimmed classes', () => {
    const html = render(createElement(Button, { disabled: true, type: 'submit' }, 'ส่งคำขอ'));
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('type="submit"');
    expect(html).toContain('cursor-not-allowed');
    expect(html).toMatchSnapshot();
  });

  it('buttonClasses only adds the disabled classes when asked', () => {
    expect(buttonClasses('primary')).not.toContain('cursor-not-allowed');
    expect(buttonClasses('primary', true)).toContain('cursor-not-allowed');
    expect(buttonClasses()).toBe(buttonClasses('primary'));
  });
});

describe('Badge and StatusBadge', () => {
  it('Badge renders its text with the tone classes', () => {
    const tones = (['neutral', 'warning', 'success', 'danger'] as const).map((tone) => render(createElement(Badge, { tone, children: tone })));
    expect(tones[1]).toContain('pending-text');
    expect(tones[2]).toContain('approved-text');
    expect(tones[3]).toContain('danger-text');
    expect(tones).toMatchSnapshot();
  });

  it.each([
    ['PENDING', 'รออนุมัติ'],
    ['APPROVED', 'อนุมัติแล้ว'],
    ['REJECTED', 'ปฏิเสธ'],
  ] as const)('StatusBadge %s shows the TEXT label (colour is never the only signal)', (status, label) => {
    const html = render(createElement(StatusBadge, { status }));
    expect(html).toContain(`>${label}<`);
    expect(html).toMatchSnapshot();
  });
});

describe('Alert', () => {
  it('error uses role="alert"; notice and warning use role="status"', () => {
    const error = render(createElement(Alert, { variant: 'error', title: 'ผิดพลาด' }));
    const notice = render(createElement(Alert, { variant: 'notice' }, 'สำเร็จ'));
    const warning = render(createElement(Alert, { variant: 'warning', title: 'เตือน' }));
    expect(error).toContain('role="alert"');
    expect(notice).toContain('role="status"');
    expect(warning).toContain('role="status"');
    expect(error).toContain('ผิดพลาด');
    expect([error, notice, warning]).toMatchSnapshot();
  });
});

describe('Skeleton', () => {
  it('is hidden from assistive technology and takes extra classes', () => {
    const html = render(createElement(Skeleton, { className: 'h-6 w-40' }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('h-6 w-40');
    expect(html).toMatchSnapshot();
  });
});

describe('EmptyState', () => {
  it('without an action renders only the title (and the description when given)', () => {
    const plain = render(createElement(EmptyState, { title: 'ยังไม่มีอุปกรณ์' }));
    const described = render(createElement(EmptyState, { title: 'ไม่พบ', description: 'ลองเปลี่ยนคำค้นหา' }));
    expect(plain).not.toContain('<a');
    expect(described).toContain('ลองเปลี่ยนคำค้นหา');
    expect([plain, described]).toMatchSnapshot();
  });

  it('with an action renders a link to the given href', () => {
    const html = render(createElement(EmptyState, { title: 'ว่าง', action: { href: '/equipments', label: 'ไปเลือกอุปกรณ์' } }));
    expect(html).toContain('href="/equipments"');
    expect(html).toContain('ไปเลือกอุปกรณ์');
    expect(html).toMatchSnapshot();
  });
});

describe('Pagination', () => {
  const props = { basePath: '/requests', params: { status: 'PENDING' } };

  it('renders NOTHING for a single page', () => {
    expect(render(createElement(Pagination, { ...props, page: 1, totalPages: 1 }))).toBe('');
    expect(render(createElement(Pagination, { ...props, page: 1, totalPages: 0 }))).toBe('');
  });

  it('first page: "previous" is a disabled span (not a link), "next" links to page 2 and keeps the filter', () => {
    const html = render(createElement(Pagination, { ...props, page: 1, totalPages: 3 }));
    expect(html).toMatch(/<span aria-disabled="true"[^>]*>ก่อนหน้า<\/span>/);
    expect(html).toContain('href="/requests?status=PENDING&amp;page=2"');
    expect(html).toContain('หน้า 1 จาก 3');
    expect(html).toMatchSnapshot();
  });

  it('middle page: both directions are links (page 1 drops the page parameter)', () => {
    const html = render(createElement(Pagination, { ...props, page: 2, totalPages: 3 }));
    expect(html).toContain('href="/requests?status=PENDING"');
    expect(html).toContain('href="/requests?status=PENDING&amp;page=3"');
    expect(html).toContain('rel="prev"');
    expect(html).toContain('rel="next"');
    expect(html).toMatchSnapshot();
  });

  it('last page: "next" is a disabled span (not a link)', () => {
    const html = render(createElement(Pagination, { ...props, page: 3, totalPages: 3 }));
    expect(html).toMatch(/<span aria-disabled="true"[^>]*>ถัดไป<\/span>/);
    expect(html).not.toContain('rel="next"');
    expect(html).toMatchSnapshot();
  });
});

describe('ErrorState', () => {
  it('shows the title, the message and a retry button inside role="alert"', () => {
    const html = render(createElement(ErrorState, { title: 'โหลดไม่ได้', message: 'ลองใหม่อีกครั้ง', reset: vi.fn() }));
    expect(html).toContain('role="alert"');
    expect(html).toContain('โหลดไม่ได้');
    expect(html).toContain('ลองใหม่อีกครั้ง');
    expect(html).toMatch(/<button[^>]*>ลองใหม่<\/button>/);
    expect(html).toMatchSnapshot();
  });

  it('has default texts', () => {
    expect(render(createElement(ErrorState, { reset: vi.fn() }))).toContain('เกิดข้อผิดพลาด');
  });
});

describe('NavLink', () => {
  it('is aria-current="page" when the path equals or is below the href, otherwise not', () => {
    const active = render(createElement(NavLink, { href: '/equipments', children: 'อุปกรณ์' }));
    const inactive = render(createElement(NavLink, { href: '/requests', children: 'คำขอของฉัน' }));
    expect(active).toContain('aria-current="page"');
    expect(active).toContain('bg-inverse');
    expect(inactive).not.toContain('aria-current');
    expect([active, inactive]).toMatchSnapshot();
  });
});
