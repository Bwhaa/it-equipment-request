import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findFiles } from './support/discover';

const WEB = join(__dirname, '..');
const EXPECTED_TITLES: Record<string, string> = {
  'app/(auth)/login/page.tsx': 'เข้าสู่ระบบ',
  'app/(app)/equipments/page.tsx': 'รายการอุปกรณ์',
  'app/(app)/equipments/[id]/request/page.tsx': 'ขอเบิกอุปกรณ์',
  'app/(app)/requests/page.tsx': 'คำขอของฉัน',
  'app/(app)/requests/[id]/page.tsx': 'รายละเอียดคำขอ',
  'app/(app)/admin/requests/page.tsx': 'คำขอทั้งหมด',
  'app/(app)/admin/requests/[id]/page.tsx': 'ตรวจสอบคำขอ',
  'app/(app)/admin/equipments/page.tsx': 'จัดการอุปกรณ์',
  'app/(app)/admin/equipments/new/page.tsx': 'เพิ่มอุปกรณ์',
  'app/(app)/admin/equipments/[id]/edit/page.tsx': 'แก้ไขอุปกรณ์',
};
const TITLE = /export const metadata(?::\s*Metadata)?\s*=\s*\{\s*title:\s*'([^']+)'/;

const pages = findFiles('page.tsx')
  .map((file) => relative(WEB, file))
  .filter((file) => file !== 'app/page.tsx');

describe('page titles', () => {
  it('the root layout has a title template and a default', () => {
    const layout = readFileSync(join(WEB, 'app/layout.tsx'), 'utf8');
    expect(layout).toMatch(/default:\s*'ระบบเบิกอุปกรณ์ไอที'/);
    expect(layout).toMatch(/template:\s*'%s \| ระบบเบิกอุปกรณ์ไอที'/);
  });

  it('every page except app/page.tsx (a pure redirect) exports metadata with a non-empty string title', () => {
    expect(pages.length).toBeGreaterThanOrEqual(10);
    const missing = pages.filter((file) => !TITLE.test(readFileSync(join(WEB, file), 'utf8')));
    expect(missing).toEqual([]);
  });

  it.each(Object.entries(EXPECTED_TITLES))('%s has the title %j', (file, title) => {
    expect(TITLE.exec(readFileSync(join(WEB, file), 'utf8'))?.[1]).toBe(title);
  });

  it('the expected list covers every page', () => {
    expect([...pages].sort()).toEqual(Object.keys(EXPECTED_TITLES).sort());
  });

  it.each(['app/not-found.tsx', 'app/(app)/not-found.tsx'])('%s has the title "ไม่พบหน้า"', (file) => {
    expect(TITLE.exec(readFileSync(join(WEB, file), 'utf8'))?.[1]).toBe('ไม่พบหน้า');
  });

  it('no page is a client component (metadata only works in Server Components)', () => {
    const clientPages = pages.filter((file) => /^['"]use client['"]/.test(readFileSync(join(WEB, file), 'utf8')));
    expect(clientPages).toEqual([]);
  });
});
