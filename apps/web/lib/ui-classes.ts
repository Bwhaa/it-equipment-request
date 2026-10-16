/**
 * Input class of the search/filter bars (inline, not full width): the Field recipe of docs/ui-design.md.
 * min-h-12 (not h-12) so the same classes also fit a <textarea>.
 */
export const FILTER_INPUT_CLASS =
  'min-h-12 rounded-field border border-field-line bg-surface px-4 py-3 text-base text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand-tint aria-[invalid=true]:border-2 aria-[invalid=true]:border-danger-text';

/** Input class of the forms (full width). */
export const FORM_INPUT_CLASS = `w-full ${FILTER_INPUT_CLASS}`;

/** Card surface. */
export const CARD_CLASS = 'rounded-card border border-line bg-surface';
