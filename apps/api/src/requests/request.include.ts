import type { Prisma } from '@prisma/client';

export const requestInclude = {
  requester: { select: { id: true, name: true } },
  reviewer: { select: { id: true, name: true } },
  equipment: { select: { id: true, name: true, category: true, stockQuantity: true, status: true } },
} satisfies Prisma.RequestInclude;

export const requestDetailInclude = {
  ...requestInclude,
  auditLogs: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { actor: { select: { id: true, name: true } } },
  },
} satisfies Prisma.RequestInclude;

export type RequestWithRelations = Prisma.RequestGetPayload<{ include: typeof requestInclude }>;
export type RequestWithDetail = Prisma.RequestGetPayload<{ include: typeof requestDetailInclude }>;
