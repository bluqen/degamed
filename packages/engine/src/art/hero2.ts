/**
 * Big heroes (round 2): about 34 px tall in a 48×48 frame. Every body pose is a hand-drawn grid:
 * cloaks (stand, run, air, fall, crouch, dash, skid) and legs (stand, the four run keys
 * contact → down → passing → up, jump, tuck, fall, crouch, lunge, dash, skid). Each animation
 * frame is keyed by hand from those parts (which cloak, which legs, body bob, head lag, scarf
 * angle). The second half of the run swaps the near and far leg. Costumes supply a hand-drawn
 * head (with blink and hurt faces) and ramps; rim light, shade and selective outline passes then
 * finish the sprite. The scarf, hair or plume is a chain whose angle is keyed per frame, so it
 * lags and streams behind the body.
 *
 * Grid letters: K k c C cloak (darkest → light), a hand, l/L far/near leg, b/B far/near boot.
 * Markers: @ neck (head sits on it), + hip (legs hang from it; drawn as cloak), % scarf root
 * (drawn as cloak), & hand (drawn as hand; weapons start here).
 */
import { Ix, type Palette } from './core';
import { sheetOf, type Raster } from '../pixel';
import type { SpriteSheet } from './types';

export const BIG_W = 48;
export const BIG_H = 48;
const GROUND = 46;

// ── Cloaks ──────────────────────────────────────────────────────────────────

const CLOAK = {
  stand: [
    '........@.........',
    '.......kcCC.......',
    '......kkccCC......',
    '.....%kcccCCC.....',
    '.....kkccccCC.....',
    '.....kcccccCCC....',
    '....kkcccccCCC....',
    '....kcccccccCC&...',
    '....kccc+ccccCC...',
    '...kkccccccccCC...',
    '...kcccccccccCCC..',
    '..kkccccccccccCC..',
    '..kkkkcccccckkkk..',
    '....kk.kkkk.kk....',
  ],
  breathe: [
    '..................',
    '........@.........',
    '.......kcCC.......',
    '......kkccCC......',
    '.....%kcccCCC.....',
    '.....kkccccCCC....',
    '....kkcccccCCC....',
    '....kcccccccCC&...',
    '....kccc+ccccCC...',
    '...kkcccccccccC...',
    '...kcccccccccCCC..',
    '..kkcccccccccCCC..',
    '..kkkkcccccckkkk..',
    '....kk.kkkk.kk....',
  ],
  runA: [
    '..........@.......',
    '.........kcCC.....',
    '........kkccCC....',
    '.......%kcccCC....',
    '.......kccccCCC...',
    '......kkccccCCC&..',
    '......kcccccCCC...',
    '.....kkccccccCC...',
    '....kkcccc+ccCC...',
    '...kkcccccccccC...',
    '..kkcccccccccCC...',
    '.kkkcccccccccC....',
    'kkkkkkcccckkkk....',
    '.kk..kkk.kk.......',
  ],
  runB: [
    '..........@.......',
    '.........kcCC.....',
    '........kkccCC....',
    '.......%kcccCC....',
    '.......kccccCCC...',
    '......kkccccCCC&..',
    '.....kkcccccCCC...',
    '....kkcccccccCC...',
    '...kkccccc+ccCC...',
    '..kkcccccccccCC...',
    '.kkccccccccccC....',
    'kkkkcccccccckk....',
    'kk.kkkkcckkk......',
    'k....kk..k........',
  ],
  air: [
    '........@.........',
    '.......kcC........',
    '......kkcCC.......',
    '......%ccCC.......',
    '......kccCC.......',
    '......kcccCC......',
    '......kcccCC&.....',
    '.....kkcccCC......',
    '.....kcc+cCC......',
    '.....kccccCC......',
    '.....kccccCC......',
    '.....kkcccCC......',
    '......kkckkk......',
    '......k.kk.k......',
  ],
  fall: [
    '........@.........',
    '.......kcCC.......',
    '......kkccCC......',
    '.....%kcccCCC.....',
    '....kkccccCCCC....',
    '...kkcccccccCCC...',
    '..kkccccccccCCCC..',
    '.kkcccccc+cccCCC&.',
    'kkkkcccccccccckkk.',
    'kk.kkkkcccckkk.kk.',
    'k....kk.kk.kk...k.',
  ],
  crouch: [
    '........@.........',
    '......kkcCC.......',
    '.....kkccCCC......',
    '....%kccccCCC.....',
    '....kkcccccCCC....',
    '...kkcccccccCC&...',
    '..kkccccc+ccCCC...',
    '..kcccccccccCCC...',
    '.kkcccccccccccCC..',
    '.kkkkcccccccckkkk.',
    '...kk.kkkkk.kk....',
  ],
  dash: [
    '...........@......',
    '........kkcCC.....',
    '......kkkccCCC....',
    '....%kkcccccCCC&..',
    '..kkkcccccccCCC...',
    'kkkccccc+cccCC....',
    'kkkkccccccccC.....',
    '.kk.kkkkkkkk......',
  ],
  skid: [
    '.......@..........',
    '......kcCC........',
    '.....kkccCC.......',
    '.....%cccCCC......',
    '.....kccccCCC.....',
    '.....kcccccCCC....',
    '....kkc+ccccCCC...',
    '....kccccccccCCC..',
    '....kkcccccccccCC.',
    '.....kkkkccckkkkkk',
    '......kk.kk.kk..k.',
  ],
} as const;

