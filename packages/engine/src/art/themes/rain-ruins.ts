/**
 * Rain Ruins: rusted industrial ruins under endless rain. Teal and grey-green fog, colossal
 * towers fading into the haze, pipes and girders overgrown with moss, a pale little creature with
 * a rust-red scarf. Mood reference: Rain World.
 */
import { Canvas, gradient, Ix, MatLayer, Palette, rng, fbm, bayer, type Material } from '../core';
import { heroSheet } from '../hero';
import { cable, crane, elbow, hangingChain, lightShafts, mistBand, overgrow, pipe, pylon, tank, tower, truss } from '../scenery';
import { crack, derive, pickRamp, px01, tileNoise, TILE } from '../tiles';
import { sheetOf, type Raster } from '../../pixel';
import type { ArtTheme, ParallaxLayer, PropInfo, SpriteSheet } from '../types';
import { rainHeroCostume } from './rain-hero';
import { checkpointSheet, flyerSheet, spikeStrip } from '../extras';

const W = 480;
const H = 270;

const C = {
  skyTop: '#1f2d31',
  skyMid: '#4a625f',
  horizon: '#7c958d',
  haze: '#8aa198',
  low: '#5d7772',
  concrete: ['#141d1e', '#1f2b2c', '#293737', '#354544', '#455852', '#5d7168'],
  moss: ['#1e2f1f', '#2f4529', '#466337', '#6a8a46', '#98b062'],
  rust: ['#331d17', '#5c2f21', '#8a4428', '#b8673a'],
  steel: ['#1a2324', '#2c3938', '#435350', '#64766f', '#8b9c90'],
  glow: '#7ff2d8',
  lamp: '#ffd98a',
};

// ── Layers ──────────────────────────────────────────────────────────────────

function sky(): Canvas {
  const c = new Canvas(W, H);
  gradient(c, [[0, C.skyTop], [0.3, '#34494a'], [0.55, C.skyMid], [0.72, C.horizon], [0.82, C.haze], [1, C.low]], { dither: 6 });
  // heavy rain clouds: long horizontal streaks
  for (let y = 0; y < 180; y++)
    for (let x = 0; x < W; x++) {
      const n = fbm(x, y, { w: W, h: H, cells: 4, octaves: 5, seed: 3, wrapX: true, aspect: 0.22 });
      const t = n - 0.55;
      if (t > 0) {
        const a = Math.floor(Math.min(0.5, t * 2.2) * 8 + bayer(x, y) * 0.9) / 8;
        if (a > 0) c.set(x, y, y < 90 ? '#3e5554' : '#6a827c', a);
      }
      if (t < -0.12 && y < 120) {
        const a = Math.floor(Math.min(0.35, -t - 0.12) * 8 + bayer(x, y) * 0.9) / 8;
        if (a > 0) c.set(x, y, '#18242a', a);
      }
    }
  c.wrapX = true;
  return c;
}

function superstructure(): Canvas {
  const r = rng(101);
  const L = new MatLayer(W, H);
  const xs = [20, 150, 265, 380];
  for (const x0 of xs) {
    const x = x0 + r.int(-10, 20);
    const w = r.int(30, 58);
    tower(L, r, x, H, w, r.int(200, 300), 1, { win: 2, winGap: 7, winSkip: 0.7, antenna: true, ledges: 3, ribs: 2, greeble: 2 });
    if (r.chance(0.6)) pylon(L, x + w + r.int(4, 12), H, 5, r.int(140, 220), 1);
  }
  // colossal bridges between the stacks
  truss(L, 0, 70, W, 6, 1);
  L.rect(0, 118, W, 3, 1);
  for (let x = 0; x < W; x += 64) cable(L, x, 121, x + 64, 121, 9, 1);
  const mats: Record<number, Material> = {
    1: { base: '#6b867f', dark: '#66817a', light: '#718b84', rim: '#83a097', grain: 12, dither: true, fadeTo: C.horizon, fadeFrom: 0.5, fadeAmt: 0.8 },
    2: { base: '#5d7771', fadeTo: C.horizon, fadeFrom: 0.5, fadeAmt: 0.8 },
  };
  return L.paint(mats, 7);
}

