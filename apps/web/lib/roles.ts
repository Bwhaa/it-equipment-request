import type { Role } from '@app/shared';

export function isRole(value: unknown): value is Role {
  return value === 'EMPLOYEE' || value === 'ADMIN';
}

export const ROLE_HOME: Record<Role, string> = {
  EMPLOYEE: '/equipments',
  ADMIN: '/admin/requests',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
