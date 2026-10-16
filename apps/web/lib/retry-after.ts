/** Retry-After (seconds) -> whole minutes to show the user, at least 1. */
export function retryAfterMinutes(header: string | null | undefined): number {
  const seconds = Number(header);
  if (!header || !Number.isFinite(seconds) || seconds <= 0) return 1;
  return Math.max(1, Math.ceil(seconds / 60));
}
