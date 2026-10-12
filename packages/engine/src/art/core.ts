/**
 * Core drawing toolkit for the procedural art themes. Pure TypeScript, no DOM, so it runs in
 * Node (tests, previews) and in the browser.
 *
 * - colour helpers with hue-shifted ramps (shadows lean cool, highlights lean warm)
 * - seeded, optionally periodic value noise (so tiles and parallax layers wrap seamlessly)
 * - `Canvas`: an RGBA surface with alpha blending and an optional horizontal wrap
 * - `Ix`: an indexed sprite surface whose colours live on ramps, so shading passes step along a
 *   ramp (proper pixel-art shading) instead of blending to mud
 * - `MatLayer`: a material map for silhouettes; painted later with texture, rim light and fog
 */
import type { Raster } from '../pixel';

// ── Colour ──────────────────────────────────────────────────────────────────

export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];

const hexCache = new Map<string, RGB>();
export function rgb(hex: string): RGB {
  let c = hexCache.get(hex);
  if (!c) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.replace(/./g, (m) => m + m);
    const n = parseInt(h.slice(0, 6), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    hexCache.set(hex, c);
  }
  return c;
}

export function hex(c: readonly number[]): string {
  return '#' + c.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

export function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function toHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function fromHsl(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function hueToward(h: number, target: number, amt: number): number {
  let d = ((target - h + 540) % 360) - 180;
  return h + d * amt;
}

/**
 * A hue-shifted ramp from dark to light around `base`. Shadows rotate toward cool blue-violet and
 * lose a little saturation; highlights rotate toward warm yellow. This is the classic
 * pixel-art ramp, not a plain brightness step.
 */
export function ramp(
  base: string,
  steps: number,
  o: { dark?: number; light?: number; shift?: number; satBoost?: number; coolHue?: number; warmHue?: number } = {},
): string[] {
  const [h, s, l] = toHsl(rgb(base));
  const dark = o.dark ?? 0.12;
  const light = o.light ?? Math.min(0.92, l + 0.32);
  const shift = o.shift ?? 0.22;
  const out: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0.5 : i / (steps - 1);
    const lt = t < 0.5 ? dark + (l - dark) * (t / 0.5) : l + (light - l) * ((t - 0.5) / 0.5);
    const hh = t < 0.5 ? hueToward(h, o.coolHue ?? 245, shift * (1 - t / 0.5)) : hueToward(h, o.warmHue ?? 55, shift * ((t - 0.5) / 0.5));
    const ss = Math.min(1, s * (0.75 + 0.5 * Math.sin(t * Math.PI)) * (o.satBoost ?? 1));
    out.push(hex(fromHsl(hh, ss, lt)));
  }
  return out;
}

export function luminance(c: RGB): number {
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
}

// ── Noise ───────────────────────────────────────────────────────────────────

export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a: number, b: number) => a + (b - a) * next(),
    int: (a: number, b: number) => Math.floor(a + (b - a + 1) * next()),
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!,
    chance: (p: number) => next() < p,
  };
}
export type Rng = ReturnType<typeof rng>;

const smooth = (t: number) => t * t * (3 - 2 * t);
const wrap = (i: number, p: number) => (p > 0 ? ((i % p) + p) % p : i);

/** Value noise in lattice units. `px`/`py` are periods in lattice cells (0 = no wrap). */
export function noise2(u: number, v: number, px: number, py: number, seed: number): number {
  const iu = Math.floor(u);
  const iv = Math.floor(v);
  const fu = smooth(u - iu);
  const fv = smooth(v - iv);
  const x0 = wrap(iu, px);
  const x1 = wrap(iu + 1, px);
  const y0 = wrap(iv, py);
  const y1 = wrap(iv + 1, py);
  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);
  return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
}

/**
 * Fractal noise over a surface of size w×h. `cells` is the number of lattice cells across the
 * width at the first octave. With `wrapX`/`wrapY` the result tiles seamlessly.
 */
export function fbm(
  x: number,
  y: number,
  o: { w: number; h: number; cells: number; octaves?: number; seed: number; wrapX?: boolean; wrapY?: boolean; aspect?: number },
): number {
  const oct = o.octaves ?? 4;
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let cells = o.cells;
  const ar = o.aspect ?? 1;
  for (let i = 0; i < oct; i++) {
    const cx = cells;
    const cy = Math.max(1, Math.round((cells * o.h * ar) / o.w));
    sum += amp * noise2((x / o.w) * cx, (y / o.h) * cy, o.wrapX ? cx : 0, o.wrapY ? cy : 0, o.seed + i * 131);
    norm += amp;
    amp *= 0.5;
    cells *= 2;
  }
  return sum / norm;
}

