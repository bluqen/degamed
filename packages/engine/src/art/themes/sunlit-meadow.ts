/**
 * Sunlit Meadow: a bright, warm summer day. Puffy cel-shaded clouds, snow-capped mountains in a
 * blue haze, rolling hills with round trees, lush grass over warm soil, flowers and a red-haired
 * climber. Mood reference: Celeste's sunny chapters, Stardew Valley.
 */
import { Canvas, fbm, gradient, Ix, MatLayer, Palette, rng, bayer, mix, type Material, type Rng } from '../core';
import { heroSheet } from '../hero';
import { bigHeroSheet } from '../hero2';
import { meadowBig } from './big-heroes';
import { mistBand, overgrow, shadedBlob } from '../scenery';
import { derive, px01, tileNoise, TILE } from '../tiles';
import { backEdges, backWall } from '../tiles';
import { bonesDecal, fossilDecal, rootsDecal, stonesDecal } from '../decals';
import { sheetOf, type Raster } from '../../pixel';
import type { ArtTheme, ParallaxLayer, PropInfo, SpriteSheet } from '../types';
import { meadowHeroCostume } from './meadow-hero';
import { checkpointSheet, flyerSheet, spikeStrip } from '../extras';

const W = 480;
const H = 270;

const C = {
  skyTop: '#3b78d8',
  skyMid: '#62a4ee',
  horizon: '#a9d6fb',
  warm: '#fbefd3',
  grass: ['#1f5a3a', '#2f7d3f', '#46a246', '#71c653', '#a6e36a', '#dcf7a0'],
  dirt: ['#3a1f2a', '#5a2e2e', '#7d4535', '#a0603f', '#c08254', '#ddb07a'],
  stone: ['#5d5f7a', '#8a8ca3', '#b9bccb', '#e3e5ec'],
  wood: ['#4a2a2a', '#7a4632', '#a8683f', '#d39a5c'],
  flower: ['#ff6f91', '#ffd25e', '#ffffff', '#b98cff', '#6fd3ff'],
};

// ── Layers ──────────────────────────────────────────────────────────────────

function sky(): Canvas {
  const c = new Canvas(W, H);
  c.wrapX = true;
  gradient(c, [[0, C.skyTop], [0.4, C.skyMid], [0.7, C.horizon], [0.85, '#d3ebfb'], [1, C.warm]], { dither: 5 });
  // sun glow, top right
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - 390) / 170, (y - 40) / 130);
      const a = Math.max(0, 1 - d) ** 2 * 0.55;
      const q = Math.floor(a * 8 + bayer(x, y) * 0.95) / 8;
      if (q > 0) c.set(x, y, '#fff5d6', q);
    }
  c.disc(390, 40, 13, '#fff8e4', 0.9);
  c.disc(390, 40, 10, '#ffffff');
  return c;
}

/** Cel-shaded cumulus: lumpy top lit warm-white, flat shaded base. */
function cloud(c: Canvas, r: Rng, cx: number, cy: number, w: number, s: { lit: string; mid: string; shade: string; base: string; alpha?: number }): void {
  const mask = new MatLayer(c.w, c.h, true);
  const n = Math.max(3, Math.round(w / 9));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const rad = (Math.sin(t * Math.PI) * 0.6 + 0.4) * w * 0.2 * r.range(0.75, 1.25);
    mask.disc(cx - w / 2 + t * w, cy - rad * 0.5, rad, 1);
    // cauliflower billows on top
    if (t > 0.15 && t < 0.85 && r.chance(0.7)) mask.disc(cx - w / 2 + t * w + r.range(-4, 4), cy - rad * 1.3, rad * r.range(0.45, 0.7), 1);
  }
  mask.rect(cx - w / 2, cy - 2, w, 4, 1);
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      if (!mask.get(x, y)) continue;
      if (y > cy + 2) continue;
      const above = mask.get(x, y - 2) && mask.get(x + 2, y - 2);
      const col = y > cy - 1 ? s.base : y > cy - 4 ? s.shade : !above ? s.lit : s.mid;
      c.set(x, y, col, s.alpha ?? 1);
    }
}

function clouds(): Canvas {
  const c = new Canvas(W, H);
  c.wrapX = true;
  const r = rng(7);
  for (let i = 0; i < 7; i++) {
    const x = (i / 7) * W + r.int(-20, 20);
    const y = r.int(40, 130);
    const w = r.int(40, 110);
    const far = y < 80;
    cloud(c, r, x, y, w, far ? { lit: '#ffffff', mid: '#f2f8ff', shade: '#d7e8fa', base: '#bcd6f2', alpha: 0.85 } : { lit: '#fffaf0', mid: '#f5f9ff', shade: '#d4e5f7', base: '#b5cfee' });
  }
  return c;
}

