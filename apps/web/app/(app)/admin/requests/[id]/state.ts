import type { ApiError } from '@app/shared';

export type ReviewActionState = {
  ok: false;
  error?: ApiError;
  fieldErrors?: { reason?: string };
  values?: { reason: string };
};

export const initialReviewActionState: ReviewActionState = { ok: false };