export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number) => (BAYER4[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)]! + 0.5) / 16;

// ── RGBA canvas ─────────────────────────────────────────────────────────────

export class Canvas {
  readonly data: Uint8ClampedArray;
  wrapX = false;
  constructor(
    readonly w: number,
    readonly h: number,
    fill?: string,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
    if (fill) this.fillRect(0, 0, w, h, fill);
  }

  static from(r: Raster): Canvas {
    const c = new Canvas(r.width, r.height);
    c.data.set(r.data);
    return c;
  }

  private ix(x: number, y: number): number {
    x = Math.floor(x);
    y = Math.floor(y);
    if (this.wrapX) x = ((x % this.w) + this.w) % this.w;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return (y * this.w + x) * 4;
  }

  get(x: number, y: number): RGBA {
    const i = this.ix(x, y);
    if (i < 0) return [0, 0, 0, 0];
    const d = this.data;
    return [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!];
  }

  alpha(x: number, y: number): number {
    const i = this.ix(x, y);
    return i < 0 ? 0 : this.data[i + 3]!;
  }

  /** Paints `color` over the pixel with opacity `a` (source-over). */
  set(x: number, y: number, color: string | RGB, a = 1): void {
    const i = this.ix(x, y);
    if (i < 0 || a <= 0) return;
    const c = typeof color === 'string' ? rgb(color) : color;
    this.blendAt(i, c[0], c[1], c[2], a);
  }

  /** Adds light: dst + color * a. */
  add(x: number, y: number, color: string | RGB, a = 1): void {
    const i = this.ix(x, y);
    if (i < 0 || a <= 0) return;
    const c = typeof color === 'string' ? rgb(color) : color;
    const d = this.data;
    d[i] = d[i]! + c[0] * a;
    d[i + 1] = d[i + 1]! + c[1] * a;
    d[i + 2] = d[i + 2]! + c[2] * a;
    if (d[i + 3] === 0) d[i + 3] = Math.min(255, 255 * a);
  }

  private blendAt(i: number, r: number, g: number, b: number, a: number): void {
    const d = this.data;
    a = Math.min(1, a);
    const da = d[i + 3]! / 255;
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    d[i] = (r * a + d[i]! * da * (1 - a)) / oa;
    d[i + 1] = (g * a + d[i + 1]! * da * (1 - a)) / oa;
    d[i + 2] = (b * a + d[i + 2]! * da * (1 - a)) / oa;
    d[i + 3] = oa * 255;
  }

  clear(x: number, y: number): void {
    const i = this.ix(x, y);
    if (i >= 0) this.data.fill(0, i, i + 4);
  }

  fillRect(x: number, y: number, w: number, h: number, color: string, a = 1): void {
    for (let yy = Math.floor(y); yy < y + h; yy++) for (let xx = Math.floor(x); xx < x + w; xx++) this.set(xx, yy, color, a);
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string, a = 1, thick = 1): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    const seen = new Set<number>();
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      for (let t = 0; t < thick; t++)
        for (let s = 0; s < thick; s++) {
          const k = (y + s) * 100003 + (x + t);
          if (seen.has(k)) continue;
          seen.add(k);
          this.set(x + t, y + s, color, a);
        }
    }
  }

  disc(cx: number, cy: number, r: number, color: string, a = 1): void {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, color, a);
  }

  /** Soft radial glow (additive), for lamps and halos. */
  glow(cx: number, cy: number, r: number, color: string, a = 1): void {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
        if (d < 1) this.add(x, y, color, a * (1 - d) ** 2);
      }
  }

  poly(pts: [number, number][], color: string, a = 1): void {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys));
    const y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i]!;
        const [bx, by] = pts[(i + 1) % pts.length]!;
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.round(xs[k]!); x < Math.round(xs[k + 1]!); x++) this.set(x, y, color, a);
    }
  }

  /** Draws another raster on top (alpha aware). */
  blit(src: Raster | Canvas, dx: number, dy: number, o: { flipX?: boolean; alpha?: number; sx?: number; sy?: number; sw?: number; sh?: number; tint?: string; tintAmt?: number } = {}): void {
    const sw = o.sw ?? ('w' in src ? src.w : src.width);
    const sh = o.sh ?? ('h' in src ? src.h : src.height);
    const srcW = 'w' in src ? src.w : src.width;
    const sx0 = o.sx ?? 0;
    const sy0 = o.sy ?? 0;
    const tint = o.tint ? rgb(o.tint) : null;
    const ta = o.tintAmt ?? 0;
    const d = src.data;
    dx = Math.round(dx);
    dy = Math.round(dy);
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        const sx = sx0 + (o.flipX ? sw - 1 - x : x);
        const i = ((sy0 + y) * srcW + sx) * 4;
        const a = (d[i + 3]! / 255) * (o.alpha ?? 1);
        if (a <= 0) continue;
        let c: RGB = [d[i]!, d[i + 1]!, d[i + 2]!];
        if (tint) c = mixRGB(c, tint, ta);
        this.set(dx + x, dy + y, c, a);
      }
  }

  toRaster(): Raster {
    return { width: this.w, height: this.h, data: new Uint8ClampedArray(this.data) };
  }
}

