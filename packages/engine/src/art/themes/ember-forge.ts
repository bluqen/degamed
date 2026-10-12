/**
 * Ember Forge: the deep halls of a burning castle-forge. Plum-black stone, molten light rising
 * from below, colossal gears and arcades, chains and torn banners, embers drifting upward and a
 * helmed wanderer trailing a flame plume. Mood reference: Dead Cells, Blasphemous.
 */
import { Canvas, fbm, gradient, Ix, MatLayer, Palette, rng, bayer, type Material } from '../core';
import { heroSheet } from '../hero';
import { bigHeroSheet } from '../hero2';
import { emberBig } from './big-heroes';
import { arcade, gear, hangingChain, lightShafts, mistBand, overgrow, pipe, tower } from '../scenery';
import { derive, px01, tileNoise, TILE } from '../tiles';
import { backEdges, backWall } from '../tiles';
import { bonesDecal, crackDecal, grateDecal, veinDecal } from '../decals';
import { sheetOf, type Raster } from '../../pixel';
import type { ArtTheme, ParallaxLayer, PropInfo, SpriteSheet } from '../types';
import { emberHeroCostume } from './ember-hero';
import { checkpointSheet, flyerSheet, spikeStrip } from '../extras';

const W = 480;
const H = 270;

const C = {
  top: '#120910',
  mid: '#241019',
  low: '#4a1a18',
  glow: '#a0361a',
  stone: ['#0c070b', '#170d13', '#24141c', '#341c24', '#4a282e', '#653a38', '#8a5442'],
  iron: ['#160f12', '#2e2226', '#4c3c3c', '#76625a', '#a48c7c'],
  lava: ['#5a1408', '#b8320e', '#f06a1a', '#ffb040', '#fff0a0'],
  banner: ['#4a0c18', '#7a1424', '#b82a35', '#e0564a'],
  gold: ['#6a3a10', '#b8781e', '#f0c050', '#fff0a0'],
};

// ── Layers ──────────────────────────────────────────────────────────────────

function backdrop(): Canvas {
  const c = new Canvas(W, H);
  c.wrapX = true;
  gradient(c, [[0, C.top], [0.45, C.mid], [0.75, '#3a1418'], [0.9, C.low], [1, C.glow]], { dither: 6 });
  // a furnace glow welling up from below
  for (let y = 120; y < H; y++)
    for (let x = 0; x < W; x++) {
      const n = fbm(x, y, { w: W, h: H, cells: 4, octaves: 3, seed: 5, wrapX: true });
      const a = Math.max(0, (y - 120) / 150) ** 2 * (0.4 + n * 0.6) * 0.6;
      const q = Math.floor(a * 12 + bayer(x, y) * 0.95) / 12;
      if (q > 0) c.set(x, y, '#d0501e', q);
    }
  return c;
}

function farHalls(): Canvas {
  const r = rng(11);
  const L = new MatLayer(W, H);
  // colossal chimneys and keeps
  for (let i = 0; i < 6; i++) {
    const x = i * 80 + r.int(0, 40);
    tower(L, r, x, H, r.int(16, 34), r.int(120, 230), 1, { win: 3, winGap: 6, winSkip: 0.75, ribs: 2, ledges: 2, antenna: false });
  }
  arcade(L, 0, W, 210, 70, 40, 8, 1);
  // lava falls pouring from openings
  for (let i = 0; i < 3; i++) {
    const x = r.int(0, W);
    const y0 = r.int(60, 140);
    const w = r.int(3, 5);
    for (let y = y0; y < H; y++) {
      const wob = Math.round(Math.sin(y * 0.15 + i) * 0.6);
      for (let k = 0; k < w; k++) L.set(x + k + wob, y, k === 1 ? 5 : 4);
    }
    L.rect(x - 2, y0 - 2, w + 4, 3, 1);
  }
  const fade = { fadeTo: '#5a2018', fadeFrom: 0.55, fadeAmt: 0.85 };
  const mats: Record<number, Material> = {
    1: { base: '#2e1820', dark: '#2a161d', rim: '#5a2e2a', grain: 20, dither: true, ...fade },
    2: { base: '#28141b', ...fade },
    3: { base: '#ff9a3a' },
    4: { base: '#d8501a' },
    5: { base: '#ffb040' },
  };
  return L.paint(mats, 3);
}

