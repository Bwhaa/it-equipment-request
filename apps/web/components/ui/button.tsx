import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary';

const BASE =
  'inline-flex items-center justify-center rounded px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'border border-neutral-400 bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800',
};
const DISABLED = 'cursor-not-allowed opacity-50 hover:bg-inherit';

/** Class names shared by <Button> and links that should look like buttons. */
export function buttonClasses(variant: ButtonVariant = 'primary', disabled = false): string {
  return `${BASE} ${VARIANT[variant]}${disabled ? ` ${DISABLED}` : ''}`;
}

export function Button({
  variant = 'primary',
  className = '',
  disabled,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-disabled={disabled ? true : undefined}
      className={`${buttonClasses(variant, Boolean(disabled))} ${className}`.trim()}
      {...rest}
    />
  );
}
