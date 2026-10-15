import { PasswordService } from '../src/auth/password.service';
import { USER_IDS } from '../prisma/seed-data';
import request from 'supertest';
import { createTestApp, useTestApp } from './support/create-test-app';
import { AuthTestController } from './support/auth-test.controller';
import {
  ADMIN_LOGIN,
  decodePart,
  EMPLOYEE1_LOGIN,
  loginToken,
  replacePayload,
  signExpiredToken,
  signToken,
  signTokenWithWrongSecret,
  unsignedToken,
} from './support/tokens';

const getCtx = useTestApp([AuthTestController]);
const http = () => request(getCtx().app.getHttpServer());
const app = () => getCtx().app;

const UNAUTHORIZED_BODY = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'Unauthorized',
  code: 'UNAUTHORIZED',
};

describe('POST /auth/login', () => {
  it('admin login -> 200 with exactly { accessToken, user }', async () => {
    const res = await http().post('/api/v1/auth/login').send(ADMIN_LOGIN).expect(200);
    expect(Object.keys(res.body).sort()).toEqual(['accessToken', 'user']);
    expect(Object.keys(res.body.user).sort()).toEqual(['email', 'id', 'name', 'role']);
    expect(res.body.user).toEqual({
      id: USER_IDS.admin,
      name: 'Admin',
      email: 'admin@company.com',
      role: 'ADMIN',
    });
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('passwordHash');
    expect(text).not.toContain('$2');

    const parts = (res.body.accessToken as string).split('.');
    expect(parts).toHaveLength(3);
    expect(decodePart(parts[0]).alg).toBe('HS256');
    const payload = decodePart(parts[1]);
    expect(payload.sub).toBe(USER_IDS.admin);
    expect(payload.role).toBe('ADMIN');
    expect(Number(payload.exp) - Number(payload.iat)).toBe(3600);
  });

  it('employee1 login -> 200 with role EMPLOYEE', async () => {
    const res = await http().post('/api/v1/auth/login').send(EMPLOYEE1_LOGIN).expect(200);
    expect(res.body.user).toMatchObject({ id: USER_IDS.employee1, role: 'EMPLOYEE' });
  });

  it.each([
    ['wrong password', { email: 'admin@company.com', password: 'Wrong@123' }],
    ['unknown email', { email: 'nobody@company.com', password: 'Admin@123' }],
  ])('%s -> identical 401 and exactly one bcrypt compare', async (_label, body) => {
    const compareSpy = jest.spyOn(app().get(PasswordService), 'compare');
    const res = await http().post('/api/v1/auth/login').send(body).expect(401);
    expect(res.body).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid email or password',
      code: 'UNAUTHORIZED',
    });
    expect(compareSpy).toHaveBeenCalledTimes(1);
    compareSpy.mockRestore();
  });

  it.each([
    ['missing email', { password: 'Admin@123' }],
    ['malformed email', { email: 'not-an-email', password: 'Admin@123' }],
    ['5-char password', { email: 'admin@company.com', password: '12345' }],
    ['non-string password', { email: 'admin@company.com', password: 123456 }],
    ['extra field', { ...ADMIN_LOGIN, extra: true }],
  ])('%s -> 400 VALIDATION_ERROR', async (_label, body) => {
    const res = await http().post('/api/v1/auth/login').send(body).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('works without an Authorization header (public)', async () => {
    await http().post('/api/v1/auth/login').send(ADMIN_LOGIN).expect(200);
  });
});

