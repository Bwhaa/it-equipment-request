import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { ADMIN_LOGIN, EMPLOYEE1_LOGIN, EMPLOYEE2_LOGIN, loginToken } from './tokens';

export interface Tokens {
  admin: string;
  employee1: string;
  employee2: string;
}

export async function loginAll(app: INestApplication): Promise<Tokens> {
  return {
    admin: await loginToken(app, ADMIN_LOGIN),
    employee1: await loginToken(app, EMPLOYEE1_LOGIN),
    employee2: await loginToken(app, EMPLOYEE2_LOGIN),
  };
}

export const bearer = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` });

/** Direct update of stockQuantity ONLY (version is deliberately left alone). */
export async function setStock(prisma: PrismaClient, equipmentId: string, stockQuantity: number): Promise<void> {
  await prisma.equipment.update({ where: { id: equipmentId }, data: { stockQuantity } });
}

export async function createPending(
  app: INestApplication,
  token: string,
  equipmentId: string,
  quantity: number,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/requests')
    .set(bearer(token))
    .send({ equipmentId, quantity, reason: 'created by the e2e fixtures' });
  if (res.status !== 201) throw new Error(`createPending expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
  return (res.body as { id: string }).id;
}

export interface CallResult {
  status: number;
  body: Record<string, unknown>;
}

export async function approve(app: INestApplication, token: string, id: string): Promise<CallResult> {
  const res = await request(app.getHttpServer()).patch(`/api/v1/requests/${id}/approve`).set(bearer(token));
  return { status: res.status, body: res.body as Record<string, unknown> };
}

export async function reject(app: INestApplication, token: string, id: string, rejectReason: string): Promise<CallResult> {
  const res = await request(app.getHttpServer())
    .patch(`/api/v1/requests/${id}/reject`)
    .set(bearer(token))
    .send({ rejectReason });
  return { status: res.status, body: res.body as Record<string, unknown> };
}

export interface Snapshot {
  counts: { users: number; equipments: number; requests: number; auditLogs: number };
  equipments: { id: string; stockQuantity: number; version: number }[];
  requests: { id: string; status: string }[];
}

export async function snapshot(prisma: PrismaClient): Promise<Snapshot> {
  const [users, equipments, requests, auditLogs] = await Promise.all([
    prisma.user.count(),
    prisma.equipment.findMany({ select: { id: true, stockQuantity: true, version: true }, orderBy: { id: 'asc' } }),
    prisma.request.findMany({ select: { id: true, status: true }, orderBy: { id: 'asc' } }),
    prisma.auditLog.count(),
  ]);
  return {
    counts: { users, equipments: equipments.length, requests: requests.length, auditLogs },
    equipments,
    requests,
  };
}
