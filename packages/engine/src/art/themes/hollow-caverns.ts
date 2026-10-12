/**
 * Hollow Caverns: blue-black caverns under a forgotten city. Distant spires with a few warm
 * windows, the carved statue of a winged moth keeper, layered stalactites rimmed in cold blue
 * light, glowing fungus and drifting spores. The hero is Lumen, a moth carrying a lantern; puffcap
 * mushrooms waddle through the dark.
 */
import { Canvas, fbm, gradient, Ix, MatLayer, Palette, rng, bayer, type Material, type Rng } from '../core';
import { castFor, castSheet } from './big-heroes';
import { hangingChain, lightShafts, mistBand, speckle } from '../scenery';
import { derive, px01, tileCells, tileNoise, TILE } from '../tiles';
import { backEdges, backWall } from '../tiles';
import { bonesDecal, crackDecal, fossilDecal, rootsDecal, veinDecal } from '../decals';
import { dripSheet, glowwormSheet, grassSwaySheet } from '../overlays';
import { sheetOf, type Raster } from '../../pixel';
import type { ArtTheme, ParallaxLayer, PropInfo, SpriteSheet } from '../types';
import { checkpointSheet, flyerSheet, spikeStrip } from '../extras';

const W = 480;
const H = 270;

const C = {
  top: '#0a1122',
  mid: '#14223f',
  glowSky: '#1e3460',
  low: '#0a0f1d',
  fog: '#25406e',
  stone: ['#04060d', '#0a101e', '#111a2f', '#1a2642', '#26375a', '#38507f', '#5874aa', '#86a3d6'],
  blue: ['#2c6fb0', '#4fa6e8', '#8fdcff', '#d9f6ff'],
  amber: ['#6e3212', '#b8601e', '#f0a040', '#ffd98a'],
  teal: ['#0e2630', '#173c48', '#235a66', '#3b8a8f'],
};

// ── Cave shapes ─────────────────────────────────────────────────────────────

/** Organic cave masses hanging from the ceiling and rising from the floor, with spikes. */
function caveMass(
  L: MatLayer,
  r: Rng,
  id: number,
  o: { seed: number; ceil?: number; floor?: number; amp: number; cells: number; rough?: number; spikes?: number; spikeLen?: [number, number]; spikeW?: [number, number]; mites?: number },
): void {
  for (let x = 0; x < L.w; x++) {
    const nC = fbm(x, 0, { w: L.w, h: L.h, cells: o.cells, octaves: 4, seed: o.seed, wrapX: true });
    const nF = fbm(x, 0, { w: L.w, h: L.h, cells: o.cells, octaves: 4, seed: o.seed + 1, wrapX: true });
    for (let y = 0; y < L.h; y++) {
      const n2 = (fbm(x, y, { w: L.w, h: L.h, cells: o.cells * 3, octaves: 3, seed: o.seed + 2, wrapX: true }) - 0.5) * (o.rough ?? 10);
      if (o.ceil !== undefined && y < o.ceil + (nC - 0.5) * 2 * o.amp + n2) L.set(x, y, id);
      if (o.floor !== undefined && y > o.floor - (nF - 0.5) * 2 * o.amp + n2) L.set(x, y, id);
    }
  }
  const spike = (x: number, from: number, len: number, w: number, dir: 1 | -1) => {
    const bend = r.range(-0.15, 0.15);
    const pts: [number, number][] = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const half = (w / 2) * (1 - t) ** 0.8;
      pts.push([x - half + bend * t * len, from + dir * t * len]);
    }
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const half = (w / 2) * (1 - t) ** 0.8;
      pts.push([x + half + bend * t * len, from + dir * t * len]);
    }
    L.poly(pts, id);
  };
  const surface = (x: number, top: boolean) => {
    if (top) {
      let y = 0;
      while (y < L.h && L.get(x, y) === id) y++;
      return y;
    }
    let y = L.h - 1;
    while (y > 0 && L.get(x, y) === id) y--;
    return y;
  };
  if (o.ceil !== undefined)
    for (let i = 0; i < (o.spikes ?? 0); i++) {
      const x = r.int(0, L.w - 1);
      spike(x, surface(x, true) - 2, r.int(...(o.spikeLen ?? [10, 40])), r.int(...(o.spikeW ?? [4, 12])), 1);
    }
  if (o.floor !== undefined)
    for (let i = 0; i < (o.mites ?? 0); i++) {
      const x = r.int(0, L.w - 1);
      spike(x, surface(x, false) + 2, r.int(...(o.spikeLen ?? [10, 40])) * 0.7, r.int(...(o.spikeW ?? [4, 12])) * 1.3, -1);
    }
}

/** A slender spire with a pointed roof, for the distant city. */
function spire(L: MatLayer, r: Rng, x: number, base: number, w: number, h: number, id: number, win: number, lit: number): void {
  L.rect(x, base - h, w, h, id);
  const roof = r.int(w, w * 2.5);
  L.poly([[x - 1, base - h], [x + w / 2, base - h - roof], [x + w + 1, base - h]], id);
  L.rect(Math.round(x + w / 2), base - h - roof - r.int(4, 10), 1, r.int(4, 10), id);
  if (r.chance(0.5)) {
    // a bulb dome halfway up
    L.ellipse(x + w / 2, base - h * 0.55, w * 0.9, w * 0.7, id);
  }
  for (let y = base - h + 4; y < base - 6; y += r.int(5, 9))
    if (r.chance(0.5)) L.rect(x + Math.floor(w / 2) - 1, y, 2, 3, r.chance(0.2) ? lit : win);
}