/** A distant castle on a foothill: keep, towers with cone roofs, crenellated wall, pennants. */
function castle(L: MatLayer, cx: number, base: number): void {
  // the hill it stands on
  L.ellipse(cx, base + 10, 46, 16, 7);
  // curtain wall with crenellations
  L.rect(cx - 30, base - 14, 60, 14, 6);
  for (let x = cx - 30; x < cx + 30; x += 4) L.rect(x, base - 17, 2, 3, 6);
  // keep
  L.rect(cx - 8, base - 34, 16, 20, 6);
  L.poly([[cx - 10, base - 34], [cx, base - 48], [cx + 10, base - 34]], 8);
  // towers
  for (const tx of [cx - 30, cx + 26]) {
    L.rect(tx, base - 26, 6, 26, 6);
    L.poly([[tx - 2, base - 26], [tx + 3, base - 36], [tx + 8, base - 26]], 8);
    L.rect(tx + 3, base - 41, 1, 5, 6);
    L.rect(tx + 4, base - 41, 3, 2, 9);
  }
  L.rect(cx, base - 54, 1, 6, 6);
  L.rect(cx + 1, base - 54, 4, 2, 9);
  // gate and windows
  L.rect(cx - 2, base - 8, 4, 8, 7);
  for (const wx of [cx - 4, cx + 3]) L.rect(wx, base - 28, 1, 3, 7);
}

function mountains(): Canvas {
  const L = new MatLayer(W, H);
  const ridge = (x: number) => {
    let v = 0;
    let amp = 1;
    let norm = 0;
    for (let o = 0; o < 5; o++) {
      const n = fbm(x, o * 13, { w: W, h: H, cells: 3 * 2 ** o, octaves: 1, seed: 71 + o, wrapX: true });
      v += amp * (1 - Math.abs(n * 2 - 1));
      norm += amp;
      amp *= 0.5;
    }
    return 205 - (v / norm) * 120;
  };
  const tops = Array.from({ length: W }, (_, x) => ridge(x));
  for (let x = 0; x < W; x++) {
    const top = Math.round(tops[x]!);
    const slope = tops[(x + 4) % W]! - tops[(x - 4 + W) % W]!;
    const lit = slope > 1.5; // faces the sun on the right
    for (let y = top; y < H; y++) {
      const snowLine = 120 + fbm(x, y, { w: W, h: H, cells: 12, octaves: 2, seed: 9, wrapX: true }) * 26;
      const depth = y - top;
      let m = lit && depth < 50 ? 3 : 1;
      if (y < snowLine) m = lit ? 2 : 4;
      if (depth > 60) m = 5;
      L.set(x, y, m);
    }
  }
  castle(L, 96, 214);
  const fade = { fadeTo: C.horizon, fadeFrom: 0.55, fadeAmt: 0.9 };
  const mats: Record<number, Material> = {
    6: { base: '#c4d3ee', rim: '#f2f7ff', rimDir: [1, 0] },
    7: { base: '#a2b4dc' },
    8: { base: '#8a86c4', rim: '#b0aae0', rimDir: [1, -1] },
    9: { base: '#ff8a7a' },
    1: { base: '#7f9fd0', dark: '#7899cb', grain: 30, dither: true, ...fade },
    2: { base: '#fbfdff', rim: '#ffffff', ...fade },
    3: { base: '#9ab8e2', light: '#a5c0e6', grain: 30, dither: true, ...fade },
    4: { base: '#c9daf4', rim: '#e8f1fc', ...fade },
    5: { base: '#8aaad8', ...fade },
  };
  return L.paint(mats, 3);
}

/** A white windmill with a red cap and four lattice sails. */
function windmill(L: MatLayer, cx: number, base: number): void {
  // tapered tower: lit right side, shaded left
  for (let y = base - 30; y < base; y++) {
    const half = 4 + ((y - (base - 30)) / 30) * 3;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) L.set(x, y, x < cx - half / 3 ? 8 : 7);
  }
  L.poly([[cx - 6, base - 30], [cx, base - 38], [cx + 6, base - 30]], 9);
  L.rect(cx - 1, base - 8, 3, 8, 8);
  L.rect(cx + 1, base - 22, 2, 3, 8);
  // sails around the hub
  const hx = cx + 1;
  const hy = base - 31;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.35;
    const ex = hx + Math.cos(a) * 17;
    const ey = hy + Math.sin(a) * 17;
    L.line(hx, hy, ex, ey, 10);
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    for (let t = 0.35; t <= 1; t += 0.08) {
      const px = hx + Math.cos(a) * 17 * t;
      const py = hy + Math.sin(a) * 17 * t;
      L.line(px, py, px + nx * 3, py + ny * 3, 10);
    }
  }
}

/** Round-crowned tree: trunk plus cel-shaded lobes (base, shadow and light materials). */
function tree(L: MatLayer, r: Rng, x: number, base: number, size: number, leaf: [number, number, number], trunk: number): void {
  L.rect(x - Math.max(1, size / 8), base - size * 1.1, Math.max(2, size / 4), size * 1.1, trunk);
  const lobes: [number, number, number][] = [];
  const n = r.int(4, 6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r.range(0, 0.6);
    lobes.push([x + Math.cos(a) * size * 0.34, base - size * 1.25 + Math.sin(a) * size * 0.26, size * r.range(0.36, 0.48)]);
  }
  lobes.push([x, base - size * 1.38, size * 0.48]);
  // back to front: lower lobes first so upper ones overlap them
  lobes.sort((p, q) => q[1] - p[1]);
  for (const [lx, ly, lr] of lobes) shadedBlob(L, lx, ly, lr, leaf[0], leaf[1], leaf[2]);
}

