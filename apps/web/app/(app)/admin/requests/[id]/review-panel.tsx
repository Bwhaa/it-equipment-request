'use client';

import { useActionState, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { ApprovalBlock } from '@/lib/approval';
import { ERROR_TITLE, errorMessages } from '@/lib/error-messages';
import { approveRequestAction, rejectRequestAction } from './actions';
import { initialReviewActionState } from './state';
import { FORM_INPUT_CLASS } from '@/lib/ui-classes';

/**
 * Stays mounted after the request has been reviewed (`reviewed`), so an error returned by a stale
 * form (for example INVALID_STATUS) is still shown after revalidatePath re-renders the page.
 */
export function ReviewPanel({ id, block, reviewed }: { id: string; block: ApprovalBlock | null; reviewed: boolean }) {
  const [approveState, approveAction, approving] = useActionState(approveRequestAction, initialReviewActionState);
  const [rejectState, rejectAction, rejecting] = useActionState(rejectRequestAction, initialReviewActionState);
  const [reasonLength, setReasonLength] = useState(rejectState.values?.reason.length ?? 0);

  const apiError = approveState.error ?? rejectState.error;
  const reasonError = rejectState.fieldErrors?.reason;
  const busy = approving || rejecting;

  return (
    <div className="space-y-4">
      {!reviewed && block && <Alert variant="error" title={block.message} />}

      {apiError && (
        <Alert variant="error" title={ERROR_TITLE[apiError.code]}>
          <ul className="mt-1 list-disc pl-5">
            {errorMessages(apiError).map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alert>
      )}

      {reviewed ? (
        <Alert variant="notice">คำขอนี้ได้รับการพิจารณาแล้ว</Alert>
      ) : (
        <>
          {/* Always rendered: the button is disabled as a hint only, the API stays the authority. */}
          <form action={approveAction}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" disabled={block !== null || busy}>
              {approving ? 'กำลังอนุมัติ…' : 'อนุมัติ'}
            </Button>
          </form>

          <details className="rounded border border-neutral-300 p-3 dark:border-neutral-700" open={Boolean(reasonError) || undefined}>
            <summary className="cursor-pointer text-sm font-medium">ปฏิเสธคำขอ</summary>
            <form action={rejectAction} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={id} />
              <div>
                <label htmlFor="reason" className="mb-1 block text-sm font-medium">
                  เหตุผลที่ปฏิเสธ
                </label>
                <textarea
                  id="reason"
                  name="reason"
                  rows={3}
                  maxLength={500}
                  defaultValue={rejectState.values?.reason ?? ''}
                  onChange={(event) => setReasonLength(event.target.value.length)}
                  aria-invalid={reasonError ? true : undefined}
                  aria-describedby={reasonError ? 'reason-count reason-error' : 'reason-count'}
                  className={FORM_INPUT_CLASS}
                />
                <p id="reason-count" className="mt-1 text-right text-xs text-neutral-600 dark:text-neutral-400">
                  {reasonLength}/500
                </p>
                {reasonError && (
                  <p id="reason-error" className="mt-1 text-sm text-red-700 dark:text-red-400">
                    {reasonError}
                  </p>
                )}
              </div>
              <Button type="submit" variant="secondary" disabled={busy}>
                {rejecting ? 'กำลังปฏิเสธ…' : 'ยืนยันการปฏิเสธ'}
              </Button>
            </form>
          </details>
        </>
      )}
    </div>
  );
}
