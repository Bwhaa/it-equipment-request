import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline-danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center rounded-pill font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-text';
const SIZE: Record<ButtonSize, string> = {
  sm: 'h-11 px-5 text-[15px]',
  md: 'h-12 px-7 text-base',
  lg: 'h-[52px] px-9 text-[17px]',
};
const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-strong',
  secondary: 'border border-ink bg-surface text-ink hover:bg-ground',
  ghost: 'text-brand-text hover:bg-brand-tint',
  danger: 'bg-danger-solid text-on-danger hover:opacity-90',
  'outline-danger': 'border border-danger-text bg-surface text-danger-text hover:bg-danger-bg',
};
const DISABLED = 'bg-disabled-bg text-disabled-text cursor-not-allowed';

/** Class names shared by <Button> and links that should look like buttons. */
export function buttonClasses(variant: ButtonVariant = 'primary', disabled = false, size: ButtonSize = 'md'): string {
  return `${BASE} ${SIZE[size]} ${disabled ? DISABLED : VARIANT[variant]}`;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-disabled={disabled ? true : undefined}
      className={`${buttonClasses(variant, Boolean(disabled), size)} ${className}`.trim()}
      {...rest}
    />
  );
}