describe('GET /auth/me', () => {
  it.each([
    ['no header', undefined],
    ['Basic scheme', 'Basic xxx'],
    ['Bearer without token', 'Bearer'],
    ['garbage token', 'Bearer garbage'],
  ])('%s -> 401 UNAUTHORIZED', async (_label, header) => {
    const req = http().get('/api/v1/auth/me');
    const res = await (header === undefined ? req : req.set('Authorization', header)).expect(401);
    expect(res.body).toEqual(UNAUTHORIZED_BODY);
  });

  it('payload tampered (role -> ADMIN, signature kept) -> 401', async () => {
    const token = await loginToken(app(), EMPLOYEE1_LOGIN);
    const tampered = replacePayload(token, { sub: USER_IDS.employee1, role: 'ADMIN' });
    await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${tampered}`).expect(401);
  });

  it('wrong secret -> 401', async () => {
    const token = await signTokenWithWrongSecret(app(), { sub: USER_IDS.admin, role: 'ADMIN' });
    await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  });

  it('unsigned alg:none token -> 401', async () => {
    const token = unsignedToken({ sub: USER_IDS.admin, role: 'ADMIN' });
    await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  });

  it('expired token -> 401', async () => {
    const token = await signExpiredToken(app(), { sub: USER_IDS.admin, role: 'ADMIN' });
    await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  });

  it('valid signature but role SUPERADMIN -> 401', async () => {
    const token = await signToken(app(), { sub: USER_IDS.admin, role: 'SUPERADMIN' });
    await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  });

  it('valid signature but non-UUID sub -> 401', async () => {
    const token = await signToken(app(), { sub: 'not-a-uuid', role: 'ADMIN' });
    await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  });

  it('valid signature and UUID sub that is not in the database -> 401', async () => {
    const token = await signToken(app(), { sub: 'a0000000-0000-4000-8000-0000000000ff', role: 'ADMIN' });
    const res = await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('valid employee token -> 200 with the seeded employee', async () => {
    const token = await loginToken(app(), EMPLOYEE1_LOGIN);
    const res = await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body).toEqual({
      id: USER_IDS.employee1,
      name: 'Employee One',
      email: 'employee1@company.com',
      role: 'EMPLOYEE',
    });
  });
});

describe('global guards', () => {
  it('no token on admin-only -> 401, not 403 (JwtAuthGuard runs first)', async () => {
    const res = await http().get('/api/v1/__test/admin-only').expect(401);
    expect(res.body).toEqual(UNAUTHORIZED_BODY);
  });

  it('employee token on admin-only -> 403 with the exact body', async () => {
    const token = await loginToken(app(), EMPLOYEE1_LOGIN);
    const res = await http().get('/api/v1/__test/admin-only').set('Authorization', `Bearer ${token}`).expect(403);
    expect(res.body).toEqual({ statusCode: 403, error: 'Forbidden', message: 'Forbidden', code: 'FORBIDDEN' });
  });

  it('role matrix', async () => {
    const admin = await loginToken(app(), ADMIN_LOGIN);
    const employee = await loginToken(app(), EMPLOYEE1_LOGIN);
    await http().get('/api/v1/__test/admin-only').set('Authorization', `Bearer ${admin}`).expect(200);
    await http().get('/api/v1/__test/employee-only').set('Authorization', `Bearer ${admin}`).expect(403);
    await http().get('/api/v1/__test/employee-only').set('Authorization', `Bearer ${employee}`).expect(200);
  });

  it('route with no decorators is protected (default deny) and open to any valid token', async () => {
    await http().get('/api/v1/__test/any').expect(401);
    const employee = await loginToken(app(), EMPLOYEE1_LOGIN);
    await http().get('/api/v1/__test/any').set('Authorization', `Bearer ${employee}`).expect(200);
  });

  it('@Public() route needs no token', async () => {
    await http().get('/api/v1/__test/public').expect(200);
  });

  it('@CurrentUser() returns the token owner', async () => {
    const token = await loginToken(app(), EMPLOYEE1_LOGIN);
    const res = await http().get('/api/v1/__test/who').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body).toEqual({ id: USER_IDS.employee1, role: 'EMPLOYEE' });
  });
});

describe('boot refusal', () => {
  const saved = { secret: process.env.JWT_SECRET, expires: process.env.JWT_EXPIRES_IN };

  afterEach(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore('JWT_SECRET', saved.secret);
    restore('JWT_EXPIRES_IN', saved.expires);
  });

  it('31-character JWT_SECRET -> rejects mentioning JWT_SECRET', async () => {
    process.env.JWT_SECRET = 's'.repeat(31);
    await expect(createTestApp()).rejects.toThrow(/JWT_SECRET/);
  });

  it('32-character JWT_SECRET -> boots', async () => {
    process.env.JWT_SECRET = 's'.repeat(32);
    const booted = await createTestApp();
    await booted.app.close();
  });

  it('unset JWT_SECRET -> rejects', async () => {
    delete process.env.JWT_SECRET;
    await expect(createTestApp()).rejects.toThrow(/JWT_SECRET/);
  });

  it('JWT_EXPIRES_IN "abc" -> rejects mentioning JWT_EXPIRES_IN', async () => {
    process.env.JWT_EXPIRES_IN = 'abc';
    await expect(createTestApp()).rejects.toThrow(/JWT_EXPIRES_IN/);
  });
});