function farRuins(): Canvas {
  const r = rng(202);
  const L = new MatLayer(W, H);
  let x = 0;
  while (x < W) {
    const kind = r.next();
    const base = H - r.int(0, 10);
    if (kind < 0.45) {
      const w = r.int(12, 34);
      tower(L, r, x, base, w, r.int(50, 120), 1, { win: 2, winGap: 4, broken: r.chance(0.5), antenna: true, litWin: 3, litChance: 0.04, greeble: 2 });
      x += w + r.int(-3, 6);
    } else if (kind < 0.6) {
      const rr = r.int(6, 12);
      tank(L, x + rr, base - r.int(30, 60), rr, r.int(12, 24), 1);
      L.rect(x + rr - 1, base - 60, 2, 60, 1);
      x += rr * 2 + r.int(2, 8);
    } else if (kind < 0.75) {
      // chimney stack
      const w = r.int(5, 8);
      const h = r.int(80, 150);
      L.rect(x, base - h, w, h, 1);
      L.rect(x - 1, base - h, w + 2, 3, 1);
      L.rect(x - 1, base - h + 10, w + 2, 1, 1);
      x += w + r.int(4, 12);
    } else if (kind < 0.85) {
      crane(L, r, x, base - 40, r.int(60, 100), 1);
      L.rect(x - 4, base - 40, 14, 40, 1);
      x += r.int(14, 24);
    } else {
      pylon(L, x, base, 5, r.int(60, 110), 1);
      x += r.int(10, 20);
    }
  }
  // low connecting mass and pipes
  L.rect(0, H - 40, W, 40, 1);
  for (let i = 0; i < 5; i++) {
    const y = r.int(150, 215);
    const x0 = r.int(0, W);
    pipe(L, x0, y, x0 + r.int(30, 90), y, 2, 1);
  }
  overgrow(L, r, new Set([1]), 4, 4, { tuft: 0.35, hang: 0.03, maxHang: 10, seed: 22 });
  const mats: Record<number, Material> = {
    1: { base: '#4f6a64', dark: '#4a645e', light: '#55706a', rim: '#7a978d', grain: 20, dither: true, fadeTo: C.haze, fadeFrom: 0.62, fadeAmt: 0.85 },
    2: { base: '#465f5a', fadeTo: C.haze, fadeFrom: 0.62, fadeAmt: 0.85 },
    3: { base: '#d6cd8e' },
    4: { base: '#536e58', rim: '#6f8e6c', fadeTo: C.haze, fadeFrom: 0.62, fadeAmt: 0.85 },
  };
  return L.paint(mats, 9);
}

function mist(): Canvas {
  const c = new Canvas(W, H);
  c.wrapX = true;
  lightShafts(c, rng(5), { count: 5, color: '#d5e4d2', alpha: 0.32, slope: 0.42, width: [7, 20], top: 0, bottom: 240 });
  mistBand(c, { y: 205, h: 46, color: C.haze, alpha: 0.75, seed: 41, cells: 5 });
  mistBand(c, { y: 120, h: 22, color: '#7e978f', alpha: 0.3, seed: 43, cells: 4 });
  return c;
}

function midRuins(): Canvas {
  const r = rng(303);
  const L = new MatLayer(W, H);
  const buildings: [number, number, number][] = [];
  let x = r.int(0, 20);
  while (x < W - 20) {
    const w = r.int(34, 72);
    const h = r.int(70, 170);
    const top = H - h;
    tower(L, r, x, H, w, h, 1, { broken: r.chance(0.7), ledges: r.int(0, 2), greeble: 5 });
    // big openings showing the dark interior, with a lip of concrete
    for (let k = 0; k < r.int(1, 3); k++) {
      const ow = r.int(6, Math.max(7, w / 2.5));
      const oh = r.int(8, 22);
      const ox = x + r.int(3, Math.max(4, w - ow - 3));
      const oy = top + r.int(10, Math.max(12, h - oh - 30));
      L.rect(ox, oy, ow, oh, 5);
      if (r.chance(0.5)) L.rect(ox + Math.floor(ow / 2), oy, 1, oh, 1); // mullion
    }
    // rust panels
    if (r.chance(0.6)) L.rect(x + r.int(0, w - 8), top + r.int(15, Math.max(16, h - 20)), r.int(5, 12), r.int(6, 18), 2);
    buildings.push([x, w, top]);
    x += w + r.int(14, 40);
  }
  // girder bridges, pipes and cables between buildings
  for (let i = 0; i < buildings.length; i++) {
    const [ax, aw, at] = buildings[i]!;
    const [bx, , bt] = buildings[(i + 1) % buildings.length]!;
    const nx = bx < ax ? bx + W : bx;
    const y = Math.max(at, bt) + r.int(8, 30);
    if (r.chance(0.6)) {
      truss(L, ax + aw - 2, y, nx + 2, 5, 1);
      for (let k = 0; k < r.int(1, 3); k++) hangingChain(L, r.int(ax + aw, nx), y + 5, r.int(10, 40), 1);
    } else pipe(L, ax + aw - 2, y, nx + 2, y, r.int(4, 6), 2, 2, 14, 6);
    if (r.chance(0.7)) cable(L, ax + aw, at + 4, nx, bt + 6, r.int(6, 18), 1);
  }
  // a couple of elbow pipes snaking down
  for (let i = 0; i < 3; i++) {
    const x0 = r.int(0, W);
    const y0 = r.int(130, 190);
    elbow(L, x0, y0, x0 + r.int(20, 50), H, 4, 2, 2);
  }
  overgrow(L, r, new Set([1, 2]), 3, 4, { tuft: 0.55, hang: 0.1, maxHang: 30, seed: 31 });
  const fade = { fadeTo: '#6c8781', fadeFrom: 0.68, fadeAmt: 0.75 };
  const mats: Record<number, Material> = {
    1: { base: '#2e4343', dark: '#283b3b', light: '#34494a', rim: '#5a786f', grain: 30, dither: true, ...fade },
    2: { base: '#4a3328', dark: '#3e2b23', light: '#57392b', rim: '#7d5038', grain: 50, dither: true, ...fade },
    3: { base: '#37523a', rim: '#5c7c4a', ...fade },
    4: { base: '#2b4232', ...fade },
    5: { base: '#1c2a2b', dark: '#182425', grain: 40, ...fade },
    6: { base: '#8a5a3e', ...fade },
  };
  return L.paint(mats, 13);
}