function hills(o: { seed: number; base: number; amp: number; cells: number; trees: number; treeSize: [number, number]; mats: Record<number, Material>; flowers?: boolean; extra?: (L: MatLayer, top: (x: number) => number) => void }): Canvas {
  const r = rng(o.seed);
  const L = new MatLayer(W, H);
  const top = (x: number) => o.base - fbm(x, 0, { w: W, h: H, cells: o.cells, octaves: 3, seed: o.seed, wrapX: true }) * o.amp;
  for (let x = 0; x < W; x++) L.column(x, top(x), 1);
  for (let i = 0; i < o.trees; i++) {
    const x = r.int(0, W);
    const cluster = r.int(1, 3);
    for (let k = 0; k < cluster; k++) {
      const tx = x + k * r.int(6, 14);
      tree(L, r, tx, top(tx) + 3, r.int(...o.treeSize), [2, 5, 6], 3);
    }
  }
  o.extra?.(L, top);
  if (o.flowers) for (let x = 0; x < W; x++) if (px01(x, 0, o.seed) > 0.8) L.set(x, Math.round(top(x)) + r.int(2, 18), 4);
  return L.paint(o.mats, o.seed);
}

function nearBushes(): Canvas {
  const r = rng(61);
  const L = new MatLayer(W, H);
  L.rect(0, H - 22, W, 22, 2);
  for (let x = 0; x < W; x += r.int(16, 34)) {
    const s = r.int(9, 18);
    for (let k = 0; k < 3; k++) shadedBlob(L, x + k * s * 0.6, H - 22 - r.int(0, 8), s * r.range(0.6, 0.9), 1, 2, 6);
  }
  // a big tree framing the scene
  tree(L, r, 60, H - 18, 66, [1, 2, 6], 3);
  overgrow(L, r, new Set([1, 6]), 4, 1, { tuft: 0.4, hang: 0, seed: 62 });
  for (let i = 0; i < 70; i++) {
    const x = r.int(0, W);
    const y = r.int(H - 40, H - 2);
    if (L.get(x, y) === 2 || L.get(x, y) === 1) L.set(x, y, 5);
  }
  const mats: Record<number, Material> = {
    1: { base: '#3f9a4a', dark: '#3a9247', grain: 40, dither: true },
    2: { base: '#2c7444', dark: '#286c40', grain: 40, dither: true },
    3: { base: '#6e4535', rim: '#9a6440', rimDir: [1, 0] },
    4: { base: '#5dbb50', rim: '#a6e36a' },
    5: { base: '#ffd25e' },
    6: { base: '#62b956', rim: '#9ede70', rimDir: [1, -1] },
  };
  return L.paint(mats, 63);
}

function foreground(): Canvas {
  const r = rng(71);
  const FW = 640;
  const L = new MatLayer(FW, H);
  for (let x = 0; x < FW; x++) {
    const n = fbm(x, 0, { w: FW, h: H, cells: 14, octaves: 3, seed: 72, wrapX: true });
    const h = Math.max(0, Math.round((n - 0.52) * 60));
    for (let k = 0; k < h; k++) L.set(x, H - 1 - k, 1);
  }
  void r;
  return L.paint({ 1: { base: '#1f5a3a', dark: '#1b5235', rim: '#2f7d3f', grain: 30 } }, 73);
}

function layers(): ParallaxLayer[] {
  return [
    { name: 'sky', raster: sky().toRaster(), factor: 0, tiled: true },
    { name: 'clouds', raster: clouds().toRaster(), factor: 0.04, tiled: true },
    { name: 'mountains', raster: mountains().toRaster(), factor: 0.1, tiled: true },
    {
      name: 'far hills',
      raster: hills({
        seed: 31,
        base: 225,
        amp: 40,
        cells: 4,
        trees: 26,
        treeSize: [5, 9],
        extra: (L, top) => windmill(L, 300, Math.round(top(300)) + 2),
        mats: {
          1: { base: '#79b98a', dark: '#73b386', rim: '#9dd29c', grain: 30, dither: true, fadeTo: '#b9dcf2', fadeFrom: 0.85, fadeAmt: 0.6 },
          2: { base: '#5d9f7a' },
          3: { base: '#5d7f75' },
          5: { base: '#4f8a70' },
          6: { base: '#7fbb8a' },
          7: { base: '#f3ecdc', rim: '#ffffff', rimDir: [1, 0] },
          8: { base: '#cfc5b2' },
          9: { base: '#b46a4a', rim: '#d88a5e', rimDir: [1, -1] },
          10: { base: '#e8dfcc' },
        },
      }).toRaster(),
      factor: 0.22,
      tiled: true,
    },
    {
      name: 'haze',
      raster: (() => {
        const c = new Canvas(W, H);
        c.wrapX = true;
        mistBand(c, { y: 236, h: 26, color: '#e9f5ff', alpha: 0.6, seed: 5, cells: 5 });
        return c.toRaster();
      })(),
      factor: 0.3,
      tiled: true,
    },
    {
      name: 'near hills',
      raster: hills({
        seed: 41,
        base: 252,
        amp: 34,
        cells: 3,
        trees: 9,
        treeSize: [12, 20],
        flowers: true,
        mats: {
          1: { base: '#5fb35a', dark: '#58aa55', light: '#68bd5f', rim: '#a0dd75', grain: 40, dither: true },
          2: { base: '#3f9450', dark: '#3b8d4c', grain: 40, dither: true },
          3: { base: '#7a4d3a', rim: '#a06a48', rimDir: [1, 0] },
          4: { base: '#fff1a8' },
          5: { base: '#2f7848' },
          6: { base: '#68b858', rim: '#9edb72', rimDir: [1, -1] },
        },
      }).toRaster(),
      factor: 0.45,
      tiled: true,
    },
    { name: 'bushes', raster: nearBushes().toRaster(), factor: 0.7, tiled: true },
    { name: 'foreground', raster: foreground().toRaster(), factor: 1.35, tiled: true },
  ];
}

