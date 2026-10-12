/**
 * Phaser-free maths for the atmosphere renderer and game feel, so it can be unit-tested.
 */
import type { Environment } from '@degamed/shared';

export type Rgb = [number, number, number];

/** '#RRGGBB' → [r, g, b] in 0..1. */
export function hexToRgb01(hex: string): Rgb {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgb01ToInt([r, g, b]: Rgb): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return (c(r) << 16) | (c(g) << 8) | c(b);
}

/** Scales a colour so its brightest channel is 1 (black stays black). */
export function normalizeRgb(c: Rgb): Rgb {
  const m = Math.max(c[0], c[1], c[2]);
  return m > 0 ? [c[0] / m, c[1] / m, c[2] / m] : [0, 0, 0];
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const LUMA: Rgb = [0.2126, 0.7152, 0.0722];

/**
 * A 4×5 colour matrix (Phaser's ColorMatrix layout, offsets in 0..255) for a grade:
 * saturation, then contrast around mid grey, then a multiplying tint.
 */
export function gradeMatrix(grade: { contrast?: number; saturation?: number; tint?: string } = {}): number[] {
  const s = grade.saturation ?? 1;
  const c = grade.contrast ?? 1;
  // The tint shifts hue without darkening: its brightest channel is treated as 1.
  const tint = grade.tint ? normalizeRgb(hexToRgb01(grade.tint)) : ([1, 1, 1] as Rgb);
  const m: number[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const sat = (row === col ? s : 0) + (1 - s) * LUMA[col]!;
      m.push(tint[row]! * c * sat);
    }
    m.push(0, tint[row]! * 0.5 * (1 - c) * 255);
  }
  m.push(0, 0, 0, 1, 0);
  return m;
}

/** Applies a gradeMatrix to one colour (0..1), for tests and previews. */
export function applyMatrix(m: number[], [r, g, b]: Rgb): Rgb {
  const row = (i: number) => m[i]! * r + m[i + 1]! * g + m[i + 2]! * b + m[i + 4]! / 255;
  return [row(0), row(5), row(10)];
}

/** Smooth 1D value noise in 0..1, deterministic per seed. */
export function noise1(t: number, seed = 0): number {
  const hash = (i: number) => {
    let x = Math.imul((i + seed * 7919) | 0, 0x27d4eb2d);
    x ^= x >>> 15;
    x = Math.imul(x, 0x165667b1);
    x ^= x >>> 13;
    return ((x >>> 0) % 10000) / 10000;
  };
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

/** Brightness multiplier for a flickering light: 1 when flicker is 0, dips towards 1 - flicker. */
export function flickerAt(time: number, flicker: number, seed = 0): number {
  if (flicker <= 0) return 1;
  const n = noise1(time * 9, seed) * 0.6 + noise1(time * 23, seed + 3) * 0.4;
  return 1 - flicker * 0.55 * n;
}

/** Ambient lightmap base colour (what unlit pixels are multiplied by). */
export function ambientColor(env: Environment | undefined): Rgb {
  const a = env?.ambient;
  if (!a) return [1, 1, 1];
  // The colour gives the hue of the shadows; intensity alone sets how bright they are.
  const c = normalizeRgb(hexToRgb01(a.color));
  const k = a.intensity ?? 1;
  return [c[0] * k, c[1] * k, c[2] * k];
}

/** True when the scene is dark enough that lights matter. */
export function needsLightmap(env: Environment | undefined): boolean {
  const [r, g, b] = ambientColor(env);
  return Math.max(r, g, b) < 0.98;
}

/**
 * How much fog veils each parallax layer (index 0 = farthest), as an alpha for a veil drawn
 * just in front of that layer. Veils stack, so far layers end up the haziest.
 */
export function fogVeilAlphas(layerCount: number, density: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < layerCount; i++) {
    const depth = layerCount <= 1 ? 1 : 1 - i / (layerCount - 1); // 1 far … 0 near
    out.push(Math.min(0.85, density * (0.18 + 0.35 * depth)));
  }
  return out;
}

/**
 * The display zoom for a pixel-art game in a container: whole-number zoom when it costs at most
 * 15% of the space (crisp, even pixels), otherwise the largest fractional zoom that fits.
 */
export function pixelZoom(containerW: number, containerH: number, gameW: number, gameH: number): number {
  const fit = Math.min(containerW / gameW, containerH / gameH);
  if (!isFinite(fit) || fit <= 0) return 1;
  if (fit < 1) return fit;
  const whole = Math.floor(fit);
  return whole / fit >= 0.85 ? whole : fit;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Finds the highest solid surface at `x` between `top` and `bottom` (for rain splashes).
 * Rects are top-left based. Returns null when there's nothing to land on.
 */
export function surfaceAt(rects: readonly Rect[], x: number, top: number, bottom: number): number | null {
  let best: number | null = null;
  for (const r of rects) {
    if (x < r.x || x > r.x + r.width) continue;
    if (r.y < top || r.y > bottom) continue;
    if (best === null || r.y < best) best = r.y;
  }
  return best;
}

/** Eases the camera's look-ahead towards where the target is heading. */
export function lookAheadStep(current: number, velocityX: number, lookAhead: number, dt: number): number {
  const target = Math.abs(velocityX) > 20 ? Math.sign(velocityX) * lookAhead : current * 0.98;
  const k = 1 - Math.pow(0.04, dt); // ~96% of the way per second
  return current + (target - current) * k;
}