function nearStructures(): Canvas {
  const r = rng(404);
  const L = new MatLayer(W, H);
  // massive pillars from the floor
  for (const x0 of [40, 210, 350]) {
    const x = x0 + r.int(-15, 15);
    const w = r.int(18, 28);
    const top = r.int(90, 150);
    L.rect(x, top, w, H - top, 1);
    L.rect(x - 3, top, w + 6, 5, 1);
    L.rect(x - 2, top + 5, w + 4, 2, 1);
    // rust weeping down from the capital
    for (let k = x + 2; k < x + w - 2; k++) if (r.chance(0.35)) L.rect(k, top + 7, 1, r.int(3, 26), 2);
  }
  // huge main pipe along the bottom
  pipe(L, 0, 236, W, 236, 14, 1, 1, 60, 5);
  L.rect(0, 228, W, 2, 0);
  // ceiling beams and drops
  L.rect(0, 0, W, 6, 1);
  for (let x = 0; x < W; x += r.int(50, 90)) {
    const w = r.int(10, 18);
    const d = r.int(10, 28);
    L.rect(x, 6, w, d, 1);
    L.rect(x - 2, 6 + d, w + 4, 2, 1);
  }
  for (let i = 0; i < 2; i++) {
    const x0 = r.int(0, W);
    pipe(L, x0, 0, x0, r.int(60, 110), 8, 2, 2, 16, 5);
  }
  for (let i = 0; i < 6; i++) hangingChain(L, r.int(0, W), 6, r.int(20, 70), 1);
  overgrow(L, r, new Set([1, 2]), 3, 4, { tuft: 0.6, hang: 0.16, maxHang: 46, seed: 51 });
  const mats: Record<number, Material> = {
    1: { base: '#162123', dark: '#121b1d', light: '#1a2628', rim: '#35504c', grain: 40, dither: true },
    2: { base: '#2b1f1a', dark: '#211712', light: '#36251d', rim: '#5a3a2a', grain: 60, dither: true },
    3: { base: '#1d3024', rim: '#3d5938' },
    4: { base: '#18281e' },
    5: { base: '#3a4f4c' },
  };
  return L.paint(mats, 17);
}

function foreground(): Canvas {
  const r = rng(505);
  const FW = 640;
  const L = new MatLayer(FW, H);
  // hanging vines and a broken pipe in the top corners, grass clumps along the bottom
  for (let i = 0; i < 5; i++) {
    const x = r.int(0, FW);
    const len = r.int(30, 90);
    let vx = x;
    for (let y = 0; y < len; y++) {
      L.set(vx, y, 1);
      L.set(vx + 1, y, 1);
      if (r.chance(0.1)) vx += r.chance(0.5) ? 1 : -1;
      if (r.chance(0.25)) L.set(vx + (r.chance(0.5) ? 2 : -1), y, 1);
    }
  }
  for (let x = 0; x < FW; x++) {
    const n = fbm(x, 0, { w: FW, h: H, cells: 20, octaves: 3, seed: 77, wrapX: true });
    const h = Math.max(0, Math.round((n - 0.5) * 50));
    for (let k = 0; k < h; k++) L.set(x, H - 1 - k + (k > h - 3 && r.chance(0.5) ? 1 : 0), 1);
  }
  return L.paint({ 1: { base: '#070c0d', rim: '#14201f' } }, 19);
}

function layers(): ParallaxLayer[] {
  return [
    { name: 'sky', raster: sky().toRaster(), factor: 0, tiled: true },
    { name: 'superstructure', raster: superstructure().toRaster(), factor: 0.06, tiled: true },
    { name: 'far ruins', raster: farRuins().toRaster(), factor: 0.18, tiled: true },
    { name: 'mist', raster: mist().toRaster(), factor: 0.28, tiled: true },
    { name: 'mid ruins', raster: midRuins().toRaster(), factor: 0.42, tiled: true },
    { name: 'near structures', raster: nearStructures().toRaster(), factor: 0.68, tiled: true },
    { name: 'foreground', raster: foreground().toRaster(), factor: 1.35, tiled: true },
  ];
}

// ── Tiles ───────────────────────────────────────────────────────────────────

function concrete(seed: number, slab = false): Canvas {
  const r = rng(seed);
  const n = tileNoise(11, 3, 3);
  const n2 = tileNoise(seed, 8, 2);
  const c = new Canvas(TILE, TILE);
  const K = C.concrete;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const v = n(x, y) * 0.7 + n2(x, y) * 0.3 + (bayer(x, y) - 0.5) * 0.08;
      c.set(x, y, v < 0.36 ? K[1]! : v < 0.62 ? K[2]! : K[3]!);
    }
  // pits: dark hole with a lit lower lip (light comes from above)
  for (let k = 0; k < 3; k++) {
    const x = r.int(0, 15);
    const y = r.int(0, 14);
    c.set(x, y, K[1]!);
    if (r.chance(0.5)) c.set((x + 1) % TILE, y, K[1]!);
    c.set(x, (y + 1) % TILE, K[3]!);
  }
  if (slab) {
    // an irregular slab joint that wraps around the tile edges
    let y = r.int(5, 10);
    for (let x = 0; x < TILE; x++) {
      c.set(x, y, K[0]!);
      c.set(x, y + 1, K[3]!);
      if (x > 2 && x < 13 && r.chance(0.2)) y += r.chance(0.5) ? 1 : -1;
    }
  }
  crack(c, r, r.int(0, 15), r.int(0, 8), r.int(4, 8), K[0]!);
  // a rebar stub bleeding rust
  if (r.chance(0.5)) {
    const x = r.int(1, 14);
    const y = r.int(1, 8);
    c.set(x, y, C.rust[2]!);
    for (let k = 1; k < r.int(3, 6); k++) c.set(x, y + k, k < 2 ? C.rust[1]! : C.rust[0]!);
  }
  for (let k = 0; k < 3; k++) c.set(r.int(0, 15), r.int(0, 15), K[4]!);
  return c;
}