// ── Tiles ───────────────────────────────────────────────────────────────────

function soil(seed: number): Canvas {
  const D = C.dirt;
  const n = tileNoise(seed, 2, 3);
  const fine = tileNoise(seed + 9, 8, 1);
  const c = new Canvas(TILE, TILE);
  const r = rng(seed);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      // soft horizontal strata: the noise is stretched sideways
      const v = n(x, Math.floor(y / 2) * 2) * 0.75 + fine(x, y) * 0.25 + (bayer(x, y) - 0.5) * 0.12;
      c.set(x, y, v < 0.36 ? D[1]! : v < 0.7 ? D[2]! : D[3]!);
    }
  // short root / strata strokes and a pebble
  for (let k = 0; k < r.int(0, 1); k++) {
    const x = r.int(0, 15);
    const y = r.int(1, 14);
    const len = r.int(2, 3);
    for (let i = 0; i < len; i++) c.set((x + i) % TILE, y, D[1]!);
  }
  if (r.chance(0.6)) {
    const x = r.int(1, 13);
    const y = r.int(2, 13);
    c.set(x, y, C.stone[2]!);
    c.set(x + 1, y, C.stone[1]!);
    c.set(x, y + 1, C.stone[1]!);
    c.set(x + 1, y + 1, C.stone[0]!);
  }
  return c;
}

function grassy(base: Canvas, seed: number): Canvas {
  const G = C.grass;
  const scallop = tileNoise(seed, 2, 2);
  return derive(base, (x, y) => {
    // rounded tufts of grass hanging over the soil: 4px-wide scallops
    const sc = 5 + Math.round(Math.sin(((x + seed) / 4) * Math.PI) ** 2 * 2 + scallop(x, 0) * 2);
    const blade = px01(x, 0, seed);
    if (y === 0) return blade > 0.55 ? (blade > 0.85 ? G[5] : G[4]) : 'clear';
    if (y === 1) return blade > 0.3 ? G[4] : G[5];
    if (y === 2) return px01(x, 2, seed) > 0.7 ? G[4] : G[3];
    if (y < sc - 1) return px01(x, y, seed) > 0.85 ? G[3] : G[2];
    if (y === sc - 1) return G[1];
    if (y === sc) return G[0];
    if (y === sc + 1) return C.dirt[1];
    return null;
  });
}

function meadowTiles(): ArtTheme['tiles'] {
  const D = C.dirt;
  const G = C.grass;
  const fill = soil(5);
  const fill2 = soil(6);
  const fill3 = soil(10);
  const ground = grassy(soil(7), 1);
  const ground2 = grassy(soil(8), 2);
  const ground3 = grassy(soil(9), 3);
  const groundLeft = derive(ground, (x, y) => {
    if (x + y < 3) return 'clear';
    if (x === 0 && y < 8) return y < 6 ? G[2] : G[1];
    if (x === 0) return D[1];
    if (x + y === 3) return G[4];
    return null;
  });
  const groundRight = derive(ground, (x, y) => {
    if (15 - x + y < 3) return 'clear';
    if (x === 15 && y < 8) return y < 6 ? G[3] : G[2];
    if (x === 15) return D[3];
    if (15 - x + y === 3) return G[5];
    return null;
  });
  const fillLeft = derive(fill, (x) => (x === 0 ? D[0] : x === 1 ? D[1] : null));
  const fillRight = derive(fill, (x) => (x === 15 ? D[4] : x === 14 ? D[3] : null));
  const ceiling = derive(fill, (x, y) => {
    if (y === 15) return px01(x, 15, 3) > 0.6 ? G[1] : 'clear';
    if (y === 14) return D[0];
    return null;
  });
  // a wooden plank bridge
  const plat = new Canvas(TILE, TILE);
  const Wd = C.wood;
  for (let x = 0; x < TILE; x++) {
    const seam = x % 8 === 3;
    plat.set(x, 0, seam ? Wd[2]! : Wd[3]!);
    for (let y = 1; y < 5; y++) plat.set(x, y, seam ? Wd[0]! : y === 1 ? Wd[3]! : px01(x, y, 4) > 0.8 ? Wd[1]! : Wd[2]!);
    plat.set(x, 5, Wd[1]!);
    plat.set(x, 6, Wd[0]!);
    if (x % 8 === 5) plat.set(x, 2, '#e8d0a0');
  }
  // rope hanging under the planks
  for (let x = 0; x < TILE; x++) plat.set(x, 8 + Math.round(Math.sin((x / TILE) * Math.PI) * 2), '#c9a26a');
  const platformLeft = derive(plat, (x, y) => (x < 2 && y < 9 ? (y < 7 ? Wd[1] : null) : null));
  const platformRight = derive(plat, (x, y) => (x > 13 && y < 9 ? (y < 7 ? Wd[1] : null) : null));
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
      const back = backWall(fill2, '#3a1f2a', 0.45);
      const e = backEdges(back, C.dirt[3]!, '#2a1520');
      return { back: t(back), backTop: t(e.backTop), backBottom: t(e.backBottom), backLeft: t(e.backLeft), backRight: t(e.backRight) };
    })(),
    spike: spikeStrip([C.stone[0]!, C.stone[1]!, C.stone[2]!, C.stone[3]!], '#2a1a2e', G[1]),
  };
}