// ── Legs (hip at row 0, col 6; grounded poses touch row 9) ──────────────────

const LEGS = {
  stand: [
    '....lll.LLL...',
    '....lll.LLL...',
    '....ll...LL...',
    '....ll...LL...',
    '....ll...LL...',
    '....ll...LL...',
    '....ll...LL...',
    '....ll...LL...',
    '...bbbb.BBBB..',
    '...bbbb.BBBB..',
  ],
  // run keys, near (L) leg leading
  contact: [
    '....lllLLL....',
    '...lll..LLL...',
    '...ll....LLL..',
    '..ll......LL..',
    '..ll.......LL.',
    '.ll........LL.',
    '.ll........LL.',
    'll.........LL.',
    'bb........BBBB',
    'b.........BBBB',
  ],
  down: [
    '...lllLLL.....',
    '..lll..LLL....',
    '.lll....LL....',
    'lll.....LLL...',
    'bbb......LL...',
    'bb.......LL...',
    '.........LL...',
    '........LL....',
    '........BBBB..',
    '........BBBB..',
  ],
  passing: [
    '....LLLlll....',
    '....LL.llll...',
    '....LL..lll...',
    '....LL...ll...',
    '....LL..ll....',
    '....LL.bbb....',
    '....LL.bb.....',
    '....LL........',
    '...BBBB.......',
    '...BBBB.......',
  ],
  up: [
    '....LLLlll....',
    '...LLL..lll...',
    '..LLL....lll..',
    '.LL.......ll..',
    '.LL........ll.',
    'LL.........bb.',
    'LL.........bbb',
    'BB............',
    'BB............',
    '..............',
  ],
  jump: [
    '....lllLLL....',
    '....ll.LLL....',
    '....ll..LL....',
    '....ll..LL....',
    '....ll..LL....',
    '....ll..LL....',
    '....ll..LL....',
    '....bb..BB....',
    '.....b...B....',
    '..............',
  ],
  tuck: [
    '...lllLLLL....',
    '..lll..LLLL...',
    '..ll....LLLL..',
    '..ll......LL..',
    '..bbb....LL...',
    '...bb...BBB...',
    '........BB....',
    '..............',
    '..............',
    '..............',
  ],
  fall: [
    '....lllLLL....',
    '...lll..LLL...',
    '..lll....LL...',
    '..ll.....LL...',
    '..ll......LL..',
    '..ll......LL..',
    '.bbb......BBB.',
    '.bb........BBB',
    '..............',
    '..............',
  ],
  crouch: [
    '..lllllLLLLL..',
    '.lll......LLL.',
    '.ll........LL.',
    '..ll......LL..',
    '..bbbb...BBBB.',
    '..bbbb...BBBB.',
  ],
  lunge: [
    '....lllLLL....',
    '...lll..LLL...',
    '..lll....LLL..',
    '.lll.......LL.',
    '.ll........LL.',
    'll.........LL.',
    'll.........LL.',
    'll.........LL.',
    'bbb.......BBBB',
    'bbb.......BBBB',
  ],
  dash: [
    '......LLLlll..',
    '...LLLL...ll..',
    'BBLLL......ll.',
    'BB.........bbb',
    '............b.',
  ],
  skid: [
    '...lllLLL.....',
    '....lll.LLL...',
    '.....ll..LLL..',
    '.....ll...LLL.',
    '.....ll....LL.',
    '.....ll.....LL',
    '.....ll.....LL',
    '.....ll.....LL',
    '....bbbb...BBB',
    '....bbbb...BBB',
  ],
} as const;