// ── Layers ──────────────────────────────────────────────────────────────────

function backdrop(): Canvas {
  const c = new Canvas(W, H);
  c.wrapX = true;
  gradient(c, [[0, C.top], [0.35, C.mid], [0.6, C.glowSky], [0.8, '#122039'], [1, C.low]], { dither: 6 });
  // a soft opening far above: dithered radial bloom of cold light
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - 300) / 220, (y - 20) / 160);
      const a = Math.max(0, 1 - d) ** 2 * 0.35;
      const q = Math.floor(a * 10 + bayer(x, y) * 0.95) / 10;
      if (q > 0) c.set(x, y, '#3a5f9c', q);
    }
  speckle(c, rng(3), 90, '#6f93d0', [0, 0, W, H * 0.7], 0.5);
  return c;
}

function farCity(): Canvas {
  const r = rng(11);
  const L = new MatLayer(W, H);
  let x = 4;
  while (x < W - 8) {
    const w = r.int(5, 11);
    spire(L, r, x, H - 40, w, r.int(50, 150), 1, 2, 3);
    x += w + r.int(6, 26);
  }
  L.rect(0, H - 60, W, 60, 1);
  // a great dome
  L.ellipse(140, H - 60, 46, 34, 1);
  L.rect(139, H - 60 - 34 - 18, 2, 18, 1);
  const fade = { fadeTo: '#1d3358', fadeFrom: 0.55, fadeAmt: 0.85 };
  const mats: Record<number, Material> = {
    1: { base: '#1b2b4b', dark: '#192846', rim: '#2d4676', grain: 20, ...fade },
    2: { base: '#16233e', ...fade },
    3: { base: '#ffcf7a' },
  };
  return L.paint(mats, 5);
}

/** Where the great statue stands in the far cave layer (centre x, ground y). */
const STATUE: [number, number] = [178, 246];

/**
 * A colossal statue of a winged moth keeper, carved from the cave rock: folded wings spread
 * behind it, feathery antennae, great hollow eyes, and a lantern staff whose lamp still glows.
 */
function statue(L: MatLayer, cx: number, base: number): void {
  // stepped pedestal
  L.rect(cx - 44, base - 8, 88, 8, 2);
  L.rect(cx - 36, base - 16, 72, 8, 2);
  // wings: two broad scalloped fans behind the body
  for (const dir of [-1, 1]) {
    const pts: [number, number][] = [[cx, base - 110]];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const a = -0.9 + t * 1.9;
      const r = 62 + Math.sin(t * Math.PI * 3) * 5;
      pts.push([cx + dir * Math.cos(a) * r * 0.85, base - 92 + Math.sin(a) * r * 0.75]);
    }
    pts.push([cx, base - 40]);
    L.poly(pts, 2);
  }
  // robed body
  L.poly([[cx - 14, base - 104], [cx + 14, base - 104], [cx + 26, base - 16], [cx - 26, base - 16]], 2);
  // round furred head
  L.ellipse(cx, base - 118, 17, 15, 2);
  // feathery antennae sweeping up and out
  for (const dir of [-1, 1]) {
    let px = cx + dir * 6;
    let py = base - 130;
    for (let i = 0; i < 14; i++) {
      const nx = px + dir * 1.6;
      const ny = py - 3;
      L.line(px, py, nx, ny, 2, 2);
      // barbs
      L.line(nx, ny, nx + dir * 4, ny + 2, 2);
      L.line(nx, ny, nx - dir * 1, ny - 3, 2);
      px = nx;
      py = ny;
    }
  }
  // great hollow eyes
  L.ellipse(cx - 7, base - 118, 5.5, 6.5, 3);
  L.ellipse(cx + 7, base - 118, 5.5, 6.5, 3);
  // the lantern staff
  L.line(cx + 22, base - 16, cx + 30, base - 150, 2, 3);
  L.rect(cx + 24, base - 154, 12, 3, 2);
  L.rect(cx + 31, base - 151, 1, 6, 2);
  L.rect(cx + 28, base - 145, 7, 9, 2);
}

function farCave(): Canvas {
  const r = rng(21);
  const L = new MatLayer(W, H);
  caveMass(L, r, 1, { seed: 31, ceil: 40, floor: 235, amp: 26, cells: 5, rough: 14, spikes: 18, spikeLen: [20, 70], spikeW: [6, 16], mites: 8 });
  // tall rock columns joining floor and ceiling
  for (let i = 0; i < 3; i++) {
    const cx = r.int(0, W);
    for (let y = 0; y < H; y++) {
      const w = 8 + Math.abs(Math.sin(y / 30 + i)) * 6 + (y < 60 || y > 210 ? (Math.min(y, H - y) < 60 ? (60 - Math.min(y, H - y)) * 0.4 : 0) : 0);
      L.rect(cx - w / 2, y, w, 1, 1);
    }
  }
  statue(L, STATUE[0], STATUE[1]);
  const mats: Record<number, Material> = {
    1: { base: '#131f38', dark: '#111b32', light: '#16233f', rim: '#2b4473', rimWidth: 1, grain: 18, dither: true, fadeTo: C.fog, fadeFrom: 0.7, fadeAmt: 0.6 },
    2: { base: '#23385f', dark: '#203459', light: '#283f68', rim: '#6a92d0', rimWidth: 1, grain: 22, dither: true, fadeTo: C.fog, fadeFrom: 0.8, fadeAmt: 0.5 },
    3: { base: '#070b16' },
  };
  return L.paint(mats, 7);
}