// ── Creatures ───────────────────────────────────────────────────────────────

/**
 * A jelly slime that hops with real squash and stretch: anticipation, launch, peak, fall, splat
 * and a wobbly rebound. Glinting eyes squint on impact; a bubble floats in its jelly; idle blinks.
 */
function slimeSheet(): SpriteSheet {
  const FW = 30;
  const FH = 26;
  const pal = new Palette();
  const [ol, olLit] = pal.ramp(['#24164a', '#4a2f8a']);
  const body = pal.ramp(['#3e2690', '#6248d0', '#8f74f0', '#bba6ff', '#e6dcff']);
  const [core] = pal.ramp(['#a48cfa']);
  const [shine] = pal.ramp(['#ffffff']);
  const [eye] = pal.ramp(['#1b1035']);
  const [mouth] = pal.ramp(['#2e1a5a']);
  const [flash] = pal.ramp(['#ffffff']);
  // [half width, half height, lift above ground, eyes: 0 open / 1 squint / 2 closed]
  const poses: [number, number, number, number][] = [
    [10, 7.5, 0, 0], // rest
    [12, 6, 0, 1], // anticipation squash
    [7.5, 10, 2, 0], // launch stretch
    [8.5, 9, 7, 0], // rising
    [9.5, 8, 9, 0], // peak, round
    [8, 9.5, 5, 0], // falling, stretched
    [13, 5, 0, 1], // splat
    [9, 8.5, 0, 0], // rebound wobble
    [10, 7.5, 0, 2], // idle blink
  ];
  const frames: Raster[] = [];
  const draw = ([rx, ry, lift, eyes]: [number, number, number, number], hurt = false) => {
    const c = new Ix(FW, FH, pal);
    const cx = 15;
    const base = FH - 2 - lift;
    const top = base - ry * 2 + 1;
    c.ellipse(cx, base - ry + 1, rx, ry, (x, y, nx, ny) => {
      const l = -ny * 0.9 - nx * 0.35;
      return body[Math.max(0, Math.min(4, Math.round(1.8 + l * 1.6)))]!;
    });
    for (let x = 0; x < FW; x++) for (let y = base + 1; y < FH; y++) c.set(x, y, 0);
    // flat, darker base where it meets the ground (or the underside in the air)
    for (let x = 0; x < FW; x++) if (c.get(x, base)) c.set(x, base, body[0]!);
    // jelly core and a floating bubble
    c.ellipse(cx + 1, base - ry * 0.8, rx * 0.45, ry * 0.4, core!);
    c.set(cx - Math.round(rx * 0.3), base - Math.round(ry * 0.6), body[4]!);
    // shine: a curved highlight on the upper left
    const sx = cx - Math.round(rx * 0.55);
    const sy = Math.round(top + ry * 0.45);
    c.set(sx, sy, shine!);
    c.set(sx + 1, sy - 1, shine!);
    c.set(sx, sy + 1, shine!);
    c.set(sx + 2, sy - 1, body[4]!);
    // face looks the way it moves (right)
    const ey = Math.round(base - ry * 1.05);
    for (const ex of [cx + 2, cx + 6]) {
      if (eyes === 2) c.set(ex, ey + 1, eye!), c.set(ex + 1, ey + 1, eye!);
      else if (eyes === 1) c.set(ex, ey + 1, eye!), c.set(ex + 1, ey, eye!);
      else {
        c.rect(ex, ey, 2, 3, eye!);
        c.set(ex + 1, ey, shine!);
      }
    }
    c.set(cx + 4, ey + 3, mouth!);
    c.set(cx + 5, ey + 3, mouth!);
    c.outline(ol!, olLit!);
    if (hurt) for (let i = 0; i < c.px.length; i++) if (c.px[i] && c.px[i] !== ol) c.px[i] = flash!;
    frames.push(c.toRaster());
  };
  poses.forEach((p) => draw(p));
  draw(poses[6]!, true);
  return {
    raster: sheetOf(frames),
    frameWidth: FW,
    frameHeight: FH,
    animations: {
      walk: { frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 11, loop: true },
      idle: { frames: [0, 0, 7, 0, 0, 0, 8, 0], fps: 5, loop: true },
      hurt: { frames: [9, 6, 9, 0], fps: 14, loop: false },
    },
    hitbox: { x: 5, y: 10, w: 20, h: 15 },
    anchor: { x: 15, y: 25 },
  };
}

