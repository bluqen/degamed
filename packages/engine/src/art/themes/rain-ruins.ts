/**
 * Rain Ruins: rusted industrial ruins under endless rain. Teal and grey-green fog, colossal
 * towers and a radio mast fading into the haze, pipes and girders overgrown with moss. The hero is
 * Pip, a little lantern robot in a tarp cape; rust crawler drones skitter about; batteries glow;
 * a warm-windowed hatch waits at the end.
 */
import { Canvas, gradient, Ix, MatLayer, Palette, rng, fbm, bayer, type Material } from '../core';
import { castFor, castSheet } from './big-heroes';
import { cable, crane, mast, elbow, hangingChain, lightShafts, mistBand, overgrow, pipe, pylon, tank, tower, truss } from '../scenery';
import { crack, derive, pickRamp, px01, tileNoise, TILE } from '../tiles';
import { backEdges, backWall } from '../tiles';
import { crackDecal, grateDecal, pipeDecal, rootsDecal } from '../decals';
import { sheetOf, type Raster } from '../../pixel';
import type { ArtTheme, ParallaxLayer, PropInfo, SpriteSheet } from '../types';
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

/** The mast's beacon, in layer pixels. */
const MAST: [number, number] = [218, 44];

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
  // the landmark: a colossal radio mast rising out of the haze, its beacon blinking red
  mast(L, MAST[0], H, MAST[1] + 18, 56, 8, 3);
  for (let i = 0; i < 4; i++) cable(L, MAST[0], MAST[1] + 40 + i * 30, MAST[0] - 90 + i * 60, H, 18, 3);
  const mats: Record<number, Material> = {
    3: { base: '#587570', dark: '#54706b', rim: '#7c9890', grain: 12, dither: true, fadeTo: C.horizon, fadeFrom: 0.55, fadeAmt: 0.7 },
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
    { name: 'superstructure', raster: superstructure().toRaster(), factor: 0.06, tiled: true, glows: [{ x: MAST[0], y: MAST[1], color: '#ff4a3a', radius: 7, intensity: 1, blink: 1.6 }] },
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
  const fill3 = concrete(27);
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
    fill3: t(fill3),
    ...(() => {
      const back = backWall(fill2, '#0f1718', 0.55, (x) => (x % 8 === 0 ? 0.2 : 0));
      const e = backEdges(back, C.concrete[3]!, '#070b0c');
      return { back: t(back), backTop: t(e.backTop), backBottom: t(e.backBottom), backLeft: t(e.backLeft), backRight: t(e.backRight) };
    })(),
    spike: spikeStrip([C.rust[0]!, C.rust[1]!, C.steel[3]!, C.steel[4]!], '#0b1213', C.concrete[2]),
  };
}

// ── Creatures ───────────────────────────────────────────────────────────────

/**
 * A rust crawler drone: a dented dome on four jointed legs, one red lens that scans, a stubby
 * antenna. It skitters (8 frames), the lens sweeps while idle and flares before it lunges.
 */
