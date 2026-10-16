import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anchors, render, visibleText } from './support/render';
import { makeEquipment, makeRequest, paginated } from './support/data';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import AdminEquipmentsPage from '@/app/(app)/admin/equipments/page';
import AdminRequestsPage from '@/app/(app)/admin/requests/page';
import EquipmentsPage from '@/app/(app)/equipments/page';
import MyRequestsPage from '@/app/(app)/requests/page';
import { apiFetch } from '@/lib/api';
import { ApiRequestError, makeApiError } from '@/lib/api-error';

const mockedFetch = vi.mocked(apiFetch);

/** Answers apiFetch by path; an unexpected path fails the test loudly. */
function respond(routes: Record<string, unknown>): void {
  mockedFetch.mockImplementation((async (path: string) => {
    if (path in routes) return routes[path];
    throw new Error(`unexpected apiFetch ${path}`);
  }) as typeof apiFetch);
}

/** The rejection is created when apiFetch is CALLED, never earlier. */
const failWith = (error: Error) => mockedFetch.mockImplementation((() => Promise.reject(error)) as typeof apiFetch);
const api503 = () => new ApiRequestError(503, makeApiError(503, 'INTERNAL_ERROR', 'Cannot reach the API'));
const sp = (values: Record<string, string>) => Promise.resolve(values);

beforeEach(() => {
  mockedFetch.mockReset();
});

// ---------------------------------------------------------------- employee equipment list (cards)
describe('/equipments (employee)', () => {
  const items = [
    makeEquipment({ id: 'e0000000-0000-4000-8000-000000000001', name: 'Monitor 24-inch', stockQuantity: 10 }),
    makeEquipment({ id: 'e0000000-0000-4000-8000-000000000007', name: 'Webcam', category: 'Video', stockQuantity: 0 }),
  ];
  const categories = ['Display', 'Video'];

  it('(i) data: cards, filter controls with the URL values, pagination text', async () => {
    respond({ '/equipments': paginated(items, 12, 1, 6), '/equipments/categories': categories });
    const html = render(await EquipmentsPage({ searchParams: sp({ search: 'mon', category: 'Display' }) }));
    const text = visibleText(html);
    expect(text).toContain('Monitor 24-inch');
    expect(text).toContain('คงเหลือ 10 ชิ้น');
    expect(html).toContain('value="mon"');
    expect(html).toMatch(/<option value="Display" selected="">Display<\/option>/);
    expect(html).toContain('href="/equipments/e0000000-0000-4000-8000-000000000001/request"');
    expect(text).toContain('หน้า 1 จาก 2');
    expect(text).toContain('ล้างตัวกรอง');
    expect(html).toMatchSnapshot();
  });

  it('(v) an out-of-stock card shows the TEXT "หมด" and a disabled control that is not a link', async () => {
    respond({ '/equipments': paginated(items, 2, 1, 6), '/equipments/categories': categories });
    const html = render(await EquipmentsPage({ searchParams: sp({}) }));
    expect(visibleText(html)).toContain('หมด');
    expect(html).toMatch(/<button type="button" disabled="" aria-disabled="true"[^>]*>ขอเบิก<\/button>/);
    expect(html).not.toContain('e0000000-0000-4000-8000-000000000007/request');
  });

  it('(ii) empty without a filter', async () => {
    respond({ '/equipments': paginated([], 0, 1, 6), '/equipments/categories': [] });
    const html = render(await EquipmentsPage({ searchParams: sp({}) }));
    expect(visibleText(html)).toContain('ยังไม่มีอุปกรณ์ให้เบิก');
    expect(html).toMatchSnapshot();
  });

  it('(iii) empty with a filter: "ไม่พบ…" and a clear-filter link', async () => {
    respond({ '/equipments': paginated([], 0, 1, 6), '/equipments/categories': categories });
    const html = render(await EquipmentsPage({ searchParams: sp({ search: 'zzz' }) }));
    expect(visibleText(html)).toContain('ไม่พบอุปกรณ์ที่ตรงกับการค้นหา');
    expect(anchors(html)).toContainEqual(expect.objectContaining({ href: '/equipments', text: 'ล้างตัวกรอง' }));
    expect(html).toMatchSnapshot();
  });

  it('(iv) beyond the last page: "ไม่มีรายการในหน้านี้" with a link back to page 1', async () => {
    respond({ '/equipments': paginated([], 12, 9, 6), '/equipments/categories': categories });
    const html = render(await EquipmentsPage({ searchParams: sp({ page: '9', search: 'mon' }) }));
    expect(visibleText(html)).toContain('ไม่มีรายการในหน้านี้');
    expect(html).toContain('href="/equipments?search=mon"');
    expect(html).toMatchSnapshot();
  });

  it('(vii) an API failure makes the page REJECT (the segment error.tsx takes over)', async () => {
    failWith(api503());
    await expect(EquipmentsPage({ searchParams: sp({}) })).rejects.toBeInstanceOf(ApiRequestError);
  });
});