function gears(): Canvas {
  const r = rng(21);
  const L = new MatLayer(W, H);
  for (let i = 0; i < 4; i++) {
    const cx = i * 120 + r.int(0, 60);
    const cy = r.int(50, 150);
    const rad = r.int(18, 36);
    gear(L, cx, cy, rad, Math.round(rad / 2.6), 1, rad * 0.6);
    if (r.chance(0.7)) gear(L, cx + rad + r.int(8, 14), cy + r.int(-10, 20), rad * 0.5, Math.round(rad / 4), 1, rad * 0.3);
    // axle beam down to the floor
    L.rect(cx - 2, cy, 4, H - cy, 1);
  }
  for (let i = 0; i < 8; i++) hangingChain(L, r.int(0, W), 0, r.int(30, 120), 1);
  const mats: Record<number, Material> = {
    1: { base: '#190a10', dark: '#16090e', rim: '#7a3a2a', grain: 24, dither: true, fadeTo: '#4a1a18', fadeFrom: 0.65, fadeAmt: 0.6 },
  };
  return L.paint(mats, 5);
}

function smoke(): Canvas {
  const c = new Canvas(W, H);
  c.wrapX = true;
  lightShafts(c, rng(3), { count: 3, color: '#ff9a50', alpha: 0.16, slope: -0.25, width: [10, 22], top: 0, bottom: 230 });
  mistBand(c, { y: 230, h: 40, color: '#7a2a1c', alpha: 0.65, seed: 9, cells: 5 });
  mistBand(c, { y: 70, h: 26, color: '#3a1820', alpha: 0.5, seed: 10, cells: 4 });
  return c;
}

function midWalls(): Canvas {
  const r = rng(31);
  const L = new MatLayer(W, H);
  let x = r.int(0, 20);
  while (x < W - 30) {
    const w = r.int(36, 64);
    const h = r.int(110, 190);
    const top = H - h;
    L.rect(x, top, w, h, 1);
    // crenellations
    for (let cx = x; cx < x + w; cx += 6) L.rect(cx, top - 4, 3, 4, 1);
    // tall arched window glowing from inside
    const ww = r.int(8, 12);
    const wx = x + Math.floor((w - ww) / 2);
    const wy = top + r.int(16, 30);
    const wh = r.int(24, 40);
    L.rect(wx, wy + ww / 2, ww, wh, 3);
    L.ellipse(wx + ww / 2, wy + ww / 2, ww / 2, ww / 2, 3);
    L.rect(wx + Math.floor(ww / 2), wy, 1, wh + ww / 2, 1);
    // banner hanging from the wall
    if (r.chance(0.6)) {
      const bx = x + (r.chance(0.5) ? 3 : w - 12);
      const by = top + r.int(6, 14);
      const bh = r.int(20, 34);
      L.rect(bx, by, 9, bh, 4);
      L.poly([[bx, by + bh], [bx + 4.5, by + bh - 5], [bx + 9, by + bh], [bx + 9, by + bh + 1], [bx, by + bh + 1]], 0);
      L.rect(bx - 1, by - 1, 11, 1, 5);
    }
    x += w + r.int(16, 40);
  }
  for (let i = 0; i < 4; i++) {
    const y = r.int(120, 200);
    const x0 = r.int(0, W);
    pipe(L, x0, y, x0 + r.int(30, 70), y, 2, 5);
  }
  overgrow(L, r, new Set([1]), 6, 6, { tuft: 0.15, hang: 0.04, maxHang: 18, seed: 33 });
  const fade = { fadeTo: '#4a1a18', fadeFrom: 0.72, fadeAmt: 0.6 };
  const mats: Record<number, Material> = {
    1: { base: '#1e1016', dark: '#1a0e13', light: '#24131a', rim: '#7a3a2a', grain: 30, dither: true, ...fade },
    3: { base: '#d8562a', light: '#ff9a3a', dark: '#b8401e', grain: 14 },
    4: { base: '#6a1220', rim: '#a82a30', rimDir: [1, 0] },
    5: { base: '#3a2a2a', rim: '#8a5a40' },
    6: { base: '#2a1418' },
  };
  return L.paint(mats, 7);
}