function droneSheet(): SpriteSheet {
  const FW = 36;
  const FH = 24;
  const pal = new Palette();
  const [ol, olLit] = pal.ramp(['#0a0f10', '#2a3434']);
  const shell = pal.ramp(['#3a3430', '#6a5a48', '#9a7e5a', '#c8a878']);
  const rust = pal.ramp(['#5a2a18', '#8a4424']);
  const [plate, plateLit] = pal.ramp(['#2a3232', '#4a5454']);
  const [leg, legLit] = pal.ramp(['#1e2626', '#3e4a4a']);
  const [lensRim, lens, lensHot] = pal.ramp(['#3a0a0a', '#e0302a', '#ffd0a0']);
  const [flash] = pal.ramp(['#ffffff']);
  const frames: Raster[] = [];
  const draw = (f: number, mode: 'walk' | 'idle' | 'attack' | 'hurt') => {
    const c = new Ix(FW, FH, pal);
    const walk = mode === 'walk';
    const bob = walk ? [0, 1, 1, 0, 0, 1, 1, 0][f % 8]! : mode === 'attack' ? -1 : 0;
    const cx = 17 + (mode === 'attack' ? 2 : 0);
    const by = 12 + bob;
    // legs: two pairs (far darker), jointed: knee up above the body line, foot down
    const legAt = (hipX: number, ph: number, far: boolean) => {
      const step = walk ? Math.round(Math.sin(ph) * 3) : 0;
      const lift = walk && Math.cos(ph) > 0.3 ? 2 : 0;
      const kx = hipX + Math.sign(hipX - cx) * 4 + step;
      const ky = by - 3 - lift;
      const fx = hipX + Math.sign(hipX - cx) * 6 + step;
      const fy = FH - 2 - lift;
      const col = far ? leg! : legLit!;
      c.line(hipX, by + 1, kx, ky, col);
      c.line(kx, ky, fx, fy, col);
      c.set(fx, fy + 1, col);
    };
    const ph = (f / 8) * Math.PI * 2;
    legAt(cx - 5, ph + Math.PI, true);
    legAt(cx + 5, ph, true);
    // chassis plate and dome
    c.rect(cx - 9, by, 18, 3, plate!);
    for (let x = cx - 9; x < cx + 9; x++) c.set(x, by, plateLit!);
    c.ellipse(cx, by, 9, 7, (x, y, nx, ny) => (y >= by ? 0 : shell[Math.max(0, Math.min(3, Math.round(1.6 - ny * 1.5 + nx * 0.4)))]!));
    // dents and rust
    c.set(cx - 4, by - 4, rust[1]!);
    c.set(cx - 3, by - 4, rust[0]!);
    c.set(cx - 5, by - 2, rust[0]!);
    c.set(cx + 2, by - 6, shell[3]!);
    for (let x = cx - 8; x < cx + 8; x += 3) c.set(x, by + 2, rust[0]!);
    // lens: sweeps while idle, flares on attack
    const look = mode === 'idle' ? [0, 1, 2, 1][f % 4]! : 2;
    const lx = cx + 5 + look - 2;
    c.ellipse(lx, by - 3, 2.6, 2.6, lensRim!);
    c.ellipse(lx, by - 3, 1.6, 1.6, lens!);
    c.set(lx, by - 4, lensHot!);
    if (mode === 'attack') c.set(lx + 1, by - 3, lensHot!), c.set(lx - 1, by - 3, lensHot!);
    // antenna
    c.line(cx - 3, by - 7, cx - 5, by - 11 + (walk ? f % 2 : 0), plateLit!);
    c.set(cx - 5, by - 12 + (walk ? f % 2 : 0), lens!);
    // near legs over the body
    legAt(cx - 4, ph, false);
    legAt(cx + 6, ph + Math.PI, false);
    c.rim(0, -1, new Set(shell));
    c.outline(ol!, olLit!);
    if (mode === 'hurt') for (let i = 0; i < c.px.length; i++) if (c.px[i] && c.px[i] !== ol) c.px[i] = flash!;
    frames.push(c.toRaster());
  };
  for (let f = 0; f < 8; f++) draw(f, 'walk');
  for (let f = 0; f < 4; f++) draw(f, 'idle');
  draw(0, 'attack');
  draw(0, 'hurt');
  return {
    raster: sheetOf(frames),
    frameWidth: FW,
    frameHeight: FH,
    animations: {
      walk: { frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 14, loop: true },
      idle: { frames: [8, 9, 10, 11, 10, 9], fps: 4, loop: true },
      attack: { frames: [12, 12, 0], fps: 10, loop: false },
      hurt: { frames: [13, 0, 13, 0], fps: 14, loop: false },
    },
    hitbox: { x: 6, y: 5, w: 24, h: 18 },
    anchor: { x: 18, y: 23 },
  };
}

/** A charged battery cell: glowing bars, a little bolt, bobbing and pulsing. */
function batterySheet(): SpriteSheet {
  const FW = 14;
  const FH = 18;
  const frames: Raster[] = [];
  for (let f = 0; f < 8; f++) {
    const c = new Canvas(FW, FH);
    const bob = Math.round(Math.sin((f / 8) * Math.PI * 2) * 1.2);
    const pulse = 0.6 + 0.4 * Math.sin((f / 8) * Math.PI * 2);
    const x0 = 3;
    const y0 = 3 + bob;
    c.glow(7, y0 + 7, 8, C.glow, 0.45 * pulse);
    // cap
    c.fillRect(x0 + 2, y0, 4, 2, C.steel[3]!);
    c.set(x0 + 2, y0, C.steel[4]!);
    // casing: shaded cylinder
    const shade = [C.steel[1]!, C.steel[3]!, C.steel[4]!, C.steel[3]!, C.steel[2]!, C.steel[2]!, C.steel[1]!, C.steel[0]!];
    for (let y = 2; y < 13; y++) for (let i = 0; i < 8; i++) c.set(x0 + i, y0 + y, shade[i]!);
    // charge window with bars filling up
    const lit = 1 + (f % 4);
    for (let k = 0; k < 4; k++) for (let i = 2; i < 6; i++) c.set(x0 + i, y0 + 11 - k * 2, k < lit ? (k === lit - 1 ? '#c8fff0' : C.glow) : '#1a3a38');
    // bolt
    c.set(x0 + 5, y0 + 3, '#fff6c0');
    c.set(x0 + 4, y0 + 4, '#fff6c0');
    c.set(x0 + 5, y0 + 4, '#fff6c0');
    c.set(x0 + 4, y0 + 5, '#fff6c0');
    if (f === 2 || f === 3) {
      c.set(12, 2, '#ffffff');
      c.set(11, 2, '#bdf7ea', 0.7);
      c.set(12, 1, '#bdf7ea', 0.7);
      c.set(12, 3, '#bdf7ea', 0.7);
      c.set(13, 2, '#bdf7ea', 0.7);
    }
    frames.push(c.toRaster());
  }
  return { raster: sheetOf(frames), frameWidth: FW, frameHeight: FH, animations: { idle: { frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 9, loop: true } } };
}

