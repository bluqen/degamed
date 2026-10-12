/**
 * Silhouette builders for parallax layers. They write material ids into a `MatLayer`; the theme
 * decides how each material is painted (texture, rim light, fog fade). All builders respect the
 * layer's horizontal wrap, so layers tile seamlessly.
 */
import { Canvas, fbm, bayer, MatLayer, type Rng } from './core';

/** A ruined tower: setbacks, optional broken top, antenna and windows (window material). */
export function tower(
  L: MatLayer,
  r: Rng,
  x: number,
  base: number,
  w: number,
  h: number,
  id: number,
  o: { win?: number; winGap?: number; winSkip?: number; ribs?: number; broken?: boolean; antenna?: boolean; ledges?: number; litWin?: number; litChance?: number } = {},
): void {
  const top = base - h;
  L.rect(x, top, w, h, id);
  // setbacks on the upper part
  let sx = x;
  let sw = w;
  let st = top;
  const steps = r.int(0, 2);
  for (let i = 0; i < steps; i++) {
    const inset = r.int(2, Math.max(2, Math.floor(sw / 4)));
    const hh = r.int(6, 18);
    sx += inset;
    sw -= inset * 2;
    if (sw < 4) break;
    L.rect(sx, st - hh, sw, hh, id);
    st -= hh;
  }
  if (o.antenna && r.chance(0.7)) {
    const ax = sx + r.int(1, Math.max(1, sw - 2));
    const ah = r.int(8, 26);
    L.rect(ax, st - ah, 1, ah, id);
    if (r.chance(0.5)) L.rect(ax - 2, st - ah + r.int(2, 6), 5, 1, id);
  }
  if (o.broken) {
    // jagged bite out of one corner
    const bw = r.int(Math.floor(w / 4), Math.floor(w / 2));
    const left = r.chance(0.5);
    for (let i = 0; i < bw; i++) {
      const depth = Math.round((bw - i) * r.range(0.6, 1.4)) + r.int(0, 3);
      const cx = left ? x + i : x + w - 1 - i;
      for (let y = top; y < top + depth; y++) L.set(cx, y, 0);
    }
  }
  for (let i = 0; i < (o.ledges ?? 0); i++) {
    const ly = top + r.int(8, Math.max(9, h - 10));
    L.rect(x - 2, ly, w + 4, r.int(1, 2), id);
  }
  if (o.ribs !== undefined) {
    for (let rx = x + 3; rx < x + w - 2; rx += r.int(5, 9)) for (let y = top + 2; y < base; y++) if (L.get(rx, y) === id) L.set(rx, y, o.ribs);
    for (let by = top + r.int(8, 20); by < base; by += r.int(14, 30)) for (let bx = x; bx < x + w; bx++) if (L.get(bx, by)) L.set(bx, by, o.ribs);
  }
  if (o.win !== undefined) {
    const gap = o.winGap ?? 4;
    for (let wy = top + 4; wy < base - 4; wy += gap + 1)
      for (let wx = x + 2; wx < x + w - 2; wx += gap) {
        if (r.chance(o.winSkip ?? 0.25)) continue;
        const lit = o.litWin !== undefined && r.chance(o.litChance ?? 0.05);
        if (L.get(wx, wy) === id) L.rect(wx, wy, Math.max(1, gap - 2), 2, lit ? o.litWin! : o.win);
      }
  }
}

