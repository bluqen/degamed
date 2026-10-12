import { forwardRef, useId, type ComponentProps, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from './cx';

const control =
  'w-full rounded-md border border-line-strong bg-surface text-ink placeholder:text-faint shadow-[inset_0_1px_1px_rgb(0_0_0/0.03)] transition-[border-color,box-shadow] duration-150 ease-standard hover:border-faint focus:border-brand focus:shadow-[0_0_0_3px_var(--c-brand-tint-2)] focus:outline-none focus-visible:outline-none disabled:opacity-50 aria-[invalid=true]:border-bad';

/** Label + control + hint/error, stacked with consistent spacing. */
export function Field({ label, hint, error, children, htmlFor, className }: { label?: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-body-sm font-semibold text-ink">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-body-sm text-bad">
          {error}
        </p>
      ) : (
        hint && <p className="text-body-sm text-muted">{hint}</p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, ComponentProps<'input'> & { icon?: ReactNode }>(function Input({ className, icon, ...props }, ref) {
  if (!icon) return <input ref={ref} className={cx(control, 'h-10 px-3 text-body', className)} {...props} />;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">{icon}</span>
      <input ref={ref} className={cx(control, 'h-10 pr-3 pl-9 text-body', className)} {...props} />
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<'textarea'>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cx(control, 'min-h-24 resize-y px-3 py-2.5 text-body', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<'select'>>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cx(control, 'h-10 cursor-pointer appearance-none pr-9 pl-3 text-body', className)} {...props}>
        {children}
      </select>
      <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted" />
    </div>
  );
});

/** An on/off switch. Renders a real checkbox with role="switch" for screen readers. */
export function Switch({ checked, onChange, label, description, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean; id?: string }) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <label htmlFor={inputId} className={cx('group flex cursor-pointer items-center justify-between gap-4', disabled && 'cursor-default opacity-50')}>
      <span className="flex min-w-0 flex-col">
        <span className="text-body text-ink">{label}</span>
        {description && <span className="text-body-sm text-muted">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input id={inputId} type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span
          aria-hidden="true"
          className="h-6 w-10 rounded-full bg-surface-3 shadow-[inset_0_0_0_1px_var(--c-line-strong)] transition-colors duration-200 ease-standard peer-checked:bg-brand peer-checked:shadow-none peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--c-focus)]"
        />
        <span
          aria-hidden="true"
          className="absolute top-1 left-1 size-4 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-200 ease-emphasized peer-checked:translate-x-4"
        />
      </span>
    </label>
  );
}

/** A labelled slider with its current value shown on the right. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = String,
  minLabel,
  maxLabel,
  id,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  minLabel?: string;
  maxLabel?: string;
  id?: string;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-body text-ink">
          {label}
        </label>
        <output htmlFor={inputId} className="text-body-sm font-semibold text-muted tabular-nums">
          {format(value)}
        </output>
      </div>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--fill' as string]: `${pct}%` }}
        className="ui-slider w-full"
      />
      {(minLabel || maxLabel) && (
        <div className="flex justify-between text-caption text-muted">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}

/** A row of mutually exclusive choices (radio group styled as a segmented control). */
export function Segmented<T extends string>({ label, value, options, onChange, size = 'md' }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full rounded-md bg-surface-2 p-0.5 shadow-[inset_0_0_0_1px_var(--c-line)]">
      {options.map((o) => (
        <label
          key={o.value}
          className={cx(
            'relative flex flex-1 cursor-pointer items-center justify-center rounded-[8px] px-2 font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 ease-standard has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--c-focus)]',
            size === 'sm' ? 'h-7 text-body-sm' : 'h-9 text-body-sm',
            value === o.value ? 'bg-surface text-ink shadow-1' : 'text-muted hover:text-ink',
          )}
        >
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );
}
