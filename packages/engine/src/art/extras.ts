/**
 * Optional pieces every theme ships, skinned with its own colours: a spike strip, a checkpoint
 * lantern (`idle` unlit, `lit` flickering) and a small flyer (`fly`, `hurt`).
 */
import { Canvas, Ix, Palette } from './core';
import { sheetOf, type Raster } from '../pixel';
import type { SpriteSheet } from './types';

/** Four shaded spikes on a base strip, 16×10. `ramp` is dark → light (4 colours). */
export function spikeStrip(ramp: string[], outline: string, base?: string): Raster {
  const pal = new Palette();
  const [ol] = pal.ramp([outline]);
  const r = pal.ramp(ramp);
  const [b] = pal.ramp([base ?? ramp[0]!]);
  const c = new Ix(16, 10, pal);
  for (let s = 0; s < 4; s++) {
    const cx = s * 4 + 2;
    const h = s % 2 ? 7 : 8;
    for (let y = 0; y < h; y++) {
      const half = Math.floor((y * 1.6) / 2 + 0.5) / 1.6;
      const yy = 9 - h + y;
      for (let x = Math.round(cx - half - 0.5); x <= Math.round(cx + half - 0.5); x++) c.set(x, yy, x >= cx ? r[2]! : r[1]!);
      c.set(cx, 9 - h + y, y < 2 ? r[3]! : r[2]!);
    }
  }
  for (let x = 0; x < 16; x++) c.set(x, 9, b!);
  c.outline(ol!);
  for (let x = 0; x < 16; x++) c.set(x, 9, b!);
  return c.toRaster();
}

/** A lantern on a post: `idle` is dark, `lit` glows and flickers. 16×32. */
export function checkpointSheet(o: { post: string[]; cage: string; glow: string; core: string; outline: string; banner?: string }): SpriteSheet {
  const frames: Raster[] = [];
  const draw = (lit: boolean, f: number) => {
    const c = new Canvas(16, 32);
    const P = o.post;
    // post
    for (let y = 12; y < 32; y++) {
      c.set(7, y, P[2]!);
      c.set(8, y, P[1]!);
    }
    for (let x = 4; x < 12; x++) c.set(x, 31, P[0]!), c.set(x, 30, P[1]!);
    c.set(5, 30, P[2]!);
    // arm and cage
    for (let x = 7; x < 12; x++) c.set(x, 11, P[2]!);
    if (o.banner) for (let y = 14; y < 21; y++) for (let x = 9; x < 12; x++) if (y < 20 || x === 10) c.set(x, y, o.banner, lit ? 1 : 0.8);
    const cx = 8;
    const cy = 6;
    if (lit) c.glow(cx, cy, 9 + (f % 2), o.glow, 0.55 + 0.1 * (f % 3));
    for (let y = 2; y <= 10; y++) {
      c.set(cx - 3, y, o.cage);
      c.set(cx + 3, y, o.cage);
    }
    for (let x = cx - 3; x <= cx + 3; x++) c.set(x, 2, o.cage), c.set(x, 10, o.cage);
    c.set(cx, 1, o.cage);
    c.set(cx, 0, o.cage);
    // the flame / bulb
    if (lit) {
      const flick = [0, 1, 0, -1][f % 4]!;
      for (let y = 4; y <= 8; y++) for (let x = cx - 2; x <= cx + 2; x++) c.set(x, y, o.glow, 0.85);
      c.set(cx, 5 + Math.max(0, flick), o.core);
      c.set(cx - 1 + (f % 2), 6, o.core);
      c.set(cx, 6, '#ffffff');
      c.set(cx, 7, o.core);
    } else {
      for (let y = 5; y <= 8; y++) for (let x = cx - 1; x <= cx + 1; x++) c.set(x, y, o.outline, 0.7);
      c.set(cx, 6, o.cage);
    }
    frames.push(c.toRaster());
  };
  draw(false, 0);
  for (let f = 0; f < 4; f++) draw(true, f);
  return {
    raster: sheetOf(frames),
    frameWidth: 16,
    frameHeight: 32,
    animations: { idle: { frames: [0], fps: 1, loop: true }, lit: { frames: [1, 2, 3, 4], fps: 8, loop: true } },
    anchor: { x: 8, y: 31 },
  };
}

/** A small flying creature with flapping wings. 20×16. */
export function flyerSheet(o: { body: string[]; wing: string[]; eye: string; outline: string; flash?: string; stripes?: string; glowEye?: boolean }): SpriteSheet {
  const pal = new Palette();
  const [ol, olLit] = pal.ramp([o.outline, o.outline]);
  const body = pal.ramp(o.body);
  const wing = pal.ramp(o.wing);
  const [eye] = pal.ramp([o.eye]);
  const [stripe] = pal.ramp([o.stripes ?? o.body[0]!]);
  const [flash] = pal.ramp([o.flash ?? '#ffffff']);
  const frames: Raster[] = [];
  // wing tip offsets per frame: up, mid, down, mid
  const tips: [number, number][] = [
    [-2, -7],
    [-5, -3],
    [-4, 3],
    [-5, -2],
  ];
  const draw = (f: number, hurt = false) => {
    const c = new Ix(20, 16, pal);
    const bob = [0, 1, 1, 0][f % 4]!;
    const cx = 10;
    const cy = 9 + bob;
    const [tx, ty] = tips[f % 4]!;
    // far wing (darker), then body, then near wing
    c.poly([[cx - 1, cy - 1], [cx + 2 + tx * 0.6, cy + ty * 0.9], [cx + 4 + tx * 0.4, cy + ty * 0.6 + 2]], wing[0]!);
    c.ellipse(cx, cy, 4.5, 3, (x, y, nx, ny) => (ny < -0.3 ? body[2]! : ny > 0.4 ? body[0]! : body[1]!));
    if (o.stripes) for (const sx of [cx - 2, cx]) for (let y = cy - 3; y <= cy + 3; y++) if (c.get(sx, y)) c.set(sx, y, stripe!);
    c.set(cx + 3, cy - 1, eye!);
    if (o.glowEye) c.set(cx + 4, cy - 1, eye!);
    c.poly([[cx - 1, cy - 1], [cx + tx - 1, cy + ty], [cx + tx + 5, cy + ty + 1], [cx + 2, cy]], wing[1]!);
    c.rim(0, -1, new Set(wing));
    c.outline(ol!, olLit!);
    if (hurt) for (let i = 0; i < c.px.length; i++) if (c.px[i] && c.px[i] !== ol) c.px[i] = flash!;
    frames.push(c.toRaster());
  };
  for (let f = 0; f < 4; f++) draw(f);
  draw(0, true);
  return {
    raster: sheetOf(frames),
    frameWidth: 20,
    frameHeight: 16,
    animations: { fly: { frames: [0, 1, 2, 3], fps: 14, loop: true }, hurt: { frames: [4, 0], fps: 10, loop: false } },
    hitbox: { x: 5, y: 5, w: 10, h: 8 },
    anchor: { x: 10, y: 12 },
  };
}
