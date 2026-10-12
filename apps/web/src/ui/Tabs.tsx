import { useId, useRef, type ReactNode } from 'react';
import { cx } from './cx';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
}

/**
 * Accessible tabs (arrow keys move between tabs). Renders the tab list only;
 * give each panel `role="tabpanel"` and `aria-labelledby={tabId(id)}` via `panelProps`.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  variant = 'pill',
  className,
  idBase,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  variant?: 'pill' | 'line';
  className?: string;
  idBase?: string;
}) {
  const auto = useId();
  const base = idBase ?? auto;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number) => {
    const n = (i + items.length) % items.length;
    onChange(items[n]!.id);
    refs.current[n]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cx(
        variant === 'pill'
          ? 'flex rounded-md bg-surface-2 p-1 shadow-[inset_0_0_0_1px_var(--c-line)]'
          : 'flex gap-5 border-b border-line',
        className,
      )}
    >
      {items.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${base}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(i + 1);
              else if (e.key === 'ArrowLeft') move(i - 1);
              else if (e.key === 'Home') move(0);
              else if (e.key === 'End') move(items.length - 1);
              else return;
              e.preventDefault();
            }}
            className={cx(
              'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 ease-standard',
              variant === 'pill'
                ? cx(
                    'h-8 flex-1 rounded-[8px] px-3 text-body-sm',
                    active ? 'bg-surface text-ink shadow-1' : 'text-muted hover:text-ink',
                  )
                : cx(
                    '-mb-px h-11 border-b-2 text-body',
                    active
                      ? 'border-brand text-ink'
                      : 'border-transparent text-muted hover:text-ink',
                  ),
            )}
          >
            {t.icon}
            {t.label}
            {t.badge}
          </button>
        );
      })}
    </div>
  );
}

/** Props for a panel controlled by <Tabs idBase={…}/>. */
export function tabPanelProps(idBase: string, id: string, active: boolean) {
  return {
    role: 'tabpanel' as const,
    id: `${idBase}-panel-${id}`,
    'aria-labelledby': `${idBase}-tab-${id}`,
    hidden: !active,
  };
}
