/**
 * A software compositor that renders a theme as a game "screenshot": parallax layers, an
 * autotiled level, props, hero, enemy, pickups and goal, then the environment (ambient light and
 * point lights, fog, particles, bloom, vignette, grade). Pure TypeScript, so it runs in Node for
 * previews and tests, and in the browser for theme thumbnails.
 *
 * It is also the reference for how the engine is expected to interpret `environment`.
 */
import { Canvas, hash2, luminance, rgb, rng, type RGB } from './core';
import type { Raster } from '../pixel';
import type { ArtTheme, Light, SpriteSheet } from './types';

export interface PreviewOptions {
  width?: number;
  height?: number;
  camX?: number;
  seed?: number;
  /** Turn the environment pass off to inspect raw art. */
  raw?: boolean;
  /** Hero animation and frame to show. */
  heroAnim?: string;
  heroFrame?: number;
}

/** The level used for previews: rows of '#' ground, '=' platform, '.' empty (30×17 tiles). */
export const PREVIEW_LEVEL = [
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..................====........',
  '..............................',
  '.....====.....................',
  '..............................',
  '.......................#######',
  '.......................#######',
  '##########.....###############',
  '##########.....###############',
  '##########.....###############',
  '##########.....###############',
];

function frameOf(sheet: SpriteSheet, anim: string, i: number): number {
  const a = sheet.animations[anim] ?? Object.values(sheet.animations)[0]!;
  return a.frames[i % a.frames.length]!;
}

function drawFrame(c: Canvas, sheet: SpriteSheet, frame: number, x: number, y: number, flipX = false): void {
  c.blit(sheet.raster, x, y, { sx: frame * sheet.frameWidth, sy: 0, sw: sheet.frameWidth, sh: sheet.frameHeight, flipX });
}

function blitTiled(c: Canvas, r: Raster, ox: number, oy: number): void {
  let x = ((ox % r.width) + r.width) % r.width;
  if (x > 0) x -= r.width;
  for (; x < c.w; x += r.width) c.blit(r, x, oy);
}