function nearPillars(): Canvas {
  const r = rng(41);
  const L = new MatLayer(W, H);
  for (const x0 of [30, 190, 330]) {
    const x = x0 + r.int(-10, 10);
    const w = r.int(20, 30);
    L.rect(x, 0, w, H, 1);
    for (let y = r.int(10, 30); y < H; y += r.int(30, 60)) L.rect(x - 3, y, w + 6, 4, 1);
    // glowing rune slit
    if (r.chance(0.6)) L.rect(x + Math.floor(w / 2) - 1, r.int(60, 140), 2, r.int(8, 18), 2);
  }
  for (let i = 0; i < 6; i++) hangingChain(L, r.int(0, W), 0, r.int(40, 150), 3);
  L.rect(0, 0, W, 8, 1);
  const mats: Record<number, Material> = {
    1: { base: '#0f080c', dark: '#0d070a', light: '#120a0e', rim: '#4a2018', rimDir: [0, 1], grain: 30, dither: true },
    2: { base: '#ff8a2a', rim: '#ffe08a' },
    3: { base: '#22161a', rim: '#6a4030', rimDir: [1, 0] },
  };
  return L.paint(mats, 9);
}

function foreground(): Canvas {
  const r = rng(51);
  const FW = 640;
  const L = new MatLayer(FW, H);
  for (let i = 0; i < 5; i++) {
    const x = r.int(0, FW);
    for (let y = 0; y < r.int(50, 130); y++) {
      L.set(x, y, 1);
      if (y % 3 === 1) L.set(x - 1, y, 1), L.set(x + 1, y, 1);
    }
  }
  for (let x = 0; x < FW; x++) {
    const n = fbm(x, 0, { w: FW, h: H, cells: 16, octaves: 3, seed: 52, wrapX: true });
    const h = Math.max(0, Math.round((n - 0.55) * 46));
    for (let k = 0; k < h; k++) L.set(x, H - 1 - k, 1);
  }
  return L.paint({ 1: { base: '#050204', rim: '#2a0e0c' } }, 11);
}

function layers(): ParallaxLayer[] {
  return [
    { name: 'furnace', raster: backdrop().toRaster(), factor: 0, tiled: true },
    { name: 'far halls', raster: farHalls().toRaster(), factor: 0.1, tiled: true },
    { name: 'gears', raster: gears().toRaster(), factor: 0.22, tiled: true },
    { name: 'smoke', raster: smoke().toRaster(), factor: 0.3, tiled: true },
    { name: 'walls', raster: midWalls().toRaster(), factor: 0.45, tiled: true },
    { name: 'pillars', raster: nearPillars().toRaster(), factor: 0.72, tiled: true },
    { name: 'foreground', raster: foreground().toRaster(), factor: 1.35, tiled: true },
  ];
}

// ── Tiles ───────────────────────────────────────────────────────────────────

/** Castle bricks: offset courses, bevelled edges, a few cracked or ember-lit. */
function bricks(seed: number, warm = 0): Canvas {
  const S = C.stone;
  const n = tileNoise(seed, 4, 2);
  const c = new Canvas(TILE, TILE);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const row = Math.floor(y / 4);
      const off = row % 2 ? 4 : 0;
      const bx = (x + off) % 8;
      const by = y % 4;
      const brick = Math.floor(((x + off) % TILE) / 8) + row * 2;
      const tone = px01(brick, row, seed) > 0.7 ? 0 : 1;
      let i = 2 + tone + (warm && y < 8 ? warm : 0);
      if (by === 3 || bx === 7) i = 1; // mortar
      else if (by === 0) i += 1; // lit top bevel
      else if (bx === 6) i -= 1; // shadowed right bevel
      if (n(x, y) > 0.72 && i > 1) i -= 1;
      c.set(x, y, S[Math.max(0, Math.min(S.length - 1, i))]!);
    }
  return c;
}