function glowMist(): Canvas {
  const c = new Canvas(W, H);
  c.wrapX = true;
  lightShafts(c, rng(4), { count: 4, color: '#a9c8ff', alpha: 0.26, slope: 0.18, width: [6, 16], top: 0, bottom: 250 });
  mistBand(c, { y: 215, h: 40, color: '#2f4f86', alpha: 0.7, seed: 51, cells: 5 });
  mistBand(c, { y: 95, h: 20, color: '#2a477a', alpha: 0.35, seed: 52, cells: 4 });
  return c;
}

function midCave(): Canvas {
  const r = rng(31);
  const L = new MatLayer(W, H);
  caveMass(L, r, 1, { seed: 61, ceil: 22, floor: 250, amp: 16, cells: 6, rough: 12, spikes: 22, spikeLen: [14, 60], spikeW: [5, 12], mites: 10 });
  // rounded boulders on the floor
  for (let i = 0; i < 6; i++) L.ellipse(r.int(0, W), r.int(232, 250), r.int(10, 26), r.int(8, 16), 1);
  // hanging roots with glowing bulbs
  for (let i = 0; i < 14; i++) {
    let x = r.int(0, W);
    let y = 0;
    while (y < H && L.get(x, y)) y++;
    const len = r.int(12, 60);
    for (let k = 0; k < len; k++) {
      L.set(x, y + k, 2);
      if (r.chance(0.12)) x += r.chance(0.5) ? 1 : -1;
    }
    if (r.chance(0.6)) {
      L.disc(x + 0.5, y + len + 1, 1.6, 3);
    }
  }
  // glowing fungus on floor tops
  for (let x = 0; x < W; x++) {
    let y = H - 1;
    while (y > 0 && L.get(x, y)) y--;
    if (y < H - 1 && fbm(x, 0, { w: W, h: H, cells: 30, octaves: 2, seed: 71, wrapX: true }) > 0.62) {
      L.set(x, y, 3);
      if (r.chance(0.4)) L.set(x, y - 1, 3);
    }
  }
  const mats: Record<number, Material> = {
    1: { base: '#0c1427', dark: '#0a1123', light: '#0f182e', rim: '#2d4c80', grain: 26, dither: true, fadeTo: '#1a2d52', fadeFrom: 0.8, fadeAmt: 0.6 },
    2: { base: '#16283e' },
    3: { base: '#7fd8ff', rim: '#d9f6ff' },
  };
  return L.paint(mats, 9);
}

function nearCave(): Canvas {
  const r = rng(41);
  const L = new MatLayer(W, H);
  caveMass(L, r, 1, { seed: 81, ceil: 6, amp: 8, cells: 4, rough: 8, spikes: 9, spikeLen: [40, 110], spikeW: [10, 24] });
  caveMass(L, r, 1, { seed: 82, floor: 262, amp: 6, cells: 4, rough: 6, mites: 5, spikeLen: [40, 90], spikeW: [10, 20] });
  // shelf fungus on a few spikes, glowing tips
  for (let i = 0; i < 10; i++) {
    const x = r.int(0, W);
    let y = 0;
    while (y < H - 1 && L.get(x, y)) y++;
    if (y > 20 && y < 140) L.disc(x, y, 1.5, 2);
  }
  const mats: Record<number, Material> = {
    1: { base: '#060a14', dark: '#050812', light: '#080d19', rim: '#1d3256', grain: 30, dither: true },
    2: { base: '#8fdcff', rim: '#ffffff' },
  };
  return L.paint(mats, 11);
}

function foreground(): Canvas {
  const r = rng(51);
  const FW = 640;
  const L = new MatLayer(FW, H);
  caveMass(L, r, 1, { seed: 91, floor: 285, amp: 26, cells: 6, rough: 8, mites: 4, spikeLen: [30, 60], spikeW: [14, 30] });
  for (let i = 0; i < 4; i++) {
    let x = r.int(0, FW);
    const len = r.int(40, 120);
    for (let y = 0; y < len; y++) {
      L.set(x, y, 1);
      L.set(x + 1, y, 1);
      if (r.chance(0.1)) x += r.chance(0.5) ? 1 : -1;
    }
  }
  return L.paint({ 1: { base: '#020308', rim: '#0b1426' } }, 13);
}

function layers(): ParallaxLayer[] {
  return [
    { name: 'backdrop', raster: backdrop().toRaster(), factor: 0, tiled: true },
    { name: 'far city', raster: farCity().toRaster(), factor: 0.07, tiled: true },
    { name: 'far cave', raster: farCave().toRaster(), factor: 0.18, tiled: true, glows: [{ x: STATUE[0] + 31, y: STATUE[1] - 140, color: '#ffc04a', radius: 6, intensity: 0.9, flicker: 0.3 }, { x: STATUE[0] - 40, y: STATUE[1] - 22, color: '#8fdcff', radius: 5, intensity: 0.7, flicker: 0.2 }] },
    { name: 'glow mist', raster: glowMist().toRaster(), factor: 0.3, tiled: true },
    { name: 'mid cave', raster: midCave().toRaster(), factor: 0.45, tiled: true },
    { name: 'near cave', raster: nearCave().toRaster(), factor: 0.7, tiled: true },
    { name: 'foreground', raster: foreground().toRaster(), factor: 1.35, tiled: true },
  ];
}

