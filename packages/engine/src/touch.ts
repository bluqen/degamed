/**
 * On-screen controls for phones and tablets. They appear on touch devices (or after the first
 * touch) and drive the same InputState the keyboard does.
 *
 * Placement (decided by the runtime from the space around the game):
 * - 'below': portrait screens: the game sits at the top and the controls get the space under it,
 *   Game Boy style, so thumbs never cover the action.
 * - 'sides': landscape screens with letterbox bars: the controls sit in the bars.
 * - 'overlay': otherwise, semi-transparent and sized to the screen.
 */
import type { InputState } from './input';

export interface TouchLayout {
  move: 'horizontal' | 'stick' | 'none';
  buttons: { action: string; label: string }[];
}

export const DEFAULT_TOUCH: TouchLayout = { move: 'horizontal', buttons: [{ action: 'jump', label: 'A' }] };

export type TouchPlacement = 'below' | 'sides' | 'overlay';

export interface TouchFrame {
  /** The box the game lives in. */
  width: number;
  height: number;
  /** Where the game is drawn inside it. */
  game: { x: number; y: number; width: number; height: number };
  placement: TouchPlacement;
}

export interface TouchControls {
  /** True once the controls are showing (a touch device, or the screen was touched). */
  readonly visible: boolean;
  /** Called by the runtime whenever the game is resized or moved. */
  layout(frame: TouchFrame): void;
  /** Called when visibility changes, so the runtime can make room below the game. */
  onVisibilityChange: (() => void) | null;
  dispose(): void;
}

/** How much space below the game the controls want in portrait. */
export function belowStripHeight(boxW: number, boxH: number): number {
  return Math.round(Math.max(150, Math.min(260, boxH * 0.36, boxW * 0.62)));
}

/** Chooses where the controls go for a box of this size and a game of this aspect. */
export function choosePlacement(boxW: number, boxH: number, gameW: number, gameH: number): TouchPlacement {
  const fitH = boxW * (gameH / gameW);
  if (boxH - fitH >= 150) return 'below';
  const fitW = boxH * (gameW / gameH);
  if ((boxW - fitW) / 2 >= Math.min(boxW, boxH) * 0.16) return 'sides';
  return 'overlay';
}

/** Virtual key codes, so touch can't get stuck on a real keyboard key. */
const code = (action: string) => `Touch:${action}`;

const CSS = `
.dg-touch { position: absolute; inset: 0; pointer-events: none; z-index: 5; user-select: none; -webkit-user-select: none;
  touch-action: none; font: 700 16px/1 system-ui, sans-serif; --s: 64px; }
.dg-touch[hidden] { display: none; }
.dg-touch .dg-pad { position: absolute; display: flex; gap: calc(var(--s) * 0.22); pointer-events: auto; align-items: center; }
.dg-touch .dg-btn { width: var(--s); height: var(--s); border-radius: 50%; display: grid; place-items: center;
  color: rgba(255,255,255,.9); font-size: calc(var(--s) * 0.28); letter-spacing: .02em;
  background: rgba(20,22,32,.42); border: 2px solid rgba(255,255,255,.3); transition: transform .06s, background .06s; }
.dg-touch .dg-btn.dg-on { background: rgba(255,255,255,.34); transform: scale(.94); }
.dg-touch .dg-btn.dg-big { width: calc(var(--s) * 1.18); height: calc(var(--s) * 1.18); }
.dg-touch .dg-stick { width: calc(var(--s) * 1.8); height: calc(var(--s) * 1.8); border-radius: 50%;
  background: rgba(20,22,32,.34); border: 2px solid rgba(255,255,255,.24); position: relative; }
.dg-touch .dg-knob { position: absolute; left: 50%; top: 50%; width: calc(var(--s) * 0.8); height: calc(var(--s) * 0.8);
  transform: translate(-50%, -50%); border-radius: 50%; background: rgba(255,255,255,.36); border: 2px solid rgba(255,255,255,.42); }
.dg-touch svg { width: 42%; height: 42%; fill: currentColor; }
.dg-touch.dg-overlay .dg-pad { opacity: .5; }
.dg-touch.dg-below { background: linear-gradient(#0e0f15, #07080c); }
`;

const ARROW = (dir: 'left' | 'right') =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${dir === 'left' ? 'M15 5 8 12l7 7z' : 'M9 5l7 7-7 7z'}"/></svg>`;