function ledge(base: Canvas, seed: number): Canvas {
  const S = C.stone;
  return derive(base, (x, y) => {
    if (y === 0) return px01(x, 0, seed) > 0.75 ? 'clear' : S[6];
    if (y === 1) return S[5];
    if (y === 2) return S[4];
    if (y === 3) return S[1];
    // a glowing crack here and there
    if (y > 4 && y < 9 && px01(x, y, seed) > 0.96) return C.lava[2];
    return null;
  });
}

function forgeTiles(): ArtTheme['tiles'] {
  const S = C.stone;
  const fill = bricks(3);
  const fill2 = bricks(4);
  const fill3 = bricks(8);
  const ground = ledge(bricks(5, 1), 21);
  const ground2 = ledge(bricks(6, 1), 22);
  const ground3 = ledge(bricks(7, 1), 23);
  const groundLeft = derive(ground, (x, y) => (x + y < 2 ? 'clear' : x === 0 ? (y < 4 ? S[5] : S[1]) : null));
  const groundRight = derive(ground, (x, y) => (15 - x + y < 2 ? 'clear' : x === 15 ? (y < 4 ? S[6] : S[3]) : null));
  const fillLeft = derive(fill, (x) => (x === 0 ? S[0] : null));
  const fillRight = derive(fill, (x) => (x === 15 ? S[4] : null));
  const ceiling = derive(fill, (x, y) => (y === 15 ? S[0] : y === 14 && px01(x, 1, 3) > 0.8 ? C.lava[1] : null));
  // iron grate platform
  const plat = new Canvas(TILE, TILE);
  const I = C.iron;
  for (let x = 0; x < TILE; x++) {
    plat.set(x, 0, I[4]!);
    plat.set(x, 1, I[3]!);
    plat.set(x, 2, I[1]!);
    for (let y = 3; y < 6; y++) if (x % 4 === 0 || y === 5) plat.set(x, y, y === 5 ? I[2]! : I[1]!);
    plat.set(x, 6, I[0]!);
    if (x % 8 === 4) plat.set(x, 1, C.gold[2]!);
  }
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
    platformLeft: t(derive(plat, (x, y) => (x === 0 && y < 7 ? I[1] : null))),
    platformRight: t(derive(plat, (x, y) => (x === 15 && y < 7 ? I[1] : null))),
    fill3: t(fill3),
    ...(() => {
      const back = backWall(fill2, '#0b0509', 0.5);
      const e = backEdges(back, C.stone[5]!, '#050204');
      return { back: t(back), backTop: t(e.backTop), backBottom: t(e.backBottom), backLeft: t(e.backLeft), backRight: t(e.backRight) };
    })(),
    spike: spikeStrip([I[1]!, I[2]!, I[3]!, I[4]!], '#0a0508', S[2]),
  };
}

// ── Creatures ───────────────────────────────────────────────────────────────

/**
 * A magma slug: charred plates over a molten body that glows through the seams. It inches along
 * (a wave of compression runs from tail to head), its glowing eye stalks sway, and now and then a
 * drop of lava drips from its belly.
 */