// ── Tiles ───────────────────────────────────────────────────────────────────

function cobbles(seed: number, lift = 0, count = 9): Canvas {
  const S = C.stone;
  const cell = tileCells(seed, count);
  const n = tileNoise(seed + 3, 4, 2);
  const c = new Canvas(TILE, TILE);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const k = cell(x, y);
      const tone = (k.id * 37) % 4 === 0 ? 0 : 1;
      const lf = y < 9 || (y < 12 && bayer(x, y) > 0.5) ? lift : 0;
      let i = 2 + tone + lf;
      if (k.gap < 1) i = 1 + lf;
      else if (k.gap < 2 && k.dy < -0.5) i += 1; // lit upper rim of each stone
      if (n(x, y) > 0.7 && bayer(x, y) > 0.5) i += 1;
      c.set(x, y, S[Math.max(0, Math.min(S.length - 1, i))]!);
    }
  return c;
}

function crust(base: Canvas, seed: number): Canvas {
  const S = C.stone;
  const depth = tileNoise(seed, 2, 2);
  return derive(base, (x, y) => {
    const d = 3 + Math.round(depth(x, 0) * 2);
    if (y === 0) {
      const blade = px01(x, 0, seed) > 0.55;
      return blade ? (px01(x, 1, seed) > 0.85 ? C.blue[2] : C.teal[3]) : 'clear';
    }
    if (y === 1) return px01(x, 2, seed) > 0.25 ? S[7] : C.blue[1];
    if (y === 2) return px01(x, 3, seed) > 0.85 ? C.blue[1] : S[6];
    if (y < d) return S[5];
    if (y === d) return S[4];
    if (y === d + 1) return S[1];
    return null;
  });
}

function caveTiles(): ArtTheme['tiles'] {
  const S = C.stone;
  const fill = cobbles(5);
  const fill2 = cobbles(6);
  const fill3 = cobbles(10);
  const ground = crust(cobbles(7, 1), 21);
  const ground2 = crust(cobbles(8, 1), 22);
  const ground3 = crust(cobbles(9, 1), 23);
  const groundLeft = derive(ground, (x, y) => {
    if (x + y < 3) return 'clear';
    if (x === 0 && y >= 3) return y < 8 ? S[5] : S[1];
    if (x + y === 3) return S[6];
    return null;
  });
  const groundRight = derive(ground, (x, y) => {
    if (15 - x + y < 3) return 'clear';
    if (x === 15 && y >= 3) return y < 10 ? S[6] : S[4];
    if (15 - x + y === 3) return S[7];
    return null;
  });
  const fillLeft = derive(fill, (x) => (x === 0 ? S[0] : null));
  const fillRight = derive(fill, (x) => (x === 15 ? S[4] : x === 14 ? S[3] : null));
  const ceiling = derive(fill, (x, y) => {
    const drip = px01(x, 1, 3);
    if (y === 15) return drip > 0.6 ? S[2] : 'clear';
    if (y === 14) return drip > 0.3 ? S[3] : 'clear';
    if (y === 13) return S[3];
    return null;
  });
  // a stone ledge with a rounded underside and hanging roots
  const plat = new Canvas(TILE, TILE);
  const pc = tileCells(41, 4);
  for (let x = 0; x < TILE; x++) {
    plat.set(x, 0, px01(x, 0, 41) > 0.6 ? C.teal[2]! : S[7]!);
    plat.set(x, 1, S[6]!);
    for (let y = 2; y < 7; y++) {
      const k = pc(x, y * 2);
      plat.set(x, y, k.gap < 1.2 ? S[1]! : y < 4 ? S[4]! : S[3]!);
    }
    plat.set(x, 7, S[2]!);
    plat.set(x, 8, S[1]!);
    if (px01(x, 5, 41) > 0.82) {
      const len = 2 + Math.floor(px01(x, 6, 41) * 6);
      for (let y = 9; y < 9 + len; y++) plat.set(x, y, C.teal[1]!);
      if (px01(x, 7, 41) > 0.5) plat.set(x, 9 + len, C.blue[2]!);
    }
  }
  const platformLeft = derive(plat, (x, y) => (x === 0 && (y === 0 || y > 6) ? 'clear' : x === 0 ? S[5] : null));
  const platformRight = derive(plat, (x, y) => (x === 15 && (y === 0 || y > 6) ? 'clear' : x === 15 ? S[2] : null));
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
    platform: t(plat),
    platformLeft: t(platformLeft),
    platformRight: t(platformRight),
    fill3: t(fill3),
    ...(() => {
      const back = backWall(fill2, '#04070e', 0.6);
      const e = backEdges(back, C.stone[4]!, '#020308');
      return { back: t(back), backTop: t(e.backTop), backBottom: t(e.backBottom), backLeft: t(e.backLeft), backRight: t(e.backRight) };
    })(),
    spike: spikeStrip(['#5c6680', '#9aa4bf', '#d5dbea', '#ffffff'], '#03040a', S[2]),
  };
}

