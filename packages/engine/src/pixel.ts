/**
 * Tiny pixel-art toolkit for starter templates: sprites written as character grids, plus
 * dithered sky and mountain backdrops. The starter art is meant to be replaced with
 * AI-generated assets from the Art Lab.
 */

/** Sweetie 16 palette by GrafxKid (CC0). */
export const SWEETIE16 = {
  ink: '#1A1C2C',
  plum: '#5D275D',
  red: '#B13E53',
  orange: '#EF7D57',
  gold: '#FFCD75',
  lime: '#A7F070',
  green: '#38B764',
  teal: '#257179',
  navy: '#29366F',
  blue: '#3B5DC9',
  sky: '#41A6F6',
  cyan: '#73EFF7',
  white: '#F4F4F4',
  silver: '#94B0C2',
  slate: '#566C86',
  shadow: '#333C57',
} as const;

export interface PixelGrid {
  rows: string[];
  /** Character → colour. '.' is always transparent. */
  colors: Record<string, string>;
}

export interface Raster {
  width: number;
  height: number;
  /** RGBA bytes. */
  data: Uint8ClampedArray;
}

function hexToRgba(hex: string): [number, number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

/** Validates a grid and converts it to RGBA. Throws on ragged rows or unknown characters. */
export function rasterize(grid: PixelGrid): Raster {
  const height = grid.rows.length;
  const width = grid.rows[0]?.length ?? 0;
  if (!height || !width) throw new Error('Empty pixel grid');
  const data = new Uint8ClampedArray(width * height * 4);
  grid.rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Row ${y} is ${row.length} wide, expected ${width}`);
    for (let x = 0; x < width; x++) {
      const ch = row[x]!;
      if (ch === '.') continue;
      const color = grid.colors[ch];
      if (!color) throw new Error(`Unknown pixel "${ch}" at ${x},${y}`);
      data.set(hexToRgba(color), (y * width + x) * 4);
    }
  });
  return { width, height, data };
}

/** Deterministic pseudo-random numbers so generated backdrops are the same every time. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * A banded vertical gradient, the classic pixel-art sky: solid bands with a short
 * ordered-dither transition between neighbours (`blend` = share of each band that dithers).
 */
export function ditheredSky(width: number, height: number, stops: string[], blend = 0.3): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  const colors = stops.map(hexToRgba);
  const bands = colors.length - 1;
  for (let y = 0; y < height; y++) {
    const t = (y / (height - 1)) * bands;
    const band = Math.min(bands - 1, Math.floor(t));
    const frac = Math.max(0, (t - band - (1 - blend)) / blend);
    for (let x = 0; x < width; x++) {
      const threshold = (BAYER4[(y % 4) * 4 + (x % 4)]! + 0.5) / 16;
      data.set(frac > threshold ? colors[band + 1]! : colors[band]!, (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/** A tileable mountain/hill silhouette layer with a lighter rim. Transparent above the ridge. */
export function ridgeLayer(
  width: number,
  height: number,
  opts: { base: number; amplitude: number; color: string; rim: string; seed: number; roughness?: number },
): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  const rand = mulberry32(opts.seed);
  // Sum of sines with integer frequencies so the left and right edges line up (tileable).
  const waves = Array.from({ length: 4 }, (_, i) => ({
    freq: (i + 1) * (1 + Math.floor(rand() * 2)),
    phase: rand() * Math.PI * 2,
    amp: opts.amplitude / (i + 1) ** (opts.roughness ?? 1.2),
  }));
  const fill = hexToRgba(opts.color);
  const rim = hexToRgba(opts.rim);
  for (let x = 0; x < width; x++) {
    const u = (x / width) * Math.PI * 2;
    const ridge = Math.round(height - opts.base - waves.reduce((s, w) => s + Math.sin(u * w.freq + w.phase) * w.amp, 0));
    for (let y = Math.max(0, ridge); y < height; y++) {
      data.set(y - ridge < 2 ? rim : fill, (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

const P = SWEETIE16;

export const SPRITES = {
  knight: {
    colors: { o: P.ink, h: P.silver, H: P.slate, w: P.white, v: P.cyan, r: P.red, b: P.blue, B: P.navy, y: P.gold },
    rows: [
      '................',
      '.....oooooo.....',
      '....ohhhhhho....',
      '...ohwhhhhhho...',
      '...ohhhhhhhho...',
      '...ohhoooooooo..',
      '...ohhovvvvvvo..',
      '...oHhoooooooo..',
      '....oHHHHHHHo...',
      '...orrrrrrro....',
      '..orrbbbbbbro...',
      '..oorbbbbbbboy..',
      '....obbBBbbbo...',
      '....oBBooBBo....',
      '....oBo..oBo....',
      '....ooo..ooo....',
    ],
  },
  slime: {
    colors: { o: P.ink, g: P.green, G: P.teal, l: P.lime, w: P.white },
    rows: [
      '................',
      '................',
      '................',
      '................',
      '......oooo......',
      '....oollllgo....',
      '...olwwlgggggo..',
      '..olwlggggggggo.',
      '..oggggggggggggo',
      '.oggowggggowgggo',
      '.oggooggggooggGo',
      '.ogggggggggggGGo',
      '.oGgggggggggGGGo',
      '.oGGGGGGGGGGGGGo',
      '..oooooooooooooo',
      '................',
    ],
  },
  coin: {
    colors: { o: P.ink, y: P.gold, Y: P.orange, w: P.white },
    rows: [
      '...oooo...',
      '..oyyyyo..',
      '.oywwyyYo.',
      'oywyyyyYYo',
      'oyyyYYyYYo',
      'oyyyYYyYYo',
      'oyyyyyyYYo',
      '.oyyyyYYo.',
      '..oYYYYo..',
      '...oooo...',
    ],
  },
  flag: {
    colors: { o: P.ink, s: P.silver, r: P.red, R: P.plum, y: P.gold },
    rows: [
      '.oy.........',
      '.os.oooooo..',
      '.osorrrrrro.',
      '.osorrrrrrro',
      '.osoRrrrrro.',
      '.osoRRRRRo..',
      '.osooooo....',
      '.os.........',
      '.os.........',
      '.os.........',
      '.os.........',
      '.os.........',
      '.os.........',
      '.os.........',
      'oooo........',
      'ossso.......',
    ],
  },
  grass: {
    colors: { o: P.ink, l: P.lime, g: P.green, G: P.teal, d: P.plum, D: P.red, k: P.orange },
    rows: [
      'llgllllgllllglll',
      'glggllgggllggglg',
      'gggGgggGgggGgggG',
      'GGoGGGoGGGGoGGGo',
      'dddDddddDdddddDd',
      'ddddddkdddddDddd',
      'dDddddddddddddkd',
      'ddddDdddddDddddd',
      'dddddddkdddddddD',
      'ddkdddddddDddddd',
      'ddddddDdddddddkd',
      'dDddddddddddDddd',
      'ddddkdddddddddDd',
      'dddddddDddkddddd',
      'ddDdddddddddDddd',
      'DddddkdddddddddD',
    ],
  },
  dirt: {
    colors: { d: P.plum, D: P.red, k: P.orange },
    rows: [
      'dddDddddDdddddDd',
      'ddddddkdddddDddd',
      'dDddddddddddddkd',
      'ddddDdddddDddddd',
      'dddddddkdddddddD',
      'ddkdddddddDddddd',
      'ddddddDdddddddkd',
      'dDddddddddddDddd',
      'ddddkdddddddddDd',
      'dddddddDddkddddd',
      'ddDdddddddddDddd',
      'DddddkdddddddddD',
      'dddDddddDdddddDd',
      'ddddddkdddddDddd',
      'dDddddddddddddkd',
      'ddddDdddddDddddd',
    ],
  },
  cloud: {
    colors: { w: P.white, s: P.silver },
    rows: [
      '.......wwww...........',
      '.....wwwwwwww.........',
      '...wwwwwwwwwwww.wwww..',
      '..wwwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwww',
      'sswwwwwwwwwwwwwwwwwwss',
      '..ssssswwwwwwwsssss...',
      '.......ssssssss.......',
    ],
  },
} satisfies Record<string, PixelGrid>;

// ── Frame helpers: build animation frames from a base grid ──────────────────

/** Returns a copy of `grid` with some rows replaced (by row index). */
export function withRows(grid: PixelGrid, replacements: Record<number, string>): PixelGrid {
  return { colors: grid.colors, rows: grid.rows.map((row, i) => replacements[i] ?? row) };
}

/** Moves rows 0…`through` down (dy > 0) or up (dy < 0); rows below `through` stay put. */
export function bob(grid: PixelGrid, dy: number, through: number): PixelGrid {
  const blank = '.'.repeat(grid.rows[0]!.length);
  const rows = grid.rows.map((row, i) => {
    if (i > through) return row;
    const src = i - dy;
    if (src < 0) return blank;
    return grid.rows[Math.min(src, through)] ?? blank;
  });
  return { colors: grid.colors, rows };
}

/** Drops row `remove` and adds a blank row on top: a squashed version of the sprite. */
export function squashAt(grid: PixelGrid, remove: number): PixelGrid {
  const blank = '.'.repeat(grid.rows[0]!.length);
  return { colors: grid.colors, rows: [blank, ...grid.rows.filter((_, i) => i !== remove)] };
}

/** Horizontally squeezes a grid to `width` columns (nearest sample), centred in the original width. */
export function squeezeX(grid: PixelGrid, width: number): PixelGrid {
  const full = grid.rows[0]!.length;
  const left = Math.floor((full - width) / 2);
  const rows = grid.rows.map((row) => {
    let out = '';
    for (let x = 0; x < full; x++) {
      const local = x - left;
      out += local >= 0 && local < width ? row[Math.floor(((local + 0.5) * full) / width)]! : '.';
    }
    return out;
  });
  return { colors: grid.colors, rows };
}

/** Lays equally sized frames out left to right in one sprite sheet. */
export function sheetOf(frames: Raster[]): Raster {
  const fw = frames[0]!.width;
  const fh = frames[0]!.height;
  if (frames.some((f) => f.width !== fw || f.height !== fh)) throw new Error('All frames must be the same size');
  const width = fw * frames.length;
  const data = new Uint8ClampedArray(width * fh * 4);
  frames.forEach((f, i) => {
    for (let y = 0; y < fh; y++) data.set(f.data.subarray(y * fw * 4, (y + 1) * fw * 4), (y * width + i * fw) * 4);
  });
  return { width, height: fh, data };
}

const KNIGHT = SPRITES.knight;

/** Starter animation frames, in sheet order. */
export const KNIGHT_FRAMES: PixelGrid[] = [
  KNIGHT, // 0 idle
  bob(KNIGHT, 1, 12), // 1 idle (breath)
  withRows(KNIGHT, { 14: '...oBo....oBo...', 15: '..ooo.....ooo...' }), // 2 run: stride
  bob(withRows(KNIGHT, { 13: '.....oBBBBo.....', 14: '.....oBooBo.....', 15: '.....oo..oo.....' }), -1, 12), // 3 run: passing
  withRows(KNIGHT, { 14: '....oBo...oBo...', 15: '...ooo....ooo...' }), // 4 run: other stride
  withRows(KNIGHT, { 13: '....oBBBBBBo....', 14: '....oBBooBBo....', 15: '.....oo..oo.....' }), // 5 jump: tucked
  withRows(KNIGHT, { 13: '...oBBo..oBBo...', 14: '..oBo......oBo..', 15: '..oo........oo..' }), // 6 fall: legs apart
];

export const SLIME_FRAMES: PixelGrid[] = [SPRITES.slime, squashAt(SPRITES.slime, 4)];

export const COIN_FRAMES: PixelGrid[] = [SPRITES.coin, squeezeX(SPRITES.coin, 6), squeezeX(SPRITES.coin, 2), squeezeX(SPRITES.coin, 6)];