export function renderPreview(theme: ArtTheme, o: PreviewOptions = {}): Raster {
  const W = o.width ?? 480;
  const H = o.height ?? 270;
  const camX = o.camX ?? 0;
  const env = o.raw ? {} : theme.environment;
  const T = theme.tileSize ?? theme.tiles.ground.width;
  const r = rng(o.seed ?? 1);

  // ── background ──
  const bg = new Canvas(W, H, theme.background);
  const fg = theme.layers.filter((l) => l.factor > 1);
  for (const l of theme.layers) if (l.factor <= 1) blitTiled(bg, l.raster, -camX * l.factor, l.y ?? 0);
  if (env.fog) {
    const fc = env.fog.color;
    const h = env.fog.height ?? 0.4;
    for (let y = 0; y < H; y++) {
      const t = Math.max(0, (y / H - (1 - h)) / h);
      const a = env.fog.density * Math.min(1, t) * 0.8;
      if (a > 0) for (let x = 0; x < W; x++) bg.set(x, y, fc, a);
    }
  }

  // ── world ──
  const world = new Canvas(W, H);
  const rows = PREVIEW_LEVEL;
  const at = (cx: number, cy: number) => rows[cy]?.[cx] ?? (cy >= rows.length ? '#' : '.');
  const lights: (Light & { x: number; y: number })[] = [];
  const pick = (base: string, cx: number, cy: number, variants: string[]) => {
    const opts = [base, ...variants.filter((v) => theme.tiles[v])];
    return theme.tiles[opts[Math.floor(hash2(cx, cy, 5) * opts.length)]!]!;
  };
  const solid = (ch: string) => ch === '#';
  const tops: [number, number][] = [];
  for (let cy = 0; cy < rows.length; cy++)
    for (let cx = 0; cx < rows[0]!.length; cx++) {
      const ch = at(cx, cy);
      const x = cx * T - camX;
      const y = cy * T;
      if (ch === '#') {
        const top = !solid(at(cx, cy - 1));
        const l = !solid(at(cx - 1, cy));
        const rr = !solid(at(cx + 1, cy));
        let tile: Raster;
        if (top) {
          tops.push([cx, cy]);
          tile = l && theme.tiles.groundLeft ? theme.tiles.groundLeft : rr && theme.tiles.groundRight ? theme.tiles.groundRight : pick('ground', cx, cy, ['ground2', 'ground3']);
        } else tile = l && theme.tiles.fillLeft ? theme.tiles.fillLeft : rr && theme.tiles.fillRight ? theme.tiles.fillRight : pick('fill', cx, cy, ['fill2']);
        world.blit(tile, x, y);
      } else if (ch === '=') {
        const l = at(cx - 1, cy) !== '=';
        const rr = at(cx + 1, cy) !== '=';
        const tile = l && theme.tiles.platformLeft ? theme.tiles.platformLeft : rr && theme.tiles.platformRight ? theme.tiles.platformRight : theme.tiles.platform;
        world.blit(tile, x, y);
      }
    }

  // props behind the actors
  const info = theme.propInfo ?? {};
  const names = Object.keys(theme.props);
  const groundProps = names.filter((n) => (info[n]?.anchor ?? 'ground') === 'ground');
  const hangProps = names.filter((n) => info[n]?.anchor === 'ceiling');
  const wallProps = names.filter((n) => info[n]?.anchor === 'wall');
  const placeLight = (n: string, x: number, y: number) => {
    const L = info[n]?.light;
    if (L) lights.push({ ...L, x: x + L.x, y: y + L.y });
  };
  const used = new Set<number>();
  for (const [cx, cy] of tops) {
    if (!r.chance(0.42) || used.has(cx) || !groundProps.length) continue;
    const n = groundProps[Math.floor(r.next() * groundProps.length)]!;
    const p = theme.props[n]!;
    const x = cx * T - camX + Math.floor((T - p.width) / 2) + r.int(-3, 3);
    const y = cy * T - p.height + 2;
    if (p.height > 40 && r.chance(0.6)) continue;
    world.blit(p, x, y);
    placeLight(n, x, y);
    for (let k = 0; k < Math.ceil(p.width / T); k++) used.add(cx + k);
  }
  for (const n of wallProps.slice(0, 1)) {
    const p = theme.props[n]!;
    const x = 26 * T - camX;
    const y = 11 * T - p.height - 18;
    world.blit(p, x, y);
    placeLight(n, x, y);
  }
  for (let i = 0; i < hangProps.length; i++) {
    const n = hangProps[i]!;
    const p = theme.props[n]!;
    const x = [70, 205, 300, 410, 160][i % 5]! - camX;
    world.blit(p, x, 0);
    placeLight(n, x, 0);
  }

  // actors
  const S = theme.sprites;
  const hero = S.hero;
  const heroAnim = o.heroAnim ?? 'run';
  const hx = 130 - camX;
  const hy = 13 * T - hero.frameHeight;
  drawFrame(world, hero, frameOf(hero, heroAnim, o.heroFrame ?? 2), hx, hy);
  if (theme.lights?.hero) lights.push({ ...theme.lights.hero, x: hx + hero.frameWidth / 2, y: hy + hero.frameHeight / 2 });
  const en = S.enemy;
  const ex = 19 * T - camX;
  const ey = 13 * T - en.frameHeight;
  drawFrame(world, en, frameOf(en, 'walk', 1), ex, ey, true);
  if (theme.lights?.enemy) lights.push({ ...theme.lights.enemy, x: ex + en.frameWidth / 2, y: ey + en.frameHeight / 2 });
  const pk = S.pickup;
  const pickups: [number, number][] = [
    [6.5 * T, 8 * T],
    [7.8 * T, 7.3 * T],
    [12.5 * T, 10.5 * T],
    [19.5 * T, 6.3 * T],
    [20.7 * T, 6.6 * T],
  ];
  pickups.forEach(([x, y], i) => {
    const px = x - camX - pk.frameWidth / 2;
    const py = y - pk.frameHeight / 2;
    drawFrame(world, pk, frameOf(pk, 'idle', i * 2), px, py);
    if (theme.lights?.pickup) lights.push({ ...theme.lights.pickup, x: px + pk.frameWidth / 2, y: py + pk.frameHeight / 2 });
  });
  const goal = S.goal;
  const gx = 27.5 * T - camX - goal.frameWidth / 2;
  const gy = 11 * T - goal.frameHeight;
  drawFrame(world, goal, frameOf(goal, 'idle', 1), gx, gy);
  if (theme.lights?.goal) lights.push({ ...theme.lights.goal, x: gx + goal.frameWidth / 2, y: gy + goal.frameHeight / 3 });

  // ── lighting on the world ──
  if (env.ambient) {
    const amb = rgb(env.ambient.color);
    const k = env.ambient.intensity;
    // light colour per pixel = ambient (tinted) + point lights
    // ambient: the colour gives the hue (normalised so its brightest channel is 1), the
    // intensity gives the brightness of unlit areas
    const mx = Math.max(amb[0], amb[1], amb[2], 1);
    const base: RGB = [(k * amb[0]) / mx, (k * amb[1]) / mx, (k * amb[2]) / mx];
    const d = world.data;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (!d[i + 3]) continue;
        let lr = base[0];
        let lg = base[1];
        let lb = base[2];
        for (const L of lights) {
          const dist = Math.hypot(x - L.x, y - L.y) / L.radius;
          if (dist >= 1) continue;
          const f = (1 - dist) ** 2 * L.intensity;
          const c = rgb(L.color);
          lr += (f * c[0]) / 255;
          lg += (f * c[1]) / 255;
          lb += (f * c[2]) / 255;
        }
        d[i] = d[i]! * Math.min(1.35, lr);
        d[i + 1] = d[i + 1]! * Math.min(1.35, lg);
        d[i + 2] = d[i + 2]! * Math.min(1.35, lb);
      }
  }

  const out = bg;
  out.blit(world, 0, 0);
  if (env.fog) {
    // a thin veil of fog over the world's lower area too
    const h = env.fog.height ?? 0.4;
    for (let y = 0; y < H; y++) {
      const t = Math.max(0, (y / H - (1 - h * 0.5)) / (h * 0.5));
      const a = env.fog.density * Math.min(1, t) * 0.25;
      if (a > 0) for (let x = 0; x < W; x++) if (world.alpha(x, y)) out.set(x, y, env.fog.color, a);
    }
  }
  // light glow over everything (soft halos around lamps)
  if (!o.raw) for (const L of lights) out.glow(L.x, L.y, L.radius * 0.6, L.color, L.intensity * 0.18);

  // foreground layers (in front of the world)
  for (const l of fg) blitTiled(out, l.raster, -camX * l.factor, l.y ?? 0);

  if (o.raw) return out.toRaster();

  // ── particles ──
  const pr = rng((o.seed ?? 1) + 99);
  for (const p of env.particles ?? []) {
    const col = p.color ?? '#ffffff';
    if (p.type === 'rain') {
      const n = Math.round(p.density * 520);
      for (let i = 0; i < n; i++) {
        const x = pr.range(-40, W);
        const y = pr.range(-10, H);
        const len = pr.int(5, 11);
        const near = pr.chance(0.25);
        for (let k = 0; k < len; k++) out.set(Math.round(x + k * 0.3), Math.round(y + k), col, (near ? 0.55 : 0.28) * (1 - k / len / 2));
      }
      // splashes on ground tops
      for (const [cx, cy] of tops) if (pr.chance(0.5 * p.density)) {
        const x = cx * T - camX + pr.int(0, T - 1);
        out.set(x, cy * T - 1, col, 0.6);
        out.set(x - 1, cy * T - 2, col, 0.4);
        out.set(x + 1, cy * T - 2, col, 0.4);
      }
    } else if (p.type === 'dust' || p.type === 'snow') {
      const n = Math.round(p.density * (p.type === 'snow' ? 300 : 160));
      for (let i = 0; i < n; i++) {
        const x = pr.int(0, W);
        const y = pr.int(0, H);
        out.set(x, y, col, pr.range(0.25, 0.7));
        if (p.type === 'snow' && pr.chance(0.3)) out.set(x + 1, y, col, 0.4);
      }
    } else {
      // glowing motes: spores drift, fireflies blink, embers rise
      const n = Math.round(p.density * (p.type === 'fireflies' ? 40 : 110));
      for (let i = 0; i < n; i++) {
        const x = pr.int(0, W);
        const y = p.type === 'embers' ? pr.int(H * 0.3, H) : pr.int(0, H);
        const big = pr.chance(0.25);
        out.glow(x + 0.5, y + 0.5, big ? 5 : 3, col, big ? 0.5 : 0.3);
        out.set(x, y, col, 0.9);
        if (p.type === 'embers' && big) out.set(x, y - 1, col, 0.6);
      }
    }
  }

  // ── bloom ──
  if (env.bloom && env.bloom.strength > 0) {
    const th = env.bloom.threshold ?? 0.7;
    const bright = new Float32Array(W * H * 3);
    const d = out.data;
    for (let i = 0; i < W * H; i++) {
      const c: RGB = [d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!];
      const l = luminance(c);
      if (l > th) {
        const k = (l - th) / (1 - th);
        bright[i * 3] = c[0] * k;
        bright[i * 3 + 1] = c[1] * k;
        bright[i * 3 + 2] = c[2] * k;
      }
    }
    const blur = (src: Float32Array, rad: number) => {
      const tmp = new Float32Array(src.length);
      const dst = new Float32Array(src.length);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          for (let ch = 0; ch < 3; ch++) {
            let s = 0;
            for (let k = -rad; k <= rad; k++) s += src[(y * W + Math.min(W - 1, Math.max(0, x + k))) * 3 + ch]!;
            tmp[(y * W + x) * 3 + ch] = s / (rad * 2 + 1);
          }
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          for (let ch = 0; ch < 3; ch++) {
            let s = 0;
            for (let k = -rad; k <= rad; k++) s += tmp[(Math.min(H - 1, Math.max(0, y + k)) * W + x) * 3 + ch]!;
            dst[(y * W + x) * 3 + ch] = s / (rad * 2 + 1);
          }
      return dst;
    };
    const b = blur(blur(bright, 4), 6);
    for (let i = 0; i < W * H; i++)
      for (let ch = 0; ch < 3; ch++) d[i * 4 + ch] = d[i * 4 + ch]! + b[i * 3 + ch]! * env.bloom.strength * 1.6;
  }

  // ── grade + vignette ──
  const g = env.grade ?? {};
  const contrast = g.contrast ?? 1;
  const sat = g.saturation ?? 1;
  const tint = g.tint ? rgb(g.tint) : null;
  const vig = env.vignette ?? 0;
  const d = out.data;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let c: RGB = [d[i]! / 255, d[i + 1]! / 255, d[i + 2]! / 255];
      const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      c = c.map((v) => l + (v - l) * sat) as RGB;
      c = c.map((v) => (v - 0.5) * contrast + 0.5) as RGB;
      if (tint) c = c.map((v, k) => v * (0.7 + (0.3 * tint[k]!) / 255)) as RGB;
      if (vig) {
        const dx = x / W - 0.5;
        const dy = y / H - 0.5;
        const v = 1 - vig * Math.min(1, (dx * dx + dy * dy) * 2.2) ** 1.3;
        c = c.map((q) => q * v) as RGB;
      }
      d[i] = c[0] * 255;
      d[i + 1] = c[1] * 255;
      d[i + 2] = c[2] * 255;
      d[i + 3] = 255;
    }
  return out.toRaster();
}
