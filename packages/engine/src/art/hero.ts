/**
 * The hero puppet. Each theme supplies a costume (hand-drawn head grid, ramps for cloak, scarf,
 * legs and weapon); the poses below are keyframed by hand and shared, so every hero gets the same
 * carefully timed animation: breathing idle with a blink, an 8-frame run with bob and leg arcs,
 * stretch on take-off, billowing fall, squash on landing, a 4-frame attack with anticipation and a
 * slash arc, and a recoil hurt with a flash. The scarf (or hair) is a chain whose angle and wave
 * lag the body, which gives free secondary motion.
 */
import { Ix, Palette } from './core';
import { sheetOf, type Raster } from '../pixel';
import type { SpriteSheet } from './types';

export const HERO_W = 32;
export const HERO_H = 32;
const GROUND = 31;

export interface HeroCostume {
  pal: Palette;
  outline: number;
  outlineLit: number;
  /** dark → light, at least 4. */
  cloak: number[];
  legs: number[];
  scarf: number[];
  weapon: number[];
  slash: number[];
  head: { rows: string[]; map: Record<string, number>; anchorX: number };
  /** Rows to swap in for a blink (row index → row). */
  blink?: Record<number, string>;
  /** Rows to swap in when hurt (pained face). */
  hurtFace?: Record<number, string>;
  flash: number;
  scarfLen: number;
  scarfWidth: number;
  /** Where the scarf/hair starts, relative to the neck point. */
  scarfAt: [number, number];
  /** Draw the chain over the head (hair) instead of only behind the body. */
  scarfKnot?: boolean;
  cloakLen: number;
  cloakTop: number;
  cloakHem: number;
  /** Teeth on the hem: 0 = smooth jacket, 1 = ragged cloak. */
  ragged: number;
  legLen?: number;
  tail?: { ramp: number[]; len: number };
  /** Head colours that also catch the rim light (metal helms). */
  headRim?: number[];
}

interface Leg {
  x: number;
  y: number;
}

export interface HeroPose {
  bob: number;
  lean: number;
  sq: number;
  back: Leg;
  front: Leg;
  flare: number;
  lift: number;
  scarf: { ang: number; wave: number; ph: number };
  blink?: boolean;
  headDy?: number;
  weapon?: { ang: number; len: number };
  slash?: number;
  flash?: boolean;
  hurt?: boolean;
}

/** Foot position for a run-cycle phase (0..1): stance on the ground, swing in an arc. */
function runFoot(p: number, hipY: number): Leg {
  p = ((p % 1) + 1) % 1;
  if (p < 0.5) {
    const t = p / 0.5;
    return { x: 4 - 8 * t, y: GROUND - hipY };
  }
  const t = (p - 0.5) / 0.5;
  const e = t * t * (3 - 2 * t);
  return { x: -4 + 9 * e, y: GROUND - hipY - Math.sin(t * Math.PI) * 4 - (t > 0.6 ? 0 : 1) };
}

const BASE_HIP = 25;

function pose(p: Partial<HeroPose>): HeroPose {
  return {
    bob: 0,
    lean: 0,
    sq: 0,
    back: { x: -2, y: GROUND - BASE_HIP },
    front: { x: 2, y: GROUND - BASE_HIP },
    flare: 0,
    lift: 0,
    scarf: { ang: Math.PI * 0.82, wave: 0.25, ph: 0 },
    ...p,
  };
}