/** Mounts touch controls in `parent`. */
export function mountTouchControls(parent: HTMLElement, input: InputState, layout: TouchLayout = DEFAULT_TOUCH): TouchControls {
  const doc = parent.ownerDocument;
  const root = doc.createElement('div');
  root.className = 'dg-touch';
  root.hidden = true;
  const style = doc.createElement('style');
  style.textContent = CSS;
  root.append(style);

  const actions = new Set([...layout.buttons.map((b) => b.action), 'left', 'right', 'up', 'down']);
  for (const a of actions) input.addBinding(a, code(a));

  const hold = (el: HTMLElement, action: string) => {
    const pointers = new Set<number>();
    const update = () => {
      el.classList.toggle('dg-on', pointers.size > 0);
      if (pointers.size) input.press(code(action));
      else input.release(code(action));
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      pointers.add(e.pointerId);
      update();
    });
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      update();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  };

  const left = doc.createElement('div');
  left.className = 'dg-pad dg-left';
  let stickEl: HTMLElement | null = null;
  if (layout.move === 'horizontal') {
    for (const dir of ['left', 'right'] as const) {
      const b = doc.createElement('div');
      b.className = 'dg-btn';
      b.innerHTML = ARROW(dir);
      b.setAttribute('aria-label', dir === 'left' ? 'Move left' : 'Move right');
      hold(b, dir);
      left.append(b);
    }
  } else if (layout.move === 'stick') {
    const stick = (stickEl = doc.createElement('div'));
    stick.className = 'dg-stick';
    const knob = doc.createElement('div');
    knob.className = 'dg-knob';
    stick.append(knob);
    let active: number | null = null;
    const set = (dx: number, dy: number) => {
      const r = stick.getBoundingClientRect().width * 0.3;
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, r / len);
      knob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
      const dead = r * 0.4;
      const apply = (action: string, on: boolean) => (on ? input.press(code(action)) : input.release(code(action)));
      apply('left', dx < -dead);
      apply('right', dx > dead);
      apply('up', dy < -dead);
      apply('down', dy > dead);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== active) return;
      const rect = stick.getBoundingClientRect();
      set(e.clientX - rect.left - rect.width / 2, e.clientY - rect.top - rect.height / 2);
    };
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      active = e.pointerId;
      stick.setPointerCapture?.(e.pointerId);
      move(e);
    });
    stick.addEventListener('pointermove', move);
    const end = (e: PointerEvent) => {
      if (e.pointerId !== active) return;
      active = null;
      set(0, 0);
    };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    left.append(stick);
  }

  const right = doc.createElement('div');
  right.className = 'dg-pad dg-right';
  layout.buttons.forEach((btn, i) => {
    const b = doc.createElement('div');
    b.className = i === 0 ? 'dg-btn dg-big' : 'dg-btn';
    b.textContent = btn.label;
    b.setAttribute('aria-label', btn.action);
    hold(b, btn.action);
    // The main button sits on the far right, under the thumb.
    right.prepend(b);
  });
  root.append(left, right);
  parent.append(root);

  const controls: TouchControls = {
    get visible() {
      return !root.hidden;
    },
    onVisibilityChange: null,
    layout(f) {
      const short = Math.min(f.width, f.height);
      root.className = `dg-touch dg-${f.placement}`;
      const place = (el: HTMLElement, css: Partial<CSSStyleDeclaration>) => {
        el.style.left = el.style.right = el.style.top = el.style.bottom = el.style.transform = '';
        el.style.flexDirection = '';
        Object.assign(el.style, css);
      };
      if (f.placement === 'below') {
        const top = f.game.y + f.game.height;
        const strip = f.height - top;
        const s = Math.round(Math.max(56, Math.min(96, strip * 0.4, f.width * 0.2)));
        root.style.setProperty('--s', `${s}px`);
        root.style.top = `${top}px`;
        const mid = `${Math.round(strip / 2)}px`;
        place(left, { left: '6%', top: mid, transform: 'translateY(-50%)' });
        place(right, { right: '6%', top: mid, transform: 'translateY(-50%)' });
      } else if (f.placement === 'sides') {
        root.style.top = '0';
        const bar = f.game.x;
        const s = Math.round(Math.max(44, Math.min(84, bar * 0.62, short * 0.2)));
        root.style.setProperty('--s', `${s}px`);
        const cx = `${Math.round(bar / 2)}px`;
        place(left, { left: cx, bottom: '10%', transform: 'translateX(-50%)', flexDirection: stickEl ? 'row' : 'column' });
        place(right, { right: cx, bottom: '10%', transform: 'translateX(50%)', flexDirection: 'column-reverse' });
        if (stickEl) stickEl.style.width = stickEl.style.height = `${Math.round(Math.min(bar * 0.92, s * 1.8))}px`;
      } else {
        root.style.top = '0';
        // No more than ~20% of the shorter side, and half transparent.
        const s = Math.round(Math.max(40, Math.min(80, short * 0.18)));
        root.style.setProperty('--s', `${s}px`);
        const edge = `${Math.round(Math.max(10, short * 0.04))}px`;
        place(left, { left: edge, bottom: edge });
        place(right, { right: edge, bottom: edge });
      }
    },
    dispose() {
      parent.removeEventListener('touchstart', onTouch);
      doc.defaultView?.removeEventListener('keydown', onKey);
      root.remove();
    },
  };

  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const setVisible = (v: boolean) => {
    if (root.hidden === !v) return;
    root.hidden = !v;
    controls.onVisibilityChange?.();
  };
  if (coarse || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && !matchMedia?.('(pointer: fine)').matches)) root.hidden = false;
  const onTouch = () => setVisible(true);
  const onKey = () => {
    // A real keyboard is in use: get the buttons out of the way.
    if (!coarse) setVisible(false);
  };
  parent.addEventListener('touchstart', onTouch, { passive: true });
  doc.defaultView?.addEventListener('keydown', onKey);
  return controls;
}
