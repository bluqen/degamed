/**
 * On-screen controls for phones and tablets. They appear the first time the screen is touched
 * (or straight away on touch-only devices) and drive the same InputState the keyboard does.
 */
import type { InputState } from './input';

export interface TouchLayout {
  move: 'horizontal' | 'stick' | 'none';
  buttons: { action: string; label: string }[];
}

export const DEFAULT_TOUCH: TouchLayout = { move: 'horizontal', buttons: [{ action: 'jump', label: 'A' }] };

/** Virtual key codes, so touch can't get stuck on a real keyboard key. */
const code = (action: string) => `Touch:${action}`;

const CSS = `
.dg-touch { position: absolute; inset: 0; pointer-events: none; z-index: 5; user-select: none; -webkit-user-select: none;
  touch-action: none; font: 600 16px/1 system-ui, sans-serif; }
.dg-touch[hidden] { display: none; }
.dg-touch .dg-pad { position: absolute; bottom: max(18px, env(safe-area-inset-bottom)); display: flex; gap: 14px; pointer-events: auto; }
.dg-touch .dg-left { left: max(18px, env(safe-area-inset-left)); }
.dg-touch .dg-right { right: max(18px, env(safe-area-inset-right)); align-items: flex-end; }
.dg-touch .dg-btn { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; color: rgba(255,255,255,.85);
  background: rgba(20,22,32,.38); border: 2px solid rgba(255,255,255,.28); backdrop-filter: blur(2px); transition: transform .06s, background .06s; }
.dg-touch .dg-btn.dg-on { background: rgba(255,255,255,.32); transform: scale(.94); }
.dg-touch .dg-btn.dg-big { width: 76px; height: 76px; }
.dg-touch .dg-stick { width: 120px; height: 120px; border-radius: 50%; background: rgba(20,22,32,.3); border: 2px solid rgba(255,255,255,.22); position: relative; }
.dg-touch .dg-knob { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; margin: -26px 0 0 -26px; border-radius: 50%;
  background: rgba(255,255,255,.35); border: 2px solid rgba(255,255,255,.4); }
.dg-touch svg { width: 26px; height: 26px; fill: currentColor; }
`;

const ARROW = (dir: 'left' | 'right') =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${dir === 'left' ? 'M15 5 8 12l7 7z' : 'M9 5l7 7-7 7z'}"/></svg>`;

/** Mounts touch controls in `parent`. Returns a cleanup function. */
export function mountTouchControls(parent: HTMLElement, input: InputState, layout: TouchLayout = DEFAULT_TOUCH): () => void {
  const doc = parent.ownerDocument;
  const root = doc.createElement('div');
  root.className = 'dg-touch';
  root.hidden = true;
  const style = doc.createElement('style');
  style.textContent = CSS;
  root.append(style);

  // Make actions reachable through the virtual codes.
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
    const stick = doc.createElement('div');
    stick.className = 'dg-stick';
    const knob = doc.createElement('div');
    knob.className = 'dg-knob';
    stick.append(knob);
    let active: number | null = null;
    const set = (dx: number, dy: number) => {
      const r = 34;
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, r / len);
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      const dead = 14;
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

  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const show = () => {
    root.hidden = false;
  };
  if (coarse || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && !matchMedia?.('(pointer: fine)').matches)) show();
  const onTouch = () => show();
  const onKey = () => {
    // A real keyboard is in use: get the buttons out of the way.
    if (!coarse) root.hidden = true;
  };
  parent.addEventListener('touchstart', onTouch, { passive: true });
  doc.defaultView?.addEventListener('keydown', onKey);
  return () => {
    parent.removeEventListener('touchstart', onTouch);
    doc.defaultView?.removeEventListener('keydown', onKey);
    root.remove();
  };
}