// ---------------------------------------------------------------- my requests (table)
describe('/requests (employee)', () => {
  const rows = [
    makeRequest({ id: 'b0000000-0000-4000-8000-000000000001', status: 'PENDING' }),
    makeRequest({ id: 'b0000000-0000-4000-8000-000000000002', status: 'APPROVED' }),
    makeRequest({ id: 'b0000000-0000-4000-8000-000000000003', status: 'REJECTED' }),
  ];

  it('(i)(v)(vi) data: rows, active tab, badges with text, caption and scoped headers, pagination', async () => {
    respond({ '/requests/me': paginated(rows, 7, 1, 5) });
    const html = render(await MyRequestsPage({ searchParams: sp({ status: 'PENDING' }) }));
    const text = visibleText(html);
    expect(anchors(html)).toContainEqual(
      expect.objectContaining({ href: '/requests?status=PENDING', text: 'รออนุมัติ', attrs: expect.stringContaining('aria-current="page"') }),
    );
    expect(html).toContain('href="/requests/b0000000-0000-4000-8000-000000000002"');
    for (const label of ['รออนุมัติ', 'อนุมัติแล้ว', 'ปฏิเสธ']) expect(html).toContain(`>${label}<`);
    expect(html).toContain('<caption class="sr-only">รายการคำขอเบิกของฉัน</caption>');
    expect(html.match(/<th scope="col"/g)).toHaveLength(5);
    expect(text).toContain('หน้า 1 จาก 2');
    expect(html).toMatchSnapshot();
  });

  it('(ii) empty without a filter, with a link to choose equipment', async () => {
    respond({ '/requests/me': paginated([], 0, 1, 5) });
    const html = render(await MyRequestsPage({ searchParams: sp({}) }));
    expect(visibleText(html)).toContain('คุณยังไม่มีคำขอเบิก');
    expect(html).toContain('href="/equipments"');
    expect(html).toMatchSnapshot();
  });

  it('(iii) empty with a status filter (this page has no clear link: the "ทั้งหมด" tab resets it)', async () => {
    respond({ '/requests/me': paginated([], 0, 1, 5) });
    const html = render(await MyRequestsPage({ searchParams: sp({ status: 'REJECTED' }) }));
    expect(visibleText(html)).toContain('ไม่มีคำขอในสถานะนี้');
    expect(html).toContain('href="/requests"');
    expect(html).toMatchSnapshot();
  });

  it('(iv) beyond the last page', async () => {
    respond({ '/requests/me': paginated([], 7, 9, 5) });
    const html = render(await MyRequestsPage({ searchParams: sp({ page: '9' }) }));
    expect(visibleText(html)).toContain('ไม่มีรายการในหน้านี้');
    expect(html).toContain('href="/requests"');
    expect(html).toMatchSnapshot();
  });

  it('(vii) an API failure makes the page REJECT', async () => {
    failWith(api503());
    await expect(MyRequestsPage({ searchParams: sp({}) })).rejects.toBeInstanceOf(ApiRequestError);
  });
});

// ---------------------------------------------------------------- admin requests (table)
describe('/admin/requests', () => {
  const rows = [
    makeRequest({ id: 'b0000000-0000-4000-8000-000000000009', status: 'PENDING' }),
    makeRequest({
      id: 'b0000000-0000-4000-8000-000000000015',
      status: 'PENDING',
      quantity: 8,
      equipment: { id: 'e0000000-0000-4000-8000-000000000002', name: 'Monitor 27-inch', category: 'Display', stockQuantity: 5, status: 'ACTIVE' },
    }),
    makeRequest({
      id: 'b0000000-0000-4000-8000-000000000014',
      status: 'PENDING',
      equipment: { id: 'e0000000-0000-4000-8000-000000000008', name: 'Projector', category: 'Display', stockQuantity: 3, status: 'INACTIVE' },
    }),
    makeRequest({ id: 'b0000000-0000-4000-8000-000000000001', status: 'APPROVED' }),
  ];

  it('(i)(v)(vi) data: rows, filters from the URL, block badges with text, caption and headers', async () => {
    respond({ '/requests': paginated(rows, 25, 1, 10) });
    const html = render(await AdminRequestsPage({ searchParams: sp({ status: 'PENDING', search: 'monitor', sort: 'createdAt:asc' }) }));
    const text = visibleText(html);
    expect(html).toContain('value="monitor"');
    expect(html).toMatch(/<option value="createdAt:asc" selected="">/);
    expect(html).toContain('<input type="hidden" name="status" value="PENDING"/>');
    expect(html).toMatch(/aria-current="page"[^>]*>รออนุมัติ<\/a>/);
    expect(html).toContain('>สต็อกไม่พอ<');
    expect(html).toContain('>อุปกรณ์ปิดใช้งาน<');
    expect(html).toContain('<caption class="sr-only">รายการคำขอเบิกทั้งหมด</caption>');
    expect(html.match(/<th scope="col"/g)).toHaveLength(6);
    expect(text).toContain('หน้า 1 จาก 3');
    expect(html).toContain('href="/admin/requests/b0000000-0000-4000-8000-000000000009"');
    expect(html).toMatchSnapshot();
  });

  it('(ii) empty without a filter', async () => {
    respond({ '/requests': paginated([], 0, 1, 10) });
    const html = render(await AdminRequestsPage({ searchParams: sp({}) }));
    expect(visibleText(html)).toContain('ยังไม่มีคำขอเบิก');
    expect(html).toMatchSnapshot();
  });

  it('(iii) empty with a filter: "ไม่พบ…" and a clear-filter link', async () => {
    respond({ '/requests': paginated([], 0, 1, 10) });
    const html = render(await AdminRequestsPage({ searchParams: sp({ search: 'zzz' }) }));
    expect(visibleText(html)).toContain('ไม่พบคำขอที่ตรงกับการค้นหา');
    expect(anchors(html)).toContainEqual(expect.objectContaining({ href: '/admin/requests', text: 'ล้างตัวกรอง' }));
    expect(html).toMatchSnapshot();
  });

  it('(iv) beyond the last page keeps the filters in the link to page 1', async () => {
    respond({ '/requests': paginated([], 25, 9, 10) });
    const html = render(await AdminRequestsPage({ searchParams: sp({ page: '9', status: 'APPROVED' }) }));
    expect(visibleText(html)).toContain('ไม่มีรายการในหน้านี้');
    expect(html).toContain('href="/admin/requests?status=APPROVED"');
    expect(html).toMatchSnapshot();
  });

  it('(vii) an API failure makes the page REJECT', async () => {
    failWith(api503());
    await expect(AdminRequestsPage({ searchParams: sp({}) })).rejects.toBeInstanceOf(ApiRequestError);
  });
});

