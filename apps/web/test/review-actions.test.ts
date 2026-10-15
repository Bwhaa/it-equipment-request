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

import { approveRequestAction, rejectRequestAction } from '@/app/(app)/admin/requests/[id]/actions';
import { initialReviewActionState } from '@/app/(app)/admin/requests/[id]/state';
import { ApiRequestError, makeApiError } from '@/lib/api-error';
import { REJECT_REASON_ERROR } from '@/lib/reject-form';

const ID = 'b0000000-0000-4000-8000-000000000009';
const DETAIL = `/admin/requests/${ID}`;
const NOT_FOUND = { ok: false, error: makeApiError(404, 'NOT_FOUND', 'Request not found') };

function form(fields: Record<string, unknown>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) data.set(key, value as string);
  }
  return data;
}
const approve = (fields: Record<string, unknown>) => approveRequestAction(initialReviewActionState, form(fields));
const reject = (fields: Record<string, unknown>) => rejectRequestAction(initialReviewActionState, form(fields));

const BAD_IDS: [string, unknown][] = [
  ['path traversal', '../equipments'],
  ['empty', ''],
  ['not a uuid', 'not-a-uuid'],
  ['file-like', new File(['x'], 'a.txt')],
  ['missing', null],
];

const API_ERRORS = [
  makeApiError(409, 'INVALID_STATUS', 'Request is not pending'),
  makeApiError(409, 'EQUIPMENT_INACTIVE', 'Equipment is inactive'),
  makeApiError(409, 'INSUFFICIENT_STOCK', 'Only 2 left'),
  makeApiError(404, 'NOT_FOUND', 'Request not found'),
];

beforeEach(() => {
  apiFetchMock.mockReset();
  redirectMock.mockClear();
  revalidatePathMock.mockClear();
});

describe('approveRequestAction', () => {
  it('PATCHes approve, revalidates detail + list, and redirects (the signal propagates)', async () => {
    apiFetchMock.mockResolvedValue({ id: ID });
    await expect(approve({ id: ID })).rejects.toMatchObject({ target: `${DETAIL}?done=approved` });

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(`/requests/${ID}/approve`, { method: 'PATCH' });
    expect(revalidatePathMock).toHaveBeenCalledWith(DETAIL);
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/requests');
    expect(redirectMock).toHaveBeenCalledWith(`${DETAIL}?done=approved`);
  });

  it.each(API_ERRORS.map((body) => [body.code, body] as const))('%s -> error result, both paths revalidated, no redirect', async (_code, body) => {
    apiFetchMock.mockRejectedValue(new ApiRequestError(body.statusCode, body));
    await expect(approve({ id: ID })).resolves.toEqual({ ok: false, error: body });
    expect(revalidatePathMock).toHaveBeenCalledTimes(2);
    expect(revalidatePathMock).toHaveBeenCalledWith(DETAIL);
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/requests');
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('403 FORBIDDEN -> error result, nothing revalidated', async () => {
    const body = makeApiError(403, 'FORBIDDEN', 'Forbidden resource');
    apiFetchMock.mockRejectedValue(new ApiRequestError(403, body));
    await expect(approve({ id: ID })).resolves.toEqual({ ok: false, error: body });
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it.each(BAD_IDS)('id: %s -> NOT_FOUND and the API is not called', async (_label, id) => {
    await expect(approve({ id })).resolves.toEqual(NOT_FOUND);
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('a redirect signal thrown by apiFetch propagates', async () => {
    const signal = new RedirectSignal('/api/auth/logout?expired=1');
    apiFetchMock.mockRejectedValue(signal);
    await expect(approve({ id: ID })).rejects.toBe(signal);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('a plain Error propagates', async () => {
    const boom = new Error('boom');
    apiFetchMock.mockRejectedValue(boom);
    await expect(approve({ id: ID })).rejects.toBe(boom);
  });
});

describe('rejectRequestAction', () => {
  it('sends EXACTLY { rejectReason: <trimmed> }, revalidates and redirects', async () => {
    apiFetchMock.mockResolvedValue({ id: ID });
    await expect(reject({ id: ID, reason: '  because  ' })).rejects.toMatchObject({ target: `${DETAIL}?done=rejected` });

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(`/requests/${ID}/reject`, { method: 'PATCH', body: { rejectReason: 'because' } });
    expect(revalidatePathMock).toHaveBeenCalledWith(DETAIL);
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/requests');
  });

  it.each([
    ['empty', ''],
    ['spaces', '    '],
    ['4 chars', 'abcd'],
    ['501 chars', 'a'.repeat(501)],
    ['missing', null],
  ])('reason %s -> field error, values kept, API not called', async (_label, reason) => {
    const result = await reject({ id: ID, reason });
    expect(result).toEqual({
      ok: false,
      fieldErrors: { reason: REJECT_REASON_ERROR },
      values: { reason: typeof reason === 'string' ? reason : '' },
    });
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('409 -> error result with the typed reason kept, both paths revalidated', async () => {
    const body = makeApiError(409, 'INVALID_STATUS', 'Request is not pending');
    apiFetchMock.mockRejectedValue(new ApiRequestError(409, body));
    await expect(reject({ id: ID, reason: ' too late ' })).resolves.toEqual({
      ok: false,
      error: body,
      values: { reason: ' too late ' },
    });
    expect(revalidatePathMock).toHaveBeenCalledTimes(2);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('403 -> error result, nothing revalidated', async () => {
    const body = makeApiError(403, 'FORBIDDEN', 'Forbidden resource');
    apiFetchMock.mockRejectedValue(new ApiRequestError(403, body));
    await expect(reject({ id: ID, reason: 'valid reason' })).resolves.toMatchObject({ ok: false, error: body });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it.each(BAD_IDS)('id: %s -> NOT_FOUND and the API is not called', async (_label, id) => {
    await expect(reject({ id, reason: 'valid reason' })).resolves.toEqual(NOT_FOUND);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('a redirect signal and a plain Error propagate', async () => {
    const signal = new RedirectSignal('/api/auth/logout?expired=1');
    apiFetchMock.mockRejectedValueOnce(signal);
    await expect(reject({ id: ID, reason: 'valid reason' })).rejects.toBe(signal);
    const boom = new Error('boom');
    apiFetchMock.mockRejectedValueOnce(boom);
    await expect(reject({ id: ID, reason: 'valid reason' })).rejects.toBe(boom);
  });
});
