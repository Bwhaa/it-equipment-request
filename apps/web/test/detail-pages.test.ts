import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APPROVED_DETAIL, IDS, REJECTED_DETAIL, makeDetail, makeEquipment } from './support/data';
import { anchors, render, visibleText } from './support/render';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));

import AdminRequestDetailPage from '@/app/(app)/admin/requests/[id]/page';
import { ReviewPanel } from '@/app/(app)/admin/requests/[id]/review-panel';
import { EquipmentForm } from '@/app/(app)/admin/equipments/equipment-form';
import EditEquipmentPage from '@/app/(app)/admin/equipments/[id]/edit/page';
import NewEquipmentPage from '@/app/(app)/admin/equipments/new/page';
import { RequestForm } from '@/app/(app)/equipments/[id]/request/request-form';
import RequestEquipmentPage from '@/app/(app)/equipments/[id]/request/page';
import RequestDetailPage from '@/app/(app)/requests/[id]/page';
import { LoginForm } from '@/app/(auth)/login/login-form';
import { apiFetch } from '@/lib/api';
import { ApiRequestError, makeApiError } from '@/lib/api-error';

const mockedFetch = vi.mocked(apiFetch);
const returns = (value: unknown) => mockedFetch.mockImplementation((async () => value) as typeof apiFetch);
const params = (id: string) => ({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });
const notFound404 = () => new ApiRequestError(404, makeApiError(404, 'NOT_FOUND', 'x'));

// A block body: vitest treats a function RETURNED by beforeEach as a teardown callback (mockReset returns the mock).
beforeEach(() => {
  mockedFetch.mockReset();
});
/** The rejection is created when apiFetch is CALLED, never earlier. */
const failWith = (error: Error) => mockedFetch.mockImplementation((() => Promise.reject(error)) as typeof apiFetch);