/** Home: a rusted round-topped hatch in a concrete frame, its porthole glowing warm. */
function hatchSheet(): SpriteSheet {
  const FW = 32;
  const FH = 48;
  const K = C.concrete;
  const S = C.steel;
  const frames: Raster[] = [];
  for (let f = 0; f < 6; f++) {
    const c = new Canvas(FW, FH);
    const pulse = 0.6 + 0.4 * Math.sin((f / 6) * Math.PI * 2);
    // concrete frame
    for (let y = 8; y < FH; y++) for (let x = 2; x < 30; x++) c.set(x, y, x < 5 ? K[3]! : x > 26 ? K[2]! : K[4]!);
    for (let x = 2; x < 30; x++) c.set(x, 8, K[5]!), c.set(x, 9, K[4]!);
    // the hatch: rounded top, riveted steel with rust
    for (let y = 12; y < FH; y++)
      for (let x = 7; x < 25; x++) {
        if (y < 20 && Math.hypot(x + 0.5 - 16, y - 20) > 9) continue;
        c.set(x, y, x < 10 ? S[1]! : x > 21 ? S[1]! : S[2]!);
      }
    for (const x of [8, 23]) for (let y = 20; y < FH; y += 5) c.set(x, y, S[4]!);
    for (let y = 30; y < 44; y++) if ((y * 7) % 5 < 2) c.set(11 + (y % 3), y, C.rust[1]!);
    // handle wheel
    c.set(20, 34, S[4]!);
    c.set(19, 34, S[3]!);
    c.set(21, 34, S[3]!);
    c.set(20, 33, S[3]!);
    c.set(20, 35, S[3]!);
    // warm porthole: someone is home
    c.glow(16, 22, 9, C.lamp, 0.45 * pulse);
    c.disc(16, 22, 4.5, S[0]!);
    c.disc(16, 22, 3.5, '#ffb84a');
    c.disc(15.5, 21.5, 2, '#ffe6a0');
    c.set(15, 20, '#ffffff');
    // a little green lamp above the hatch blinks
    c.set(16, 5, f % 3 === 0 ? '#7aff9a' : '#2a6a3a');
    if (f % 3 === 0) c.glow(16, 5, 4, '#7aff9a', 0.6);
    c.fillRect(14, 6, 5, 2, S[2]!);
    // moss on the frame
    for (let x = 2; x < 30; x += 1) if (((x * 13) % 7) < 2) c.set(x, 7, C.moss[3]!);
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
  // reeds with seed heads
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

function decals(): Record<string, Raster> {
  return {
    crack: crackDecal(34, 22, C.concrete[0]!, '#080d0e', C.concrete[4]!, 3),
    crack2: crackDecal(26, 18, C.concrete[0]!, '#080d0e', C.concrete[4]!, 9),
    pipe: pipeDecal(34, C.steel.slice(0, 4), C.rust.slice(1, 3)),
    vent: grateDecal(C.steel.slice(0, 3), '#060a0b'),
    roots: rootsDecal(26, 22, C.moss.slice(0, 3), 5),
  };
}

export const RAIN_RUINS_META = {
  id: 'rain-ruins',
  name: 'Rain Ruins',
  description: 'Moody rain-soaked industrial ruins in teal fog: rusted towers, a radio mast, pipes and moss. A little lantern robot looks for home.',
  keywords: ['rain', 'ruins', 'industrial', 'city', 'factory', 'pipes', 'rust', 'fog', 'abandoned', 'post-apocalyptic', 'storm', 'wet', 'grey', 'moody', 'melancholy', 'lonely', 'overgrown', 'sewer', 'urban', 'atmospheric'],
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
      hero: castSheet('robot'),
      enemy: droneSheet(),
      pickup: batterySheet(),
      goal: hatchSheet(),
      flyer: flyerSheet({ body: ['#1b2224', '#2e3a3a', '#4a5856'], wing: ['#3e4c4a', '#8fa59c', '#c4d4cb'], eye: '#e8f06a', outline: '#070b0c', glowEye: true }),
      checkpoint: checkpointSheet({ post: C.steel.slice(0, 3), cage: C.steel[3]!, glow: C.lamp, core: '#fff6d8', outline: '#0b1213' }),
    },
    props: p,
    propInfo: info,
    heroes: castFor('robot'),
    decals: decals(),
    tileSize: TILE,
    lights: {
      hero: { color: '#cfe8df', radius: 46, intensity: 0.35 },
      pickup: { color: C.glow, radius: 40, intensity: 0.8, flicker: 0.05 },
      goal: { color: C.lamp, radius: 72, intensity: 0.8, flicker: 0.04 },
      enemy: { color: '#ff5a3a', radius: 22, intensity: 0.35, flicker: 0.1 },
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
