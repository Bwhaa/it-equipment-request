import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

export interface Credentials {
  email: string;
  password: string;
}

export const ADMIN_LOGIN: Credentials = { email: 'admin@company.com', password: 'Admin@123' };
export const EMPLOYEE1_LOGIN: Credentials = { email: 'employee1@company.com', password: 'Employee@123' };
export const EMPLOYEE2_LOGIN: Credentials = { email: 'employee2@company.com', password: 'Employee@123' };

export function signToken(app: INestApplication, payload: object): Promise<string> {
  return app.get(JwtService).signAsync(payload);
}

export function signExpiredToken(app: INestApplication, payload: object): Promise<string> {
  return app.get(JwtService).signAsync(payload, { expiresIn: '-10s' });
}

export function signTokenWithWrongSecret(app: INestApplication, payload: object): Promise<string> {
  return app.get(JwtService).signAsync(payload, { secret: 'a-completely-different-secret-0123456789' });
}

const b64 = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');

export function unsignedToken(payload: object): string {
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.`;
}

export function decodePart(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
}

export function replacePayload(token: string, payload: object): string {
  const [header, , signature] = token.split('.');
  return `${header}.${b64(payload)}.${signature}`;
}

export async function loginToken(app: INestApplication, credentials: Credentials): Promise<string> {
  const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send(credentials).expect(200);
  return (res.body as { accessToken: string }).accessToken;
}
