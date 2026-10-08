import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, RotateCcw, X } from 'lucide-react';

/* ─── Menus ─────────────────────────────────────────────────────────────── */

export type MenuItem =
  | { type?: 'item'; label: string; shortcut?: string; icon?: ReactNode; disabled?: boolean; checked?: boolean; danger?: boolean; onSelect: () => void }
  | { type: 'separator' }
  | { type: 'submenu'; label: string; icon?: ReactNode; items: MenuItem[] }
  | { type: 'heading'; label: string };

/** A dropdown/context menu list with keyboard navigation. Positioned with fixed coordinates. */
export function MenuList({ items, x, y, onClose, minWidth = 220 }: { items: MenuItem[]; x: number; y: number; onClose: () => void; minWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const [sub, setSub] = useState<{ index: number; x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.max(4, Math.min(x, window.innerWidth - r.width - 4)),
      y: Math.max(4, Math.min(y, window.innerHeight - r.height - 4)),
    });
    el.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  }, [x, y]);

  const focusable = () => [...(ref.current?.querySelectorAll<HTMLButtonElement>(':scope > button:not([disabled])') ?? [])];

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left: pos.x, top: pos.y, minWidth }}
      className="fixed z-[100] flex flex-col rounded-md border border-[#2E3342] bg-[#1A1D25] py-1 text-[12.5px] shadow-[0_12px_32px_rgba(0,0,0,.55)]"
      onKeyDown={(e) => {
        const list = focusable();
        const i = list.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          list[(i + 1) % list.length]?.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          list[(i - 1 + list.length) % list.length]?.focus();
        } else if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {items.map((item, i) => {
        if (item.type === 'separator') return <div key={i} role="separator" className="my-1 border-t border-[#2A2E3A]" />;
        if (item.type === 'heading')
          return (
            <div key={i} className="px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-[#7D8496] uppercase">
              {item.label}
            </div>
          );
        if (item.type === 'submenu')
          return (
            <button
              key={i}
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              className="flex items-center gap-2 px-3 py-[5px] text-left text-ink-2 hover:bg-[#2B2550] hover:text-white focus:bg-[#2B2550] focus:text-white focus:outline-none focus-visible:outline-none"
              onMouseEnter={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setSub({ index: i, x: r.right - 2, y: r.top - 4 });
              }}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setSub({ index: i, x: r.right - 2, y: r.top - 4 });
              }}
            >
              <span className="flex w-4 justify-center text-muted">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              <ChevronRight size={13} aria-hidden="true" />
            </button>
          );
        return (
          <button
            key={i}
            type="button"
            role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={item.checked}
            disabled={item.disabled}
            onMouseEnter={() => setSub(null)}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            className={`flex items-center gap-2 px-3 py-[5px] text-left hover:bg-[#2B2550] focus:bg-[#2B2550] focus:outline-none focus-visible:outline-none disabled:opacity-40 disabled:hover:bg-transparent ${
              item.danger ? 'text-[#FF9C9C]' : 'text-ink-2 hover:text-white focus:text-white'
            }`}
          >
            <span className="flex w-4 justify-center text-muted">{item.checked ? <Check size={13} className="text-cyan" /> : item.icon}</span>
            <span className="flex-1 whitespace-nowrap">{item.label}</span>
            {item.shortcut && <kbd className="ml-6 font-sans text-[11px] text-[#7D8496]">{item.shortcut}</kbd>}
          </button>
        );
      })}
      {sub && items[sub.index]?.type === 'submenu' && (
        <MenuList items={(items[sub.index] as { items: MenuItem[] }).items} x={sub.x} y={sub.y} onClose={onClose} />
      )}
    </div>
  );
}

/** Closes on outside pointer down, Escape, blur or resize. */
function useDismiss(open: boolean, onClose: () => void, ignore?: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ignore?.current?.contains(t)) return;
      if ((t as Element).closest?.('[role="menu"]')) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key);
    window.addEventListener('resize', onClose);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('blur', onClose);
    };
  }, [open, onClose, ignore]);
}

