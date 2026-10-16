'use server';

import type { EquipmentRequest } from '@app/shared';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { ApiRequestError, makeApiError } from '@/lib/api-error';
import { validateRequestForm } from '@/lib/request-form';
import { isUuid } from '@/lib/roles';
import type { RequestFormState } from './state';

const text = (value: FormDataEntryValue | null): string => (typeof value === 'string' ? value : '');

export async function createRequestAction(_previous: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const equipmentId = formData.get('equipmentId');
  const values = { quantity: text(formData.get('quantity')), reason: text(formData.get('reason')) };

  if (!isUuid(equipmentId)) {
    return { ok: false, error: makeApiError(404, 'NOT_FOUND', 'Equipment not found'), values };
  }

  // The server never trusts the client: validate again (same function as the form).
  const checked = validateRequestForm({ quantity: formData.get('quantity'), reason: formData.get('reason') });
  if (!checked.ok) return { ok: false, fieldErrors: checked.fieldErrors, values };

  // Optional: a missing or malformed key just means no replay protection (never a local error).
  const idempotencyKey = formData.get('idempotencyKey');
  const headers = isUuid(idempotencyKey) ? { 'Idempotency-Key': idempotencyKey } : undefined;

  let created: EquipmentRequest;
  try {
    created = await apiFetch<EquipmentRequest>('/requests', {
      method: 'POST',
      body: { equipmentId, quantity: checked.value.quantity, reason: checked.value.reason },
      ...(headers ? { headers } : {}),
    });
  } catch (error) {
    // Only API errors become form state; redirect() signals and unexpected errors propagate untouched.
    if (error instanceof ApiRequestError) return { ok: false, error: error.body, values };
    throw error;
  }

  // redirect() works by throwing: keep it outside the try/catch.
  redirect(`/requests/${created.id}?created=1`);
}