function grassTop(base: Canvas, seed: number): Canvas {
  const depthN = tileNoise(seed + 1, 2, 2);
  const M = C.moss;
  const K = C.concrete;
  const lift = (col: [number, number, number, number]) => {
    const h = '#' + col.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
    const i = K.indexOf(h);
    return i >= 0 && i < K.length - 1 ? K[i + 1]! : null;
  };
  return derive(base, (x, y, col) => {
    const d = 3 + Math.round(depthN(x, 0) * 3);
    const blade = px01(x, 0, seed) > 0.42;
    if (y === 0) return blade ? (px01(x, 1, seed) > 0.5 ? M[4]! : M[3]!) : 'clear';
    if (y === 1) return blade || px01(x, 2, seed) > 0.4 ? M[3] : M[4];
    if (y < d - 1) return px01(x, y, seed) > 0.7 ? M[3] : M[2];
    if (y === d - 1) return px01(x, y, seed) > 0.5 ? M[1] : M[2];
    // moss tendrils creeping down
    if (px01(x, 7, seed) > 0.72 && y < d + 1 + Math.floor(px01(x, 9, seed) * 5)) return y === d ? M[2] : M[1];
    if (y === d) return K[5];
    if (y === d + 1) return K[4];
    // the top of the slab catches the sky light, fading with depth
    if (y < d + 6 && bayer(x, y) < (d + 6 - y) / 6) return lift(col);
    return null;
  });
}

function rainTiles(): ArtTheme['tiles'] {
  const fill = concrete(21);
  const fill2 = concrete(22, true);
  const ground = grassTop(concrete(23), 61);
  const ground2 = grassTop(concrete(24, true), 62);
  const ground3 = grassTop(concrete(25), 63);
  const K = C.concrete;
  const groundLeft = derive(ground, (x, y) => {
    if (x + y < 2) return 'clear';
    if (x === 0 && y > 3) return K[1];
    if (x === 1 && y > 4) return null;
    if (x === 0 && y <= 3) return C.moss[2];
    return null;
  });
  const groundRight = derive(ground, (x, y) => {
    if (15 - x + y < 2) return 'clear';
    if (x === 15 && y > 3) return K[4];
    if (x === 15 && y <= 3) return C.moss[3];
    return null;
  });
  const fillLeft = derive(fill, (x) => (x === 0 ? K[0] : x === 1 ? K[1] : null));
  const fillRight = derive(fill, (x, y) => (x === 15 ? (px01(x, y, 4) > 0.7 ? C.moss[2] : K[4]) : x === 14 ? K[3] : null));
  const ceiling = derive(fill, (x, y) => {
    if (y === 15) return px01(x, 15, 9) > 0.7 ? C.moss[1] : 'clear';
    if (y === 14) return K[0];
    if (y === 13) return K[1];
    return null;
  });
  // girder platform: plate, X-braced web, flange, a few hanging moss strands
  const platform = new Canvas(TILE, TILE);
  const S = C.steel;
  for (let x = 0; x < TILE; x++) {
    const rusty = px01(x, 0, 5) > 0.86;
    platform.set(x, 0, rusty ? C.rust[2]! : px01(x, 1, 5) > 0.7 ? C.moss[3]! : S[4]!);
    platform.set(x, 1, x % 8 === 4 ? S[4]! : rusty ? C.rust[2]! : S[3]!);
    platform.set(x, 2, S[1]!);
    for (let y = 3; y < 7; y++) {
      const a = (x + y) % 8;
      const b = (x - y + 16) % 8;
      if (a === 0 || b === 0 || x % 8 === 0) platform.set(x, y, a === 0 ? S[2]! : S[1]!);
    }
    platform.set(x, 7, S[2]!);
    platform.set(x, 8, S[0]!);
    if (px01(x, 3, 7) > 0.8) for (let y = 9; y < 9 + Math.floor(px01(x, 4, 7) * 5); y++) platform.set(x, y, C.moss[1]!);
  }
  const platformLeft = derive(platform, (x, y) => (x === 0 && y < 9 ? S[0] : null));
  const platformRight = derive(platform, (x, y) => (x === 15 && y < 9 ? S[0] : null));
  const t = (c: Canvas) => c.toRaster();
  return {
    ground: t(ground),
    ground2: t(ground2),
    ground3: t(ground3),
    groundLeft: t(groundLeft),
    groundRight: t(groundRight),
    fill: t(fill),
    fill2: t(fill2),
    fillLeft: t(fillLeft),
    fillRight: t(fillRight),
    ceiling: t(ceiling),
    platform: t(platform),
    platformLeft: t(platformLeft),
    platformRight: t(platformRight),
    spike: spikeStrip([C.rust[0]!, C.rust[1]!, C.steel[3]!, C.steel[4]!], '#0b1213', C.concrete[2]),
  };
}

// ── Creatures ───────────────────────────────────────────────────────────────