// ── Creatures ───────────────────────────────────────────────────────────────

/**
 * A puffcap: a waddling mushroom with a glowing-spotted cap, two sleepy eyes on its stem and
 * root-nub feet. The cap bounces as it waddles; idle, it puffs out a little cloud of spores.
 */
function puffcapSheet(): SpriteSheet {
  const FW = 30;
  const FH = 28;
  const pal = new Palette();
  const [ol, olLit] = pal.ramp(['#06040c', '#2a1e3a']);
  const cap = pal.ramp(['#2a1a4a', '#4a2e7a', '#7a4aa8', '#a878d0']);
  const [spot, spotHot] = pal.ramp(['#4fd8c8', '#d8fff6']);
  const [gill] = pal.ramp(['#1a1230']);
  const stem = pal.ramp(['#7a7090', '#b8b0c8', '#e4e0ec']);
  const [eye] = pal.ramp(['#120c1c']);
  const [foot] = pal.ramp(['#4a4060']);
  const [spore] = pal.ramp(['#8ff0e0']);
  const [flash] = pal.ramp(['#ffffff']);
  const frames: Raster[] = [];
  const draw = (f: number, mode: 'walk' | 'idle' | 'hurt') => {
    const c = new Ix(FW, FH, pal);
    const walk = mode === 'walk';
    const sway = walk ? [0, 1, 1, 0, 0, -1, -1, 0][f % 8]! : 0;
    const bounce = walk ? [0, 1, 0, -1, 0, 1, 0, -1][f % 8]! : mode === 'idle' && f % 2 ? 1 : 0;
    const cx = 15;
    const ground = FH - 2;
    // feet: little root nubs that step alternately
    for (const [dx, ph] of [[-4, 0], [3, 4]] as const) {
      const lift = walk && (f + ph) % 8 < 3 ? 1 : 0;
      c.rect(cx + dx + (walk ? Math.round(Math.sin(((f + ph) / 8) * Math.PI * 2)) : 0), ground - lift, 3, 2, foot!);
    }
    // stem: a soft barrel, leaning with the sway
    for (let y = ground - 11 + bounce; y < ground; y++) {
      const t = (y - (ground - 11)) / 11;
      const half = 4.5 + Math.sin(t * Math.PI) * 1.2;
      const ox = Math.round(sway * (1 - t));
      for (let x = Math.round(cx - half) + ox; x <= Math.round(cx + half) + ox; x++) c.set(x, y, x < cx - 2 + ox ? stem[0]! : x > cx + 2 + ox ? stem[2]! : stem[1]!);
    }
    // sleepy eyes on the stem
    const ey = ground - 7 + bounce;
    c.set(cx + 1 + sway, ey, eye!);
    c.set(cx + 4 + sway, ey, eye!);
    if (mode !== 'idle' || f % 2 === 0) c.set(cx + 1 + sway, ey + 1, eye!), c.set(cx + 4 + sway, ey + 1, eye!);
    // the cap: a wide dome with gills underneath and glowing spots
    const capY = ground - 12 + bounce;
    const squash = walk && bounce > 0 ? 1 : 0;
    c.ellipse(cx + sway, capY, 12 + squash, 8 - squash, (x, y, nx, ny) => (y > capY ? 0 : cap[Math.max(0, Math.min(3, Math.round(1.7 - ny * 1.5 + nx * 0.4)))]!));
    for (let x = cx - 11 + sway; x <= cx + 11 + sway; x++) {
      c.set(x, capY, gill!);
      if (x % 2) c.set(x, capY + 1, gill!);
    }
    for (const [sx, sy] of [[-6, -3], [-1, -6], [5, -4], [8, -1], [-9, -1]] as const) {
      c.set(cx + sx + sway, capY + sy, spot!);
      if (sy < -3) c.set(cx + sx + sway + 1, capY + sy, spotHot!);
    }
    // idle: a puff of spores rising
    if (mode === 'idle' && f % 2) for (const [px, py] of [[-3, -11], [1, -13], [4, -10], [-1, -15]] as const) c.set(cx + px, capY + py, spore!);
    c.rim(0, -1, new Set(cap));
    c.outline(ol!, olLit!);
    if (mode === 'hurt') for (let i = 0; i < c.px.length; i++) if (c.px[i] && c.px[i] !== ol) c.px[i] = flash!;
    frames.push(c.toRaster());
  };
  for (let f = 0; f < 8; f++) draw(f, 'walk');
  draw(0, 'idle');
  draw(1, 'idle');
  draw(0, 'hurt');
  return {
    raster: sheetOf(frames),
    frameWidth: FW,
    frameHeight: FH,
    animations: {
      walk: { frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 10, loop: true },
      idle: { frames: [8, 8, 8, 9, 9, 8], fps: 3, loop: true },
      hurt: { frames: [10, 0, 10, 0], fps: 14, loop: false },
    },
    hitbox: { x: 5, y: 8, w: 20, h: 19 },
    anchor: { x: 15, y: 27 },
  };
}

