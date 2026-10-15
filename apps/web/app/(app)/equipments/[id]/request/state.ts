import type { ApiError } from '@app/shared';

export type RequestFormState =
  | { ok: true }
  | {
      ok: false;
      error?: ApiError;
      fieldErrors?: { quantity?: string; reason?: string };
      values?: { quantity: string; reason: string };
    };

export const initialRequestFormState: RequestFormState = { ok: false };
