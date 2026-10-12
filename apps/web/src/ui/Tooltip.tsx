import { cloneElement, useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';

type Side = 'top' | 'bottom';

/**
 * A small label shown on hover (after a short delay) and on keyboard focus.
 * Wraps one focusable element and links it with aria-describedby only when the
 * label adds something beyond the element's own name.
 */
export function Tooltip({
  label,
  children,
  side = 'bottom',
  delay = 450,
}: {
  label: string;
  children: ReactElement<Record<string, unknown>>;
  side?: Side;
  delay?: number;
}) {
  const id = useId();
  const [pos, setPos] = useState<{ x: number; y: number; side: Side } | null>(null);
  const timer = useRef<number>(undefined);

  const show = (el: HTMLElement, wait: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      const s: Side =
        side === 'top' && r.top < 48
          ? 'bottom'
          : side === 'bottom' && r.bottom > window.innerHeight - 48
            ? 'top'
            : side;
      setPos({ x: r.left + r.width / 2, y: s === 'top' ? r.top - 8 : r.bottom + 8, side: s });
    }, wait);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setPos(null);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, true);
    };
  }, [pos]);

  const p = children.props;
  const child = cloneElement(children, {
    onPointerEnter: (e: React.PointerEvent<HTMLElement>) => {
      (p.onPointerEnter as ((e: unknown) => void) | undefined)?.(e);
      if (e.pointerType === 'mouse') show(e.currentTarget, delay);
    },
    onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
      (p.onPointerLeave as ((e: unknown) => void) | undefined)?.(e);
      hide();
    },
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      (p.onPointerDown as ((e: unknown) => void) | undefined)?.(e);
      hide();
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      (p.onFocus as ((e: unknown) => void) | undefined)?.(e);
      if (e.currentTarget.matches(':focus-visible')) show(e.currentTarget, 0);
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      (p.onBlur as ((e: unknown) => void) | undefined)?.(e);
      hide();
    },
    'aria-describedby': pos && p['aria-label'] !== label ? id : undefined,
  });

  return (
    <>
      {child}
      {pos &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={{ left: pos.x, top: pos.y }}
            className={`pointer-events-none fixed z-[200] max-w-64 -translate-x-1/2 animate-fade-in rounded-sm bg-[#1d1c27] px-2 py-1 text-caption font-medium text-white shadow-2 dark:bg-[#33323f] ${pos.side === 'top' ? '-translate-y-full' : ''}`}
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  );
}