/** A pipe from (x0,y0) to (x1,y1) with flanges every `every` pixels. */
export function pipe(L: MatLayer, x0: number, y0: number, x1: number, y1: number, thick: number, id: number, flange?: number, every = 18, hi?: number): void {
  L.line(x0, y0, x1, y1, id, thick);
  if (hi !== undefined && thick >= 3) {
    // a specular stripe along the lit side gives the pipe its roundness
    const horizontal0 = Math.abs(x1 - x0) > Math.abs(y1 - y0);
    const o = -Math.floor(thick / 2) + Math.max(1, Math.floor(thick / 4));
    if (horizontal0) L.line(x0, y0 + o, x1, y1 + o, hi, 1);
    else L.line(x0 + o + Math.floor(thick / 2), y0, x1 + o + Math.floor(thick / 2), y1, hi, 1);
  }
  if (flange === undefined) return;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const horizontal = Math.abs(x1 - x0) > Math.abs(y1 - y0);
  for (let d = every / 2; d < len; d += every) {
    const x = x0 + ((x1 - x0) * d) / len;
    const y = y0 + ((y1 - y0) * d) / len;
    const o = Math.floor(thick / 2) + 1;
    if (horizontal) L.rect(x, y - o, 2, thick + 2, flange);
    else L.rect(x - o, y, thick + 2, 2, flange);
  }
}

/** An elbow pipe: horizontal run then down/up. */
export function elbow(L: MatLayer, x0: number, y0: number, x1: number, y1: number, thick: number, id: number, flange?: number): void {
  pipe(L, x0, y0, x1, y0, thick, id, flange);
  pipe(L, x1, y0, x1, y1, thick, id, flange);
}

/** A lattice girder between two x positions at height y. */
export function truss(L: MatLayer, x0: number, y: number, x1: number, h: number, id: number): void {
  L.rect(x0, y, x1 - x0, 1, id);
  L.rect(x0, y + h - 1, x1 - x0, 1, id);
  const step = h;
  for (let x = x0; x < x1; x += step) {
    L.line(x, y, Math.min(x1, x + step), y + h - 1, id);
    L.rect(x, y, 1, h, id);
  }
}

/** A vertical truss tower (pylon). */
export function pylon(L: MatLayer, x: number, base: number, w: number, h: number, id: number): void {
  L.rect(x, base - h, 1, h, id);
  L.rect(x + w - 1, base - h, 1, h, id);
  for (let y = base - h; y < base; y += w) {
    L.line(x, y, x + w - 1, Math.min(base, y + w), id);
    L.line(x + w - 1, y, x, Math.min(base, y + w), id);
  }
}