/** A spinning shard of blue crystal. */
function shardSheet(): SpriteSheet {
  const S = 14;
  const frames: Raster[] = [];
  const widths = [4, 3, 1.5, 3, 4, 4];
  for (let f = 0; f < 6; f++) {
    const c = new Canvas(S, S);
    const bob = Math.round(Math.sin((f / 6) * Math.PI * 2));
    const cx = 7;
    const cy = 7 + bob;
    const w = widths[f]!;
    c.glow(cx, cy, 6.5, C.blue[2]!, 0.5);
    c.poly([[cx, cy - 6], [cx + w, cy], [cx, cy + 5], [cx - w, cy]], C.blue[0]!);
    c.poly([[cx, cy - 6], [cx + w, cy], [cx, cy + 1]], C.blue[2]!);
    c.poly([[cx, cy - 6], [cx, cy + 1], [cx - w, cy]], C.blue[1]!);
    c.set(cx, cy - 4, C.blue[3]!);
    if (f === 0 || f === 4) c.set(cx - 1, cy - 2, '#ffffff');
    frames.push(c.toRaster());
  }
  return { raster: sheetOf(frames), frameWidth: S, frameHeight: S, animations: { idle: { frames: [0, 1, 2, 3, 4, 5], fps: 8, loop: true } } };
}

/** A stone archway with a shimmering blue veil. */
function archSheet(): SpriteSheet {
  const FW = 36;
  const FH = 48;
  const S = C.stone;
  const frames: Raster[] = [];
  for (let f = 0; f < 6; f++) {
    const c = new Canvas(FW, FH);
    const cx = 18;
    // veil
    for (let y = 8; y < FH; y++)
      for (let x = 6; x < 30; x++) {
        const inArch = y > 20 || Math.hypot(x + 0.5 - cx, y - 20) < 12;
        if (!inArch) continue;
        const wave = Math.sin(y * 0.35 + f * 1.05 + x * 0.15) * 0.5 + 0.5;
        const a = 0.35 + wave * 0.35;
        c.set(x, y, wave > 0.8 ? C.blue[2]! : C.blue[1]!, a);
      }
    c.glow(cx, 32, 18, C.blue[2]!, 0.3);
    // stone arch blocks
    for (let a = Math.PI; a <= Math.PI * 2 + 0.01; a += 0.04)
      for (let rr = 12; rr < 17; rr++) {
        const x = Math.round(cx + Math.cos(a) * rr - 0.5);
        const y = Math.round(20 + Math.sin(a) * rr);
        const block = Math.floor(((a - Math.PI) / Math.PI) * 7);
        c.set(x, y, rr === 12 ? S[2]! : rr === 16 ? S[6]! : block % 2 ? S[4]! : S[5]!);
      }
    for (const px of [2, 30]) for (let y = 20; y < FH; y++) for (let k = 0; k < 5; k++) c.set(px + k, y, k === 0 ? S[2]! : k === 4 ? S[2]! : y % 9 === 0 ? S[2]! : k === 1 ? S[6]! : S[4]!);
    // keystone glyph
    c.set(cx - 1, 4, C.blue[3]!, 0.6 + 0.4 * Math.sin(f));
    c.set(cx, 4, C.blue[3]!, 0.6 + 0.4 * Math.sin(f));
    c.set(cx - 1, 5, C.blue[2]!);
    c.set(cx, 5, C.blue[2]!);
    frames.push(c.toRaster());
  }
  return { raster: sheetOf(frames), frameWidth: FW, frameHeight: FH, animations: { idle: { frames: [0, 1, 2, 3, 4, 5], fps: 6, loop: true } }, anchor: { x: 18, y: 47 } };
}

// ── Props ───────────────────────────────────────────────────────────────────

