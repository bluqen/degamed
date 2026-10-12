import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { themePreview, themeThumb } from '../lib/game/preview';
import type { ThemeArt } from '../lib/game';
import { cx } from '../ui';

/** Key art for a theme, rendered from the theme's own sprites and layers. */
export function ThemeArtImage({
  theme,
  className,
  width = 320,
  height = 180,
}: {
  theme: ThemeArt;
  className?: string;
  width?: number;
  height?: number;
}) {
  // Pre-rendered thumbnail first; render live from the theme only if it's missing.
  const [src, setSrc] = useState(() => themeThumb(theme.id));
  useEffect(() => setSrc(themeThumb(theme.id)), [theme.id]);
  return (
    <img
      src={src}
      onError={() => {
        if (src.startsWith('data:')) return;
        window.setTimeout(() => setSrc(themePreview(theme, width, height)), 0);
      }}
      alt=""
      width={width}
      height={height}
      className={cx('pixelated block h-full w-full object-cover', className)}
    />
  );
}

/** A selectable theme tile (radio semantics). */
export function ThemeCard({
  theme,
  selected,
  onSelect,
  size = 'md',
  name,
}: {
  theme: ThemeArt;
  selected?: boolean;
  onSelect?: () => void;
  size?: 'sm' | 'md';
  name?: string;
}) {
  const content = (
    <>
      <span
        className={cx(
          'relative block overflow-hidden',
          size === 'sm' ? 'aspect-[16/10] rounded-md' : 'aspect-video rounded-lg',
        )}
      >
        <ThemeArtImage
          theme={theme}
          className="transition-transform duration-300 ease-standard group-hover:scale-[1.04]"
        />
        <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]" />
        {selected && (
          <span className="absolute top-2 right-2 flex size-6 animate-pop items-center justify-center rounded-full bg-brand text-on-brand shadow-2">
            <Check size={14} strokeWidth={3} aria-hidden="true" />
          </span>
        )}
      </span>
      <span
        className={cx('flex flex-col', size === 'sm' ? 'gap-0 px-0.5 pt-2' : 'gap-0.5 px-1 pt-3')}
      >
        <span
          className={cx('font-semibold text-ink', size === 'sm' ? 'text-body-sm' : 'text-body')}
        >
          {theme.name}
        </span>
        {size === 'md' && (
          <span className="line-clamp-2 text-body-sm text-muted">{theme.description}</span>
        )}
      </span>
    </>
  );
  if (!onSelect) return <div className="group flex flex-col">{content}</div>;
  return (
    <label
      className={cx(
        'group flex cursor-pointer flex-col rounded-xl p-1.5 transition-[background-color,box-shadow] duration-150 ease-standard has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--c-focus)]',
        selected ? 'bg-brand-tint shadow-[inset_0_0_0_2px_var(--c-brand)]' : 'hover:bg-surface-2',
      )}
    >
      <input
        type="radio"
        name={name ?? 'theme'}
        checked={!!selected}
        onChange={onSelect}
        className="sr-only"
        aria-label={theme.name}
      />
      {content}
    </label>
  );
}
