import { useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { cx } from './cx';

export type MenuEntry =
  | { type?: 'item'; label: string; description?: string; icon?: ReactNode; checked?: boolean; disabled?: boolean; danger?: boolean; onSelect: () => void }
  | { type: 'separator' }
  | { type: 'heading'; label: string };

/**
 * A dropdown menu anchored to a trigger. Arrow keys move, Enter selects,
 * Escape closes and returns focus to the trigger.
 */
export function Menu({ trigger, items, align = 'end', label, width = 240 }: { trigger: ReactElement<Record<string, unknown>>; items: MenuEntry[]; align?: 'start' | 'end'; label: string; width?: number }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const anchor = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const place = () => {
    const btn = anchor.current?.firstElementChild as HTMLElement | null;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const x = align === 'end' ? r.right - width : r.left;
    setPos({ x: Math.max(8, Math.min(x, window.innerWidth - width - 8)), y: r.bottom + 6 });
  };

  useLayoutEffect(() => {
    if (!open) return;
    const el = list.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8) {
      const btn = anchor.current?.firstElementChild as HTMLElement | null;
      const top = btn ? btn.getBoundingClientRect().top - r.height - 6 : window.innerHeight - r.height - 8;
      setPos((p) => ({ ...p, y: Math.max(8, top) }));
    }
    el.querySelector<HTMLButtonElement>('[role^=menuitem]:not([disabled])')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!list.current?.contains(e.target as Node) && !anchor.current?.contains(e.target as Node)) setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) (anchor.current?.firstElementChild as HTMLElement | null)?.focus();
  };

  const focusables = () => [...(list.current?.querySelectorAll<HTMLButtonElement>('[role^=menuitem]:not([disabled])') ?? [])];

  return (
    <>
      <span
        ref={anchor}
        className="contents"
        onClick={() => {
          if (!open) place();
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            place();
            setOpen(true);
          }
        }}
      >
        {trigger}
      </span>
      {open &&
        createPortal(
          <div
            ref={list}
            role="menu"
            aria-label={label}
            style={{ left: pos.x, top: pos.y, width }}
            className="fixed z-[150] flex animate-pop flex-col rounded-lg border border-line bg-surface p-1.5 text-ink shadow-3"
            onKeyDown={(e) => {
              const all = focusables();
              const i = all.indexOf(document.activeElement as HTMLButtonElement);
              if (e.key === 'ArrowDown') all[(i + 1) % all.length]?.focus();
              else if (e.key === 'ArrowUp') all[(i - 1 + all.length) % all.length]?.focus();
              else if (e.key === 'Home') all[0]?.focus();
              else if (e.key === 'End') all[all.length - 1]?.focus();
              else if (e.key === 'Escape' || e.key === 'Tab') close(e.key === 'Escape');
              else return;
              e.preventDefault();
            }}
          >
            {items.map((item, i) => {
              if (item.type === 'separator') return <div key={i} role="separator" className="mx-1 my-1.5 h-px bg-line" />;
              if (item.type === 'heading')
                return (
                  <div key={i} className="px-2.5 pt-2 pb-1 text-caption font-semibold text-muted">
                    {item.label}
                  </div>
                );
              return (
                <button
                  key={i}
                  type="button"
                  role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                  aria-checked={item.checked}
                  disabled={item.disabled}
                  onClick={() => {
                    close();
                    item.onSelect();
                  }}
                  className={cx(
                    'flex min-h-9 items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-left text-body-sm outline-none hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none disabled:opacity-45',
                    item.danger ? 'text-bad' : 'text-ink',
                  )}
                >
                  {item.icon && <span className="flex w-4 shrink-0 justify-center text-muted">{item.icon}</span>}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{item.label}</span>
                    {item.description && <span className="text-caption text-muted">{item.description}</span>}
                  </span>
                  {item.checked && <Check size={16} className="shrink-0 text-brand-ink" aria-hidden="true" />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
