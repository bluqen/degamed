import type { ComponentProps, ReactNode } from 'react';
import { cx } from './cx';

/** A surface with a hairline border and soft shadow. `interactive` adds hover lift. */
export function Card({ className, interactive, ...props }: ComponentProps<'div'> & { interactive?: boolean }) {
  return (
    <div
      className={cx(
        'rounded-xl border border-line bg-surface shadow-1',
        interactive && 'transition-[transform,box-shadow,border-color] duration-200 ease-standard hover:-translate-y-0.5 hover:border-line-strong hover:shadow-2',
        className,
      )}
      {...props}
    />
  );
}

type Tone = 'neutral' | 'brand' | 'accent' | 'ok' | 'warn' | 'bad';
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  brand: 'bg-brand-tint text-brand-ink',
  accent: 'bg-accent-tint text-accent',
  ok: 'bg-ok-tint text-ok',
  warn: 'bg-warn-tint text-warn',
  bad: 'bg-bad-tint text-bad',
};

export function Badge({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-caption font-semibold', tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/** A placeholder block that shimmers while content loads. */
export function Skeleton({ className, rounded = 'rounded-md' }: { className?: string; rounded?: string }) {
  return <div aria-hidden="true" className={cx('skeleton', rounded, className)} />;
}

/** Calm, centred empty/error state with an optional action. */
export function EmptyState({ icon, title, body, action, tone = 'neutral', className }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode; tone?: 'neutral' | 'bad'; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center gap-3 px-6 py-10 text-center', className)}>
      {icon && <div className={cx('flex size-12 items-center justify-center rounded-full', tone === 'bad' ? 'bg-bad-tint text-bad' : 'bg-brand-tint text-brand-ink')}>{icon}</div>}
      <div className="flex max-w-sm flex-col gap-1">
        <h3 className="text-subtitle font-semibold text-ink">{title}</h3>
        {body && <p className="text-body text-muted">{body}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Keyboard key hint. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line-strong bg-surface-2 px-1 font-sans text-caption font-semibold text-muted">{children}</kbd>;
}