type CloakKey = keyof typeof CLOAK;
type LegKey = keyof typeof LEGS;

/** Swaps near and far leg (the second half of a run cycle). */
function swapLegs(rows: readonly string[]): string[] {
  const m: Record<string, string> = { l: 'L', L: 'l', b: 'B', B: 'b' };
  return rows.map((r) => r.replace(/[lLbB]/g, (ch) => m[ch]!));
}

function find(rows: readonly string[], ch: string): [number, number] | null {
  for (let y = 0; y < rows.length; y++) {
    const x = rows[y]!.indexOf(ch);
    if (x >= 0) return [x, y];
  }
  return null;
}

// ── Costume ─────────────────────────────────────────────────────────────────

export interface BigCostume {
  pal: Palette;
  outline: number;
  outlineLit: number;
  /** dark → light, 4 entries: K k c C. */
  cloak: number[];
  legs: [number, number];
  boots: [number, number];
  hand: number;
  scarf: number[];
  weapon: number[];
  slash: number[];
  flash: number;
  head: { rows: string[]; map: Record<string, number>; anchorX: number };
  blink?: Record<number, string>;
  hurtFace?: Record<number, string>;
  /** Extra head colours that catch rim light (metal helms). */
  headRim?: number[];
  scarfLen: number;
  scarfWidth: number;
  /** Offset of the chain root from the % marker. */
  scarfAt?: [number, number];
  /** Root the chain at the top of the head instead of the cloak (hair, plume). */
  chainFromHead?: [number, number];
  tail?: { ramp: number[]; len: number };
  /** Weapon length in pixels. */
  weaponLen?: number;
}

/** One hand-keyed animation frame. */
export interface BigKey {
  cloak: CloakKey;
  legs: LegKey;
  swap?: boolean;
  /** Hip offset from the standing position (+y down). */
  hx?: number;
  hy?: number;
  /** Extra offset of cloak + head (breathing, lean). */
  bx?: number;
  by?: number;
  /** Extra head offset (lag, nod). */
  headX?: number;
  headY?: number;
  /** Scarf: root angle (radians, π = straight back), wave amount, phase. */
  scarf: [number, number, number];
  weapon?: { ang: number; len?: number };
  slash?: 1 | 2;
  blink?: boolean;
  hurt?: boolean;
  flash?: boolean;
  /** Speed lines behind the body (dash). */
  streak?: boolean;
}

const B = Math.PI;

