'use server';

import type { Equipment } from '@app/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { ApiRequestError, makeApiError } from '@/lib/api-error';
import { parseVersion, validateEquipmentForm } from '@/lib/equipment-form';
import { isUuid } from '@/lib/roles';
import type { EquipmentFormState, EquipmentFormValues } from './state';

const text = (value: FormDataEntryValue | null): string => (typeof value === 'string' ? value : '');

function readValues(formData: FormData): EquipmentFormValues {
  return {
    name: text(formData.get('name')),
    category: text(formData.get('category')),
    stockQuantity: text(formData.get('stockQuantity')),
    status: text(formData.get('status')),
  };
}

export async function createEquipmentAction(
  _previous: EquipmentFormState,
  formData: FormData,
): Promise<EquipmentFormState> {
  const values = readValues(formData);
  // The server never trusts the client: validate again (same function as the form).
  const checked = validateEquipmentForm(values);
  if (!checked.ok) return { ok: false, fieldErrors: checked.fieldErrors, values };

  try {
    await apiFetch<Equipment>('/equipments', { method: 'POST', body: checked.value });
  } catch (error) {
    if (error instanceof ApiRequestError) return { ok: false, error: error.body, values };
    throw error;
  }

  // redirect() works by throwing: keep it outside the try/catch.
  revalidatePath('/admin/equipments');
  redirect('/admin/equipments?done=created');
}

export async function updateEquipmentAction(
  _previous: EquipmentFormState,
  formData: FormData,
): Promise<EquipmentFormState> {
  const values = readValues(formData);

  const id = formData.get('id');
  if (!isUuid(id)) return { ok: false, error: makeApiError(404, 'NOT_FOUND', 'Equipment not found'), values };

  const version = parseVersion(formData.get('version'));
  if (version === undefined) return { ok: false, error: makeApiError(400, 'VALIDATION_ERROR', 'Invalid version'), values };

  const checked = validateEquipmentForm(values);
  if (!checked.ok) return { ok: false, fieldErrors: checked.fieldErrors, values };

  try {
    await apiFetch<Equipment>(`/equipments/${id}`, { method: 'PATCH', body: { version, ...checked.value } });
  } catch (error) {
    if (!(error instanceof ApiRequestError)) throw error;
    if (error.body.code !== 'VERSION_CONFLICT') return { ok: false, error: error.body, values };

    // Someone else saved first: hand back the latest values; never retry silently.
    let latest: Equipment;
    try {
      latest = await apiFetch<Equipment>(`/equipments/${id}`);
    } catch (refetchError) {
      if (refetchError instanceof ApiRequestError) return { ok: false, error: refetchError.body, values };
      throw refetchError;
    }
    return { ok: false, error: error.body, values, conflict: { latest, attempted: values } };
  }

  revalidatePath('/admin/equipments');
  redirect('/admin/equipments?done=updated');
}