function slugSheet(): SpriteSheet {
  const FW = 38;
  const FH = 22;
  const pal = new Palette();
  const [ol, olLit] = pal.ramp(['#0a0508', '#4a1a10']);
  const rock = pal.ramp(['#1a0e10', '#33201f', '#553530', '#7a5040', '#a07050']);
  const lava = pal.ramp(C.lava.slice(1));
  const [eye, eyeCore] = pal.ramp(['#ffb040', '#fff6c0']);
  const [stalk] = pal.ramp(['#33201f']);
  const [flash] = pal.ramp(['#ffffff']);
  const frames: Raster[] = [];
  const draw = (f: number, mode: 'walk' | 'idle' | 'hurt') => {
    const c = new Ix(FW, FH, pal);
    const ph = (f / 8) * Math.PI * 2;
    const segs = 6;
    const walk = mode === 'walk';
    const xs: number[] = [];
    let headTop = 0;
    for (let i = 0; i < segs; i++) {
      const t = i / (segs - 1);
      // the compression wave travels forward along the body
      const squeeze = walk ? Math.sin(ph - i * 1.05) : 0;
      const x = 5 + t * 23 + squeeze * 1.2;
      const rad = 3.6 + Math.sin(t * Math.PI * 0.85) * 2.6 + (i === segs - 1 ? 0.6 : 0);
      const hump = walk ? Math.max(0, squeeze) * 2.2 : mode === 'idle' ? Math.sin(ph + i) * 0.4 : 0;
      const y = FH - 1 - rad - hump;
      xs.push(x);
      if (i === segs - 1) headTop = y - rad;
      c.ellipse(x, y, rad + 0.9, rad, (xx, yy, nx, ny) => rock[Math.max(0, Math.min(4, Math.round(2 - ny * 1.6 + nx * 0.3)))]!);
    }
    // molten seams between plates, brighter at the top of each seam
    for (let i = 1; i < segs; i++) {
      const sx = Math.round((xs[i]! + xs[i - 1]!) / 2 + 1);
      for (let y = 1; y < FH - 1; y++) if (c.get(sx, y)) c.set(sx, y, y < FH - 8 ? lava[2]! : lava[1]!);
    }
    for (let x = 0; x < FW; x++) if (c.get(x, FH - 1)) c.set(x, FH - 1, lava[0]!);
    // eye stalks sway; eyes glow
    const hx = Math.round(xs[segs - 1]!);
    for (const [k, off] of [[0, 1], [1, 4]] as const) {
      const sway = Math.round(Math.sin(ph + k * 1.7) * 1.2);
      const bx = hx + off - 1;
      const by = Math.round(headTop) + 1;
      c.line(bx, by, bx + 1 + sway, by - 4, stalk!);
      c.set(bx + 1 + sway, by - 5, eye!);
      c.set(bx + 2 + sway, by - 5, eyeCore!);
    }
    // a lava drip on one frame of the cycle
    if (walk && f === 5) c.set(Math.round(xs[2]!), FH - 1, lava[3]!);
    c.rim(0, -1, new Set(rock));
    c.outline(ol!, olLit!);
    if (mode === 'hurt') for (let i = 0; i < c.px.length; i++) if (c.px[i] && c.px[i] !== ol) c.px[i] = flash!;
    frames.push(c.toRaster());
  };
  for (let f = 0; f < 8; f++) draw(f, 'walk');
  draw(0, 'idle');
  draw(3, 'idle');
  draw(0, 'hurt');
  return {
    raster: sheetOf(frames),
    frameWidth: FW,
    frameHeight: FH,
    animations: {
      walk: { frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 9, loop: true },
      idle: { frames: [8, 9], fps: 3, loop: true },
      hurt: { frames: [10, 0, 10, 0], fps: 14, loop: false },
    },
    hitbox: { x: 3, y: 8, w: 32, h: 14 },
    anchor: { x: 19, y: 21 },
  };
}

/** A soul flame: a flickering wisp. */
function wispSheet(): SpriteSheet {
  const S = 14;
  const frames: Raster[] = [];
  for (let f = 0; f < 6; f++) {
    const c = new Canvas(S, S);
    const sway = [0, 1, 1, 0, -1, -1][f]!;
    c.glow(7, 8, 7, C.lava[3]!, 0.5);
    c.poly([[3.5, 10], [7 + sway, 1 + (f % 2)], [10.5, 10], [7, 13]], C.lava[2]!);
    c.poly([[5, 10], [7 + sway * 0.6, 4 + (f % 2)], [9, 10], [7, 12]], C.lava[3]!);
    c.disc(7, 10, 1.6, C.lava[4]!);
    c.set(7, 10, '#ffffff');
    frames.push(c.toRaster());
  }
  return { raster: sheetOf(frames), frameWidth: S, frameHeight: S, animations: { idle: { frames: [0, 1, 2, 3, 4, 5], fps: 10, loop: true } } };
}

