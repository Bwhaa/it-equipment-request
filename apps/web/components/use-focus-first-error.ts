'use client';

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { firstFieldWithError } from '@/lib/focus-order';

/**
 * Moves focus to the first invalid field (by element id, in the form's visual `order`) when a NEW `errors`
 * object arrives. An errors object that was already handled is never handled twice, so the hook does not steal
 * focus again when the same errors come back (for example stale server errors after a client-side revalidation).
 * API-level errors (the role="alert" banner) are announced by their role and do not move focus.
 */
export function useFocusFirstError<K extends string>(
  errors: Readonly<Partial<Record<K, string | undefined>>> | undefined,
  order: readonly K[],
  formRef: RefObject<HTMLFormElement | null>,
): void {
  const handled = useRef(new WeakSet<object>());

  useEffect(() => {
    if (!errors || handled.current.has(errors)) return;
    handled.current.add(errors);

    const field = firstFieldWithError(errors, order);
    const form = formRef.current;
    if (field === undefined || form === null) return;
    const element = form.ownerDocument.getElementById(field);
    if (element instanceof HTMLElement && form.contains(element)) element.focus();
  }, [errors, order, formRef]);
}
