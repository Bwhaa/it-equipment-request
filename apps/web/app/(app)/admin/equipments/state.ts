import type { ApiError, Equipment } from '@app/shared';

export type EquipmentFormValues = { name: string; category: string; stockQuantity: string; status: string };

export type EquipmentFormState = {
  ok: false;
  error?: ApiError;
  fieldErrors?: { name?: string; category?: string; stockQuantity?: string; status?: string };
  values?: EquipmentFormValues;
  conflict?: { latest: Equipment; attempted: EquipmentFormValues };
};

export const initialEquipmentFormState: EquipmentFormState = { ok: false };
