/**
 * Tile helpers: 16×16 textures from periodic noise (so they tile seamlessly in both directions),
 * plus edge treatments (caps, ceilings) built from the same texture so neighbours line up.
 */
import { Canvas, fbm, hash2, rgb, type Rng } from './core';

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

/**
 * A background-wall tile from a fill tile: pulled toward a dark, desaturated colour and given a
 * soft pattern so it reads as "behind" the playable terrain without competing with it.
 */
export function backWall(src: Canvas, toward: string, amt: number, pattern?: (x: number, y: number) => number): Canvas {
  const t = rgb(toward);
  const c = new Canvas(src.w, src.h);
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const [r, g, b, a] = src.get(x, y);
      if (!a) continue;
      const l = (r + g + b) / 3;
      const k = Math.min(1, amt + (pattern ? pattern(x, y) : 0));
      // desaturate a little, then pull toward the wall colour
      const d = [r * 0.6 + l * 0.4, g * 0.6 + l * 0.4, b * 0.6 + l * 0.4];
      c.set(x, y, [d[0]! + (t[0] - d[0]!) * k, d[1]! + (t[1] - d[1]!) * k, d[2]! + (t[2] - d[2]!) * k]);
    }
  return c;
}

/**
 * Bevelled edges for a back-wall area so it reads as a recessed alcove: a lit lip along the
 * bottom (light from above falls on the sill), an inner shadow under the top and left edges.
 */
export function backEdges(back: Canvas, lit: string, dark: string): Record<'backTop' | 'backBottom' | 'backLeft' | 'backRight', Canvas> {
  const edge = (fn: (x: number, y: number) => string | null) => derive(back, (x, y) => fn(x, y));
  return {
    backTop: edge((x, y) => (y === 0 ? dark : y === 1 ? dark : y === 2 && (x + y) % 2 === 0 ? dark : null)),
    backBottom: edge((x, y) => (y === 15 ? lit : y === 14 && x % 3 !== 0 ? lit : null)),
    backLeft: edge((x, y) => (x === 0 || x === 1 ? dark : x === 2 && (x + y) % 2 === 0 ? dark : null)),
    backRight: edge((x, y) => (x === 15 ? lit : null)),
  };
}