/** Desktop-style menu bar: click opens, hovering moves between open menus. */
export function MenuBar({ menus }: { menus: { label: string; items: MenuItem[] }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(null), []);
  useDismiss(open !== null, close, bar);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const openAt = (i: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setAnchor({ x: r.left, y: r.bottom + 2 });
    setOpen(i);
  };
  return (
    <div ref={bar} role="menubar" className="flex items-center">
      {menus.map((m, i) => (
        <button
          key={m.label}
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={open === i}
          onClick={(e) => (open === i ? setOpen(null) : openAt(i, e.currentTarget))}
          onMouseEnter={(e) => open !== null && open !== i && openAt(i, e.currentTarget)}
          className={`rounded px-2.5 py-1 text-[12.5px] ${open === i ? 'bg-[#2B2550] text-white' : 'text-ink-2 hover:bg-[#1E212B] hover:text-white'}`}
        >
          {m.label}
        </button>
      ))}
      {open !== null && menus[open] && createPortal(<MenuList items={menus[open].items} x={anchor.x} y={anchor.y} onClose={close} />, document.body)}
    </div>
  );
}

type ContextMenuState = { items: MenuItem[]; x: number; y: number } | null;
const ContextMenuCtx = createContext<(items: MenuItem[], e: { clientX: number; clientY: number }) => void>(() => {});

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ContextMenuState>(null);
  const close = useCallback(() => setState(null), []);
  useDismiss(state !== null, close);
  const show = useCallback((items: MenuItem[], e: { clientX: number; clientY: number }) => setState({ items, x: e.clientX, y: e.clientY }), []);
  return (
    <ContextMenuCtx.Provider value={show}>
      {children}
      {state && createPortal(<MenuList items={state.items} x={state.x} y={state.y} onClose={close} />, document.body)}
    </ContextMenuCtx.Provider>
  );
}

export const useContextMenu = () => useContext(ContextMenuCtx);

/** Button that opens a dropdown menu below itself. */
export function MenuButton({ items, children, label, className = '' }: { items: MenuItem[]; children: ReactNode; label: string; className?: string }) {
  const show = useContextMenu();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-haspopup="menu"
      className={className || 'flex size-6 items-center justify-center rounded text-muted hover:bg-[#232734] hover:text-white'}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        show(items, { clientX: r.left, clientY: r.bottom + 2 });
      }}
    >
      {children}
    </button>
  );
}

/* ─── Layout ────────────────────────────────────────────────────────────── */