describe('request detail (employee)', () => {
  it('APPROVED with two audit entries in order', async () => {
    returns(APPROVED_DETAIL);
    const html = render(await RequestDetailPage(params(IDS.request)));
    const text = visibleText(html);
    expect(html).toContain('>อนุมัติแล้ว<');
    expect(text).toContain('ผู้พิจารณา: Admin');
    expect(text.indexOf('สร้างคำขอ')).toBeGreaterThan(-1);
    expect(text.indexOf('สร้างคำขอ')).toBeLessThan(text.indexOf('อนุมัติคำขอ'));
    expect(html.match(/<li class="text-sm">/g)).toHaveLength(2);
    expect(html).not.toContain('เหตุผลที่ปฏิเสธ');
    expect(html).toMatchSnapshot();
  });

  it('REJECTED shows the reject reason', async () => {
    returns(REJECTED_DETAIL);
    const html = render(await RequestDetailPage(params(IDS.request)));
    expect(html).toContain('>ปฏิเสธ<');
    expect(visibleText(html)).toContain('เหตุผลที่ปฏิเสธ งบประมาณไตรมาสนี้ไม่เพียงพอ');
    expect(html).toMatchSnapshot();
  });

  it('PENDING has one audit entry and no reviewer', async () => {
    returns(makeDetail());
    const html = render(await RequestDetailPage({ params: Promise.resolve({ id: IDS.request }), searchParams: Promise.resolve({ created: '1' }) }));
    expect(html).toContain('>รออนุมัติ<');
    expect(visibleText(html)).toContain('ส่งคำขอเรียบร้อยแล้ว');
    expect(visibleText(html)).not.toContain('ผู้พิจารณา');
    expect(html).toMatchSnapshot();
  });

  it('a malformed id and an API 404 both end in notFound()', async () => {
    await expect(RequestDetailPage(params('not-a-uuid'))).rejects.toThrow('NEXT_NOT_FOUND');
    failWith(notFound404());
    await expect(RequestDetailPage(params(IDS.request))).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('any other API failure propagates (the segment error.tsx takes over)', async () => {
    failWith(new ApiRequestError(503, makeApiError(503, 'INTERNAL_ERROR', 'x')));
    await expect(RequestDetailPage(params(IDS.request))).rejects.toBeInstanceOf(ApiRequestError);
  });
});

describe('admin request detail', () => {
  const inactive = makeDetail({ equipment: { id: IDS.equipment, name: 'Projector', category: 'Display', stockQuantity: 3, status: 'INACTIVE' } });
  const overStock = makeDetail({ quantity: 8, equipment: { id: IDS.equipment, name: 'Monitor 27-inch', category: 'Display', stockQuantity: 5, status: 'ACTIVE' } });

  it.each([
    ['equipment INACTIVE', inactive, 'อุปกรณ์นี้ถูกปิดใช้งาน'],
    ['quantity above the current stock (INSUFFICIENT_STOCK)', overStock, 'คงเหลือ 5 ชิ้น น้อยกว่าจำนวนที่ขอ (8 ชิ้น)'],
  ])('PENDING with a block (%s): warning shown, approve disabled with aria-disabled, reject still available', async (_label, detail, warning) => {
    returns(detail);
    const html = render(await AdminRequestDetailPage(params(IDS.request)));
    expect(visibleText(html)).toContain(warning);
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-disabled="true"[^>]*>อนุมัติ<\/button>/);
    expect(html).toContain('<details');
    expect(html).toMatch(/<button[^>]*>ยืนยันการปฏิเสธ<\/button>/);
    expect(visibleText(html)).toContain('คงเหลือปัจจุบัน');
    expect(html).toMatchSnapshot();
  });

  it('PENDING without a block: approve is enabled', async () => {
    returns(makeDetail());
    const html = render(await AdminRequestDetailPage(params(IDS.request)));
    const approve = /<button[^>]*>อนุมัติ<\/button>/.exec(html)?.[0] ?? '';
    expect(approve).not.toBe('');
    expect(approve).not.toContain('disabled');
    expect(approve).not.toContain('aria-disabled');
    expect(html).not.toContain('role="alert"');
    expect(html).toMatchSnapshot();
  });

  it('an already reviewed request has no forms, only the notice', async () => {
    returns(APPROVED_DETAIL);
    const html = render(await AdminRequestDetailPage({ params: Promise.resolve({ id: IDS.request }), searchParams: Promise.resolve({ done: 'approved' }) }));
    expect(visibleText(html)).toContain('คำขอนี้ได้รับการพิจารณาแล้ว');
    expect(visibleText(html)).toContain('อนุมัติคำขอเรียบร้อยแล้ว');
    expect(html).not.toContain('<form');
    expect(html).toMatchSnapshot();
  });

  it('ReviewPanel alone: the reject textarea is wired to its counter and limited to 500 characters', () => {
    const html = render(createElement(ReviewPanel, { id: IDS.request, block: null, reviewed: false }));
    expect(html).toContain('maxLength="500"');
    expect(html).toContain('aria-describedby="reason-count"');
    expect(html).toContain('id="reason-count"');
  });

  it('a malformed id ends in notFound()', async () => {
    await expect(AdminRequestDetailPage(params('nope'))).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('request page (employee) and request form', () => {
  it('in stock: back link, heading, remaining stock and the form', async () => {
    returns(makeEquipment({ stockQuantity: 10 }));
    const html = render(await RequestEquipmentPage({ params: Promise.resolve({ id: IDS.equipment }) }));
    expect(visibleText(html)).toContain('ขอเบิก: Monitor 24-inch');
    expect(visibleText(html)).toContain('คงเหลือ 10 ชิ้น');
    expect(anchors(html)).toContainEqual(expect.objectContaining({ href: '/equipments' }));
    expect(html).toContain('<form');
    expect(html).toMatchSnapshot();
  });

  it('out of stock: a warning instead of the form', async () => {
    returns(makeEquipment({ stockQuantity: 0 }));
    const html = render(await RequestEquipmentPage({ params: Promise.resolve({ id: IDS.equipment }) }));
    expect(visibleText(html)).toContain('อุปกรณ์นี้หมดชั่วคราว ไม่สามารถขอเบิกได้');
    expect(html).not.toContain('<form');
  });

  it('the request form in its initial state: labelled fields, hint wiring, no errors, enabled submit', () => {
    const html = render(createElement(RequestForm, { equipmentId: IDS.equipment, stockQuantity: 10 }));
    expect(html).toMatch(/<label[^>]*for="quantity"/);
    expect(html).toMatch(/<label[^>]*for="reason"/);
    expect(html).toContain('aria-describedby="quantity-hint"');
    expect(html).toContain('aria-describedby="reason-count"');
    expect(html).not.toContain('aria-invalid');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>ส่งคำขอ<\/button>/);
    expect(html).toContain(`value="${IDS.equipment}"`);
    expect(html).toMatchSnapshot();
  });
});

describe('equipment forms', () => {
  it('create: empty form with the defaults and no hidden id/version', async () => {
    const html = render(await NewEquipmentPage());
    expect(visibleText(html)).toContain('เพิ่มอุปกรณ์');
    expect(html).not.toContain('name="version"');
    expect(html).toContain('value="0"');
    expect(html).toMatch(/<label[^>]*for="name"/);
    expect(html).toMatch(/<label[^>]*for="stockQuantity"/);
    expect(html).not.toContain('aria-invalid');
    expect(html).toMatchSnapshot();
  });

  it('edit: loaded values and the hidden id and version the Server Action sends back', async () => {
    returns(makeEquipment({ version: 4, stockQuantity: 7 }));
    const html = render(await EditEquipmentPage({ params: Promise.resolve({ id: IDS.equipment }) }));
    expect(html).toContain(`<input type="hidden" name="id" value="${IDS.equipment}"/>`);
    expect(html).toContain('<input type="hidden" name="version" value="4"/>');
    expect(visibleText(html)).toContain('เวอร์ชัน 4');
    expect(html).toContain('value="Monitor 24-inch"');
    expect(html).toMatchSnapshot();
  });

  it('EquipmentForm in create mode renders without props other than the mode', () => {
    expect(render(createElement(EquipmentForm, { mode: 'create' }))).toContain('บันทึก');
  });
});

describe('login form (initial state)', () => {
  it('has no banner and no errors, labelled fields and an enabled submit', () => {
    const html = render(createElement(LoginForm));
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('aria-invalid');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>เข้าสู่ระบบ<\/button>/);
    expect(html).toMatchSnapshot();
  });
});