/** A lizard: dark slate body, hot-pink head, splayed legs, swaying tail. */
function lizardSheet(): SpriteSheet {
  const FW = 40;
  const FH = 20;
  const pal = new Palette();
  const [ol, olLit] = pal.ramp(['#06090a', '#1d2a2b']);
  const body = pal.ramp(['#223032', '#3a4a49', '#576866', '#7d8d85']);
  const head = pal.ramp(['#5a1438', '#a52d63', '#e2639c', '#ffb0d2']);
  const [tooth] = pal.ramp(['#f3ece2']);
  const [flash] = pal.ramp(['#ffffff']);
  const frames: Raster[] = [];
  const HEAD = ['...HHHHH...', '.HHHhhhhHH.', 'HHhhhhhhhhH', 'hhhhhhhhhhh', 'dhhhhhhhhh.'];
  const JAW = ['.ddhhhhhh..', '..dddddd...'];
  const draw = (ph: number, mode: 'walk' | 'idle' | 'hurt' | 'bite') => {
    const c = new Ix(FW, FH, pal);
    const spine = 13;
    const walk = mode === 'walk';
    const sway = (x: number) => Math.sin(ph + x * 0.3) * (walk ? 1 : 0.5);
    const breathe = mode === 'idle' ? Math.round(Math.sin(ph)) : 0;
    const bodyY = (x: number) => spine + sway(x) * 0.35 + breathe * 0.5;
    const leg = (sx: number, phase: number, far: boolean) => {
      const step = walk ? Math.sin(phase) * 3.5 : 0;
      const lift = walk ? Math.max(0, Math.cos(phase)) * 2.5 : 0;
      const col = far ? body[0]! : body[2]!;
      const col2 = far ? body[0]! : body[1]!;
      const sy = Math.round(bodyY(sx)) + 1;
      const ex = Math.round(sx - 1 + step * 0.4);
      const ey = sy + 2 - Math.round(lift * 0.5);
      const fx = Math.round(sx + step);
      const fy = Math.round(FH - 1 - lift);
      c.line(sx, sy, ex, ey, col, 2);
      c.line(ex, ey, fx, fy, col2);
      c.line(ex + 1, ey, fx + 1, fy, col2);
      c.set(fx + 2, fy, col2);
      c.set(fx - 1, fy, col2);
    };
    leg(16, ph + Math.PI, true);
    leg(27, ph, true);
    // tail: long, tapering, waving
    for (let x = 0; x <= 13; x++) {
      const t = x / 13;
      const th = Math.max(1, Math.round(0.6 + t * 2.4));
      const y = Math.round(spine - 1 + sway(x) * (2.2 - t * 1.6) + (1 - t) * 1.5);
      for (let k = 0; k < th; k++) c.set(x, y + k, k === 0 ? body[2]! : body[1]!);
    }
    // body: thick chest, narrower hips and neck
    for (let x = 12; x <= 31; x++) {
      const t = (x - 12) / 19;
      const half = 1.6 + Math.sin(t * Math.PI * 0.9) * 1.6;
      const cy = bodyY(x);
      for (let y = Math.round(cy - half); y <= Math.round(cy + half); y++) c.set(x, y, y <= cy - half + 0.6 ? body[3]! : y < cy ? body[2]! : body[1]!);
    }
    leg(18, ph, false);
    leg(29, ph + Math.PI, false);
    // head: a wedge with a hinged jaw
    const hx = 29;
    const hy = Math.round(bodyY(31)) - 5;
    const open = mode === 'bite' ? (ph > 0.2 ? 3 : 2) : mode === 'idle' && ph > 3 ? 1 : 0;
    c.grid(JAW, { d: head[0]!, h: head[1]! }, hx, hy + 5 + open);
    c.grid(HEAD, { H: head[3]!, h: head[2]!, d: head[1]! }, hx, hy);
    if (open) {
      for (let k = 0; k < open; k++) for (let x = hx + 1; x <= hx + 9; x++) c.set(x, hy + 5 + k, ol!);
      for (let x = hx + 2; x <= hx + 9; x += 2) c.set(x, hy + 5, tooth!), c.set(x + 1, hy + 4 + open, tooth!);
    }
    // the pink colour bleeds down the neck and spots the back
    for (let x = 22; x < 29; x++) if ((x * 7) % 3 === 0) c.set(x, Math.round(bodyY(x) - 2), head[1]!);
    for (let x = 14; x < 22; x += 3) c.set(x, Math.round(bodyY(x) - 2), head[0]!);
    c.rim(0, -1, new Set(body.slice(1)));
    c.outline(ol!, olLit!);
    if (mode === 'hurt') for (let i = 0; i < c.px.length; i++) if (c.px[i] && c.px[i] !== ol) c.px[i] = flash!;
    frames.push(c.toRaster());
  };
  for (let f = 0; f < 6; f++) draw((f / 6) * Math.PI * 2, 'walk');
  for (let f = 0; f < 4; f++) draw((f / 4) * Math.PI * 2, 'idle');
  draw(0, 'bite');
  draw(0.5, 'bite');
  draw(0, 'hurt');
  return {
    raster: sheetOf(frames),
    frameWidth: FW,
    frameHeight: FH,
    animations: {
      walk: { frames: [0, 1, 2, 3, 4, 5], fps: 10, loop: true },
      idle: { frames: [6, 7, 8, 9], fps: 4, loop: true },
      attack: { frames: [10, 11, 10], fps: 10, loop: false },
      hurt: { frames: [12, 0], fps: 10, loop: false },
    },
    hitbox: { x: 12, y: 8, w: 27, h: 12 },
    anchor: { x: 24, y: 19 },
  };
}

