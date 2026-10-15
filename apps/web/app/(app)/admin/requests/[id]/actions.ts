'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { ApiRequestError, makeApiError } from '@/lib/api-error';
import { validateRejectReason } from '@/lib/reject-form';
import { isUuid } from '@/lib/roles';
import type { ReviewActionState } from './state';

const NOT_FOUND: ReviewActionState = { ok: false, error: makeApiError(404, 'NOT_FOUND', 'Request not found') };

/** After a 409/404 the page data is stale: drop the cache so the next render shows the database. */
function revalidateRequest(id: string): void {
  revalidatePath(`/admin/requests/${id}`);
  revalidatePath('/admin/requests');
}

export async function approveRequestAction(_previous: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const id = formData.get('id');
  if (!isUuid(id)) return NOT_FOUND;

  try {
    await apiFetch(`/requests/${id}/approve`, { method: 'PATCH' });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (error.status === 409 || error.status === 404) revalidateRequest(id);
      return { ok: false, error: error.body };
    }
    throw error;
  }

  // redirect() works by throwing: keep it outside the try/catch.
  revalidateRequest(id);
  redirect(`/admin/requests/${id}?done=approved`);
}

export async function rejectRequestAction(_previous: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const id = formData.get('id');
  if (!isUuid(id)) return NOT_FOUND;

  const raw = formData.get('reason');
  const values = { reason: typeof raw === 'string' ? raw : '' };
  const checked = validateRejectReason(raw);
  if (!checked.ok) return { ok: false, fieldErrors: { reason: checked.error }, values };

  try {
    await apiFetch(`/requests/${id}/reject`, { method: 'PATCH', body: { rejectReason: checked.value } });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (error.status === 409 || error.status === 404) revalidateRequest(id);
      return { ok: false, error: error.body, values };
    }
    throw error;
  }

  revalidateRequest(id);
  redirect(`/admin/requests/${id}?done=rejected`);
}