/** The hand-keyed frames, in sheet order. */
export const BIG_KEYS: BigKey[] = [
  // 0..4 idle: breathe in, hold, out, hold, blink
  { cloak: 'stand', legs: 'stand', scarf: [B * 0.8, 0.25, 0] },
  { cloak: 'stand', legs: 'stand', scarf: [B * 0.79, 0.25, 1.2] },
  { cloak: 'breathe', legs: 'stand', headY: 1, scarf: [B * 0.76, 0.25, 2.4] },
  { cloak: 'breathe', legs: 'stand', headY: 1, scarf: [B * 0.77, 0.25, 3.6] },
  { cloak: 'stand', legs: 'stand', blink: true, scarf: [B * 0.8, 0.25, 4.8] },
  // 5..12 run: contact, down, passing, up — then the other leg
  { cloak: 'runA', legs: 'contact', hx: 1, scarf: [B * 0.95, 0.5, 0] },
  { cloak: 'runB', legs: 'down', hx: 1, hy: 1, headY: 0, scarf: [B * 0.97, 0.55, 1.3] },
  { cloak: 'runA', legs: 'passing', hx: 1, headY: 1, scarf: [B * 0.96, 0.55, 2.6] },
  { cloak: 'runB', legs: 'up', hx: 1, hy: -2, headY: 1, scarf: [B * 0.93, 0.5, 3.9] },
  { cloak: 'runA', legs: 'contact', swap: true, hx: 1, scarf: [B * 0.95, 0.5, 5.2] },
  { cloak: 'runB', legs: 'down', swap: true, hx: 1, hy: 1, scarf: [B * 0.97, 0.55, 6.5] },
  { cloak: 'runA', legs: 'passing', swap: true, hx: 1, headY: 1, scarf: [B * 0.96, 0.55, 7.8] },
  { cloak: 'runB', legs: 'up', swap: true, hx: 1, hy: -2, headY: 1, scarf: [B * 0.93, 0.5, 9.1] },
  // 13..14 jump: stretch off the ground, then tuck
  { cloak: 'air', legs: 'jump', hy: -3, headY: 1, scarf: [B * 0.55, 0.2, 0.4] },
  { cloak: 'air', legs: 'tuck', hy: -4, scarf: [B * 0.66, 0.35, 1.6] },
  // 15..16 fall: cloak billows, scarf streams up
  { cloak: 'fall', legs: 'fall', hy: -4, headY: -1, scarf: [-B * 0.62, 0.4, 0] },
  { cloak: 'fall', legs: 'fall', swap: true, hy: -4, scarf: [-B * 0.66, 0.45, 2] },
  // 17 land: squash
  { cloak: 'crouch', legs: 'crouch', hy: 4, headY: 1, scarf: [B * 0.6, 0.3, 1] },
  // 18..21 attack: wind-up, strike, follow-through, recover
  { cloak: 'stand', legs: 'lunge', hx: -1, by: 1, headX: -1, weapon: { ang: -B * 0.85 }, scarf: [B * 0.7, 0.3, 0] },
  { cloak: 'runA', legs: 'lunge', hx: 2, weapon: { ang: -0.05 }, slash: 1, scarf: [B * 0.95, 0.5, 1] },
  { cloak: 'runA', legs: 'lunge', hx: 2, weapon: { ang: B * 0.22 }, slash: 2, scarf: [B * 0.9, 0.5, 2.2] },
  { cloak: 'stand', legs: 'lunge', hx: 1, weapon: { ang: B * 0.36 }, scarf: [B * 0.85, 0.4, 3.3] },
  // 22..23 hurt: flash, then recoil
  { cloak: 'skid', legs: 'skid', hx: -2, hy: -1, flash: true, hurt: true, scarf: [B * 0.2, 0.6, 0] },
  { cloak: 'skid', legs: 'skid', hx: -2, hurt: true, scarf: [B * 0.25, 0.6, 2] },
  // 24 crouch, 25 wall cling
  { cloak: 'crouch', legs: 'crouch', hy: 4, headY: 1, scarf: [B * 0.7, 0.25, 0] },
  { cloak: 'air', legs: 'tuck', hy: -2, bx: 1, scarf: [-B * 0.55, 0.3, 1] },
  // 26..28 dash: stretch forward, streaming cloak and scarf, speed lines
  { cloak: 'dash', legs: 'dash', hy: 2, hx: 1, headX: 1, streak: true, scarf: [B * 1.0, 0.15, 0] },
  { cloak: 'dash', legs: 'dash', swap: true, hy: 2, hx: 1, headX: 1, streak: true, scarf: [B * 1.0, 0.2, 1.5] },
  { cloak: 'runB', legs: 'contact', hx: 1, hy: 1, scarf: [B * 0.98, 0.4, 3] },
  // 29..30 turn: skid to a stop, then straighten up
  { cloak: 'skid', legs: 'skid', hx: -1, headX: -1, scarf: [B * 0.25, 0.4, 0] },
  { cloak: 'stand', legs: 'stand', scarf: [B * 0.45, 0.4, 1.5] },
];