/** A glowing pearl that bobs and pulses. */
function pearlSheet(): SpriteSheet {
  const S = 14;
  const frames: Raster[] = [];
  for (let f = 0; f < 8; f++) {
    const c = new Canvas(S, S);
    const bob = Math.round(Math.sin((f / 8) * Math.PI * 2) * 1.2);
    const pulse = 0.75 + 0.25 * Math.sin((f / 8) * Math.PI * 2);
    const cx = 7;
    const cy = 7 + bob;
    c.glow(cx, cy, 6.5, C.glow, 0.55 * pulse);
    c.disc(cx, cy, 3, '#1f7d70');
    c.disc(cx, cy - 0.3, 2.6, '#4fd8bf');
    c.disc(cx + 0.3, cy - 0.5, 1.7, '#a8fbe9');
    c.set(cx, cy - 2, '#ffffff');
    c.set(cx - 1, cy - 1, '#e8fff9');
    if (f === 2 || f === 3) {
      const sx = f === 2 ? 11 : 10;
      c.set(sx, 2, '#ffffff');
      c.set(sx - 1, 2, '#bdf7ea', 0.7);
      c.set(sx + 1, 2, '#bdf7ea', 0.7);
      c.set(sx, 1, '#bdf7ea', 0.7);
      c.set(sx, 3, '#bdf7ea', 0.7);
    }
    frames.push(c.toRaster());
  }
  return { raster: sheetOf(frames), frameWidth: S, frameHeight: S, animations: { idle: { frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 9, loop: true } } };
}

/** The shelter gate: a heavy rusted doorway under a glowing glyph. */
function gateSheet(): SpriteSheet {
  const FW = 32;
  const FH = 48;
  const frames: Raster[] = [];
  for (let f = 0; f < 6; f++) {
    const c = new Canvas(FW, FH);
    const pulse = 0.6 + 0.4 * Math.sin((f / 6) * Math.PI * 2);
    // dark interior with a faint warm floor glow
    for (let y = 18; y < FH; y++) for (let x = 7; x < 25; x++) c.set(x, y, y > 40 ? '#18221f' : '#0a0f10');
    for (let x = 8; x < 24; x++) c.set(x, 46, '#2c3a30', 0.6 + pulse * 0.3);
    // posts
    for (const px of [3, 25]) {
      for (let y = 16; y < FH; y++) {
        c.set(px, y, C.steel[1]!);
        c.set(px + 1, y, C.steel[3]!);
        c.set(px + 2, y, C.steel[2]!);
        c.set(px + 3, y, C.steel[1]!);
        if (y % 8 === 3) c.set(px + 1, y, C.steel[4]!), c.set(px + 2, y, C.steel[4]!);
      }
      for (let y = 30; y < 36; y++) c.set(px + 2, y, C.rust[2]!), c.set(px + 1, y + 2, C.rust[1]!);
    }
    // lintel
    for (let x = 1; x < 31; x++) {
      c.set(x, 13, C.steel[4]!);
      c.set(x, 14, C.steel[3]!);
      c.set(x, 15, C.steel[2]!);
      c.set(x, 16, C.steel[1]!);
      c.set(x, 17, C.steel[0]!);
    }
    for (let x = 2; x < 30; x += 3) if (px01(x, 1, 3) > 0.5) c.set(x, 12, C.moss[3]!), c.set(x, 11, C.moss[2]!, 0.8);
    // glyph: ring with a karma-like mark
    const gx = 16;
    const gy = 6;
    c.glow(gx, gy, 10, '#bff5dc', 0.35 * pulse);
    for (let a = 0; a < Math.PI * 2; a += 0.05) c.set(Math.round(gx - 0.5 + Math.cos(a) * 4.6), Math.round(gy - 0.5 + Math.sin(a) * 4.6), '#e9fff3', 0.6 + 0.4 * pulse);
    for (let y = gy - 3; y <= gy + 2; y++) c.set(gx, y, '#e9fff3', 0.7 + 0.3 * pulse);
    c.set(gx - 2, gy - 1, '#e9fff3', 0.8);
    c.set(gx + 2, gy - 1, '#e9fff3', 0.8);
    c.set(gx - 1, gy + 1, '#e9fff3', 0.8);
    c.set(gx + 1, gy + 1, '#e9fff3', 0.8);
    frames.push(c.toRaster());
  }
  return { raster: sheetOf(frames), frameWidth: FW, frameHeight: FH, animations: { idle: { frames: [0, 1, 2, 3, 4, 5], fps: 6, loop: true } }, anchor: { x: 16, y: 47 } };
}

// ── Props ───────────────────────────────────────────────────────────────────