/** A bobbing strawberry with a sparkle. */
function berrySheet(): SpriteSheet {
  const FW = 14;
  const FH = 16;
  const pal = new Palette();
  const [ol] = pal.ramp(['#4a1426']);
  const red = pal.ramp(['#9e1f3a', '#e0384a', '#ff6a6a', '#ffb0a0']);
  const leaf = pal.ramp(['#2f7d3f', '#71c653']);
  const [seedC] = pal.ramp(['#ffe08a']);
  const [white] = pal.ramp(['#ffffff']);
  const frames: Raster[] = [];
  for (let f = 0; f < 8; f++) {
    const c = new Ix(FW, FH, pal);
    const bob = Math.round(Math.sin((f / 8) * Math.PI * 2) * 1.3);
    const cx = 7;
    const cy = 9 + bob;
    c.poly([[cx - 4.5, cy - 3], [cx + 4.5, cy - 3], [cx + 4, cy + 1], [cx, cy + 5], [cx - 4, cy + 1]], (x, y) => (y < cy - 1 ? red[2]! : x < cx - 2 ? red[0]! : red[1]!));
    c.set(cx - 2, cy - 2, red[3]!);
    for (const [sx, sy] of [[-2, 0], [1, -1], [3, 0], [-1, 2], [2, 2], [0, 4]] as const) c.set(cx + sx, cy + sy, seedC!);
    c.grid(['l.L.l', '.LlL.', '..l..'], { l: leaf[0]!, L: leaf[1]! }, cx - 2, cy - 5);
    c.outline(ol!);
    if (f === 1 || f === 2) {
      c.set(12, 2, white!);
      c.set(11, 3, white!);
      c.set(13, 3, white!);
      c.set(12, 4, white!);
    }
    frames.push(c.toRaster());
  }
  return { raster: sheetOf(frames), frameWidth: FW, frameHeight: FH, animations: { idle: { frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 9, loop: true } } };
}

/** A summit flag waving in the breeze. */
function flagSheet(): SpriteSheet {
  const FW = 28;
  const FH = 44;
  const pal = new Palette();
  const [ol] = pal.ramp(['#2a1a2e']);
  const pole = pal.ramp(C.wood);
  const cloth = pal.ramp(['#8a1f3a', '#d83a4a', '#ff7a5a', '#ffc08a']);
  const [emb] = pal.ramp(['#fff3c8']);
  const [stone1, stone2, stone3] = pal.ramp(C.stone.slice(0, 3));
  const frames: Raster[] = [];
  for (let f = 0; f < 6; f++) {
    const c = new Ix(FW, FH, pal);
    for (let y = 2; y < FH - 3; y++) c.set(4, y, pole[2]!), c.set(5, y, pole[1]!);
    c.set(4, 1, cloth[3]!);
    c.set(5, 1, cloth[2]!);
    // cloth: each column follows a travelling wave
    for (let x = 6; x < 25; x++) {
      const t = (x - 6) / 19;
      const off = Math.round(Math.sin(f * 1.05 - x * 0.45) * 2 * t);
      const top = 3 + off;
      const bot = 14 + off - Math.round(t * 2);
      for (let y = top; y <= bot; y++) {
        const shade = Math.sin(f * 1.05 - x * 0.45 + 1.2);
        c.set(x, y, y === top ? cloth[3]! : shade > 0.5 ? cloth[2]! : shade < -0.5 ? cloth[0]! : cloth[1]!);
      }
      if (x > 11 && x < 16) for (let y = top + 4; y < top + 8; y++) c.set(x, y, emb!);
    }
    // cairn of stones at the base
    c.ellipse(5, FH - 3, 5, 3, (x, y, nx, ny) => (ny < -0.2 ? stone3! : nx < 0 ? stone1! : stone2!));
    c.ellipse(10, FH - 2, 3, 2, (x, y, nx, ny) => (ny < -0.2 ? stone3! : stone2!));
    c.outline(ol!);
    frames.push(c.toRaster());
  }
  return { raster: sheetOf(frames), frameWidth: FW, frameHeight: FH, animations: { idle: { frames: [0, 1, 2, 3, 4, 5], fps: 8, loop: true } }, anchor: { x: 5, y: 43 } };
}

// ── Props ───────────────────────────────────────────────────────────────────