// ── Indexed sprite surface with ramps ───────────────────────────────────────

/** A palette made of ramps. Every entry knows its lighter and darker neighbour on its ramp. */
export class Palette {
  readonly colors: string[] = ['#000000'];
  readonly up: number[] = [0];
  readonly down: number[] = [0];
  readonly rampOf: number[] = [-1];
  private rampCount = 0;

  /** Adds a dark → light ramp and returns its palette indices. */
  ramp(colors: string[]): number[] {
    const ids = colors.map((c) => {
      this.colors.push(c);
      this.rampOf.push(this.rampCount);
      return this.colors.length - 1;
    });
    ids.forEach((id, i) => {
      this.up[id] = ids[Math.min(ids.length - 1, i + 1)]!;
      this.down[id] = ids[Math.max(0, i - 1)]!;
    });
    this.rampCount++;
    return ids;
  }
}

/** Indexed canvas: 0 is transparent; other values are palette indices. */
export class Ix {
  readonly px: Uint8Array;
  constructor(
    readonly w: number,
    readonly h: number,
    readonly pal: Palette,
  ) {
    this.px = new Uint8Array(w * h);
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.px[y * this.w + x]!;
  }
  set(x: number, y: number, c: number): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: number): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number, thick = 1): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      for (let t = 0; t < thick; t++) for (let s = 0; s < thick; s++) this.set(x + t, y + s, c);
    }
  }
  disc(cx: number, cy: number, r: number, c: number): void {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, c);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number | ((x: number, y: number, nx: number, ny: number) => number)): void {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.set(x, y, typeof c === 'number' ? c : c(x, y, nx, ny));
      }
  }
  poly(pts: [number, number][], c: number | ((x: number, y: number) => number)): void {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys));
    const y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i]!;
        const [bx, by] = pts[(i + 1) % pts.length]!;
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.round(xs[k]!); x < Math.round(xs[k + 1]!); x++) this.set(x, y, typeof c === 'number' ? c : c(x, y));
    }
  }
  /** Stamps a character grid. `map` maps characters to palette indices; '.' is skipped. */
  grid(rows: readonly string[], map: Record<string, number>, x: number, y: number, flipX = false): void {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[flipX ? row.length - 1 - i : i]!;
        if (ch === '.' || ch === ' ') continue;
        const c = map[ch];
        if (c === undefined) throw new Error(`Unknown sprite char "${ch}"`);
        this.set(x + i, y + j, c);
      }
    });
  }
  /** Copies non-transparent pixels from another Ix (same palette). */
  stamp(src: Ix, dx: number, dy: number, flipX = false): void {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.get(flipX ? src.w - 1 - x : x, y);
        if (c) this.set(dx + x, dy + y, c);
      }
  }
  clone(): Ix {
    const c = new Ix(this.w, this.h, this.pal);
    c.px.set(this.px);
    return c;
  }
  /**
   * Rim light: opaque pixels whose neighbour in direction (dx,dy) is empty step one notch up their
   * ramp. `only` limits the pass to some palette indices.
   */
  rim(dx: number, dy: number, only?: Set<number>, steps = 1): void {
    const src = this.px.slice();
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        let c = src[y * this.w + x]!;
        if (!c || (only && !only.has(c))) continue;
        const nx = x + dx;
        const ny = y + dy;
        const empty = nx < 0 || ny < 0 || nx >= this.w || ny >= this.h || !src[ny * this.w + nx];
        if (empty) {
          for (let s = 0; s < steps; s++) c = this.pal.up[c]!;
          this.px[y * this.w + x] = c;
        }
      }
  }
  /** Shadow: opaque pixels whose neighbour in direction (dx,dy) is empty step down their ramp. */
  shade(dx: number, dy: number, only?: Set<number>): void {
    const src = this.px.slice();
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = src[y * this.w + x]!;
        if (!c || (only && !only.has(c))) continue;
        const nx = x + dx;
        const ny = y + dy;
        const empty = nx < 0 || ny < 0 || nx >= this.w || ny >= this.h || !src[ny * this.w + nx];
        if (empty) this.px[y * this.w + x] = this.pal.down[c]!;
      }
  }
  /**
   * Selective outline: every empty pixel touching the sprite gets an outline colour. Pixels on the
   * lit top side get `lit` (a softer line), the rest get `dark`. Corners are skipped for a rounder,
   * hand-drawn look unless `corners` is set.
   */
  outline(dark: number, lit = dark, corners = false): void {
    const src = this.px.slice();
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : src[y * this.w + x]!);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x]) continue;
        const below = at(x, y + 1);
        const any = below || at(x, y - 1) || at(x - 1, y) || at(x + 1, y) || (corners && (at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1)));
        if (!any) continue;
        this.px[y * this.w + x] = below && !at(x, y - 1) ? lit : dark;
      }
  }
  /** Replaces every opaque pixel with one colour (hurt flash, silhouettes). */
  flood(c: number): void {
    for (let i = 0; i < this.px.length; i++) if (this.px[i]) this.px[i] = c;
  }
  toRaster(alphaOf?: (index: number) => number): Raster {
    const data = new Uint8ClampedArray(this.w * this.h * 4);
    for (let i = 0; i < this.px.length; i++) {
      const c = this.px[i]!;
      if (!c) continue;
      const [r, g, b] = rgb(this.pal.colors[c]!);
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = alphaOf ? alphaOf(c) : 255;
    }
    return { width: this.w, height: this.h, data };
  }
}

