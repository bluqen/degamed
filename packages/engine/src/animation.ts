/**
 * Animation helpers that don't need Phaser (so they can be unit-tested).
 */

/** Phaser animation key for one animation in one .frames.json file. */
export const animKey = (framesPath: string, name: string) => `${framesPath}#${name}`;

export interface MotionState {
  onFloor: boolean;
  vx: number;
  vy: number;
}

/** Names the automatic state machine looks for, in priority order per state. */
export const AUTO_STATES = {
  jump: ['jump', 'fall', 'idle'],
  fall: ['fall', 'jump', 'idle'],
  run: ['run', 'walk', 'idle'],
  idle: ['idle'],
} as const;

/**
 * Picks the animation a platformer character should show, like a tiny AnimationTree:
 * in the air → jump (going up) or fall (coming down); on the ground → run when moving, else idle.
 * Falls back to whatever the sprite actually has. Returns null if nothing fits.
 */
export function pickAutoAnimation(state: MotionState, available: ReadonlySet<string>, runThreshold = 12): string | null {
  const wanted: keyof typeof AUTO_STATES = !state.onFloor
    ? state.vy < 0
      ? 'jump'
      : 'fall'
    : Math.abs(state.vx) > runThreshold
      ? 'run'
      : 'idle';
  for (const name of AUTO_STATES[wanted]) if (available.has(name)) return name;
  return available.size ? [...available][0]! : null;
}

/** Lists frame numbers that don't exist in a sheet of `columns × rows` frames. */
export function missingFrames(frames: number[], columns: number, rows: number): number[] {
  const total = columns * rows;
  return frames.filter((f) => f >= total);
}