// ---------------------------------------------------------------- admin equipments (table)
describe('/admin/equipments', () => {
  const rows = [
    makeEquipment({ id: 'e0000000-0000-4000-8000-000000000001', name: 'Monitor 24-inch', stockQuantity: 10 }),
    makeEquipment({ id: 'e0000000-0000-4000-8000-000000000007', name: 'Webcam', category: 'Video', stockQuantity: 0 }),
    makeEquipment({ id: 'e0000000-0000-4000-8000-000000000008', name: 'Projector', status: 'INACTIVE', stockQuantity: 3 }),
  ];
  const routes = (data: typeof rows, total: number, page = 1) => ({
    '/equipments': paginated(data, total, page, 10),
    '/equipments/categories': ['Display', 'Video'],
  });

  it('(i)(v)(vi) data: rows, filters from the URL, badges with text, caption and headers, done notice', async () => {
    respond(routes(rows, 25));
    const html = render(await AdminEquipmentsPage({ searchParams: sp({ search: 'mon', category: 'Video', status: 'INACTIVE', done: 'created' }) }));
    const text = visibleText(html);
    expect(html).toContain('value="mon"');
    expect(html).toMatch(/<option value="Video" selected="">Video<\/option>/);
    expect(html).toMatch(/<option value="INACTIVE" selected="">ปิดใช้งาน<\/option>/);
    expect(html).toContain('>หมด<');
    expect(html).toContain('>เปิดใช้งาน<');
    expect(html).toContain('>ปิดใช้งาน<');
    expect(html).toContain('<caption class="sr-only">รายการอุปกรณ์ทั้งหมด</caption>');
    expect(html.match(/<th scope="col"/g)).toHaveLength(5);
    expect(html).toContain('role="status"');
    expect(text).toContain('เพิ่มอุปกรณ์เรียบร้อยแล้ว');
    expect(text).toContain('หน้า 1 จาก 3');
    expect(html).toContain('href="/admin/equipments/e0000000-0000-4000-8000-000000000001/edit"');
    expect(html).toMatchSnapshot();
  });

  it('(ii) empty without a filter, with a link to add equipment', async () => {
    respond(routes([], 0));
    const html = render(await AdminEquipmentsPage({ searchParams: sp({}) }));
    expect(visibleText(html)).toContain('ยังไม่มีอุปกรณ์');
    expect(html).toContain('href="/admin/equipments/new"');
    expect(html).toMatchSnapshot();
  });

  it('(iii) empty with a filter: "ไม่พบ…" and a clear-filter link', async () => {
    respond(routes([], 0));
    const html = render(await AdminEquipmentsPage({ searchParams: sp({ category: 'Video' }) }));
    expect(visibleText(html)).toContain('ไม่พบอุปกรณ์ที่ตรงกับการค้นหา');
    expect(anchors(html)).toContainEqual(expect.objectContaining({ href: '/admin/equipments', text: 'ล้างตัวกรอง' }));
    expect(html).toMatchSnapshot();
  });

  it('(iv) beyond the last page', async () => {
    respond(routes([], 25, 9));
    const html = render(await AdminEquipmentsPage({ searchParams: sp({ page: '9', status: 'ACTIVE' }) }));
    expect(visibleText(html)).toContain('ไม่มีรายการในหน้านี้');
    expect(html).toContain('href="/admin/equipments?status=ACTIVE"');
    expect(html).toMatchSnapshot();
  });

  it('(vii) an API failure makes the page REJECT', async () => {
    failWith(api503());
    await expect(AdminEquipmentsPage({ searchParams: sp({}) })).rejects.toBeInstanceOf(ApiRequestError);
  });
});