/** The forge gate: an iron-banded arch over a pulsing molten heart. */
function forgeGateSheet(): SpriteSheet {
  const FW = 34;
  const FH = 48;
  const S = C.stone;
  const frames: Raster[] = [];
  for (let f = 0; f < 6; f++) {
    const c = new Canvas(FW, FH);
    const pulse = 0.5 + 0.5 * Math.sin((f / 6) * Math.PI * 2);
    const cx = 17;
    for (let y = 10; y < FH; y++)
      for (let x = 6; x < 28; x++) {
        if (y < 22 && Math.hypot(x + 0.5 - cx, y - 22) > 11) continue;
        const t = (y - 10) / (FH - 10);
        c.set(x, y, t > 0.65 ? C.lava[2]! : t > 0.4 ? C.lava[1]! : C.lava[0]!);
      }
    c.glow(cx, 38, 20, C.lava[3]!, 0.25 + 0.25 * pulse);
    for (let a = Math.PI; a <= Math.PI * 2 + 0.01; a += 0.035)
      for (let rr = 11; rr < 16; rr++) {
        const x = Math.round(cx + Math.cos(a) * rr - 0.5);
        const y = Math.round(22 + Math.sin(a) * rr);
        c.set(x, y, rr === 11 ? S[2]! : rr === 15 ? S[6]! : Math.floor(((a - Math.PI) / Math.PI) * 9) % 2 ? S[4]! : S[5]!);
      }
    for (const px of [2, 28]) for (let y = 22; y < FH; y++) for (let k = 0; k < 4; k++) c.set(px + k, y, k === 0 || k === 3 ? S[2]! : y % 8 === 0 ? C.iron[3]! : S[4]!);
    // iron bands with rivets
    for (const y of [28, 38]) for (let x = 6; x < 28; x++) c.set(x, y, x % 4 === 0 ? C.gold[2]! : C.iron[2]!);
    c.set(cx, 8, C.gold[3]!);
    c.set(cx - 1, 9, C.gold[2]!);
    c.set(cx + 1, 9, C.gold[2]!);
    frames.push(c.toRaster());
  }
  return { raster: sheetOf(frames), frameWidth: FW, frameHeight: FH, animations: { idle: { frames: [0, 1, 2, 3, 4, 5], fps: 6, loop: true } }, anchor: { x: 17, y: 47 } };
}

// ── Props ───────────────────────────────────────────────────────────────────

