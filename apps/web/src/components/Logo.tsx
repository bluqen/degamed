import { useId } from 'react';
import { Link } from 'react-router';
import { cx } from '../ui/cx';

/** The Degamed mark: a rounded diamond in the violet → cyan brand gradient with a play-dot. */
export function LogoMark({ size = 28, hole = 'var(--c-bg)' }: { size?: number; hole?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7457FF" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="20" height="20" rx="6" transform="rotate(45 14 14)" fill={`url(#${id})`} />
      <circle cx="14" cy="14" r="4" fill={hole} />
    </svg>
  );
}

export function Logo({ to = '/', size = 28, className, hole }: { to?: string; size?: number; className?: string; hole?: string }) {
  return (
    <Link to={to} aria-label="Degamed home" className={cx('flex items-center gap-2.5 rounded-sm text-ink', className)}>
      <LogoMark size={size} hole={hole} />
      <span className="font-display text-[21px] leading-none font-bold tracking-[-0.02em]">degamed</span>
    </Link>
  );
}
