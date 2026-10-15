import { Logger } from '@nestjs/common';
import request from 'supertest';
import { useTestApp } from './support/create-test-app';
import { assertTestDatabaseUrl } from './support/test-database';
import { TestController } from './support/test.controller';

const getCtx = useTestApp([TestController]);

const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

beforeEach(() => {
  warnSpy.mockClear();
  errorSpy.mockClear();
});

afterAll(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

const http = () => request(getCtx().app.getHttpServer());

describe('assertTestDatabaseUrl', () => {
  it('accepts a *_test database', () => {
    expect(assertTestDatabaseUrl('postgresql://app:app@localhost:5432/it_equipment_test')).toBe('it_equipment_test');
  });

  it.each([
    'postgresql://app:app@localhost:5432/it_equipment',
    'postgresql://app:app@localhost:5432/it_equipment_testing',
    'postgresql://app:app@localhost:5432/postgres',
    'postgresql://app:app@localhost:5432',
    'postgresql://app:app@localhost:5432/',
  ])('rejects %s', (url) => {
    expect(() => assertTestDatabaseUrl(url)).toThrow(/Refusing to run e2e/);
  });
});

describe('e2e environment', () => {
  it('uses a *_test database', () => {
    expect(process.env.DATABASE_URL).toMatch(/_test$/);
  });
});

describe('global error format and request id', () => {
  it('unknown route -> 404 NOT_FOUND with x-request-id', async () => {
    const res = await http().get('/api/v1/nope').expect(404);
    expect(res.body).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: expect.any(String),
      code: 'NOT_FOUND',
    });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('two requests get different request ids and a client-sent x-request-id is ignored', async () => {
    const a = await http().get('/api/v1/nope').set('x-request-id', 'client-chosen-id');
    const b = await http().get('/api/v1/nope');
    expect(a.headers['x-request-id']).not.toBe('client-chosen-id');
    expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id']);
  });

  it('coded ConflictException -> exact body', async () => {
    const res = await http().get('/api/v1/__test/conflict').expect(409);
    expect(res.body).toEqual({ statusCode: 409, error: 'Conflict', message: 'x', code: 'INVALID_STATUS' });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('409 without code keeps 409, falls back to VALIDATION_ERROR and warns', async () => {
    const res = await http().get('/api/v1/__test/conflict-nocode').expect(409);
    expect(res.body).toEqual({ statusCode: 409, error: 'Conflict', message: 'plain', code: 'VALIDATION_ERROR' });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('code/status mismatch keeps the status and warns', async () => {
    const res = await http().get('/api/v1/__test/mismatch').expect(404);
    expect(res.body).toEqual({ statusCode: 404, error: 'Not Found', message: 'y', code: 'INSUFFICIENT_STOCK' });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('unexpected error -> generic 500 with no leak, logged with the same request id', async () => {
    const res = await http().get('/api/v1/__test/boom').expect(500);
    expect(res.body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/boom|secret|stack/i);

    const requestId = res.headers['x-request-id'];
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = errorSpy.mock.calls[0].map(String).join(' ');
    expect(logged).toContain(requestId);
    expect(logged).toContain('GET /api/v1/__test/boom -> 500');
    expect(logged).toContain('boom secret detail');
  });
});

describe('validation', () => {
  it('valid body passes and strings are trimmed', async () => {
    const res = await http().post('/api/v1/__test/validate').send({ quantity: 3, reason: '  hello world  ' }).expect(201);
    expect(res.body).toEqual({ quantity: 3, reason: 'hello world' });
  });

  it('extra field -> 400 VALIDATION_ERROR with array message', async () => {
    const res = await http()
      .post('/api/v1/__test/validate')
      .send({ quantity: 3, reason: 'hello world', extra: 1 })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.error).toBe('Bad Request');
    expect(res.body.message).toEqual(expect.arrayContaining([expect.stringMatching(/property extra should not exist/)]));
  });

  it.each([0, -1, 1.5, 101])('quantity %p -> 400', async (quantity) => {
    const res = await http().post('/api/v1/__test/validate').send({ quantity, reason: 'hello world' }).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('whitespace-only reason -> 400', async () => {
    await http().post('/api/v1/__test/validate').send({ quantity: 1, reason: '     ' }).expect(400);
  });

  it('malformed JSON -> 400 VALIDATION_ERROR (not 500)', async () => {
    const res = await http()
      .post('/api/v1/__test/validate')
      .set('Content-Type', 'application/json')
      .send('{"quantity": ')
      .expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request', code: 'VALIDATION_ERROR' });
    expect(res.headers['x-request-id']).toBeDefined();
  });
});

describe('pagination query', () => {
  it('defaults to page 1 / limit 10 as numbers', async () => {
    const res = await http().get('/api/v1/__test/page').expect(200);
    expect(res.body).toMatchObject({ page: 1, limit: 10, types: { page: 'number', limit: 'number' } });
  });

  it('parses page and limit as numbers', async () => {
    const res = await http().get('/api/v1/__test/page?page=2&limit=50').expect(200);
    expect(res.body).toMatchObject({ page: 2, limit: 50, types: { page: 'number', limit: 'number' } });
  });

  it.each(['page=0', 'page=abc', 'page=1.5', 'limit=101', 'limit=0'])('%s -> 400', async (qs) => {
    const res = await http().get(`/api/v1/__test/page?${qs}`).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('trims search and rejects search over 100 characters', async () => {
    const ok = await http().get('/api/v1/__test/page?search=%20%20laptop%20%20').expect(200);
    expect(ok.body.search).toBe('laptop');
    await http().get(`/api/v1/__test/page?search=${'a'.repeat(101)}`).expect(400);
    await http().get(`/api/v1/__test/page?search=${'a'.repeat(100)}`).expect(200);
  });
});
