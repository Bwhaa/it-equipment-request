import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

class RedirectSignal extends Error {
  constructor(readonly target: string) {
    super(`redirect:${target}`);
  }
}

const cookieJar = { value: 'tok.en.value' as string | undefined };
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'access_token' && cookieJar.value !== undefined ? { name, value: cookieJar.value } : undefined),
  }),
}));
const redirectMock = vi.fn((target: string): never => {
  throw new RedirectSignal(target);
});
vi.mock('next/navigation', () => ({ redirect: (target: string) => redirectMock(target) }));

import { apiFetch } from '@/lib/api';
import { ApiRequestError } from '@/lib/api-error';

const fetchMock = vi.fn();

beforeEach(() => {
  process.env.API_URL = 'http://api.test/api/v1/';
  cookieJar.value = 'tok.en.value';
  fetchMock.mockReset();
  redirectMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('apiFetch', () => {
  it('sends the bearer token and the query string (undefined values skipped) and returns the parsed JSON', async () => {
    fetchMock.mockResolvedValue(json(200, { data: [], meta: { page: 1 } }));
    const result = await apiFetch<{ data: unknown[] }>('/equipments', { query: { page: 2, search: undefined, category: 'Display' } });

    expect(result).toEqual({ data: [], meta: { page: 1 } });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit & { headers: Record<string, string> }];
    expect(String(url)).toBe('http://api.test/api/v1/equipments?page=2&category=Display');
    expect(init.headers.Authorization).toBe('Bearer tok.en.value');
    expect(init.method).toBe('GET');
    expect(init.cache).toBe('no-store');
  });

  it('sends a JSON body with a Content-Type when a body is given', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }));
    await apiFetch('/requests', { method: 'POST', body: { quantity: 1 } });
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit & { headers: Record<string, string> }];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ quantity: 1 }));
  });

  it('sends extra headers together with Authorization, and they can NOT override Authorization', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }));
    await apiFetch('/requests', {
      method: 'POST',
      body: { quantity: 1 },
      headers: { 'Idempotency-Key': 'k-1', Authorization: 'Bearer evil', authorization: 'Bearer evil2' },
    });
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit & { headers: Record<string, string> }];
    expect(init.headers['Idempotency-Key']).toBe('k-1');
    expect(init.headers.Authorization).toBe('Bearer tok.en.value');
    expect(Object.keys(init.headers).filter((name) => name.toLowerCase() === 'authorization')).toEqual(['Authorization']);
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('without the headers option only Authorization is sent (existing behaviour)', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }));
    await apiFetch('/equipments');
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit & { headers: Record<string, string> }];
    expect(init.headers).toEqual({ Authorization: 'Bearer tok.en.value' });
  });

  it('401 -> redirect to the logout Route Handler (nothing else escapes)', async () => {
    fetchMock.mockResolvedValue(json(401, { statusCode: 401, error: 'Unauthorized', message: 'Unauthorized', code: 'UNAUTHORIZED' }));
    await expect(apiFetch('/auth/me')).rejects.toMatchObject({ target: '/api/auth/logout?expired=1' });
    expect(redirectMock).toHaveBeenCalledWith('/api/auth/logout?expired=1');
  });

  it('404 with an ApiError body -> ApiRequestError with that status and body', async () => {
    const body = { statusCode: 404, error: 'Not Found', message: 'Equipment not found', code: 'NOT_FOUND' };
    fetchMock.mockResolvedValue(json(404, body));
    const error = await apiFetch('/equipments/x').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 404, body });
  });

  it('a non-JSON error body -> a synthetic ApiError with the same status', async () => {
    fetchMock.mockResolvedValue(new Response('<html>bad gateway</html>', { status: 502 }));
    const error = await apiFetch('/equipments').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).status).toBe(502);
    expect((error as ApiRequestError).body).toMatchObject({ statusCode: 502, code: 'INTERNAL_ERROR' });
  });

  it('a network failure -> ApiRequestError 503', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const error = await apiFetch('/equipments').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 503 });
    expect((error as ApiRequestError).body.code).toBe('INTERNAL_ERROR');
  });

  it('no cookie -> redirect to /login and fetch is never called', async () => {
    cookieJar.value = undefined;
    await expect(apiFetch('/equipments')).rejects.toMatchObject({ target: '/login' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