// ── Material layers for silhouettes ─────────────────────────────────────────

export interface Material {
  /** Base colour, and optional darker/lighter variants chosen by texture noise. */
  base: string;
  dark?: string;
  light?: string;
  /** Rim light on edges facing the light (top by default). */
  rim?: string;
  rimDir?: [number, number];
  rimWidth?: number;
  /** Texture noise cells across the layer width; higher = finer. */
  grain?: number;
  /** Threshold for dark/light variants. */
  darkAt?: number;
  lightAt?: number;
  /** Ordered dither in the transition band instead of hard steps. */
  dither?: boolean;
  alpha?: number;
  /** Fades toward `fadeTo` near the bottom of the layer (atmospheric base fog). */
  fadeTo?: string;
  fadeFrom?: number;
  fadeAmt?: number;
}

/** A per-pixel material map. Drawing writes material ids; `paint` turns it into colour. */
export class MatLayer {
  readonly m: Uint8Array;
  constructor(
    readonly w: number,
    readonly h: number,
    readonly wrapX = true,
  ) {
    this.m = new Uint8Array(w * h);
  }
  private i(x: number, y: number): number {
    x = Math.round(x);
    y = Math.round(y);
    if (this.wrapX) x = ((x % this.w) + this.w) % this.w;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return y * this.w + x;
  }
  get(x: number, y: number): number {
    const i = this.i(x, y);
    return i < 0 ? 0 : this.m[i]!;
  }
  set(x: number, y: number, id: number): void {
    const i = this.i(x, y);
    if (i >= 0) this.m[i] = id;
  }
  rect(x: number, y: number, w: number, h: number, id: number): void {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) for (let xx = Math.round(x); xx < Math.round(x + w); xx++) this.set(xx, yy, id);
  }
  line(x0: number, y0: number, x1: number, y1: number, id: number, thick = 1): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      const o = Math.floor(thick / 2);
      for (let t = 0; t < thick; t++) for (let s = 0; s < thick; s++) this.set(x + t - o, y + s - o, id);
    }
  }
  disc(cx: number, cy: number, r: number, id: number): void {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, id);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, id: number): void {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.set(x, y, id);
  }
  poly(pts: [number, number][], id: number): void {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys));
    const y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i]!;
        const [bx, by] = pts[(i + 1) % pts.length]!;
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]!); x < Math.round(xs[k + 1]!); x++) this.set(x, y, id);
    }
  }
  /** Fills a column span from `top` down to the bottom of the layer. */
  column(x: number, top: number, id: number, bottom = this.h): void {
    for (let y = Math.max(0, Math.round(top)); y < bottom; y++) this.set(x, y, id);
  }
  /** Clears (sets 0) where predicate holds. */
  carve(fn: (x: number, y: number) => boolean): void {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (fn(x, y)) this.m[y * this.w + x] = 0;
  }

  /** Paints the material map into a canvas. */
  paint(mats: Record<number, Material>, seed: number, into?: Canvas): Canvas {
    const c = into ?? new Canvas(this.w, this.h);
    c.wrapX = this.wrapX;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const id = this.m[y * this.w + x]!;
        if (!id) continue;
        const mat = mats[id];
        if (!mat) continue;
        let col = mat.base;
        if (mat.dark || mat.light) {
          const n = fbm(x, y, { w: this.w, h: this.h, cells: mat.grain ?? 24, octaves: 3, seed: seed + id * 17, wrapX: this.wrapX });
          const jitter = mat.dither ? (bayer(x, y) - 0.5) * 0.12 : 0;
          if (mat.dark && n + jitter < (mat.darkAt ?? 0.38)) col = mat.dark;
          else if (mat.light && n + jitter > (mat.lightAt ?? 0.64)) col = mat.light;
        }
        if (mat.rim) {
          const [dx, dy] = mat.rimDir ?? [0, -1];
          const rw = mat.rimWidth ?? 1;
          for (let k = 1; k <= rw; k++) {
            const nb = this.get(x + dx * k, y + dy * k);
            if (nb !== id && (nb === 0 || !mats[nb] || (mats[nb]!.alpha ?? 1) < 1)) {
              col = mat.rim;
              break;
            }
          }
        }
        if (mat.fadeTo) {
          const from = mat.fadeFrom ?? 0.5;
          const t = (y / this.h - from) / (1 - from);
          if (t > 0) {
            const amt = Math.min(1, t) * (mat.fadeAmt ?? 1);
            // dithered steps keep the fade crisp
            const steps = 4;
            const q = Math.floor(amt * steps + bayer(x, y)) / steps;
            col = mix(col, mat.fadeTo, Math.min(1, q));
          }
        }
        c.set(x, y, col, mat.alpha ?? 1);
      }
    return c;
  }
}

