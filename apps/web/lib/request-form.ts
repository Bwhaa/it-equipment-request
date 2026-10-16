export interface RequestFormValue {
  quantity: number;
  reason: string;
}

export interface RequestFormFieldErrors {
  quantity?: string;
  reason?: string;
}

export type RequestFormValidation =
  | { ok: true; value: RequestFormValue }
  | { ok: false; fieldErrors: RequestFormFieldErrors };

export const QUANTITY_ERROR = 'กรุณาระบุจำนวนเป็นจำนวนเต็ม 1 ถึง 100';
export const REASON_ERROR = 'กรุณาระบุเหตุผล 5 ถึง 500 ตัวอักษร';

/**
 * Mirrors CreateRequestDto (quantity integer 1..100, reason trimmed 5..500) and nothing more:
 * the stock check belongs to the API. Used by the client form AND the Server Action.
 */
export function validateRequestForm(input: { quantity: unknown; reason: unknown }): RequestFormValidation {
  const fieldErrors: RequestFormFieldErrors = {};

  let quantity = 0;
  if (typeof input.quantity === 'string' && /^\d+$/.test(input.quantity.trim())) {
    quantity = Number(input.quantity.trim());
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) fieldErrors.quantity = QUANTITY_ERROR;

  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < 5 || reason.length > 500) fieldErrors.reason = REASON_ERROR;

  if (fieldErrors.quantity || fieldErrors.reason) return { ok: false, fieldErrors };
  return { ok: true, value: { quantity, reason } };
}
