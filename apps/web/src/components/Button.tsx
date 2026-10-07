import type { ComponentProps } from 'react';
import { Link } from 'react-router';

type Variant = 'primary' | 'outline' | 'ghost';

const base =
  'inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 font-semibold transition-colors min-h-11 disabled:opacity-50 disabled:pointer-events-none';
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-[#5A3DF0]',
  outline: 'border border-line-strong text-ink hover:bg-panel',
  ghost: 'text-ink-2 hover:text-white hover:bg-panel',
};

export function buttonClass(variant: Variant = 'primary', extra = '') {
  return `${base} ${variants[variant]} ${extra}`;
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
