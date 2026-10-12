/**
 * Tile helpers: 16×16 textures from periodic noise (so they tile seamlessly in both directions),
 * plus edge treatments (caps, ceilings) built from the same texture so neighbours line up.
 */
import { Canvas, fbm, hash2, type Rng } from './core';

export const TILE = 16;

/** Periodic noise sampled on the tile grid: n(x, y) with period 16 in both axes. */
export function tileNoise(seed: number, cells = 4, octaves = 3) {
  return (x: number, y: number) => fbm(((x % TILE) + TILE) % TILE, ((y % TILE) + TILE) % TILE, { w: TILE, h: TILE, cells, octaves, seed, wrapX: true, wrapY: true });
}

/** Picks a colour from a dark → light ramp by value 0..1. */
export function pickRamp(ramp: readonly string[], v: number): string {
  return ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(v * ramp.length)))]!;
}

/** A tileable crack: a short random walk that wraps around tile edges. */
export function crack(c: Canvas, r: Rng, x: number, y: number, len: number, color: string, light?: string): void {
  let cx = x;
  let cy = y;
  for (let i = 0; i < len; i++) {
    const px = ((cx % TILE) + TILE) % TILE;
    const py = ((cy % TILE) + TILE) % TILE;
    c.set(px, py, color);
    if (light) c.set(px, (py + 1) % TILE, light);
    if (r.chance(0.6)) cx += r.chance(0.5) ? 1 : -1;
    else cy += 1;
  }
}

/** Copies a tile with a function that may override each pixel. */
export function derive(src: Canvas, fn: (x: number, y: number, col: [number, number, number, number]) => string | null | undefined | 'clear'): Canvas {
  const c = new Canvas(src.w, src.h);
  c.data.set(src.data);
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const v = fn(x, y, src.get(x, y));
      if (v === 'clear') c.clear(x, y);
      else if (v) c.set(x, y, v);
    }
  return c;
}

/** Stable per-pixel random in [0,1). */
export const px01 = (x: number, y: number, seed: number) => hash2(x, y, seed);

/**
 * Tileable Voronoi cells on the 16×16 tile: returns, for a pixel, the nearest cell id, the distance
 * to it and the gap to the second nearest (small gap = on a crack between stones).
 */
export function tileCells(seed: number, n: number) {
  const pts = Array.from({ length: n }, (_, i) => [hash2(i, 1, seed) * TILE, hash2(i, 2, seed) * TILE] as const);
  return (x: number, y: number) => {
    let d1 = 1e9;
    let d2 = 1e9;
    let id = 0;
    let cx = 0;
    let cy = 0;
    pts.forEach(([px, py], i) => {
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++) {
          const dx = x + 0.5 - (px + ox * TILE);
          const dy = (y + 0.5 - (py + oy * TILE)) * 1.25;
          const d = Math.hypot(dx, dy);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            id = i;
            cx = dx;
            cy = dy;
          } else if (d < d2) d2 = d;
        }
    });
    return { id, d1, gap: d2 - d1, dx: cx, dy: cy };
  };
}
