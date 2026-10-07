import { useId } from 'react';
import { Link } from 'react-router';

export function LogoMark({ size = 28, hole = '#0E0F13' }: { size?: number; hole?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7C5CFF" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="20" height="20" rx="5" transform="rotate(45 14 14)" fill={`url(#${id})`} />
      <circle cx="14" cy="14" r="4" fill={hole} />
    </svg>
  );
}

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 text-white">
      <LogoMark />
      <span className="font-display text-[22px] font-bold tracking-tight">degamed</span>
    </Link>
  );
}