/** A sagging chain or cable between two points. */
export function cable(L: MatLayer, x0: number, y0: number, x1: number, y1: number, sag: number, id: number): void {
  const n = Math.max(2, Math.ceil(Math.abs(x1 - x0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    L.set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag, id);
  }
}

/** A hanging chain: alternating links. */
export function hangingChain(L: MatLayer, x: number, y0: number, len: number, id: number): void {
  for (let y = 0; y < len; y++) {
    L.set(x, y0 + y, id);
    if (y % 3 === 1) {
      L.set(x - 1, y0 + y, id);
      L.set(x + 1, y0 + y, id);
    }
  }
}

/** A storage tank: cylinder with a domed top. */
export function tank(L: MatLayer, cx: number, base: number, r: number, h: number, id: number): void {
  L.rect(cx - r, base - h, r * 2, h, id);
  L.ellipse(cx, base - h, r, Math.max(2, r * 0.45), id);
}

/** A construction crane silhouette. */
export function crane(L: MatLayer, r: Rng, x: number, base: number, h: number, id: number): void {
  pylon(L, x, base, 4, h, id);
  const arm = r.int(30, 60);
  const dir = r.chance(0.5) ? 1 : -1;
  const ax0 = dir > 0 ? x : x - arm;
  truss(L, ax0, base - h, ax0 + arm + 4, 3, id);
  const hx = dir > 0 ? x + arm : x - arm + 4;
  L.rect(hx, base - h + 3, 1, r.int(10, 30), id);
}

/**
 * Grows foliage: tufts on top of solid ground and vines hanging from overhangs. Reads `solid`
 * materials, writes `leaf` / `vine` materials.
 */
export function overgrow(L: MatLayer, r: Rng, solid: Set<number>, leaf: number, vine: number, o: { tuft?: number; hang?: number; maxHang?: number; seed: number }): void {
  const tops: [number, number][] = [];
  const bottoms: [number, number][] = [];
  for (let y = 1; y < L.h - 1; y++)
    for (let x = 0; x < L.w; x++) {
      const m = L.get(x, y);
      if (!solid.has(m)) continue;
      if (!L.get(x, y - 1)) tops.push([x, y]);
      if (!L.get(x, y + 1)) bottoms.push([x, y]);
    }
  for (const [x, y] of tops) {
    const n = fbm(x, y, { w: L.w, h: L.h, cells: 40, octaves: 2, seed: o.seed, wrapX: true });
    if (n < 1 - (o.tuft ?? 0.5)) continue;
    const hgt = Math.round((n - 0.4) * 6 * r.range(0.5, 1.2));
    for (let k = 0; k < hgt; k++) L.set(x, y - 1 - k, leaf);
    if (hgt > 1 && r.chance(0.3)) L.set(x + (r.chance(0.5) ? 1 : -1), y - hgt, leaf);
    // moss creeping down the face
    for (let k = 0; k < r.int(0, 2); k++) if (solid.has(L.get(x, y + k))) L.set(x, y + k, leaf);
  }
  for (const [x, y] of bottoms) {
    if (!r.chance(o.hang ?? 0.06)) continue;
    const len = r.int(3, o.maxHang ?? 24);
    let vx = x;
    for (let k = 1; k <= len; k++) {
      if (L.get(vx, y + k)) break;
      L.set(vx, y + k, vine);
      if (r.chance(0.08)) vx += r.chance(0.5) ? 1 : -1;
    }
  }
}

/** Translucent diagonal light shafts (painted straight onto a canvas). */
export function lightShafts(c: Canvas, r: Rng, o: { count: number; color: string; alpha: number; slope: number; width: [number, number]; top?: number; bottom?: number }): void {
  for (let i = 0; i < o.count; i++) {
    const x0 = r.range(0, c.w);
    const w = r.range(o.width[0], o.width[1]);
    const a = o.alpha * r.range(0.5, 1);
    const top = o.top ?? 0;
    const bottom = o.bottom ?? c.h;
    for (let y = top; y < bottom; y++) {
      const t = (y - top) / (bottom - top);
      const fade = Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * (1 - t) ** 0.6;
      const cx = x0 + (y - top) * o.slope;
      for (let x = Math.floor(cx - w); x <= cx + w; x++) {
        const edge = 1 - Math.abs(x - cx) / w;
        const v = a * fade * edge;
        // stepped alpha keeps it pixel-art rather than airbrushed
        const q = Math.floor(v * 24 + bayer(x, y) * 0.9) / 24;
        if (q > 0) c.set(x, y, o.color, q);
      }
    }
  }
}

/** A band of drifting mist: translucent, noise-shaped, wraps horizontally. */
export function mistBand(c: Canvas, o: { y: number; h: number; color: string; alpha: number; seed: number; cells?: number }): void {
  for (let y = Math.max(0, o.y - o.h); y < Math.min(c.h, o.y + o.h); y++)
    for (let x = 0; x < c.w; x++) {
      const v = 1 - Math.abs(y - o.y) / o.h;
      const n = fbm(x, y, { w: c.w, h: c.h, cells: o.cells ?? 6, octaves: 4, seed: o.seed, wrapX: true, aspect: 0.35 });
      const a = Math.max(0, v * v * (n * 1.6 - 0.35)) * o.alpha;
      const q = Math.floor(a * 10 + bayer(x, y) * 0.95) / 10;
      if (q > 0) c.set(x, y, o.color, Math.min(1, q));
    }
}

/** Stamps tiny dots (stars, spores, distant lights) */
export function speckle(c: Canvas, r: Rng, n: number, color: string, area: [number, number, number, number], alpha = 1): void {
  for (let i = 0; i < n; i++) c.set(Math.floor(r.range(area[0], area[2])), Math.floor(r.range(area[1], area[3])), color, alpha * r.range(0.4, 1));
}
