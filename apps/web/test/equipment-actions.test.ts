import type { Equipment } from '@app/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

class RedirectSignal extends Error {
  readonly digest = 'NEXT_REDIRECT';
  constructor(readonly target: string) {
    super(`NEXT_REDIRECT:${target}`);
  }
}

const apiFetchMock = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...args: unknown[]) => apiFetchMock(...args) }));
const redirectMock = vi.fn((target: string): never => {
  throw new RedirectSignal(target);
});
vi.mock('next/navigation', () => ({ redirect: (target: string) => redirectMock(target) }));
const revalidatePathMock = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidatePathMock(path) }));

import { createEquipmentAction, updateEquipmentAction } from '@/app/(app)/admin/equipments/actions';
import { initialEquipmentFormState } from '@/app/(app)/admin/equipments/state';
import { ApiRequestError, makeApiError } from '@/lib/api-error';
import { STOCK_ERROR } from '@/lib/equipment-form';

const ID = 'e0000000-0000-4000-8000-000000000005';
const FIELDS = { name: '  Headset X  ', category: ' Audio ', stockQuantity: ' 12 ', status: 'ACTIVE' };
const RAW = { name: '  Headset X  ', category: ' Audio ', stockQuantity: ' 12 ', status: 'ACTIVE' };

function form(fields: Record<string, unknown>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) data.set(key, value as string);
  }
  return data;
}
const create = (fields: Record<string, unknown>) => createEquipmentAction(initialEquipmentFormState, form(fields));
const update = (fields: Record<string, unknown>) => updateEquipmentAction(initialEquipmentFormState, form(fields));
const latest: Equipment = {
  id: ID,
  name: 'Headset',
  category: 'Audio',
  stockQuantity: 12,
  status: 'ACTIVE',
  version: 4,
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-10-14T00:00:00.000Z',
};

beforeEach(() => {
  apiFetchMock.mockReset();
  redirectMock.mockClear();
  revalidatePathMock.mockClear();
});

describe('createEquipmentAction', () => {
  it('POSTs EXACTLY { name, category (trimmed), stockQuantity (number), status } and redirects', async () => {
    apiFetchMock.mockResolvedValue(latest);
    await expect(create(FIELDS)).rejects.toMatchObject({ target: '/admin/equipments?done=created' });

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith('/equipments', {
      method: 'POST',
      body: { name: 'Headset X', category: 'Audio', stockQuantity: 12, status: 'ACTIVE' },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/equipments');
  });

  it('invalid input -> field errors and the typed values, API not called', async () => {
    const result = await create({ ...FIELDS, stockQuantity: '1.5', name: '   ', status: 'BROKEN' });
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { name: expect.any(String), stockQuantity: STOCK_ERROR, status: expect.any(String) },
      values: { name: '   ', stockQuantity: '1.5', status: 'BROKEN' },
    });
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('an API 400 -> error result with the values kept, no redirect', async () => {
    const body = makeApiError(400, 'VALIDATION_ERROR', ['name must be shorter']);
    apiFetchMock.mockRejectedValue(new ApiRequestError(400, body));
    await expect(create(FIELDS)).resolves.toEqual({ ok: false, error: body, values: RAW });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('a redirect signal and a plain Error propagate', async () => {
    const signal = new RedirectSignal('/api/auth/logout?expired=1');
    apiFetchMock.mockRejectedValueOnce(signal);
    await expect(create(FIELDS)).rejects.toBe(signal);
    const boom = new Error('boom');
    apiFetchMock.mockRejectedValueOnce(boom);
    await expect(create(FIELDS)).rejects.toBe(boom);
  });
});

describe('updateEquipmentAction', () => {
  const fields = { ...FIELDS, id: ID, version: '3' };

  it('PATCHes EXACTLY { version (number), name, category, stockQuantity, status } and redirects', async () => {
    apiFetchMock.mockResolvedValue(latest);
    await expect(update(fields)).rejects.toMatchObject({ target: '/admin/equipments?done=updated' });

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(`/equipments/${ID}`, {
      method: 'PATCH',
      body: { version: 3, name: 'Headset X', category: 'Audio', stockQuantity: 12, status: 'ACTIVE' },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/equipments');
  });

  it.each([['../equipments'], [''], ['not-a-uuid'], [null]])('id %j -> NOT_FOUND, API not called', async (id) => {
    const result = await update({ ...fields, id });
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' }, values: RAW });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it.each([[null], [''], ['0'], ['abc'], ['1.5'], ['2147483648']])('version %j -> VALIDATION_ERROR, API not called', async (version) => {
    const result = await update({ ...fields, version });
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid version' }, values: RAW });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('invalid fields -> field errors, API not called', async () => {
    const result = await update({ ...fields, stockQuantity: '-1' });
    expect(result).toMatchObject({ ok: false, fieldErrors: { stockQuantity: STOCK_ERROR } });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('VERSION_CONFLICT -> refetches the item and returns latest + attempted, never retries', async () => {
    const conflict = makeApiError(409, 'VERSION_CONFLICT', 'Equipment was modified');
    apiFetchMock.mockRejectedValueOnce(new ApiRequestError(409, conflict)).mockResolvedValueOnce(latest);

    const result = await update(fields);

    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(apiFetchMock.mock.calls[0]?.[0]).toBe(`/equipments/${ID}`);
    expect(apiFetchMock.mock.calls[1]?.[0]).toBe(`/equipments/${ID}`);
    expect(apiFetchMock.mock.calls[1]?.[1]).toBeUndefined();
    expect(result).toEqual({ ok: false, error: conflict, values: RAW, conflict: { latest, attempted: RAW } });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('VERSION_CONFLICT with a failing refetch (404) -> that error, no conflict', async () => {
    const conflict = makeApiError(409, 'VERSION_CONFLICT', 'Equipment was modified');
    const notFound = makeApiError(404, 'NOT_FOUND', 'Equipment not found');
    apiFetchMock.mockRejectedValueOnce(new ApiRequestError(409, conflict)).mockRejectedValueOnce(new ApiRequestError(404, notFound));

    const result = await update(fields);
    expect(result).toEqual({ ok: false, error: notFound, values: RAW });
    expect(result).not.toHaveProperty('conflict');
  });

  it('a refetch failing with a non-API error propagates', async () => {
    const boom = new Error('boom');
    apiFetchMock
      .mockRejectedValueOnce(new ApiRequestError(409, makeApiError(409, 'VERSION_CONFLICT', 'x')))
      .mockRejectedValueOnce(boom);
    await expect(update(fields)).rejects.toBe(boom);
  });

  it.each([
    makeApiError(404, 'NOT_FOUND', 'Equipment not found'),
    makeApiError(400, 'VALIDATION_ERROR', ['version must not be less than 1']),
    makeApiError(403, 'FORBIDDEN', 'Forbidden resource'),
  ])('API $statusCode $code -> error result without conflict, no refetch', async (body) => {
    apiFetchMock.mockRejectedValue(new ApiRequestError(body.statusCode, body));
    const result = await update(fields);
    expect(result).toEqual({ ok: false, error: body, values: RAW });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it('a redirect signal and a plain Error propagate', async () => {
    const signal = new RedirectSignal('/api/auth/logout?expired=1');
    apiFetchMock.mockRejectedValueOnce(signal);
    await expect(update(fields)).rejects.toBe(signal);
    const boom = new Error('boom');
    apiFetchMock.mockRejectedValueOnce(boom);
    await expect(update(fields)).rejects.toBe(boom);
  });
});
