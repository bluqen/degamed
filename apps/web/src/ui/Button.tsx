import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Loader2 } from 'lucide-react';
import { cx } from './cx';
import { Tooltip } from './Tooltip';

export type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'ghost' | 'danger' | 'inverse';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-standard active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand shadow-brand hover:bg-brand-hover active:bg-brand-press',
  secondary: 'border border-line-strong bg-surface text-ink shadow-1 hover:bg-surface-2 hover:border-line-strong',
  subtle: 'bg-surface-2 text-ink hover:bg-surface-3',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-bad text-white hover:opacity-90',
  inverse: 'bg-white text-[#15141d] shadow-2 hover:bg-white/90',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-sm px-3 text-body-sm',
  md: 'h-10 rounded-md px-4 text-body',
  lg: 'h-12 rounded-lg px-5 text-body-lg',
};

export function buttonClass({ variant = 'primary', size = 'md', block = false, className = '' }: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string } = {}) {
  return cx(base, variants[variant], sizes[size], block && 'w-full', className);
}

interface Common {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Icon before the label. */
  icon?: ReactNode;
  /** Icon after the label. */
  iconEnd?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ComponentProps<'button'> & Common>(function Button(
  { variant, size, block, icon, iconEnd, loading, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass({ variant, size, block, className })} {...props}>
      {loading ? <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" aria-hidden="true" /> : icon}
      {children}
      {iconEnd}
    </button>
  );
});

export function ButtonLink({ variant, size, block, icon, iconEnd, className, children, ...props }: ComponentProps<typeof Link> & Omit<Common, 'loading'>) {
  return (
    <Link className={buttonClass({ variant, size, block, className })} {...props}>
      {icon}
      {children}
      {iconEnd}
    </Link>
  );
}

const iconSizes: Record<ButtonSize, string> = { sm: 'size-8 rounded-sm', md: 'size-10 rounded-md', lg: 'size-12 rounded-lg' };

/** A square, icon-only button. `label` is required: it's the accessible name and the tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, Omit<ComponentProps<'button'>, 'children'> & { label: string; children: ReactNode; variant?: ButtonVariant; size?: ButtonSize; tooltip?: boolean; pressed?: boolean }>(
  function IconButton({ label, children, variant = 'ghost', size = 'md', tooltip = true, pressed, className, type = 'button', ...props }, ref) {
    const btn = (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        aria-pressed={pressed}
        className={cx(base, variants[variant], iconSizes[size], 'px-0', pressed && 'bg-brand-tint text-brand-ink hover:bg-brand-tint', className)}
        {...props}
      >
        {children}
      </button>
    );
    return tooltip ? <Tooltip label={label}>{btn}</Tooltip> : btn;
  },
);
