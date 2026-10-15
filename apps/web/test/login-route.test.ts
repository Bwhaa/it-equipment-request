import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/auth/login/route';

const API_URL = 'http://api.test/api/v1';
const TOKEN = 'header.payload.signature-token-value';
const USER = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'Admin',
  email: 'admin@company.com',
  role: 'ADMIN',
};
const API_401 = { statusCode: 401, error: 'Unauthorized', message: 'Invalid email or password', code: 'UNAUTHORIZED' };
const API_400 = { statusCode: 400, error: 'Bad Request', message: ['email must be an email'], code: 'VALIDATION_ERROR' };
const API_429 = {
  statusCode: 429,
  error: 'Too Many Requests',
  message: 'Too many failed login attempts. Try again later.',
  code: 'TOO_MANY_REQUESTS',
};

const fetchMock = vi.fn();
const saved = { api: process.env.API_URL, secure: process.env.COOKIE_SECURE };

beforeEach(() => {
  process.env.API_URL = API_URL;
  delete process.env.COOKIE_SECURE;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [name, value] of [
    ['API_URL', saved.api],
    ['COOKIE_SECURE', saved.secure],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function loginRequest(
  body: unknown,
  headers: Record<string, string> = {},
  contentType: string | null = 'application/json',
): Request {
  const allHeaders: Record<string, string> = { host: 'localhost:3000', ...headers };
  if (contentType !== null) allHeaders['content-type'] = contentType;
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: allHeaders,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const apiOk = () =>
  new Response(JSON.stringify({ accessToken: TOKEN, user: USER }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
const apiError = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const CREDENTIALS = { email: 'admin@company.com', password: 'Admin@123' };

describe('POST /api/auth/login', () => {
  it('success: body is exactly { user } and the token only lives in an httpOnly cookie', async () => {
    fetchMock.mockResolvedValue(apiOk());
    const response = await POST(loginRequest(CREDENTIALS));

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(Object.keys(JSON.parse(text) as object)).toEqual(['user']);
    expect(JSON.parse(text)).toEqual({ user: USER });
    expect(text).not.toContain('accessToken');
    expect(text).not.toContain(TOKEN);
    expect(response.headers.get('cache-control')).toBe('no-store');

    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`access_token=${TOKEN}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=3600/i);
    expect(cookie).not.toMatch(/Secure/i);
  });

  it('adds Secure to the cookie only when COOKIE_SECURE=true', async () => {
    process.env.COOKIE_SECURE = 'true';
    fetchMock.mockResolvedValue(apiOk());
    const response = await POST(loginRequest(CREDENTIALS));
    expect(response.headers.get('set-cookie') ?? '').toMatch(/Secure/i);
  });

  it('calls the API with exactly { email, password } and forwards no client credentials', async () => {
    fetchMock.mockResolvedValue(apiOk());
    await POST(
      loginRequest(
        { ...CREDENTIALS, role: 'ADMIN', extra: 1 },
        { cookie: 'access_token=stolen', authorization: 'Bearer stolen', 'x-custom': 'nope' },
      ),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe(`${API_URL}/auth/login`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(CREDENTIALS);
    const headerNames = Object.keys(init.headers).map((name) => name.toLowerCase());
    expect(headerNames).not.toContain('cookie');
    expect(headerNames).not.toContain('authorization');
    expect(headerNames).not.toContain('x-custom');
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ['present', '203.0.113.7', '203.0.113.7'],
    ['missing', undefined, undefined],
    ['blank', '   ', undefined],
  ])('X-Forwarded-For %s', async (_label, incoming, expected) => {
    fetchMock.mockResolvedValue(apiOk());
    await POST(loginRequest(CREDENTIALS, incoming === undefined ? {} : { 'x-forwarded-for': incoming }));
    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers['X-Forwarded-For']).toBe(expected);
  });

  it.each([
    [401, API_401],
    [400, API_400],
  ])('API %i is passed through with the same body and no cookie', async (status, body) => {
    fetchMock.mockResolvedValue(apiError(status, body));
    const response = await POST(loginRequest(CREDENTIALS));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(body);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('API 429 keeps the body and the Retry-After header', async () => {
    fetchMock.mockResolvedValue(apiError(429, API_429, { 'retry-after': '120' }));
    const response = await POST(loginRequest(CREDENTIALS));
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('120');
    expect(await response.json()).toEqual(API_429);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('an unreachable API -> 502 INTERNAL_ERROR and no cookie', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const response = await POST(loginRequest(CREDENTIALS));
    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe('INTERNAL_ERROR');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it.each([
    ['no accessToken', { user: USER }],
    ['bad role', { accessToken: TOKEN, user: { ...USER, role: 'ROOT' } }],
    ['not an object', 'ok'],
  ])('an OK API answer with the wrong shape (%s) -> 502 and no cookie', async (_label, body) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    const response = await POST(loginRequest(CREDENTIALS));
    expect(response.status).toBe(502);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('a non-ApiError failure from the API -> 502', async () => {
    fetchMock.mockResolvedValue(new Response('<html>oops</html>', { status: 500 }));
    const response = await POST(loginRequest(CREDENTIALS));
    expect(response.status).toBe(502);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it.each([
    ['invalid JSON', '{not json'],
    ['array body', '[]'],
    ['missing password', JSON.stringify({ email: 'a@b.co' })],
    ['non-string email', JSON.stringify({ email: 1, password: 'secret1' })],
  ])('%s -> 400 VALIDATION_ERROR and the API is not called', async (_label, body) => {
    const response = await POST(loginRequest(body));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('VALIDATION_ERROR');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Content-Type text/plain -> 415', async () => {
    const response = await POST(loginRequest(JSON.stringify(CREDENTIALS), {}, 'text/plain'));
    expect(response.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('an Origin from another host -> 403 and the API is not called', async () => {
    const response = await POST(loginRequest(CREDENTIALS, { origin: 'http://evil.example' }));
    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a same-origin Origin is accepted', async () => {
    fetchMock.mockResolvedValue(apiOk());
    const response = await POST(loginRequest(CREDENTIALS, { origin: 'http://localhost:3000' }));
    expect(response.status).toBe(200);
  });
});
