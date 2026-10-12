/**
 * Large decals that break up repeating fill: cracks, embedded pipes, bones, roots, fossils,
 * glowing veins, buried stones and grates. Each is drawn with the theme's own ramps through an
 * indexed surface (so shading steps along ramps) and has a transparent background, to be drawn
 * over solid fill or back-wall tiles.
 */
import { Ix, Palette, rng } from './core';
import type { Raster } from '../pixel';

/** A branching crack: dark gash with a lit lower lip (light comes from above). */
export function crackDecal(w: number, h: number, dark: string, deep: string, lip: string, seed: number): Raster {
  const pal = new Palette();
  const [D, d, L] = pal.ramp([deep, dark, lip]);
  const c = new Ix(w, h, pal);
  const r = rng(seed);
  const walk = (x: number, y: number, len: number, dir: number, depth: number) => {
    for (let i = 0; i < len; i++) {
      c.set(x, y, depth > 0 ? D! : d!);
      if (depth > 0 && i < len * 0.6) c.set(x + 1, y, d!);
      if (!c.get(x, y + 1)) c.set(x, y + 1, L!);
      if (r.chance(0.55)) x += dir;
      else y += r.chance(0.7) ? 1 : -1;
      x += r.chance(0.15) ? -dir : 0;
      if (depth > 0 && r.chance(0.12)) walk(x, y, Math.floor(len / 3), r.chance(0.5) ? 1 : -1, depth - 1);
      if (x < 1 || x > w - 2 || y < 1 || y > h - 2) break;
    }
  };
  walk(Math.floor(w * 0.2), Math.floor(h * 0.3), w, 1, 1);
  return c.toRaster();
}

/** A horizontal pipe embedded in the wall, with flanges and rust. */
export function pipeDecal(w: number, ramp: string[], rust: string[]): Raster {
  const pal = new Palette();
  const p = pal.ramp(ramp);
  const rs = pal.ramp(rust);
  const [ol] = pal.ramp([ramp[0]!]);
  const c = new Ix(w, 10, pal);
  const shade = [p[0]!, p[2]!, p[3]!, p[2]!, p[1]!, p[1]!, p[0]!];
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < shade.length; y++) c.set(x, 2 + y, shade[y]!);
    if (x % 14 === 4 || x % 14 === 5) for (let y = 0; y < 10; y++) c.set(x, y, y < 2 ? p[3]! : y > 7 ? p[0]! : p[2]!);
    if ((x * 7) % 11 === 3) c.set(x, 6, rs[1]!), c.set(x, 7, rs[0]!), c.set(x, 8, rs[0]!);
  }
  // broken ends fade into the wall
  for (let y = 0; y < 10; y++) c.set(0, y, ol!), c.set(w - 1, y, 0);
  return c.toRaster();
}

/** A rib cage or a skull, half buried. */
export function bonesDecal(kind: 'ribs' | 'skull', ramp: string[], hole: string): Raster {
  const pal = new Palette();
  const b = pal.ramp(ramp);
  const [hl] = pal.ramp([hole]);
  if (kind === 'skull') {
    const c = new Ix(16, 14, pal);
    c.ellipse(8, 6, 6.5, 5.5, (x, y, nx, ny) => (ny < -0.4 ? b[2]! : nx < -0.4 ? b[0]! : b[1]!));
    c.rect(4, 10, 8, 3, b[1]!);
    for (let x = 5; x < 12; x += 2) c.set(x, 12, hl!);
    c.rect(4, 6, 3, 3, hl!);
    c.rect(9, 6, 3, 3, hl!);
    c.set(8, 9, hl!);
    return c.toRaster();
  }
  const c = new Ix(34, 16, pal);
  c.line(2, 4, 31, 3, b[2]!);
  c.line(2, 5, 31, 4, b[1]!);
  for (let i = 0; i < 6; i++) {
    const x = 6 + i * 4;
    for (let y = 5; y < 15 - Math.abs(i - 2.5) * 1.2; y++) c.set(x + Math.round((y - 5) * 0.25), y, y < 7 ? b[2]! : b[1]!);
  }
  return c.toRaster();
}

