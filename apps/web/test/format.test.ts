import type { AuditLog, RequestStatus } from '@app/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { STATUS_LABEL, describeAuditEntry, formatDateTime } from '@/lib/format';

const originalTz = process.env.TZ;
afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe('formatDateTime', () => {
  const instant = '2026-10-15T00:30:00.000Z';

  it('renders Thai text with Gregorian years in Asia/Bangkok (UTC+7)', () => {
    const text = formatDateTime(instant);
    expect(text).toContain('2026');
    expect(text).toContain('15');
    expect(text).not.toContain('2569'); // Buddhist year
    expect(text).toMatch(/07[:.]30/);
  });

  it('does not depend on the process time zone', () => {
    process.env.TZ = 'America/Los_Angeles';
    const first = formatDateTime(instant);
    process.env.TZ = 'Asia/Tokyo';
    const second = formatDateTime(instant);
    expect(first).toBe(second);
  });

  it('moves to the next Bangkok day across midnight UTC+7', () => {
    expect(formatDateTime('2026-10-15T18:00:00.000Z')).toContain('16');
  });
});

describe('STATUS_LABEL', () => {
  it('covers every RequestStatus with a non-empty Thai label', () => {
    const statuses: RequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
    expect(Object.keys(STATUS_LABEL).sort()).toEqual([...statuses].sort());
    for (const status of statuses) expect(STATUS_LABEL[status].length).toBeGreaterThan(0);
  });
});

describe('describeAuditEntry', () => {
  const entry = (fromStatus: AuditLog['fromStatus'], toStatus: AuditLog['toStatus']): AuditLog => ({
    id: 'c0000000-0000-4000-8000-000000000001',
    fromStatus,
    toStatus,
    actor: { id: 'a0000000-0000-4000-8000-000000000001', name: 'Admin' },
    createdAt: '2026-10-15T00:00:00.000Z',
  });

  it.each([
    [null, 'PENDING', 'สร้างคำขอ'],
    ['PENDING', 'APPROVED', 'อนุมัติคำขอ'],
    ['PENDING', 'REJECTED', 'ปฏิเสธคำขอ'],
  ] as const)('%s -> %s = %s', (from, to, expected) => {
    expect(describeAuditEntry(entry(from, to))).toBe(expected);
  });

  it('falls back to "from → to" for any other pair', () => {
    expect(describeAuditEntry(entry('APPROVED', 'PENDING'))).toBe('APPROVED → PENDING');
    expect(describeAuditEntry(entry(null, 'APPROVED'))).toBe('- → APPROVED');
  });
});