export const BIG_ANIMS: SpriteSheet['animations'] = {
  idle: { frames: [0, 0, 1, 2, 3, 3, 2, 1, 0, 0, 4, 0], fps: 7, loop: true },
  run: { frames: [5, 6, 7, 8, 9, 10, 11, 12], fps: 14, loop: true },
  jump: { frames: [13, 14], fps: 10, loop: false },
  fall: { frames: [15, 16], fps: 8, loop: true },
  land: { frames: [17, 0], fps: 14, loop: false },
  attack: { frames: [18, 19, 20, 21], fps: 18, loop: false },
  hurt: { frames: [22, 23, 23], fps: 10, loop: false },
  crouch: { frames: [24], fps: 1, loop: false },
  wall: { frames: [25], fps: 1, loop: false },
  dash: { frames: [26, 27, 26, 27, 28], fps: 20, loop: false },
  turn: { frames: [29, 30], fps: 12, loop: false },
};

function chain(x: number, y: number, n: number, seg: number, s: [number, number, number]): [number, number][] {
  const [ang, wave, ph] = s;
  const pts: [number, number][] = [[x, y]];
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const a = ang + Math.sin(ph + i * 0.9) * wave * k + 0.15 * k * Math.sign(Math.cos(ang));
    const [px, py] = pts[i - 1]!;
    pts.push([px + Math.cos(a) * seg, py + Math.sin(a) * seg + k * 0.25]);
  }
  return pts;
}

