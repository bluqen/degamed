/**
 * Keyboard input with named actions ("jump", "left") mapped to KeyboardEvent.code values.
 * `pressed` is true only on the frame a key went down; call `endFrame()` once per frame.
 */

export const DEFAULT_ACTIONS: Record<string, string[]> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space'],
  action: ['KeyE', 'Enter'],
};

/** KeyboardEvent.code names, so scripts can write Key.SPACE instead of 'Space'. */
export const Key = {
  SPACE: 'Space',
  ENTER: 'Enter',
  ESCAPE: 'Escape',
  SHIFT: 'ShiftLeft',
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  A: 'KeyA',
  D: 'KeyD',
  E: 'KeyE',
  S: 'KeyS',
  W: 'KeyW',
  X: 'KeyX',
  Z: 'KeyZ',
} as const;

const GAME_KEYS = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

export class InputState {
  private down = new Set<string>();
  private justPressed = new Set<string>();
  private actions: Record<string, string[]>;
  private detach: () => void = () => {};

  constructor(actions: Record<string, string[]> = {}) {
    this.actions = { ...DEFAULT_ACTIONS, ...actions };
  }

  attach(target: Pick<Window, 'addEventListener' | 'removeEventListener'>) {
    const onDown = (e: KeyboardEvent) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.justPressed.add(e.code);
      this.down.add(e.code);
    };
    const onUp = (e: KeyboardEvent) => this.down.delete(e.code);
    const onBlur = () => this.down.clear();
    target.addEventListener('keydown', onDown as unknown as EventListener);
    target.addEventListener('keyup', onUp as unknown as EventListener);
    target.addEventListener('blur', onBlur);
    this.detach = () => {
      target.removeEventListener('keydown', onDown as unknown as EventListener);
      target.removeEventListener('keyup', onUp as unknown as EventListener);
      target.removeEventListener('blur', onBlur);
    };
  }

  dispose() {
    this.detach();
  }

  /** Simulates key events (touch controls, tests, AI play-testing). */
  press(code: string) {
    if (!this.down.has(code)) this.justPressed.add(code);
    this.down.add(code);
  }

  release(code: string) {
    this.down.delete(code);
  }

  private codes(name: string): string[] {
    return this.actions[name] ?? [name];
  }

  isDown(name: string): boolean {
    return this.codes(name).some((c) => this.down.has(c));
  }

  isPressed(name: string): boolean {
    return this.codes(name).some((c) => this.justPressed.has(c));
  }

  /** -1, 0 or 1 from left/right (horizontal) or up/down (vertical). */
  axis(which: 'horizontal' | 'vertical'): number {
    const [neg, pos] = which === 'horizontal' ? ['left', 'right'] : ['up', 'down'];
    return (this.isDown(pos) ? 1 : 0) - (this.isDown(neg) ? 1 : 0);
  }

  endFrame() {
    this.justPressed.clear();
  }
}