/** Roots creeping down from the top edge, thick to thin. */
export function rootsDecal(w: number, h: number, ramp: string[], seed: number, tip?: string): Raster {
  const pal = new Palette();
  const rr = pal.ramp(ramp);
  const [tp] = pal.ramp([tip ?? ramp[ramp.length - 1]!]);
  const c = new Ix(w, h, pal);
  const r = rng(seed);
  const grow = (x: number, y: number, len: number, thick: number) => {
    for (let i = 0; i < len && y < h - 1; i++) {
      for (let t = 0; t < thick; t++) c.set(x + t, y, t === 0 ? rr[2]! : rr[1]!);
      y++;
      if (r.chance(0.35)) x += r.chance(0.5) ? 1 : -1;
      if (thick > 1 && r.chance(0.12)) grow(x, y, Math.floor(len / 2), thick - 1);
    }
    if (tip) c.set(x, y, tp!);
  };
  for (let k = 0; k < 3; k++) grow(r.int(2, w - 4), 0, r.int(h / 2, h), 2);
  return c.toRaster();
}

/** A spiral fossil (ammonite / great shell). */
export function fossilDecal(size: number, ramp: string[]): Raster {
  const pal = new Palette();
  const f = pal.ramp(ramp);
  const c = new Ix(size, size, pal);
  const cx = size / 2;
  const cy = size / 2;
  for (let a = 0; a < Math.PI * 6; a += 0.04) {
    const rad = (a / (Math.PI * 6)) * (size / 2 - 1);
    const x = Math.round(cx + Math.cos(a) * rad);
    const y = Math.round(cy + Math.sin(a) * rad);
    c.set(x, y, a > Math.PI * 4 ? f[2]! : f[1]!);
    if (a > Math.PI * 4) c.set(x, y + 1, f[0]!);
  }
  // ribs across the outer whorl
  for (let a = 0; a < Math.PI * 2; a += 0.45) {
    const r0 = size / 2 - 4;
    const r1 = size / 2 - 1;
    c.line(Math.round(cx + Math.cos(a) * r0), Math.round(cy + Math.sin(a) * r0), Math.round(cx + Math.cos(a) * r1), Math.round(cy + Math.sin(a) * r1), f[1]!);
  }
  return c.toRaster();
}

/** A glowing vein (lava, crystal) wandering through the rock. */
export function veinDecal(w: number, h: number, glow: string[], seed: number): Raster {
  const pal = new Palette();
  const g = pal.ramp(glow);
  const c = new Ix(w, h, pal);
  const r = rng(seed);
  let y = Math.floor(h / 2);
  for (let x = 1; x < w - 1; x++) {
    c.set(x, y, g[2]!);
    c.set(x, y + 1, g[1]!);
    c.set(x, y - 1, g[0]!);
    if (r.chance(0.4)) y += r.chance(0.5) ? 1 : -1;
    y = Math.max(2, Math.min(h - 3, y));
    if (r.chance(0.1)) {
      // a short spur
      let sy = y;
      for (let k = 0; k < r.int(2, 5); k++) c.set(x + k, (sy += r.chance(0.5) ? 1 : -1), g[1]!);
    }
  }
  return c.toRaster();
}

/** A cluster of buried stones, lit from above. */
export function stonesDecal(ramp: string[], seed: number): Raster {
  const pal = new Palette();
  const s = pal.ramp(ramp);
  const c = new Ix(26, 16, pal);
  const r = rng(seed);
  for (let i = 0; i < 4; i++) {
    const x = r.int(4, 21);
    const y = r.int(4, 11);
    const rx = r.range(2.5, 5);
    const ry = r.range(2, 3.5);
    c.ellipse(x, y, rx, ry, (xx, yy, nx, ny) => (ny < -0.4 ? s[2]! : ny > 0.4 ? s[0]! : s[1]!));
  }
  return c.toRaster();
}

/** An iron grate with light (or dark) behind the bars. */
export function grateDecal(frame: string[], behind: string): Raster {
  const pal = new Palette();
  const f = pal.ramp(frame);
  const [bh] = pal.ramp([behind]);
  const c = new Ix(22, 14, pal);
  c.rect(0, 0, 22, 14, f[1]!);
  c.rect(2, 2, 18, 10, bh!);
  for (let x = 4; x < 20; x += 3) for (let y = 2; y < 12; y++) c.set(x, y, f[1]!);
  for (let x = 0; x < 22; x++) c.set(x, 0, f[2]!), c.set(x, 13, f[0]!);
  return c.toRaster();
}
