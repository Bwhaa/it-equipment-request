/**
 * The first field, in the visual ORDER of the form, that has a non-empty error message; undefined when no field
 * has one. Keys that are not in `order` are ignored.
 */
export function firstFieldWithError<K extends string>(
  errors: Readonly<Partial<Record<K, string | undefined>>> | undefined,
  order: readonly K[],
): K | undefined {
  if (!errors) return undefined;
  return order.find((field) => {
    const message = errors[field];
    return typeof message === 'string' && message !== '';
  });
}
