import type { RequestStatus } from '@app/shared';

export type SearchParamValue = string | string[] | undefined;

const first = (value: SearchParamValue): string | undefined => (Array.isArray(value) ? value[0] : value);

export function parsePage(value: SearchParamValue): number {
  const raw = first(value)?.trim();
  if (raw === undefined || !/^\d+$/.test(raw)) return 1;
  const page = Number(raw);
  return page >= 1 && page <= 100_000 ? page : 1;
}

function parseText(value: SearchParamValue, maxLength: number): string | undefined {
  const text = first(value)?.trim().slice(0, maxLength).trim();
  return text ? text : undefined;
}

export const parseSearch = (value: SearchParamValue): string | undefined => parseText(value, 100);
export const parseCategory = (value: SearchParamValue): string | undefined => parseText(value, 60);

export function parseRequestStatus(value: SearchParamValue): RequestStatus | undefined {
  const raw = first(value);
  return raw === 'PENDING' || raw === 'APPROVED' || raw === 'REJECTED' ? raw : undefined;
}

/** `page` is omitted when it is 1; undefined and empty params are dropped. */
export function buildHref(basePath: string, params: Record<string, string | undefined>, page: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, value);
  }
  if (page > 1) query.set('page', String(page));
  const text = query.toString();
  return text ? `${basePath}?${text}` : basePath;
}