/** Sheet order. The animations below index into this list. */
export function heroPoses(): HeroPose[] {
  const P: HeroPose[] = [];
  // 0..4 idle: breathe in and out, scarf drifting; 4 = blink
  P.push(pose({ scarf: { ang: Math.PI * 0.8, wave: 0.3, ph: 0 } }));
  P.push(pose({ scarf: { ang: Math.PI * 0.79, wave: 0.3, ph: 1.4 } }));
  P.push(pose({ sq: 1, bob: 1, headDy: 0, scarf: { ang: Math.PI * 0.76, wave: 0.3, ph: 2.6 }, back: { x: -2, y: GROUND - BASE_HIP - 1 }, front: { x: 2, y: GROUND - BASE_HIP - 1 } }));
  P.push(pose({ sq: 1, bob: 1, scarf: { ang: Math.PI * 0.77, wave: 0.3, ph: 3.9 }, back: { x: -2, y: GROUND - BASE_HIP - 1 }, front: { x: 2, y: GROUND - BASE_HIP - 1 } }));
  P.push(pose({ blink: true, scarf: { ang: Math.PI * 0.8, wave: 0.3, ph: 5 } }));
  // 5..12 run: contact, down, pass, up × 2
  for (let f = 0; f < 8; f++) {
    const bob = [0, 1, 0, -1][f % 4]!;
    const hipY = BASE_HIP + bob;
    const ph = f / 8;
    P.push(
      pose({
        bob,
        lean: 1,
        sq: f % 4 === 1 ? 1 : f % 4 === 3 ? -1 : 0,
        front: runFoot(ph, hipY),
        back: runFoot(ph + 0.5, hipY),
        flare: 2 + (f % 2),
        lift: f % 4 === 3 ? 1 : 0,
        scarf: { ang: Math.PI * 0.97, wave: 0.55, ph: f * 1.3 },
      }),
    );
  }
  // 13..14 jump: stretch on take-off, then tuck as it slows
  P.push(pose({ sq: -2, bob: -1, lean: 0, back: { x: -1, y: 7 }, front: { x: 1, y: 7 }, flare: 0, lift: -1, scarf: { ang: Math.PI * 0.58, wave: 0.2, ph: 0.5 } }));
  P.push(pose({ sq: 0, bob: -1, back: { x: -2, y: 4 }, front: { x: 3, y: 5 }, flare: 1, lift: 0, scarf: { ang: Math.PI * 0.68, wave: 0.35, ph: 1.6 } }));
  // 15..16 fall: cloak billows up, legs dangle, scarf streams up
  P.push(pose({ sq: 0, bob: -1, back: { x: -3, y: 6 }, front: { x: 2, y: 7 }, flare: 1, lift: 2, scarf: { ang: -Math.PI * 0.62, wave: 0.45, ph: 0 } }));
  P.push(pose({ sq: 0, bob: -1, back: { x: -2, y: 7 }, front: { x: 3, y: 6 }, flare: 2, lift: 3, scarf: { ang: -Math.PI * 0.66, wave: 0.45, ph: 2 } }));
  // 17 land: squash
  P.push(pose({ sq: 2, bob: 2, back: { x: -4, y: GROUND - BASE_HIP - 2 }, front: { x: 4, y: GROUND - BASE_HIP - 2 }, flare: 1, lift: -1, scarf: { ang: Math.PI * 0.6, wave: 0.3, ph: 1 } }));
  // 18..21 attack: wind-up, strike, follow-through, recover
  P.push(pose({ lean: -1, sq: 1, bob: 1, back: { x: -4, y: GROUND - BASE_HIP - 1 }, front: { x: 3, y: GROUND - BASE_HIP - 1 }, weapon: { ang: -Math.PI * 0.85, len: 7 }, scarf: { ang: Math.PI * 0.7, wave: 0.3, ph: 0 } }));
  P.push(pose({ lean: 2, sq: -1, back: { x: -4, y: GROUND - BASE_HIP }, front: { x: 5, y: GROUND - BASE_HIP }, weapon: { ang: 0, len: 11 }, slash: 1, flare: 2, scarf: { ang: Math.PI * 0.95, wave: 0.5, ph: 1 } }));
  P.push(pose({ lean: 2, sq: 0, back: { x: -4, y: GROUND - BASE_HIP }, front: { x: 5, y: GROUND - BASE_HIP }, weapon: { ang: Math.PI * 0.2, len: 10 }, slash: 2, flare: 2, scarf: { ang: Math.PI * 0.9, wave: 0.5, ph: 2.2 } }));
  P.push(pose({ lean: 1, sq: 0, back: { x: -3, y: GROUND - BASE_HIP }, front: { x: 3, y: GROUND - BASE_HIP }, weapon: { ang: Math.PI * 0.35, len: 7 }, flare: 1, scarf: { ang: Math.PI * 0.85, wave: 0.4, ph: 3.3 } }));
  // 22..23 hurt: recoil with a flash, then the pained pose
  P.push(pose({ lean: -2, sq: -1, bob: -1, back: { x: -4, y: 6 }, front: { x: 0, y: 7 }, flare: -1, lift: 1, flash: true, hurt: true, scarf: { ang: Math.PI * 0.2, wave: 0.6, ph: 0 } }));
  P.push(pose({ lean: -2, sq: 0, bob: 0, back: { x: -4, y: 6 }, front: { x: 0, y: 6 }, flare: -1, lift: 1, hurt: true, scarf: { ang: Math.PI * 0.25, wave: 0.6, ph: 2 } }));
  // 24..25 wall slide / crouch extras
  P.push(pose({ sq: 2, bob: 3, back: { x: -3, y: GROUND - BASE_HIP - 3 }, front: { x: 3, y: GROUND - BASE_HIP - 3 }, flare: 1, lift: -1, scarf: { ang: Math.PI * 0.7, wave: 0.25, ph: 0 } }));
  P.push(pose({ lean: -1, sq: 0, back: { x: -1, y: 6 }, front: { x: 3, y: 4 }, flare: -1, lift: 1, scarf: { ang: -Math.PI * 0.55, wave: 0.3, ph: 1 } }));
  return P;
}

