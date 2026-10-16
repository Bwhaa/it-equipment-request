import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { makeApiError } from '@/lib/api-error';
import { render } from './support/render';

vi.mock('server-only', () => ({}));

const hook = vi.hoisted(() => ({ state: undefined as unknown }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useActionState: (_action: unknown, initial: unknown) => [hook.state ?? initial, () => undefined, false],
  };
});
vi.mock('@/app/(app)/equipments/[id]/request/actions', () => ({ createRequestAction: async () => undefined }));

import { RequestForm } from '@/app/(app)/equipments/[id]/request/request-form';

const KEY = '00000000-0000-4000-8000-000000000001';
const EQUIPMENT_ID = 'e0000000-0000-4000-8000-000000000002';
const hidden = `<input type="hidden" name="idempotencyKey" value="${KEY}"`;

describe('RequestForm idempotency key', () => {
  it('renders the key from the prop as a hidden field in the initial state', () => {
    hook.state = undefined;
    const html = render(createElement(RequestForm, { equipmentId: EQUIPMENT_ID, stockQuantity: 5, idempotencyKey: KEY }));
    expect(html).toContain(hidden);
  });

  it('keeps the SAME key after a failed submit (API error state)', () => {
    hook.state = {
      ok: false,
      error: makeApiError(422, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was already used with a different request'),
      values: { quantity: '2', reason: 'need a screen' },
    };
    const html = render(createElement(RequestForm, { equipmentId: EQUIPMENT_ID, stockQuantity: 5, idempotencyKey: KEY }));
    expect(html).toContain(hidden);
    expect(html).toContain('คีย์ป้องกันการส่งซ้ำถูกใช้กับข้อมูลที่ต่างกัน');
    expect(html).toContain('Idempotency key was already used with a different request');
  });

  it('keeps the SAME key with field errors', () => {
    hook.state = { ok: false, fieldErrors: { quantity: 'x' }, values: { quantity: '0', reason: 'abc' } };
    const html = render(createElement(RequestForm, { equipmentId: EQUIPMENT_ID, stockQuantity: 5, idempotencyKey: KEY }));
    expect(html).toContain(hidden);
  });
});
