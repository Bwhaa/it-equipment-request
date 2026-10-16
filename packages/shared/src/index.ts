// Type-only package: no runtime exports, no build step (docs §4.5, §6).

export type Role = 'EMPLOYEE' | 'ADMIN';
export type EquipmentStatus = 'ACTIVE' | 'INACTIVE';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Equipment {
  id: string;
  name: string;
  category: string;
  stockQuantity: number;
  status: EquipmentStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentRequest {
  id: string;
  quantity: number;
  reason: string;
  status: RequestStatus;
  rejectReason: string | null;
  approvedAt: string | null;
  reviewedAt: string | null;
  requester: Pick<UserSummary, 'id' | 'name'>;
  reviewer: Pick<UserSummary, 'id' | 'name'> | null;
  equipment: Pick<Equipment, 'id' | 'name' | 'category' | 'stockQuantity' | 'status'>;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  actor: Pick<UserSummary, 'id' | 'name'>;
  createdAt: string;
}

export interface RequestDetail extends EquipmentRequest {
  auditLogs: AuditLog[];
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_STATUS'
  | 'INSUFFICIENT_STOCK'
  | 'EQUIPMENT_INACTIVE'
  | 'VERSION_CONFLICT'
  | 'EQUIPMENT_UNAVAILABLE'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_ERROR'
  | 'DUPLICATE_EQUIPMENT_NAME'
  | 'IDEMPOTENCY_KEY_REUSED';

export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  code: ErrorCode;
}