export const HERO_ANIMS: SpriteSheet['animations'] = {
  idle: { frames: [0, 0, 1, 2, 3, 3, 2, 1, 0, 0, 4, 0], fps: 7, loop: true },
  run: { frames: [5, 6, 7, 8, 9, 10, 11, 12], fps: 14, loop: true },
  jump: { frames: [13, 14], fps: 10, loop: false },
  fall: { frames: [15, 16], fps: 8, loop: true },
  land: { frames: [17, 0], fps: 14, loop: false },
  attack: { frames: [18, 19, 20, 21], fps: 18, loop: false },
  hurt: { frames: [22, 23, 23], fps: 10, loop: false },
  crouch: { frames: [24], fps: 1, loop: false },
  wall: { frames: [25], fps: 1, loop: false },
};

function drawLeg(c: Ix, hx: number, hy: number, foot: Leg, len: number, col: number, toe: number): void {
  const fx = hx + foot.x;
  const fy = hy + foot.y;
  const d = Math.hypot(foot.x, foot.y);
  const bend = Math.sqrt(Math.max(0, len * len - d * d)) / 2;
  // knee pushes forward (+x) perpendicular to the hip→foot line
  const kx = (hx + fx) / 2 + (d ? (foot.y / d) * bend : 0);
  const ky = (hy + fy) / 2 - (d ? (foot.x / d) * bend * 0.5 : 0);
  c.line(hx, hy, Math.round(kx), Math.round(ky), col);
  c.line(hx + 1, hy, Math.round(kx) + 1, Math.round(ky), col);
  c.line(Math.round(kx), Math.round(ky), Math.round(fx), Math.round(fy), col);
  c.line(Math.round(kx) + 1, Math.round(ky), Math.round(fx) + 1, Math.round(fy), col);
  c.set(Math.round(fx) + 2, Math.round(fy), toe);
}

function chain(x: number, y: number, n: number, seg: number, s: HeroPose['scarf']): [number, number][] {
  const pts: [number, number][] = [[x, y]];
  let a = s.ang;
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    a = s.ang + Math.sin(s.ph + i * 0.95) * s.wave * k + 0.18 * k * Math.sign(Math.cos(s.ang));
    const [px, py] = pts[i - 1]!;
    pts.push([px + Math.cos(a) * seg, py + Math.sin(a) * seg + k * 0.25]);
  }
  return pts;
}