function props(): { props: Record<string, Raster>; info: Record<string, PropInfo> } {
  const out: Record<string, Raster> = {};
  const info: Record<string, PropInfo> = {};
  const I = C.iron;
  const L = C.lava;

  // wall torch
  {
    const c = new Canvas(10, 22);
    c.glow(5, 6, 7, L[3]!, 0.7);
    c.poly([[2, 8], [5, 0], [8, 8], [5, 11]], L[2]!);
    c.poly([[3.5, 8], [5, 3], [6.5, 8], [5, 10]], L[3]!);
    c.set(5, 8, L[4]!);
    for (let x = 2; x < 9; x++) c.set(x, 11, I[3]!), c.set(x, 12, I[2]!);
    for (let y = 13; y < 22; y++) c.set(4, y, I[2]!), c.set(5, y, I[1]!);
    out.torch = c.toRaster();
    info.torch = { anchor: 'wall', light: { color: '#ff9a40', radius: 90, intensity: 1, flicker: 0.25, x: 5, y: 6 }, weight: 2 };
  }
  // brazier on the floor
  {
    const c = new Canvas(16, 20);
    c.glow(8, 7, 8, L[3]!, 0.7);
    c.poly([[3, 10], [6, 1], [8, 6], [10, 0], [13, 10]], L[2]!);
    c.poly([[5, 10], [8, 4], [11, 10]], L[3]!);
    c.poly([[1, 10], [15, 10], [12, 15], [4, 15]], I[2]!);
    for (let x = 1; x < 15; x++) c.set(x, 10, I[4]!);
    for (let y = 15; y < 20; y++) c.set(7, y, I[2]!), c.set(8, y, I[1]!);
    for (let x = 4; x < 12; x++) c.set(x, 19, I[1]!);
    out.brazier = c.toRaster();
    info.brazier = { anchor: 'ground', light: { color: '#ff9a40', radius: 100, intensity: 1.1, flicker: 0.2, x: 8, y: 6 }, weight: 1 };
  }
  // hanging chain with a hook
  {
    const M = new MatLayer(7, 60, false);
    hangingChain(M, 3, 0, 54, 1);
    M.rect(3, 54, 1, 3, 1);
    M.rect(1, 57, 3, 1, 1);
    M.rect(1, 55, 1, 2, 1);
    out.chain = M.paint({ 1: { base: I[2]!, rim: I[4]!, rimDir: [1, 0] } }, 1).toRaster();
    info.chain = { anchor: 'ceiling', weight: 3 };
  }
  // torn banner
  {
    const pal = new Palette();
    const [ol] = pal.ramp(['#0a0508']);
    const b = pal.ramp(C.banner);
    const g = pal.ramp(C.gold.slice(1, 3));
    const c = new Ix(14, 34, pal);
    c.rect(0, 0, 14, 2, g[0]!);
    c.poly([[1, 2], [13, 2], [13, 30], [10, 26], [7, 33], [4, 27], [1, 31]], (x) => (x < 4 ? b[1]! : x > 10 ? b[3]! : b[2]!));
    c.grid(['..g..', '.ggg.', 'ggGgg', '.ggg.', '..g..'], { g: g[0]!, G: g[1]! }, 5, 9);
    c.outline(ol!);
    out.banner = c.toRaster();
    info.banner = { anchor: 'wall', weight: 2 };
  }
  // anvil
  {
    const pal = new Palette();
    const [ol] = pal.ramp(['#0a0508']);
    const ir = pal.ramp(I.slice(1));
    const c = new Ix(20, 12, pal);
    c.poly([[0, 1], [16, 1], [19, 3], [14, 5], [6, 5], [3, 3]], ir[2]!);
    c.rect(7, 5, 6, 4, ir[1]!);
    c.rect(4, 9, 12, 3, ir[1]!);
    c.rim(0, -1, new Set(ir), 1);
    c.outline(ol!);
    out.anvil = c.toRaster();
    info.anvil = { anchor: 'ground', weight: 1 };
  }
  // pile of skulls and bones
  {
    const pal = new Palette();
    const [ol] = pal.ramp(['#0a0508']);
    const b = pal.ramp(['#7a6458', '#bfa894', '#eadccb']);
    const [e] = pal.ramp(['#140a0c']);
    const c = new Ix(22, 10, pal);
    c.line(1, 9, 20, 7, b[1]!);
    c.line(3, 7, 14, 9, b[0]!);
    for (const [x, y] of [[7, 5], [14, 6]] as const) {
      c.ellipse(x, y, 3.2, 3, (xx, yy, nx, ny) => (ny < -0.3 ? b[2]! : b[1]!));
      c.set(x - 1, y, e!);
      c.set(x + 1, y, e!);
    }
    c.outline(ol!);
    out.bones = c.toRaster();
    info.bones = { anchor: 'ground', weight: 2 };
  }
  // iron-banded barrel
  {
    const c = new Canvas(12, 16);
    const ramp = [C.stone[3]!, C.stone[4]!, C.stone[5]!, C.stone[6]!, C.stone[5]!, C.stone[4]!, C.stone[4]!, C.stone[3]!, C.stone[2]!, C.stone[2]!];
    for (let y = 1; y < 16; y++) for (let i = 0; i < 10; i++) c.set(1 + i, y, ramp[i]!);
    for (const y of [3, 12]) for (let i = 0; i < 10; i++) c.set(1 + i, y, i < 4 ? I[3]! : I[1]!);
    for (let i = 0; i < 10; i++) c.set(1 + i, 0, I[2]!);
    out.barrel = c.toRaster();
    info.barrel = { anchor: 'ground', weight: 2 };
  }
  // weapon rack
  {
    const c = new Canvas(18, 24);
    for (let x = 1; x < 17; x++) c.set(x, 6, C.stone[5]!), c.set(x, 18, C.stone[5]!), c.set(x, 19, C.stone[3]!);
    for (const [x, h] of [[4, 22], [9, 20], [14, 23]] as const) {
      for (let y = 24 - h; y < 24; y++) c.set(x, y, y < 24 - h + 7 ? I[4]! : C.stone[4]!);
      c.set(x - 1, 24 - h + 7, C.gold[2]!);
      c.set(x + 1, 24 - h + 7, C.gold[2]!);
    }
    out.rack = c.toRaster();
    info.rack = { anchor: 'ground', weight: 1 };
  }
  return { props: out, info };
}