function props(): { props: Record<string, Raster>; info: Record<string, PropInfo> } {
  const out: Record<string, Raster> = {};
  const info: Record<string, PropInfo> = {};
  const G = C.grass;

  const shaded = (w: number, h: number, draw: (c: Ix, pal: Palette) => void, outline = '#2a3a2a') => {
    const pal = new Palette();
    const [ol] = pal.ramp([outline]);
    const c = new Ix(w, h, pal);
    draw(c, pal);
    c.outline(ol!);
    return c.toRaster();
  };

  // flowers: mixed colours on thin stems
  {
    const c = new Canvas(20, 12);
    const r = rng(4);
    for (let i = 0; i < 6; i++) {
      const x = 1 + i * 3 + r.int(0, 1);
      const h = r.int(4, 9);
      for (let k = 0; k < h; k++) c.set(x, 11 - k, G[2]!);
      const col = C.flower[i % C.flower.length]!;
      const y = 11 - h;
      c.set(x, y, '#ffe9a0');
      c.set(x - 1, y, col);
      c.set(x + 1, y, col);
      c.set(x, y - 1, col);
      c.set(x, y + 1, mix(col, '#000000', 0.25));
      if (r.chance(0.5)) c.set(x + 1, 11 - Math.floor(h / 2), G[3]!);
    }
    out.flowers = c.toRaster();
    info.flowers = { anchor: 'ground', weight: 6 };
  }
  // round berry bush
  out.bush = shaded(26, 16, (c, pal) => {
    const g = pal.ramp([G[1]!, G[2]!, G[3]!, G[4]!]);
    const [berry] = pal.ramp(['#e0384a']);
    for (const [x, y, rr] of [[7, 10, 6], [14, 8, 7.5], [20, 11, 5]] as const) c.disc(x, y, rr, g[1]!);
    for (let x = 0; x < 26; x++) c.set(x, 15, 0);
    c.rim(1, -1, new Set(g), 2);
    c.shade(-1, 1, new Set(g));
    for (const [x, y] of [[9, 8], [15, 6], [18, 10], [12, 11]] as const) c.set(x, y, berry!);
  }, '#1a4a2e');
  info.bush = { anchor: 'ground', weight: 3 };
  // a big round tree
  out.tree = shaded(52, 70, (c, pal) => {
    const g = pal.ramp([G[0]!, G[1]!, G[2]!, G[3]!, G[4]!]);
    const t = pal.ramp(C.wood);
    c.poly([[22, 70], [24, 34], [28, 34], [31, 70]], t[1]!);
    c.line(24, 50, 16, 38, t[1]!, 2);
    for (let y = 34; y < 70; y++) c.set(28, y, t[2]!), c.set(29, y, t[2]!);
    const r = rng(2);
    for (const [x, y, rr] of [[26, 22, 16], [14, 30, 11], [38, 30, 12], [20, 14, 10], [33, 13, 11], [26, 34, 10]] as const) c.disc(x + r.int(-1, 1), y, rr, g[2]!);
    c.rim(1, -1, new Set(g), 2);
    c.rim(0, -1, new Set(g), 1);
    c.shade(-1, 1, new Set(g));
    // inner shadow under the crown lobes
    for (let y = 30; y < 46; y++) for (let x = 0; x < 52; x++) if (c.get(x, y) === g[2] && c.get(x, y + 3) !== g[2]) c.set(x, y, g[1]!);
  }, '#163a28');
  info.tree = { anchor: 'ground', weight: 1 };
  // sunflower
  out.sunflower = shaded(12, 30, (c, pal) => {
    const g = pal.ramp([G[1]!, G[2]!, G[3]!]);
    const y = pal.ramp(['#e09a1e', '#ffd25e', '#fff0a0']);
    const [b] = pal.ramp(['#6a3a1e']);
    c.line(6, 10, 6, 30, g[1]!);
    c.set(7, 18, g[2]!);
    c.set(8, 17, g[2]!);
    c.set(4, 22, g[1]!);
    c.set(3, 21, g[1]!);
    c.disc(6, 6, 5, y[1]!);
    c.rim(0, -1, new Set(y));
    c.disc(6, 6, 2.2, b!);
  });
  info.sunflower = { anchor: 'ground', weight: 2 };
  // fence
  out.fence = shaded(32, 16, (c, pal) => {
    const t = pal.ramp(C.wood);
    for (const x of [2, 15, 28]) {
      c.rect(x, 2, 3, 14, t[2]!);
      c.set(x + 1, 1, t[2]!);
    }
    c.rect(0, 5, 32, 2, t[3]!);
    c.rect(0, 11, 32, 2, t[2]!);
    c.rim(0, -1, new Set(t));
  }, '#3a2228');
  info.fence = { anchor: 'ground', weight: 1 };
  // mossy rock
  out.rock = shaded(20, 12, (c, pal) => {
    const s = pal.ramp(C.stone);
    const g = pal.ramp([G[2]!, G[3]!]);
    c.ellipse(10, 9, 9, 6, (x, y, nx, ny) => s[Math.max(0, Math.min(3, Math.round(1.6 - ny * 1.4 + nx * 0.5)))]!);
    for (let x = 0; x < 20; x++) c.set(x, 12, 0);
    for (let x = 4; x < 15; x++) if (px01(x, 0, 9) > 0.3) for (let y = 0; y < 12; y++) if (c.get(x, y)) { c.set(x, y, g[1]!); c.set(x, y + 1, g[0]!); break; }
  }, '#2a2a3e');
  info.rock = { anchor: 'ground', weight: 2 };
  // red mushroom
  out.mushroom = shaded(12, 12, (c, pal) => {
    const r = pal.ramp(['#9e1f3a', '#e0384a', '#ff7a6a']);
    const [w] = pal.ramp(['#fff6e8']);
    const [st] = pal.ramp(['#e8d8c0']);
    c.rect(5, 6, 3, 6, st!);
    c.ellipse(6, 5, 5.5, 4, (x, y, nx, ny) => (ny > 0.4 ? r[0]! : ny < -0.4 ? r[2]! : r[1]!));
    for (let x = 0; x < 12; x++) c.set(x, 6, c.get(x, 6) === st ? st! : 0);
    c.set(4, 3, w!);
    c.set(8, 4, w!);
    c.set(6, 2, w!);
  }, '#3a1a2a');
  info.mushroom = { anchor: 'ground', weight: 2 };
  // signpost
  out.sign = shaded(18, 22, (c, pal) => {
    const t = pal.ramp(C.wood);
    c.rect(8, 6, 2, 16, t[1]!);
    c.poly([[1, 3], [14, 3], [17, 6.5], [14, 10], [1, 10]], t[2]!);
    c.rim(0, -1, new Set(t));
    c.rect(4, 6, 7, 1, t[0]!);
  }, '#3a2228');
  info.sign = { anchor: 'ground', weight: 1 };
  // tall grass
  {
    const c = new Canvas(24, 14);
    const r = rng(17);
    for (let i = 0; i < 18; i++) {
      const x = r.int(1, 22);
      const h = r.int(5, 13);
      const lean = r.range(-0.5, 0.5);
      for (let k = 0; k < h; k++) c.set(Math.round(x + lean * k * (k / h)), 13 - k, k > h - 3 ? G[4]! : k > h / 2 ? G[3]! : G[2]!);
    }
    out.grass = c.toRaster();
    info.grass = { anchor: 'ground', weight: 6 };
  }
  // hanging vine with leaves (for ledges)
  {
    const c = new Canvas(12, 30);
    for (let y = 0; y < 30; y++) {
      const x = 6 + Math.round(Math.sin(y / 5) * 2);
      c.set(x, y, G[1]!);
      if (y % 4 === 1) c.set(x + 1, y, G[3]!), c.set(x + 2, y, G[4]!);
      if (y % 4 === 3) c.set(x - 1, y, G[2]!), c.set(x - 2, y, G[3]!);
    }
    out.vine = c.toRaster();
    info.vine = { anchor: 'ceiling', weight: 2 };
  }
  return { props: out, info };
}