export function drawHero(cos: HeroCostume, p: HeroPose): Ix {
  const c = new Ix(HERO_W, HERO_H, cos.pal);
  const hipY = BASE_HIP + p.bob;
  const hipX = 15 + Math.round(p.lean / 2);
  const neckX = 15 + p.lean;
  const neckY = hipY - cos.cloakLen + p.sq + (p.headDy ?? 0);
  const legLen = cos.legLen ?? 7;
  const [c0, c1, c2, c3] = [cos.cloak[0]!, cos.cloak[1]!, cos.cloak[2]!, cos.cloak[3]!];

  // tail (behind everything)
  if (cos.tail) {
    const pts = chain(hipX - 3, hipY - 1, cos.tail.len, 1.3, { ang: Math.PI * 0.9 + p.scarf.wave * 0.2 - (p.lift > 1 ? 0.8 : 0), wave: p.scarf.wave * 0.6, ph: p.scarf.ph + 1 });
    pts.forEach(([x, y], i) => {
      const t = i / pts.length;
      c.set(x, y, cos.tail!.ramp[1]!);
      if (t < 0.55) c.set(x, y + 1, cos.tail!.ramp[0]!);
    });
  }

  // scarf / hair chain, behind the body
  const [sx, sy] = [neckX + cos.scarfAt[0], neckY + cos.scarfAt[1]];
  const sp = chain(sx, sy, cos.scarfLen, 1.35, p.scarf);
  sp.forEach(([x, y], i) => {
    const t = i / sp.length;
    const w = t < 0.6 ? cos.scarfWidth : t < 0.85 ? Math.max(1, cos.scarfWidth - 1) : 1;
    const [px, py] = sp[Math.max(0, i - 1)]!;
    for (let k = 0; k < w; k++) {
      const col = k === 0 ? cos.scarf[2]! : k === w - 1 && w > 1 ? cos.scarf[0]! : cos.scarf[1]!;
      c.line(Math.round(px), Math.round(py) + k, Math.round(x), Math.round(y) + k, col);
    }
  });
  // a forked, frayed tip
  const [ex, ey] = sp[sp.length - 1]!;
  const [qx, qy] = sp[sp.length - 2]!;
  c.set(Math.round(ex + (ex - qx)), Math.round(ey + (ey - qy)) + 1, cos.scarf[1]!);

  // legs
  drawLeg(c, hipX - 2, hipY, p.back, legLen, cos.legs[0]!, cos.legs[0]!);
  drawLeg(c, hipX + 1, hipY, p.front, legLen, cos.legs[1]!, cos.legs[1]!);

  // cloak / body
  const topHalf = cos.cloakTop + (p.sq > 0 ? 1 : 0);
  const hemHalf = cos.cloakHem + Math.max(0, p.sq) - (p.sq < 0 ? 1 : 0);
  const hemY = hipY + 2 - p.lift;
  const backX = neckX - hemHalf - p.flare;
  const frontX = neckX + hemHalf - 1 + Math.max(0, -p.flare);
  const pts: [number, number][] = [
    [neckX - topHalf, neckY],
    [neckX + topHalf, neckY],
    [frontX + 1, hemY - 2],
  ];
  const teeth = 5;
  for (let i = 0; i <= teeth; i++) {
    const t = i / teeth;
    const x = frontX + 1 + (backX - frontX - 1) * t;
    const tooth = cos.ragged && i % 2 === 1 ? 1 + ((i * 7 + p.flare) % 2) : 0;
    const liftHere = p.lift > 0 ? Math.round(p.lift * t) : 0;
    pts.push([x, hemY + tooth - liftHere]);
  }
  pts.push([backX, hemY - 3 - Math.max(0, p.lift - 1)]);
  c.poly(pts, (x) => {
    const rel = x - neckX;
    if (rel <= -topHalf) return c1;
    if (rel >= topHalf - 1) return c3;
    return c2;
  });
  // fold line and hem shadow
  const foldX = neckX - 1 - Math.round(p.flare / 2);
  for (let y = neckY + 3; y <= hemY - 1; y++) if (c.get(foldX, y)) c.set(foldX, y, c1);
  for (let x = 0; x < HERO_W; x++)
    for (let y = HERO_H - 1; y > 0; y--) {
      const v = c.get(x, y);
      if (v === c1 || v === c2 || v === c3) {
        c.set(x, y, c0);
        break;
      }
    }

  // head
  const rows = cos.head.rows.map((r, i) => (p.blink && cos.blink?.[i]) || (p.hurt && cos.hurtFace?.[i]) || r);
  const hx = neckX - cos.head.anchorX;
  const hy = neckY - rows.length + 2;
  c.grid(rows, cos.head.map, hx, hy);

  // head casts a shadow onto the cloak just below it
  for (let x = 0; x < HERO_W; x++) {
    const v = c.get(x, hy + rows.length);
    if (v === c2 || v === c3) c.set(x, hy + rows.length, c1);
  }

  // scarf knot around the neck, in front of the cloak
  if (cos.scarfKnot !== false) {
    for (let x = neckX - topHalf; x <= neckX + topHalf; x++) {
      c.set(x, hy + rows.length - 1, cos.scarf[2]!);
      c.set(x, hy + rows.length, cos.scarf[1]!);
    }
    c.set(neckX - topHalf, hy + rows.length + 1, cos.scarf[1]!);
  }

  // weapon
  if (p.weapon) {
    const ax = neckX + 2;
    const ay = neckY + 4;
    const ex = ax + Math.cos(p.weapon.ang) * p.weapon.len;
    const ey = ay + Math.sin(p.weapon.ang) * p.weapon.len;
    // shaft: bright top edge over a darker underside so it reads at 1x
    c.line(ax, ay + 1, Math.round(ex), Math.round(ey) + 1, cos.weapon[0]!);
    c.line(ax, ay, Math.round(ex), Math.round(ey), cos.weapon[1]!);
    c.set(Math.round(ex), Math.round(ey), cos.weapon[2]!);
    c.set(Math.round((ax + ex) / 2), Math.round((ay + ey) / 2), cos.weapon[2]!);
  }

  // shading passes on cloak + scarf: light from upper right, shadow lower left
  const soft = new Set([c1, c2, c3, ...cos.scarf, ...(cos.headRim ?? [])]);
  c.rim(1, -1, soft);
  c.shade(-1, 1, new Set([c2, c3]));

  // slash arc (drawn after shading so it stays bright)
  if (p.slash) {
    const cx = neckX + 1;
    const cy = neckY + 4;
    const r = p.slash === 1 ? 10 : 11;
    const a0 = p.slash === 1 ? -1.25 : -0.2;
    const a1 = p.slash === 1 ? 1.1 : 1.25;
    for (let a = a0; a <= a1; a += 0.04) {
      const t = (a - a0) / (a1 - a0);
      const thick = p.slash === 1 ? Math.sin(t * Math.PI) * 3.2 : Math.sin(t * Math.PI) * 1.6;
      for (let k = 0; k < thick; k++) {
        const rr = r - k;
        const x = Math.round(cx + Math.cos(a) * rr);
        const y = Math.round(cy + Math.sin(a) * rr);
        c.set(x, y, k === 0 ? cos.slash[2]! : k < 2 ? cos.slash[1]! : cos.slash[0]!);
      }
    }
  }

  c.outline(cos.outline, cos.outlineLit);
  if (p.flash) {
    // keep the outline, flash the body
    for (let i = 0; i < c.px.length; i++) if (c.px[i] && c.px[i] !== cos.outline && c.px[i] !== cos.outlineLit) c.px[i] = cos.flash;
  }
  return c;
}

export function heroSheet(cos: HeroCostume): SpriteSheet {
  const frames: Raster[] = heroPoses().map((p) => drawHero(cos, p).toRaster());
  return {
    raster: sheetOf(frames),
    frameWidth: HERO_W,
    frameHeight: HERO_H,
    animations: HERO_ANIMS,
    hitbox: { x: 11, y: 12, w: 10, h: 20 },
    anchor: { x: 16, y: 31 },
  };
}