function props(): { props: Record<string, Raster>; info: Record<string, PropInfo> } {
  const out: Record<string, Raster> = {};
  const info: Record<string, PropInfo> = {};
  const S = C.stone;

  // glowing blue mushroom cluster
  {
    const c = new Canvas(20, 18);
    const caps: [number, number, number, number][] = [[6, 8, 4, 10], [13, 5, 5, 13], [17, 11, 2.5, 6]];
    for (const [x, y, r, stem] of caps) {
      for (let k = 0; k < stem - (y - 0); k++) c.set(x, y + k, k < 2 ? C.teal[3]! : C.teal[2]!);
      for (let k = y; k < 18; k++) c.set(x, k, C.teal[1]!);
      c.glow(x, y, r * 2.2, C.blue[2]!, 0.35);
      for (let yy = Math.floor(y - r); yy <= y; yy++)
        for (let xx = Math.floor(x - r); xx <= x + r; xx++)
          if (((xx + 0.5 - x) / r) ** 2 + ((yy + 0.5 - y) / (r * 0.75)) ** 2 <= 1) c.set(xx, yy, yy === y ? C.blue[0]! : yy < y - r * 0.4 ? C.blue[3]! : C.blue[2]!);
    }
    out.glowshrooms = c.toRaster();
    info.glowshrooms = { anchor: 'ground', light: { color: C.blue[2]!, radius: 50, intensity: 0.7, x: 12, y: 8 }, weight: 4 };
  }
  // amber shelf fungus on a stalk
  {
    const c = new Canvas(16, 22);
    for (let y = 6; y < 22; y++) c.set(7, y, C.teal[1]!), c.set(8, y, C.teal[0]!);
    for (const [y, w] of [[6, 7], [12, 5], [17, 4]] as const) {
      for (let x = -w; x <= w; x++) {
        c.set(8 + x, y, Math.abs(x) > w - 2 ? C.amber[1]! : C.amber[2]!);
        if (Math.abs(x) < w - 1) c.set(8 + x, y - 1, C.amber[3]!);
        c.set(8 + x, y + 1, C.amber[0]!);
      }
    }
    out.fungus = c.toRaster();
    info.fungus = { anchor: 'ground', light: { color: C.amber[2]!, radius: 36, intensity: 0.45, x: 8, y: 6 }, weight: 2 };
  }
  // stalagmite
  {
    const pal = new Palette();
    const [ol] = pal.ramp(['#020308']);
    const st = pal.ramp(S.slice(2, 7));
    const c = new Ix(14, 30, pal);
    c.poly([[1, 30], [5, 10], [7, 0], [9, 12], [13, 30]], st[1]!);
    c.rim(1, 0, new Set(st), 2);
    c.rim(0, -1, new Set(st), 1);
    c.shade(-1, 0, new Set(st));
    c.outline(ol!);
    out.stalagmite = c.toRaster();
    info.stalagmite = { anchor: 'ground', weight: 2 };
  }
  // hanging roots with glowing bulbs
  {
    const c = new Canvas(18, 48);
    const r = rng(6);
    for (let i = 0; i < 5; i++) {
      let x = r.int(2, 15);
      const len = r.int(18, 44);
      for (let y = 0; y < len; y++) {
        c.set(x, y, y % 6 === 0 ? C.teal[2]! : C.teal[1]!);
        if (r.chance(0.1)) x += r.chance(0.5) ? 1 : -1;
      }
      if (i % 2 === 0) {
        c.glow(x + 0.5, len + 1, 4, C.blue[2]!, 0.6);
        c.set(x, len, C.blue[2]!);
        c.set(x, len + 1, C.blue[3]!);
      }
    }
    out.roots = c.toRaster();
    info.roots = { anchor: 'ceiling', weight: 3 };
  }
  // a firefly lantern on a chain
  {
    const c = new Canvas(14, 34);
    for (let y = 0; y < 18; y++) c.set(7, y, y % 3 === 0 ? S[5]! : S[3]!);
    c.glow(7, 24, 9, C.blue[2]!, 0.7);
    for (let y = 18; y < 31; y++) {
      c.set(3, y, S[4]!);
      c.set(11, y, S[3]!);
    }
    for (let x = 3; x <= 11; x++) c.set(x, 18, S[5]!), c.set(x, 31, S[3]!);
    c.set(7, 17, S[5]!);
    c.set(7, 32, S[3]!);
    for (const [x, y] of [[6, 22], [8, 25], [6, 27], [9, 21]] as const) c.set(x, y, '#ffffff');
    out.lantern = c.toRaster();
    info.lantern = { anchor: 'ceiling', light: { color: '#9fe2ff', radius: 90, intensity: 1, flicker: 0.12, x: 7, y: 24 }, weight: 1 };
  }
  // pale crystals
  {
    const c = new Canvas(16, 16);
    c.glow(8, 10, 9, C.blue[2]!, 0.35);
    for (const [x, h, w] of [[5, 9, 2], [9, 14, 3], [12, 7, 2]] as const) {
      c.poly([[x - w, 16], [x - w, 16 - h + w], [x, 16 - h], [x + w, 16 - h + w], [x + w, 16]], C.blue[1]!);
      c.poly([[x, 16 - h], [x + w, 16 - h + w], [x + w, 16], [x, 16]], C.blue[2]!);
      c.set(x, 16 - h + 1, C.blue[3]!);
    }
    out.crystals = c.toRaster();
    info.crystals = { anchor: 'ground', light: { color: C.blue[2]!, radius: 40, intensity: 0.5, x: 8, y: 9 }, weight: 2 };
  }
  // dark grass blades
  {
    const c = new Canvas(22, 10);
    const r = rng(9);
    for (let i = 0; i < 14; i++) {
      const x = r.int(1, 20);
      const h = r.int(3, 9);
      const lean = r.range(-0.5, 0.5);
      for (let k = 0; k < h; k++) c.set(Math.round(x + lean * k), 9 - k, k === h - 1 && r.chance(0.3) ? C.blue[2]! : k > h / 2 ? C.teal[2]! : C.teal[1]!);
    }
    out.grass = c.toRaster();
    info.grass = { anchor: 'ground', weight: 6 };
  }
  // a little stone shrine with a candle niche
  {
    const pal = new Palette();
    const [ol] = pal.ramp(['#020308']);
    const st = pal.ramp([S[2]!, S[4]!, S[5]!, S[6]!]);
    const [niche] = pal.ramp(['#05070e']);
    const [flame, core] = pal.ramp(['#f0a040', '#fff0b0']);
    const c = new Ix(18, 22, pal);
    c.rect(1, 18, 16, 4, st[1]!);
    c.rect(3, 6, 12, 12, st[1]!);
    c.poly([[2, 7], [9, 0], [16, 7]], st[2]!);
    c.rect(6, 9, 6, 7, niche!);
    c.set(9, 13, flame!);
    c.set(9, 12, core!);
    c.set(8, 14, st[3]!);
    c.set(9, 14, st[3]!);
    c.rim(0, -1, new Set(st));
    c.shade(-1, 0, new Set(st));
    c.outline(ol!);
    out.shrine = c.toRaster();
    info.shrine = { anchor: 'ground', light: { color: C.amber[2]!, radius: 40, intensity: 0.55, flicker: 0.25, x: 9, y: 12 }, weight: 1 };
  }
  // a glowing spore pod on a stalk
  {
    const pal = new Palette();
    const [ol] = pal.ramp(['#020308']);
    const pod = pal.ramp(['#2a5a6a', '#4fa6b8', '#9fe8ff']);
    const [stalk] = pal.ramp([C.teal[1]!]);
    const c = new Ix(12, 18, pal);
    c.line(6, 10, 6, 17, stalk!);
    c.line(5, 17, 7, 17, stalk!);
    c.ellipse(6, 6, 4.5, 5.5, (x, y, nx, ny) => pod[Math.max(0, Math.min(2, Math.round(1 - ny * 1.2)))]!);
    for (const [x, y] of [[4, 4], [7, 6], [5, 8]] as const) c.set(x, y, pod[2]!);
    c.outline(ol!);
    out.sporepod = c.toRaster();
    info.sporepod = { anchor: 'ground', light: { color: C.blue[2]!, radius: 30, intensity: 0.45, x: 6, y: 6 }, weight: 2 };
  }
  // hanging chain
  {
    const L = new MatLayer(5, 50, false);
    hangingChain(L, 2, 0, 50, 1);
    out.chain = L.paint({ 1: { base: S[4]!, rim: S[6]!, rimDir: [1, 0] } }, 1).toRaster();
    info.chain = { anchor: 'ceiling', weight: 2 };
  }
  return { props: out, info };
}