function decals(): Record<string, Raster> {
  return {
    stones: stonesDecal(C.stone.slice(0, 3), 3),
    stones2: stonesDecal([C.dirt[1]!, C.dirt[3]!, C.dirt[4]!], 8),
    fossil: fossilDecal(16, [C.dirt[1]!, C.dirt[4]!, C.dirt[5]!]),
    roots: rootsDecal(28, 22, [C.dirt[0]!, C.dirt[1]!, C.dirt[2]!], 4),
    bone: bonesDecal('ribs', [C.dirt[3]!, '#e8d6b0', '#fff4dc'], C.dirt[1]!),
  };
}

export const SUNLIT_MEADOW_META = {
  id: 'sunlit-meadow',
  name: 'Sunlit Meadow',
  description: 'A bright, warm summer meadow: puffy clouds, snowy peaks, round trees, flowers and a red-haired climber. Cheerful and cosy.',
  keywords: ['happy', 'cheerful', 'bright', 'cute', 'cozy', 'cosy', 'meadow', 'grass', 'forest', 'nature', 'summer', 'day', 'sunny', 'farm', 'kids', 'family', 'adventure', 'mountain', 'climb', 'flowers', 'spring', 'relaxing', 'colorful', 'colourful'],
  palette: [C.skyTop, C.skyMid, C.horizon, C.warm, ...C.grass, ...C.dirt, ...C.stone, ...C.wood, ...C.flower],
  background: C.skyMid,
};

export function sunlitMeadow(): ArtTheme {
  const { props: p, info } = props();
  return {
    ...SUNLIT_MEADOW_META,
    layers: layers(),
    tiles: meadowTiles(),
    sprites: {
      hero: bigHeroSheet(meadowBig()),
      heroSmall: heroSheet(meadowHeroCostume()),
      enemy: slimeSheet(),
      pickup: berrySheet(),
      goal: flagSheet(),
      flyer: flyerSheet({ body: ['#c48a1e', '#ffc93a', '#fff0a0'], wing: ['#b8d8f0', '#eef8ff', '#ffffff'], eye: '#2a1a2e', outline: '#3a2228', stripes: '#3a2228' }),
      checkpoint: checkpointSheet({ post: C.wood.slice(0, 3), cage: C.wood[3]!, glow: '#ffd25e', core: '#fff6d8', outline: '#3a2228', banner: '#e0384a' }),
    },
    props: p,
    propInfo: info,
    decals: decals(),
    tileSize: TILE,
    lights: {
      pickup: { color: '#ffd0c0', radius: 24, intensity: 0.25 },
      goal: { color: '#fff0c0', radius: 50, intensity: 0.3 },
    },
    environment: {
      ambient: { color: '#fffaf2', intensity: 1 },
      fog: { color: '#e6f3ff', density: 0.14, height: 0.45 },
      bloom: { strength: 0.25, threshold: 0.82 },
      vignette: 0.15,
      grade: { contrast: 1.04, saturation: 1.08, tint: '#fff9ee' },
      particles: [
        { type: 'dust', density: 0.25, color: '#fff6c8' },
        { type: 'fireflies', density: 0.12, color: '#fffbe0' },
      ],
    },
  };
}
