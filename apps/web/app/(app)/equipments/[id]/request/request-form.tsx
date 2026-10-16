'use client';

import { useActionState, useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ERROR_TITLE, errorMessages } from '@/lib/error-messages';
import { validateRequestForm } from '@/lib/request-form';
import type { RequestFormFieldErrors } from '@/lib/request-form';
import { createRequestAction } from './actions';
import { initialRequestFormState } from './state';
import { FORM_INPUT_CLASS } from '@/lib/ui-classes';

export function RequestForm({ equipmentId, stockQuantity }: { equipmentId: string; stockQuantity: number }) {
  const [state, formAction, pending] = useActionState(createRequestAction, initialRequestFormState);
  const [clientErrors, setClientErrors] = useState<RequestFormFieldErrors>();
  const values = state.ok ? undefined : state.values;
  const [reasonLength, setReasonLength] = useState(values?.reason.length ?? 0);

  const fieldErrors: RequestFormFieldErrors = clientErrors ?? (state.ok ? {} : (state.fieldErrors ?? {}));
  const apiError = state.ok ? undefined : state.error;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const checked = validateRequestForm({ quantity: data.get('quantity'), reason: data.get('reason') });
    if (!checked.ok) {
      // No request is sent: the same rules run again on the server.
      event.preventDefault();
      setClientErrors(checked.fieldErrors);
      return;
    }
    setClientErrors(undefined);
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-4">
      <input type="hidden" name="equipmentId" value={equipmentId} />

      {apiError && (
        <Alert variant="error" title={ERROR_TITLE[apiError.code]}>
          <ul className="mt-1 list-disc pl-5">
            {errorMessages(apiError).map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div>
        <label htmlFor="quantity" className="mb-1 block text-sm font-medium">
          จำนวนที่ขอเบิก
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          step={1}
          defaultValue={values?.quantity ?? '1'}
          aria-invalid={fieldErrors.quantity ? true : undefined}
          aria-describedby={fieldErrors.quantity ? 'quantity-hint quantity-error' : 'quantity-hint'}
          className={FORM_INPUT_CLASS}
        />
        <p id="quantity-hint" className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          คงเหลือ {stockQuantity} ชิ้น
        </p>
        {fieldErrors.quantity && (
          <p id="quantity-error" className="mt-1 text-sm text-red-700 dark:text-red-400">
            {fieldErrors.quantity}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="reason" className="mb-1 block text-sm font-medium">
          เหตุผลในการขอเบิก
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={4}
          defaultValue={values?.reason ?? ''}
          onChange={(event) => setReasonLength(event.target.value.length)}
          aria-invalid={fieldErrors.reason ? true : undefined}
          aria-describedby={fieldErrors.reason ? 'reason-count reason-error' : 'reason-count'}
          className={FORM_INPUT_CLASS}
        />
        <p id="reason-count" className="mt-1 text-right text-xs text-neutral-600 dark:text-neutral-400">
          {reasonLength}/500
        </p>
        {fieldErrors.reason && (
          <p id="reason-error" className="mt-1 text-sm text-red-700 dark:text-red-400">
            {fieldErrors.reason}
          </p>
        )}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'กำลังส่ง…' : 'ส่งคำขอ'}
      </Button>
    </form>
  );
}
