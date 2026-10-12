/**
 * Small looping decoration animations (`ambientSprites`): dripping water, puddle ripples, swaying
 * grass, butterflies, glow-worms, lava shimmer and flickering flames. Each is a tiny sprite sheet
 * with a single looping `idle` animation; colours come from the theme.
 */
import { Canvas } from './core';
import { sheetOf, type Raster } from '../pixel';
import type { SpriteSheet } from './types';

function sheet(frames: Raster[], fps: number): SpriteSheet {
  const f = frames[0]!;
  return { raster: sheetOf(frames), frameWidth: f.width, frameHeight: f.height, animations: { idle: { frames: frames.map((_, i) => i), fps, loop: true } } };
}

/** A drop swells under a ceiling, falls and splashes at the bottom of the frame. 7×32, 10 frames. */
export function dripSheet(water: string, light: string): SpriteSheet {
  const frames: Raster[] = [];
  for (let f = 0; f < 10; f++) {
    const c = new Canvas(7, 32);
    if (f < 4) {
      // swelling bead
      c.set(3, 0, water);
      if (f >= 1) c.set(3, 1, water);
      if (f >= 2) c.set(3, 2, water), c.set(2, 1, water, 0.6), c.set(4, 1, water, 0.6);
      if (f >= 3) c.set(3, 3, light);
    } else if (f < 8) {
      // falling streak, accelerating
      const y = [5, 10, 17, 26][f - 4]!;
      c.set(3, y, light);
      c.set(3, y - 1, water, 0.8);
      if (f > 5) c.set(3, y - 2, water, 0.4);
    } else {
      // splash
      const s = f - 7;
      c.set(3 - s, 30 - s, light);
      c.set(3 + s, 30 - s, light);
      c.set(3, 31, water, 0.7);
      if (s === 1) c.set(3, 29, light, 0.7);
    }
    frames.push(c.toRaster());
  }
  return sheet(frames, 12);
}

/** Rings spreading on a puddle. 16×5, 6 frames. */
export function rippleSheet(water: string, light: string): SpriteSheet {
  const frames: Raster[] = [];
  for (let f = 0; f < 6; f++) {
    const c = new Canvas(16, 5);
    for (let x = 1; x < 15; x++) c.set(x, 3, water, 0.6);
    const r = 1 + f * 1.2;
    for (let a = 0; a < Math.PI * 2; a += 0.15) {
      const x = Math.round(8 + Math.cos(a) * r);
      const y = Math.round(3 + Math.sin(a) * r * 0.3);
      if (y >= 2 && y <= 4) c.set(x, y, light, 1 - f / 7);
    }
    frames.push(c.toRaster());
  }
  return sheet(frames, 8);
}

/** A tuft of grass swaying in the breeze. 16×12, 8 frames. */
export function grassSwaySheet(ramp: string[]): SpriteSheet {
  const blades: [number, number, number][] = [
    [2, 7, 0.2],
    [4, 10, 0.1],
    [6, 8, 0.3],
    [8, 11, 0],
    [10, 9, 0.25],
    [12, 7, 0.15],
    [14, 9, 0.35],
  ];
  const frames: Raster[] = [];
  for (let f = 0; f < 8; f++) {
    const c = new Canvas(16, 12);
    const wind = Math.sin((f / 8) * Math.PI * 2);
    for (const [x, h, ph] of blades) {
      for (let k = 0; k < h; k++) {
        const t = k / h;
        const bend = (wind * 0.9 + Math.sin((f / 8) * Math.PI * 2 + ph * 6) * 0.4) * t * t * 3;
        c.set(Math.round(x + bend), 11 - k, ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))]!);
      }
    }
    frames.push(c.toRaster());
  }
  return sheet(frames, 8);
}

/** A butterfly flitting on a little loop. 16×14, 8 frames. */
export function butterflySheet(wing: string, wingDark: string, body: string): SpriteSheet {
  const frames: Raster[] = [];
  for (let f = 0; f < 8; f++) {
    const c = new Canvas(16, 14);
    const cx = 8 + Math.round(Math.cos((f / 8) * Math.PI * 2) * 3);
    const cy = 7 + Math.round(Math.sin((f / 8) * Math.PI * 4) * 2);
    const open = [3, 2, 0, 2][f % 4]!;
    c.set(cx, cy, body);
    c.set(cx, cy + 1, body);
    for (const d of [-1, 1]) {
      for (let k = 1; k <= open; k++) {
        c.set(cx + d * k, cy - 1, k === open ? wingDark : wing);
        c.set(cx + d * k, cy, wing);
        if (k < open) c.set(cx + d * k, cy + 1, wingDark);
      }
      if (open === 0) c.set(cx, cy - 1, wing), c.set(cx, cy - 2, wing);
    }
    frames.push(c.toRaster());
  }
  return sheet(frames, 12);
}

/** A glow-worm on a silk thread, its light bobbing and pulsing. 7×28, 8 frames. */
export function glowwormSheet(silk: string, glow: string, core: string): SpriteSheet {
  const frames: Raster[] = [];
  for (let f = 0; f < 8; f++) {
    const c = new Canvas(9, 28);
    const len = 18 + Math.round(Math.sin((f / 8) * Math.PI * 2) * 3);
    for (let y = 0; y < len; y++) c.set(4, y, silk, 0.6);
    const pulse = 0.6 + 0.4 * Math.sin((f / 8) * Math.PI * 2 + 1);
    c.glow(4.5, len + 1.5, 4, glow, 0.6 * pulse);
    c.set(4, len, glow);
    c.set(4, len + 1, core);
    c.set(4, len + 2, glow);
    frames.push(c.toRaster());
  }
  return sheet(frames, 6);
}

/** A strip of molten lava shimmering. 16×8, tiles horizontally; 8 frames. */
export function lavaSheet(ramp: string[]): SpriteSheet {
  const frames: Raster[] = [];
  for (let f = 0; f < 8; f++) {
    const c = new Canvas(16, 8);
    for (let x = 0; x < 16; x++) {
      const wave = Math.sin(((x + f * 2) / 16) * Math.PI * 2);
      const top = Math.round(1 + wave);
      for (let y = top; y < 8; y++) {
        const hot = Math.sin(((x * 3 + y * 5 + f * 4) / 16) * Math.PI * 2) > 0.6;
        c.set(x, y, y === top ? ramp[3]! : hot ? ramp[2]! : y < 4 ? ramp[1]! : ramp[0]!);
      }
    }
    frames.push(c.toRaster());
  }
  return sheet(frames, 8);
}

/** A flickering flame (for torches and braziers). 10×14, 6 frames. */
export function flameSheet(ramp: string[]): SpriteSheet {
  const frames: Raster[] = [];
  const shapes: [number, number][] = [
    [0, 0],
    [1, -1],
    [0, -2],
    [-1, -1],
    [0, 1],
    [1, 0],
  ];
  for (let f = 0; f < 6; f++) {
    const c = new Canvas(10, 14);
    const [sx, sy] = shapes[f]!;
    c.glow(5, 8, 6, ramp[2]!, 0.4);
    c.poly([[1.5, 12], [5 + sx, 1 + sy + 1], [8.5, 12], [5, 14]], ramp[1]!);
    c.poly([[3, 12], [5 + sx * 0.6, 5 + sy], [7, 12], [5, 13]], ramp[2]!);
    c.disc(5, 11, 1.5, ramp[3]!);
    frames.push(c.toRaster());
  }
  return sheet(frames, 12);
}
