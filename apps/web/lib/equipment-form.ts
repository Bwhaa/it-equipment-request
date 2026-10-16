import type { EquipmentStatus } from '@app/shared';

export interface EquipmentFormValue {
  name: string;
  category: string;
  stockQuantity: number;
  status: EquipmentStatus;
}

export interface EquipmentFormFieldErrors {
  name?: string;
  category?: string;
  stockQuantity?: string;
  status?: string;
}

export type EquipmentFormValidation =
  | { ok: true; value: EquipmentFormValue }
  | { ok: false; fieldErrors: EquipmentFormFieldErrors };

export const NAME_ERROR = 'กรุณาระบุชื่ออุปกรณ์ (ไม่เกิน 120 ตัวอักษร)';
export const CATEGORY_ERROR = 'กรุณาระบุหมวดหมู่ (ไม่เกิน 60 ตัวอักษร)';
export const STOCK_ERROR = 'กรุณาระบุจำนวนคงเหลือเป็นจำนวนเต็ม 0 ถึง 100000';
export const STATUS_ERROR = 'กรุณาเลือกสถานะ';

const trimmedString = (value: unknown): string | undefined => (typeof value === 'string' ? value.trim() : undefined);

/**
 * Mirrors CreateEquipmentDto / UpdateEquipmentDto and nothing more. Used by the client form AND
 * the Server Actions.
 */
export function validateEquipmentForm(input: {
  name: unknown;
  category: unknown;
  stockQuantity: unknown;
  status: unknown;
}): EquipmentFormValidation {
  const fieldErrors: EquipmentFormFieldErrors = {};

  const name = trimmedString(input.name) ?? '';
  if (name.length < 1 || name.length > 120) fieldErrors.name = NAME_ERROR;

  const category = trimmedString(input.category) ?? '';
  if (category.length < 1 || category.length > 60) fieldErrors.category = CATEGORY_ERROR;

  let stockQuantity = -1;
  const stockText = trimmedString(input.stockQuantity);
  if (stockText !== undefined && /^\d+$/.test(stockText)) stockQuantity = Number(stockText);
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 100_000) {
    fieldErrors.stockQuantity = STOCK_ERROR;
  }

  const status = input.status;
  if (status !== 'ACTIVE' && status !== 'INACTIVE') fieldErrors.status = STATUS_ERROR;

  if (Object.keys(fieldErrors).length > 0 || (status !== 'ACTIVE' && status !== 'INACTIVE')) {
    return { ok: false, fieldErrors };
  }
  return { ok: true, value: { name, category, stockQuantity, status } };
}

/** The `version` a form loaded: digits only, an integer 1..2147483647 (Postgres int). */
export function parseVersion(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!/^\d+$/.test(text)) return undefined;
  const version = Number(text);
  return version >= 1 && version <= 2_147_483_647 ? version : undefined;
}