function decals(): Record<string, Raster> {
  return {
    lava: veinDecal(36, 14, [C.lava[0]!, C.lava[2]!, C.lava[3]!], 6),
    skull: bonesDecal('skull', ['#7a6458', '#bfa894', '#eadccb'], '#140a0c'),
    grate: grateDecal(C.iron.slice(0, 3), C.lava[1]!),
    crack: crackDecal(30, 20, C.stone[0]!, '#050204', C.stone[4]!, 5),
  };
}

export const EMBER_FORGE_META = {
  id: 'ember-forge',
  name: 'Ember Forge',
  description: 'The burning halls of a castle-forge: dark plum stone, molten light, giant gears, chains, banners, drifting embers and a helmed hero with a flame plume.',
  keywords: ['fire', 'lava', 'forge', 'castle', 'dungeon', 'hell', 'volcano', 'medieval', 'knight', 'sword', 'roguelike', 'action', 'combat', 'epic', 'dark fantasy', 'ember', 'embers', 'molten', 'boss', 'gothic', 'warrior'],
  palette: [C.top, C.mid, C.low, C.glow, ...C.stone, ...C.iron, ...C.lava, ...C.banner, ...C.gold],
  background: C.top,
};

export function emberForge(): ArtTheme {
  const { props: p, info } = props();
  return {
    ...EMBER_FORGE_META,
    layers: layers(),
    tiles: forgeTiles(),
    sprites: {
      hero: bigHeroSheet(emberBig()),
      heroSmall: heroSheet(emberHeroCostume()),
      enemy: slugSheet(),
      pickup: wispSheet(),
      goal: forgeGateSheet(),
      flyer: flyerSheet({ body: ['#1a0e10', '#33201f', '#553530'], wing: ['#5a1408', '#d0501e', '#ffb040'], eye: '#fff0a0', outline: '#0a0508', glowEye: true }),
      checkpoint: checkpointSheet({ post: C.iron.slice(1, 4), cage: C.iron[3]!, glow: '#ffae4a', core: '#fff0c0', outline: '#0a0508', banner: C.banner[2] }),
    },
    props: p,
    propInfo: info,
    decals: decals(),
    tileSize: TILE,
    lights: {
      hero: { color: '#ffb070', radius: 54, intensity: 0.45, flicker: 0.1 },
      pickup: { color: C.lava[3]!, radius: 40, intensity: 0.8, flicker: 0.2 },
      goal: { color: C.lava[2]!, radius: 100, intensity: 1, flicker: 0.12 },
      enemy: { color: C.lava[2]!, radius: 30, intensity: 0.5, flicker: 0.2 },
    },
    environment: {
      ambient: { color: '#ffe0d2', intensity: 0.86 },
      fog: { color: '#5a2018', density: 0.18, height: 0.4 },
      bloom: { strength: 0.85, threshold: 0.6 },
      vignette: 0.55,
      grade: { contrast: 1.1, saturation: 1.05, tint: '#fff2e8' },
      particles: [
        { type: 'embers', density: 0.6, color: '#ffae4a' },
        { type: 'dust', density: 0.15, color: '#a06a50' },
      ],
    },
  };
}