/** A draggable divider. `axis="x"` resizes widths (vertical bar), `"y"` heights. */
export function Splitter({ axis, onDrag, onDone, label }: { axis: 'x' | 'y'; onDrag: (delta: number) => void; onDone?: () => void; label: string }) {
  const start = useRef<number | null>(null);
  const move = (e: RPointerEvent) => {
    if (start.current === null) return;
    const now = axis === 'x' ? e.clientX : e.clientY;
    onDrag(now - start.current);
    start.current = now;
  };
  return (
    <div
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-label={label}
      className={`group relative z-10 shrink-0 bg-[#1F222B] ${axis === 'x' ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize'}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = axis === 'x' ? e.clientX : e.clientY;
      }}
      onPointerMove={move}
      onPointerUp={() => {
        start.current = null;
        onDone?.();
      }}
    >
      <span className={`absolute group-hover:bg-[#6B4EFF]/60 ${axis === 'x' ? '-inset-x-[3px] inset-y-0' : '-inset-y-[3px] inset-x-0'}`} />
    </div>
  );
}

/** Tab strip used by docks and the bottom panel. */
export function TabStrip<T extends string>({
  tabs,
  active,
  onChange,
  right,
  dense,
}: {
  tabs: { id: T; label: ReactNode; badge?: ReactNode }[];
  active: T | null;
  onChange: (id: T) => void;
  right?: ReactNode;
  dense?: boolean;
}) {
  return (
    <div role="tablist" className={`flex shrink-0 items-center gap-0.5 border-b border-[#1F222B] bg-[#13151B] px-1 ${dense ? 'h-7' : 'h-8'}`}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={`relative flex h-full items-center gap-1.5 px-2.5 text-[12px] ${
            active === t.id ? 'text-white after:absolute after:inset-x-1.5 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#7C5CFF]' : 'text-[#8C93A5] hover:text-white'
          }`}
        >
          {t.label}
          {t.badge}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-0.5 pr-1">{right}</div>
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  active,
  disabled,
  shortcut,
  className = '',
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  shortcut?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-7 shrink-0 items-center justify-center rounded disabled:opacity-35 ${
        active ? 'bg-[#2B2550] text-white ring-1 ring-[#4B3BA8]' : 'text-[#A3A9B8] hover:bg-[#232734] hover:text-white'
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* ─── Dialogs ───────────────────────────────────────────────────────────── */

export function Dialog({
  title,
  onClose,
  children,
  footer,
  width = 560,
  height,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  height?: number | string;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    (el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>('input,button,select,textarea'))?.focus();
    return () => prev?.focus?.();
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        style={{ width, height }}
        className="flex max-h-[min(88vh,820px)] max-w-full flex-col overflow-hidden rounded-lg border border-[#2E3342] bg-[#16181F] text-[12.5px] shadow-[0_24px_64px_rgba(0,0,0,.6)]"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
          // Keep focus inside the dialog.
          if (e.key === 'Tab') {
            const list = [...(ref.current?.querySelectorAll<HTMLElement>('input,button,select,textarea,[tabindex="0"]') ?? [])].filter((n) => !n.hasAttribute('disabled'));
            const first = list[0];
            const last = list[list.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="flex h-10 shrink-0 items-center border-b border-[#252935] bg-[#1A1D25] px-4">
          <h2 id={id} className="text-[13px] font-semibold">
            {title}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="ml-auto rounded p-1 text-muted hover:bg-[#232734] hover:text-white">
            <X size={15} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#252935] bg-[#14161C] px-4 py-2.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Btn({
  children,
  onClick,
  primary,
  danger,
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-7 items-center gap-1.5 rounded px-3 text-[12.5px] font-medium disabled:opacity-40 ${
        primary
          ? 'bg-[#6B4EFF] text-white hover:bg-[#7C61FF]'
          : danger
            ? 'bg-[#4A1D24] text-[#FFB4B4] hover:bg-[#5C232C]'
            : 'border border-[#2E3342] bg-[#1C1F28] text-ink-2 hover:border-[#3A4052] hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

/* ─── Property fields ───────────────────────────────────────────────────── */

export const fieldInput =
  'h-6 w-full min-w-0 rounded-[4px] border border-[#2A2E3A] bg-[#0F1015] px-1.5 text-[12px] text-ink outline-none hover:border-[#373C4C] focus:border-[#6B4EFF]';

/** A property row: label on the left, editor on the right, optional revert arrow. */
export function PropRow({ label, children, onRevert, hint }: { label: string; children: ReactNode; onRevert?: () => void; hint?: string }) {
  return (
    <div className="group flex min-h-[26px] items-center gap-2 px-3" title={hint}>
      <span className="w-[38%] min-w-[70px] shrink-0 truncate text-[12px] text-[#9AA1B2]">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1">{children}</div>
      <span className="flex w-4 justify-center">
        {onRevert && (
          <button type="button" aria-label={`Reset ${label}`} title="Reset to default" onClick={onRevert} className="text-[#8C7BFF] hover:text-white">
            <RotateCcw size={11} />
          </button>
        )}
      </span>
    </div>
  );
}

/**
 * A number box you can also drag sideways to scrub, like the spin sliders in desktop engines.
 * `onChange` fires while scrubbing; `onCommit` once it ends (for undo grouping).
 */
export function NumberField({
  value,
  onChange,
  onCommit,
  step = 1,
  min,
  max,
  prefix,
  prefixColor,
  label,
  decimals = 2,
}: {
  value: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
  step?: number;
  min?: number;
  max?: number;
  prefix?: string;
  prefixColor?: string;
  label: string;
  decimals?: number;
}) {
  const [text, setText] = useState<string | null>(null);
  const drag = useRef<{ x: number; v: number; moved: boolean } | null>(null);
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  const round = (v: number) => Number(v.toFixed(decimals));
  const shown = text ?? String(round(value));
  return (
    <div className="flex h-6 min-w-0 flex-1 items-center rounded-[4px] border border-[#2A2E3A] bg-[#0F1015] hover:border-[#373C4C] focus-within:border-[#6B4EFF]">
      {prefix && (
        <span
          className="cursor-ew-resize px-1.5 text-[11px] font-semibold select-none"
          style={{ color: prefixColor ?? '#8C93A5' }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, v: value, moved: false };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const dx = e.clientX - d.x;
            if (Math.abs(dx) > 2) d.moved = true;
            if (d.moved) onChange(clamp(round(d.v + Math.round(dx / 2) * step * (e.shiftKey ? 10 : 1))));
          }}
          onPointerUp={() => {
            if (drag.current?.moved) onCommit?.();
            drag.current = null;
          }}
        >
          {prefix}
        </span>
      )}
      <input
        aria-label={label}
        inputMode="decimal"
        value={shown}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => {
          if (text !== null) {
            const n = Number(text);
            if (text.trim() !== '' && Number.isFinite(n)) {
              onChange(clamp(n));
              onCommit?.();
            }
          }
          setText(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setText(null);
            e.currentTarget.blur();
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            onChange(clamp(round(value + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1))));
            onCommit?.();
          }
        }}
        className="h-full w-full min-w-0 bg-transparent px-1.5 text-[12px] text-ink tabular-nums outline-none"
      />
    </div>
  );
}

export function TextField({ value, onCommit, label, placeholder, mono }: { value: string; onCommit: (v: string) => void; label: string; placeholder?: string; mono?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      value={text ?? value}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text !== null && text !== value) onCommit(text);
        setText(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setText(null);
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
      className={`${fieldInput} ${mono ? 'font-mono' : ''}`}
    />
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-2">
      <input type="checkbox" className="size-3.5 accent-[#7C5CFF]" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span>{checked ? 'On' : 'Off'}</span>
    </label>
  );
}

export function SelectField<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)} className={`${fieldInput} pr-5`}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function ColorField({ value, onChange, label, onClear }: { value: string | undefined; onChange: (v: string) => void; label: string; onClear?: () => void }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <input
        type="color"
        aria-label={label}
        value={value ?? '#ffffff'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-6 w-9 shrink-0 cursor-pointer rounded-[4px] border border-[#2A2E3A] bg-[#0F1015] p-0.5"
      />
      <span className="truncate font-mono text-[11.5px] text-[#9AA1B2]">{value ?? 'none'}</span>
      {onClear && value && (
        <button type="button" onClick={onClear} className="ml-auto text-[11px] text-muted hover:text-white">
          Clear
        </button>
      )}
    </div>
  );
}

/** Collapsible inspector section. */
export function Section({
  title,
  icon,
  children,
  menu,
  defaultOpen = true,
  accent,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  menu?: ReactNode;
  defaultOpen?: boolean;
  accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-[#1F222B]">
      <div className="flex h-7 items-center gap-1.5 bg-[#191B23] pr-1.5 pl-1.5">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-1.5 text-left text-[12px] font-semibold text-ink">
          <ChevronRight size={13} className={`text-muted transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
          <span style={{ color: accent }} className="flex">
            {icon}
          </span>
          {title}
        </button>
        {menu}
      </div>
      {open && <div className="flex flex-col gap-0.5 py-1.5">{children}</div>}
    </section>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-[#2E3342] bg-[#0F1015] px-1.5 py-px font-sans text-[11px] text-ink-2">{children}</kbd>;
}