export function drawBigHero(cos: BigCostume, key: BigKey): Ix {
  const c = new Ix(BIG_W, BIG_H, cos.pal);
  const [K, k, cc, C] = cos.cloak as [number, number, number, number];
  const cloakMap: Record<string, number> = { K, k, c: cc, C, '+': cc, '%': k, a: cos.hand, '&': cos.hand };
  const legMap: Record<string, number> = { l: cos.legs[0], L: cos.legs[1], b: cos.boots[0], B: cos.boots[1] };

  const cloak = CLOAK[key.cloak];
  const legs = key.swap ? swapLegs(LEGS[key.legs]) : [...LEGS[key.legs]];
  const hipX = 22 + (key.hx ?? 0);
  const hipY = GROUND - 9 + (key.hy ?? 0);
  const plus = find(cloak, '+')!;
  const at = find(cloak, '@')!;
  const pct = find(cloak, '%')!;
  const hand = find(cloak, '&');
  const cx = hipX - plus[0] + (key.bx ?? 0);
  const cy = hipY - plus[1] + (key.by ?? 0);

  const head = cos.head.rows.map((r, i) => (key.blink && cos.blink?.[i]) || (key.hurt && cos.hurtFace?.[i]) || r);
  const hx = cx + at[0] - cos.head.anchorX + (key.headX ?? 0);
  const hy = cy + at[1] - head.length + 2 + (key.headY ?? 0);

  // speed lines behind a dash
  if (key.streak) {
    for (const [dy, len] of [[-4, 8], [0, 12], [4, 7]] as const) for (let i = 0; i < len; i++) if (i % 3 !== 2) c.set(cx - 4 - i, cy + 4 + dy, cos.slash[0]!);
  }

  // tail, behind everything
  if (cos.tail) {
    const pts = chain(cx + plus[0] - 4, cy + plus[1] + 1, cos.tail.len, 1.4, [B * 0.92 - (key.cloak === 'fall' ? 0.9 : 0), key.scarf[1] * 0.7, key.scarf[2] + 1]);
    pts.forEach(([x, y], i) => {
      c.set(x, y, cos.tail!.ramp[1]!);
      if (i / pts.length < 0.6) c.set(x, y + 1, cos.tail!.ramp[0]!);
    });
  }

  // scarf / hair / plume chain, behind the body
  const root: [number, number] = cos.chainFromHead ? [hx + cos.chainFromHead[0], hy + cos.chainFromHead[1]] : [cx + pct[0] + (cos.scarfAt?.[0] ?? 0), cy + pct[1] + (cos.scarfAt?.[1] ?? 0)];
  const sp = chain(root[0], root[1], cos.scarfLen, 1.5, key.scarf);
  sp.forEach(([x, y], i) => {
    const t = i / sp.length;
    const w = t < 0.55 ? cos.scarfWidth : t < 0.85 ? Math.max(1, cos.scarfWidth - 1) : 1;
    const [px, py] = sp[Math.max(0, i - 1)]!;
    for (let q = 0; q < w; q++) {
      const col = q === 0 ? cos.scarf[2]! : q === w - 1 && w > 1 ? cos.scarf[0]! : cos.scarf[1]!;
      c.line(Math.round(px), Math.round(py) + q, Math.round(x), Math.round(y) + q, col);
    }
  });

  // legs, cloak, head
  c.grid(legs, legMap, hipX - 6, hipY);
  c.grid(cloak.map((r) => r.replace('@', '.')), cloakMap, cx, cy);
  c.grid(head, cos.head.map, hx, hy);
  // the head casts a soft shadow on the cloak
  for (let x = hx; x < hx + head[0]!.length; x++) {
    const y = hy + head.length;
    const v = c.get(x, y);
    if (v === cc || v === C) c.set(x, y, k);
  }

  // weapon from the hand
  if (key.weapon && hand) {
    const ax = cx + hand[0];
    const ay = cy + hand[1];
    const len = key.weapon.len ?? cos.weaponLen ?? 12;
    const ex = Math.round(ax + Math.cos(key.weapon.ang) * len);
    const ey = Math.round(ay + Math.sin(key.weapon.ang) * len);
    c.line(ax, ay + 1, ex, ey + 1, cos.weapon[0]!);
    c.line(ax, ay, ex, ey, cos.weapon[1]!);
    c.set(ex, ey, cos.weapon[2]!);
    c.set(Math.round((ax + ex) / 2), Math.round((ay + ey) / 2), cos.weapon[2]!);
    c.set(ax, ay, cos.hand);
  }

  // shading: rim light from the upper right, soft shadow lower left
  const soft = new Set([k, cc, C, ...cos.scarf, ...(cos.headRim ?? [])]);
  c.rim(1, -1, soft);
  c.shade(-1, 1, new Set([cc, C]));

  // slash arc after shading so it stays bright
  if (key.slash && hand) {
    const ox = cx + hand[0] - 2;
    const oy = cy + hand[1];
    const r = key.slash === 1 ? 15 : 16;
    const a0 = key.slash === 1 ? -1.3 : -0.25;
    const a1 = key.slash === 1 ? 1.15 : 1.3;
    for (let a = a0; a <= a1; a += 0.03) {
      const t = (a - a0) / (a1 - a0);
      const thick = key.slash === 1 ? Math.sin(t * Math.PI) * 4.4 : Math.sin(t * Math.PI) * 2.2;
      for (let q = 0; q < thick; q++) {
        const x = Math.round(ox + Math.cos(a) * (r - q));
        const y = Math.round(oy + Math.sin(a) * (r - q));
        c.set(x, y, q === 0 ? cos.slash[2]! : q < 2 ? cos.slash[1]! : cos.slash[0]!);
      }
    }
  }

  c.outline(cos.outline, cos.outlineLit);
  if (key.flash) for (let i = 0; i < c.px.length; i++) if (c.px[i] && c.px[i] !== cos.outline && c.px[i] !== cos.outlineLit) c.px[i] = cos.flash;
  return c;
}

export function bigHeroSheet(cos: BigCostume): SpriteSheet {
  const frames: Raster[] = BIG_KEYS.map((key) => drawBigHero(cos, key).toRaster());
  return {
    raster: sheetOf(frames),
    frameWidth: BIG_W,
    frameHeight: BIG_H,
    animations: BIG_ANIMS,
    // The body is about 34 px tall; the hitbox is a little smaller than the art (head and hem
    // overlap scenery a touch, as in most platformers) so it fits through 2-tile gaps.
    hitbox: { x: 17, y: 18, w: 13, h: 29 },
    anchor: { x: 23, y: 46 },
  };
}