function decals(): Record<string, Raster> {
  return {
    fossil: fossilDecal(22, ['#1e2a44', '#34466b', '#55688f']),
    ribs: bonesDecal('ribs', ['#2c3755', '#56658a', '#8e9cc0'], '#05060c'),
    vein: veinDecal(36, 14, ['#1c4a7a', '#4fa6e8', '#9fe2ff'], 4),
    roots: rootsDecal(26, 24, C.teal.slice(0, 3), 7, C.blue[2]),
    crack: crackDecal(30, 20, C.stone[0]!, '#020308', C.stone[3]!, 11),
  };
}

export const HOLLOW_CAVERNS_META = {
  id: 'hollow-caverns',
  name: 'Hollow Caverns',
  description: 'Dark blue caverns under a forgotten city: glowing fungus, drifting spores, a giant moth statue and a little moth carrying a lantern.',
  keywords: ['cave', 'cavern', 'caves', 'underground', 'tunnels', 'grotto', 'mines', 'dark', 'deep', 'mushroom', 'fungus', 'glow', 'glowing', 'spores', 'crystal', 'mysterious', 'eerie', 'gothic', 'ancient', 'quiet', 'night'],
  palette: [C.top, C.mid, C.glowSky, C.fog, ...C.stone, ...C.blue, ...C.amber, ...C.teal, '#f4f6fb'],
  background: C.top,
};

export function hollowCaverns(): ArtTheme {
  const { props: p, info } = props();
  return {
    ...HOLLOW_CAVERNS_META,
    layers: layers(),
    tiles: caveTiles(),
    sprites: {
      hero: castSheet('moth'),
      enemy: puffcapSheet(),
      pickup: shardSheet(),
      goal: archSheet(),
      flyer: flyerSheet({ body: ['#1a1830', '#2c2a4a', '#4a4670'], wing: ['#6f80b0', '#c8d4f2', '#ffffff'], eye: '#ff9a4a', outline: '#03040a', glowEye: true }),
      checkpoint: checkpointSheet({ post: [C.stone[2]!, C.stone[4]!, C.stone[6]!], cage: C.stone[6]!, glow: '#9fe2ff', core: '#e6faff', outline: '#03040a' }),
    },
    props: p,
    propInfo: info,
    heroes: castFor('moth'),
    decals: decals(),
    ambientSprites: {
      glowworm: { sheet: glowwormSheet('#5a7090', C.blue[2]!, C.blue[3]!), anchor: 'ceiling', weight: 3, light: { color: C.blue[2]!, radius: 24, intensity: 0.5, x: 4, y: 20 } },
      drip: { sheet: dripSheet('#3a5a8a', '#9fd0ff'), anchor: 'ceiling', weight: 2 },
      grass: { sheet: grassSwaySheet(C.teal.slice(1)), anchor: 'ground', weight: 2 },
    },
    tileSize: TILE,
    lights: {
      hero: { color: '#cfe0ff', radius: 64, intensity: 0.55 },
      pickup: { color: C.blue[2]!, radius: 40, intensity: 0.8, flicker: 0.06 },
      goal: { color: C.blue[2]!, radius: 90, intensity: 0.9, flicker: 0.05 },
      enemy: { color: '#4fd8c8', radius: 26, intensity: 0.35, flicker: 0.1 },
    },
    environment: {
      ambient: { color: '#d4dfff', intensity: 0.88 },
      fog: { color: C.fog, density: 0.28, height: 0.4 },
      bloom: { strength: 0.7, threshold: 0.6 },
      vignette: 0.6,
      grade: { contrast: 1.1, saturation: 0.95, tint: '#e8eeff' },
      particles: [
        { type: 'spores', density: 0.5, color: '#9fe8ff' },
        { type: 'dust', density: 0.25, color: '#6a88c0' },
      ],
    },
  };
}
