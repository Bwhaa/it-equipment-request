import request from 'supertest';
import { useTestApp } from './support/create-test-app';
import { ADMIN_LOGIN, EMPLOYEE1_LOGIN, loginToken } from './support/tokens';
import { TestController } from './support/test.controller';

const getCtx = useTestApp([TestController]);
const http = () => request(getCtx().app.getHttpServer());

let employeeToken = '';
beforeAll(async () => {
  employeeToken = await loginToken(getCtx().app, EMPLOYEE1_LOGIN);
});

const responses: [string, number, () => request.Test][] = [
  ['200 (list as employee)', 200, () => http().get('/api/v1/equipments').set('Authorization', `Bearer ${employeeToken}`)],
  ['401 (no token)', 401, () => http().get('/api/v1/equipments')],
  ['404 (unknown route)', 404, () => http().get('/api/v1/nope')],
  ['400 (invalid page)', 400, () => http().get('/api/v1/equipments?page=0').set('Authorization', `Bearer ${employeeToken}`)],
  ['500 (test controller boom)', 500, () => http().get('/api/v1/__test/boom')],
  ['200 (login, a POST)', 200, () => http().post('/api/v1/auth/login').send(ADMIN_LOGIN)],
];

describe('security headers on every kind of response', () => {
  it.each(responses)('%s', async (_label, status, call) => {
    const res = await call();
    expect(res.status).toBe(status);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers).not.toHaveProperty('x-powered-by');
  });
});