/** Mixes every opaque pixel of a canvas toward `color` (atmospheric perspective). */
export function haze(c: Canvas, color: string, amt: number): Canvas {
  const t = rgb(color);
  const d = c.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    d[i] = d[i]! + (t[0] - d[i]!) * amt;
    d[i + 1] = d[i + 1]! + (t[1] - d[i + 1]!) * amt;
    d[i + 2] = d[i + 2]! + (t[2] - d[i + 2]!) * amt;
  }
  return c;
}

/** Vertical gradient through colour stops (0..1 positions), dithered between neighbours. */
export function gradient(c: Canvas, stops: [number, string][], o: { dither?: number; y0?: number; y1?: number } = {}): void {
  const y0 = o.y0 ?? 0;
  const y1 = o.y1 ?? c.h;
  const steps = o.dither ?? 0;
  for (let y = y0; y < y1; y++) {
    const t = (y - y0) / Math.max(1, y1 - y0 - 1);
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1]![0]) k++;
    const [ta, ca] = stops[k]!;
    const [tb, cb] = stops[k + 1]!;
    const f = Math.max(0, Math.min(1, (t - ta) / Math.max(1e-6, tb - ta)));
    for (let x = 0; x < c.w; x++) {
      let ff = f;
      if (steps > 0) ff = Math.min(1, Math.floor(f * steps + bayer(x, y)) / steps);
      c.set(x, y, mix(ca, cb, ff));
    }
  }
}