function props(): { props: Record<string, Raster>; info: Record<string, PropInfo> } {
  const S = C.steel;
  const R = C.rust;
  const M = C.moss;
  const out: Record<string, Raster> = {};
  const info: Record<string, PropInfo> = {};

  // hanging chain
  {
    const c = new Canvas(5, 56);
    for (let y = 0; y < 56; y++) {
      const k = y % 6;
      if (k < 4) {
        c.set(1, y, k === 0 || k === 3 ? S[2]! : S[1]!);
        c.set(3, y, k === 0 || k === 3 ? S[3]! : S[2]!);
        if (k === 0 || k === 3) c.set(2, y, S[3]!);
      } else c.set(2, y, k === 4 ? S[3]! : S[2]!);
      if (px01(0, y, 3) > 0.85) c.set(1, y, R[2]!);
    }
    out.chain = c.toRaster();
    info.chain = { anchor: 'ceiling', weight: 3 };
  }
  // vertical pipe with flanges
  {
    const c = new Canvas(16, 64);
    const ramp = [S[0]!, S[1]!, S[2]!, S[3]!, S[4]!, S[3]!, S[2]!, S[2]!, S[1]!, S[1]!, S[0]!, S[0]!];
    for (let y = 0; y < 64; y++) {
      for (let i = 0; i < 12; i++) c.set(2 + i, y, ramp[i]!);
      if (y % 22 === 8 || y % 22 === 9 || y % 22 === 10) for (let i = 0; i < 16; i++) c.set(i, y, y % 22 === 8 ? S[4]! : i < 3 ? S[3]! : S[1]!);
      if (px01(5, y, 9) > 0.8) c.set(7, y, R[2]!), c.set(8, y, R[1]!);
    }
    for (let y = 30; y < 44; y++) if (px01(1, y, 2) > 0.3) c.set(5, y, R[1]!), c.set(6, y, R[2]!);
    out.pipe = c.toRaster();
    info.pipe = { anchor: 'ground', weight: 2 };
  }
  // hanging work lamp
  {
    const c = new Canvas(14, 28);
    for (let y = 0; y < 14; y++) c.set(7, y, S[1]!);
    c.poly([[4, 14], [10, 14], [12, 19], [2, 19]], S[2]!);
    for (let x = 3; x < 11; x++) c.set(x, 14, S[3]!);
    for (let x = 2; x < 12; x++) c.set(x, 19, S[0]!);
    c.glow(7, 21, 7, C.lamp, 0.8);
    c.set(6, 20, '#fff4cf');
    c.set(7, 20, '#ffffff');
    c.set(8, 20, '#fff4cf');
    out.lamp = c.toRaster();
    info.lamp = { anchor: 'ceiling', light: { color: C.lamp, radius: 80, intensity: 0.9, flicker: 0.2, x: 7, y: 21 }, weight: 1 };
  }
  // grass tufts
  {
    const c = new Canvas(24, 10);
    const r = rng(8);
    for (let i = 0; i < 16; i++) {
      const x = r.int(1, 22);
      const h = r.int(3, 9);
      const lean = r.range(-0.4, 0.4);
      for (let k = 0; k < h; k++) c.set(Math.round(x + lean * k), 9 - k, k > h - 3 ? M[4]! : k > h / 2 ? M[3]! : M[2]!);
    }
    out.grass = c.toRaster();
    info.grass = { anchor: 'ground', weight: 6 };
  }
  // reeds with seed heads (pole plant)
  {
    const c = new Canvas(16, 30);
    const r = rng(12);
    for (let i = 0; i < 5; i++) {
      const x = 3 + i * 2 + r.int(0, 1);
      const h = r.int(16, 29);
      for (let k = 0; k < h; k++) c.set(x + Math.round(Math.sin(k * 0.12 + i) * 0.8), 29 - k, k > h - 5 ? (i % 2 ? R[2]! : '#b5864a') : k % 7 === 0 ? M[3]! : M[2]!);
    }
    out.reeds = c.toRaster();
    info.reeds = { anchor: 'ground', weight: 3 };
  }
  // concrete rubble with rebar
  {
    const pal = new Palette();
    const [ol, olLit] = pal.ramp(['#0b1213', '#1d2728']);
    const K = pal.ramp(C.concrete.slice(2).concat(['#7a8c80']));
    const [rb, rl] = pal.ramp([C.rust[1]!, C.rust[3]!]);
    const [m1, m2] = pal.ramp([C.moss[2]!, C.moss[3]!]);
    const c = new Ix(28, 14, pal);
    c.line(10, 7, 8, 4, rb!);
    c.set(8, 4, rl!);
    c.poly([[1, 14], [3, 8], [8, 6], [12, 9], [12, 14]], K[1]!);
    c.poly([[9, 14], [11, 7], [17, 5], [22, 8], [21, 14]], K[2]!);
    c.poly([[19, 14], [21, 10], [25, 9], [27, 14]], K[1]!);
    c.rim(0, -1, new Set(K), 2);
    c.shade(-1, 0, new Set(K));
    for (let x = 0; x < 28; x += 1) if (px01(x, 2, 6) > 0.55 && c.get(x, 13)) c.set(x, 13, m1!);
    for (let x = 0; x < 28; x += 1) if (px01(x, 3, 6) > 0.8) for (let y = 0; y < 14; y++) if (c.get(x, y)) { c.set(x, y, m2!); break; }
    c.outline(ol!, olLit!);
    out.rubble = c.toRaster();
    info.rubble = { anchor: 'ground', weight: 3 };
  }
  // hanging vines
  {
    const c = new Canvas(20, 44);
    const r = rng(14);
    for (let i = 0; i < 6; i++) {
      let x = r.int(1, 18);
      const len = r.int(14, 43);
      for (let y = 0; y < len; y++) {
        c.set(x, y, y > len - 4 ? M[3]! : M[1 + (y % 5 === 0 ? 1 : 0)]!);
        if (y % 4 === 2 && r.chance(0.6)) c.set(x + (r.chance(0.5) ? 1 : -1), y, M[2]!);
        if (r.chance(0.07)) x += r.chance(0.5) ? 1 : -1;
      }
    }
    out.vines = c.toRaster();
    info.vines = { anchor: 'ceiling', weight: 4 };
  }
  // a hazard-striped sign hanging askew from one chain
  {
    const pal = new Palette();
    const [ol, olLit] = pal.ramp(['#0b1213', '#1d2728']);
    const st = pal.ramp([C.steel[1]!, C.steel[2]!, C.steel[3]!]);
    const yl = pal.ramp(['#4f4a2e', '#7f7646', '#a69a5c']);
    const rs = pal.ramp([C.rust[0]!, C.rust[1]!, C.rust[2]!]);
    const c = new Ix(30, 24, pal);
    c.line(6, 0, 6, 5, st[1]!);
    const pts: [number, number][] = [[3, 6], [28, 10], [27, 21], [2, 17]];
    c.poly(pts, (x, y) => ((x + y * 2) % 8 < 4 ? yl[1]! : st[0]!));
    for (let x = 3; x < 28; x++) for (let y = 0; y < 24; y++) if (c.get(x, y) && px01(x, y, 11) > 0.82) c.set(x, y, rs[px01(y, x, 2) > 0.5 ? 1 : 2]!);
    c.rim(0, -1, undefined, 1);
    c.outline(ol!, olLit!);
    out.sign = c.toRaster();
    info.sign = { anchor: 'wall', weight: 1 };
  }
  // rusted barrel
  {
    const c = new Canvas(12, 16);
    const ramp = [R[0]!, R[1]!, R[2]!, R[3]!, R[2]!, R[2]!, R[1]!, R[1]!, R[0]!, R[0]!];
    for (let y = 1; y < 16; y++) for (let i = 0; i < 10; i++) c.set(1 + i, y, ramp[i]!);
    for (const y of [3, 8, 13]) for (let i = 0; i < 10; i++) c.set(1 + i, y, i < 4 ? S[3]! : S[1]!);
    for (let i = 0; i < 10; i++) c.set(1 + i, 0, S[2]!);
    out.barrel = c.toRaster();
    info.barrel = { anchor: 'ground', weight: 2 };
  }
  // big wall fan / vent
  {
    const c = new Canvas(28, 28);
    c.disc(14, 14, 13, S[0]!);
    c.disc(14, 14, 12, S[2]!);
    c.disc(14, 14, 10.5, '#0d1415');
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      c.poly([[14, 14], [14 + Math.cos(a) * 10, 14 + Math.sin(a) * 10], [14 + Math.cos(a + 0.5) * 9, 14 + Math.sin(a + 0.5) * 9]], S[1]!);
    }
    c.disc(14, 14, 2, S[3]!);
    for (let a = -2.4; a < -0.6; a += 0.05) c.set(Math.round(14 + Math.cos(a) * 12), Math.round(14 + Math.sin(a) * 12), S[4]!);
    out.fan = c.toRaster();
    info.fan = { anchor: 'wall', weight: 1 };
  }
  return { props: out, info };
}

