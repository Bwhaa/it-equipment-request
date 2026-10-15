export const REJECT_REASON_ERROR = 'กรุณาระบุเหตุผลที่ปฏิเสธ 5 ถึง 500 ตัวอักษร';

/** Mirrors RejectRequestDto (rejectReason trimmed, 5..500). */
export function validateRejectReason(input: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const value = typeof input === 'string' ? input.trim() : '';
  if (value.length < 5 || value.length > 500) return { ok: false, error: REJECT_REASON_ERROR };
  return { ok: true, value };
}
