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

import { createRequestAction } from '@/app/(app)/equipments/[id]/request/actions';
import { initialRequestFormState } from '@/app/(app)/equipments/[id]/request/state';
import { ApiRequestError, makeApiError } from '@/lib/api-error';
import { QUANTITY_ERROR, REASON_ERROR } from '@/lib/request-form';

const EQUIPMENT_ID = 'e0000000-0000-4000-8000-000000000002';
const REQUEST_ID = 'b0000000-0000-4000-8000-0000000000aa';

function form(fields: Record<string, unknown>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value as string);
  return data;
}
const run = (fields: Record<string, unknown>) => createRequestAction(initialRequestFormState, form(fields));

beforeEach(() => {
  apiFetchMock.mockReset();
  redirectMock.mockClear();
});

describe('createRequestAction', () => {
  it('posts exactly { equipmentId, quantity (number), reason (trimmed) } and redirects (the signal propagates)', async () => {
    apiFetchMock.mockResolvedValue({ id: REQUEST_ID });

    await expect(run({ equipmentId: EQUIPMENT_ID, quantity: ' 3 ', reason: '  need a screen  ' })).rejects.toMatchObject({
      target: `/requests/${REQUEST_ID}?created=1`,
    });

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith('/requests', {
      method: 'POST',
      body: { equipmentId: EQUIPMENT_ID, quantity: 3, reason: 'need a screen' },
    });
    expect(redirectMock).toHaveBeenCalledWith(`/requests/${REQUEST_ID}?created=1`);
  });

  it('invalid input -> field errors and the typed values, API not called', async () => {
    const result = await run({ equipmentId: EQUIPMENT_ID, quantity: '0', reason: 'abc' });
    expect(result).toEqual({
      ok: false,
      fieldErrors: { quantity: QUANTITY_ERROR, reason: REASON_ERROR },
      values: { quantity: '0', reason: 'abc' },
    });
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('a non-string field is treated as invalid (values become empty strings)', async () => {
    const data = new FormData();
    data.set('equipmentId', EQUIPMENT_ID);
    data.set('quantity', '1');
    data.set('reason', new File(['x'], 'a.txt'));
    const result = await createRequestAction(initialRequestFormState, data);
    expect(result).toMatchObject({ ok: false, fieldErrors: { reason: REASON_ERROR }, values: { quantity: '1', reason: '' } });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('a non-UUID equipmentId -> NOT_FOUND result and the API is not called', async () => {
    const result = await run({ equipmentId: 'not-a-uuid', quantity: '1', reason: 'need a screen' });
    expect(result).toEqual({
      ok: false,
      error: makeApiError(404, 'NOT_FOUND', 'Equipment not found'),
      values: { quantity: '1', reason: 'need a screen' },
    });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('a missing equipmentId is also NOT_FOUND', async () => {
    const result = await run({ quantity: '1', reason: 'need a screen' });
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('an API 422 becomes form state and nothing redirects', async () => {
    const body = makeApiError(422, 'EQUIPMENT_UNAVAILABLE', 'Only 5 left');
    apiFetchMock.mockRejectedValue(new ApiRequestError(422, body));

    const result = await run({ equipmentId: EQUIPMENT_ID, quantity: '6', reason: 'need a screen' });
    expect(result).toEqual({ ok: false, error: body, values: { quantity: '6', reason: 'need a screen' } });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('a redirect signal thrown by apiFetch (no cookie / 401) propagates untouched', async () => {
    const signal = new RedirectSignal('/api/auth/logout?expired=1');
    apiFetchMock.mockRejectedValue(signal);
    await expect(run({ equipmentId: EQUIPMENT_ID, quantity: '1', reason: 'need a screen' })).rejects.toBe(signal);
  });

  it('an unexpected error propagates (it is not converted into form state)', async () => {
    const boom = new Error('boom');
    apiFetchMock.mockRejectedValue(boom);
    await expect(run({ equipmentId: EQUIPMENT_ID, quantity: '1', reason: 'need a screen' })).rejects.toBe(boom);
  });

  it('a quantity above any stock (99) is not rejected locally', async () => {
    apiFetchMock.mockResolvedValue({ id: REQUEST_ID });
    await expect(run({ equipmentId: EQUIPMENT_ID, quantity: '99', reason: 'need a lot of them' })).rejects.toBeInstanceOf(
      RedirectSignal,
    );
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  describe('idempotency key', () => {
    const KEY = '3f2b8c1e-5d6a-4f7b-9c8d-0123456789ab';
    const valid = { equipmentId: EQUIPMENT_ID, quantity: '1', reason: 'need a screen' };

    it('a valid UUID in the form is sent as the Idempotency-Key header', async () => {
      apiFetchMock.mockResolvedValue({ id: REQUEST_ID });
      await expect(run({ ...valid, idempotencyKey: KEY })).rejects.toMatchObject({ target: `/requests/${REQUEST_ID}?created=1` });
      expect(apiFetchMock).toHaveBeenCalledWith('/requests', {
        method: 'POST',
        body: { equipmentId: EQUIPMENT_ID, quantity: 1, reason: 'need a screen' },
        headers: { 'Idempotency-Key': KEY },
      });
    });

    it.each([['missing', undefined], ['empty', ''], ['not a UUID', 'not-a-uuid'], ['padded', ` ${KEY} `]])(
      'a %s value sends no header and causes no local error',
      async (_name, value) => {
        apiFetchMock.mockResolvedValue({ id: REQUEST_ID });
        const fields = value === undefined ? valid : { ...valid, idempotencyKey: value };
        await expect(run(fields)).rejects.toMatchObject({ target: `/requests/${REQUEST_ID}?created=1` });
        expect(apiFetchMock).toHaveBeenCalledTimes(1);
        const options = apiFetchMock.mock.calls[0][1] as Record<string, unknown>;
        expect(options.headers).toBeUndefined();
      },
    );

    it('a non-string idempotencyKey field (a file) sends no header', async () => {
      apiFetchMock.mockResolvedValue({ id: REQUEST_ID });
      const data = form(valid);
      data.set('idempotencyKey', new File(['x'], 'a.txt'));
      await expect(createRequestAction(initialRequestFormState, data)).rejects.toBeInstanceOf(RedirectSignal);
      expect((apiFetchMock.mock.calls[0][1] as Record<string, unknown>).headers).toBeUndefined();
    });

    it('a replay (the API answers 200 with the original) redirects exactly like a creation', async () => {
      apiFetchMock.mockResolvedValue({ id: REQUEST_ID });
      await run({ ...valid, idempotencyKey: KEY }).catch(() => undefined);
      await expect(run({ ...valid, idempotencyKey: KEY })).rejects.toMatchObject({ target: `/requests/${REQUEST_ID}?created=1` });
      expect(redirectMock).toHaveBeenLastCalledWith(`/requests/${REQUEST_ID}?created=1`);
    });

    it('IDEMPOTENCY_KEY_REUSED becomes form state with the typed values', async () => {
      const body = makeApiError(422, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was already used with a different request');
      apiFetchMock.mockRejectedValue(new ApiRequestError(422, body));
      const result = await run({ ...valid, quantity: '2', idempotencyKey: KEY });
      expect(result).toEqual({ ok: false, error: body, values: { quantity: '2', reason: 'need a screen' } });
      expect(redirectMock).not.toHaveBeenCalled();
    });
  });
});
