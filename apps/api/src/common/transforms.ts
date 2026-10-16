import type { TransformFnParams } from 'class-transformer';

export const trim = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim() : value);

/** Login emails are compared in lowercase (the seeded emails are stored that way). */
export const trimLowercase = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