export const RAIN_RUINS_META = {
  id: 'rain-ruins',
  name: 'Rain Ruins',
  description: 'Moody rain-soaked industrial ruins in teal fog: rusted towers, pipes, moss and a small pale creature with a red scarf.',
  keywords: ['rain', 'ruins', 'industrial', 'moody', 'dark', 'robot', 'city', 'rust', 'pipes', 'factory', 'fog', 'abandoned', 'post-apocalyptic', 'creature', 'survival', 'storm', 'wet', 'grey', 'melancholy', 'atmospheric'],
  palette: [C.skyTop, C.skyMid, C.horizon, C.haze, ...C.concrete, ...C.moss, ...C.rust, ...C.steel, C.glow, C.lamp, '#eceadd', '#d4603a'],
  background: C.skyTop,
};

export function rainRuins(): ArtTheme {
  const { props: p, info } = props();
  return {
    ...RAIN_RUINS_META,
    layers: layers(),
    tiles: rainTiles(),
    sprites: {
      hero: heroSheet(rainHeroCostume()),
      enemy: lizardSheet(),
      pickup: pearlSheet(),
      goal: gateSheet(),
      flyer: flyerSheet({ body: ['#1b2224', '#2e3a3a', '#4a5856'], wing: ['#3e4c4a', '#8fa59c', '#c4d4cb'], eye: '#e8f06a', outline: '#070b0c', glowEye: true }),
      checkpoint: checkpointSheet({ post: C.steel.slice(0, 3), cage: C.steel[3]!, glow: C.lamp, core: '#fff6d8', outline: '#0b1213' }),
    },
    props: p,
    propInfo: info,
    tileSize: TILE,
    lights: {
      hero: { color: '#cfe8df', radius: 46, intensity: 0.35 },
      pickup: { color: C.glow, radius: 40, intensity: 0.8, flicker: 0.05 },
      goal: { color: '#bff5dc', radius: 72, intensity: 0.8, flicker: 0.04 },
    },
    environment: {
      ambient: { color: '#e0f0ec', intensity: 0.86 },
      fog: { color: C.haze, density: 0.22, height: 0.45 },
      bloom: { strength: 0.45, threshold: 0.72 },
      vignette: 0.5,
      grade: { contrast: 1.08, saturation: 0.85, tint: '#eaf6f2' },
      particles: [
        { type: 'rain', density: 0.75, color: '#b4cdc6' },
        { type: 'dust', density: 0.15, color: '#cfe0d6' },
      ],
    },
  };
}
