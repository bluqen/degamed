import { describe, expect, it } from 'vitest';
import { ART_THEMES, getTheme, renderPreview, THEME_IDS } from './index';
import { ramp, rgb, toHsl } from './core';
import type { Raster } from '../pixel';
import type { ArtTheme, SpriteSheet } from './types';

const HEX = /^#[0-9a-f]{6}$/i;

function rectangular(r: Raster): boolean {
  return Number.isInteger(r.width) && Number.isInteger(r.height) && r.width > 0 && r.height > 0 && r.data.length === r.width * r.height * 4;
}

function px(r: Raster, x: number, y: number): [number, number, number, number] {
  const i = (y * r.width + x) * 4;
  return [r.data[i]!, r.data[i + 1]!, r.data[i + 2]!, r.data[i + 3]!];
}

function diff(a: number[], b: number[]): number {
  // transparent vs opaque counts as a big jump
  return Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!) + Math.abs(a[3]! - b[3]!);
}

/**
 * How the colour jump across the wrap seam compares with the jumps between neighbouring columns
 * inside the image. Real edges (a building, a brick joint) may land on the seam, so the seam is
 * compared with the inner boundaries at percentile `p` rather than their mean: a true seam bug
 * (non-periodic noise) is an outlier against all of them.
 */
function seamRatio(r: Raster, axis: 'x' | 'y', rows?: [number, number], p = 1): number {
  const n = axis === 'x' ? r.width : r.height;
  const m = axis === 'x' ? r.height : r.width;
  const [m0, m1] = rows ?? [0, m];
  const at = (i: number, j: number) => (axis === 'x' ? px(r, i, j) : px(r, j, i));
  const boundary = (i: number) => {
    let s = 0;
    for (let j = m0; j < m1; j++) s += diff(at(i, j), at((i + 1) % n, j));
    return s / (m1 - m0);
  };
  const inner = Array.from({ length: n - 1 }, (_, i) => boundary(i)).sort((a, b) => a - b);
  const ref = inner[Math.min(inner.length - 1, Math.floor(p * (inner.length - 1)))]!;
  return boundary(n - 1) / Math.max(1, ref);
}

function frameCount(s: SpriteSheet): number {
  return Math.floor(s.raster.width / s.frameWidth);
}

function frameOpaque(s: SpriteSheet, f: number): number {
  let n = 0;
  for (let y = 0; y < s.frameHeight; y++) for (let x = 0; x < s.frameWidth; x++) if (px(s.raster, f * s.frameWidth + x, y)[3] > 0) n++;
  return n;
}

function frameEqual(s: SpriteSheet, a: number, b: number): boolean {
  for (let y = 0; y < s.frameHeight; y++)
    for (let x = 0; x < s.frameWidth; x++) if (diff(px(s.raster, a * s.frameWidth + x, y), px(s.raster, b * s.frameWidth + x, y)) > 0) return false;
  return true;
}

describe('art themes: catalogue', () => {
  it('ships at least three themes with unique ids', () => {
    expect(ART_THEMES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(THEME_IDS).size).toBe(THEME_IDS.length);
    for (const id of ['rain-ruins', 'hollow-caverns', 'sunlit-meadow']) expect(THEME_IDS).toContain(id);
  });

  it('getTheme returns the theme by id and falls back to the first', () => {
    expect(getTheme('hollow-caverns').id).toBe('hollow-caverns');
    expect(getTheme('nope').id).toBe(ART_THEMES[0]!.id);
    // cached: same object on repeat calls
    expect(getTheme('rain-ruins')).toBe(getTheme('rain-ruins'));
  });
});

describe.each(THEME_IDS)('theme %s', (id) => {
  const t: ArtTheme = getTheme(id);

  it('fills in the metadata', () => {
    expect(t.id).toBe(id);
    expect(t.name.length).toBeGreaterThan(2);
    expect(t.description.length).toBeGreaterThan(20);
    expect(t.keywords.length).toBeGreaterThanOrEqual(8);
    expect(t.palette.length).toBeGreaterThanOrEqual(8);
    for (const c of t.palette) expect(c).toMatch(HEX);
    expect(t.background).toMatch(HEX);
  });

  it('has 4+ parallax layers ordered back to front, all rectangular', () => {
    expect(t.layers.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < t.layers.length; i++) expect(t.layers[i]!.factor).toBeGreaterThanOrEqual(t.layers[i - 1]!.factor);
    for (const l of t.layers) {
      expect(rectangular(l.raster), l.name).toBe(true);
      expect(l.raster.height).toBeGreaterThanOrEqual(200);
    }
    // the backmost layer is opaque, so there is never a hole in the sky
    const back = t.layers[0]!.raster;
    for (let i = 3; i < back.data.length; i += 4 * 97) expect(back.data[i]).toBe(255);
  });

  it('tiled layers wrap seamlessly', () => {
    for (const l of t.layers.filter((x) => x.tiled)) expect(seamRatio(l.raster, 'x'), l.name).toBeLessThan(1.05);
  });

  it('has square tiles of one size, including ground, fill and platform', () => {
    const T = t.tileSize ?? 16;
    for (const k of ['ground', 'fill', 'platform']) expect(t.tiles[k], k).toBeDefined();
    for (const [k, r] of Object.entries(t.tiles)) {
      expect(rectangular(r), k).toBe(true);
      if (k === 'spike') continue;
      expect([r.width, r.height], k).toEqual([T, T]);
    }
  });

  it('tiles tile seamlessly', () => {
    // fill wraps both ways; ground and platform repeat sideways
    for (const k of ['fill', 'fill2']) {
      const r = t.tiles[k];
      if (!r) continue;
      expect(seamRatio(r, 'x'), `${k} x`).toBeLessThan(1.3);
      expect(seamRatio(r, 'y'), `${k} y`).toBeLessThan(1.3);
    }
    for (const k of ['ground', 'ground2', 'ground3']) if (t.tiles[k]) expect(seamRatio(t.tiles[k]!, 'x', [3, 16]), k).toBeLessThan(1.3);
    expect(seamRatio(t.tiles.platform, 'x', [0, 8])).toBeLessThan(1.3);
    // the bottom of a ground tile flows into the top of a fill tile
    const g = t.tiles.ground;
    const f = t.tiles.fill;
    const rowJump = (a: Raster, ya: number, b: Raster, yb: number) => {
      let s = 0;
      for (let x = 0; x < 16; x++) s += diff(px(a, x, ya), px(b, x, yb));
      return s / 16;
    };
    const worstInner = Math.max(...Array.from({ length: 15 }, (_, y) => rowJump(f, y, f, y + 1)));
    expect(rowJump(g, 15, f, 0) / Math.max(1, worstInner)).toBeLessThan(1.3);
  });

  it('ground tiles have a walkable, mostly solid body', () => {
    for (const k of ['ground', 'fill']) {
      const r = t.tiles[k]!;
      let solid = 0;
      for (let i = 3; i < r.data.length; i += 4) if (r.data[i] === 255) solid++;
      expect(solid / (r.width * r.height), k).toBeGreaterThan(0.85);
    }
  });

  it('hero has the required animations with real frames', () => {
    const h = t.sprites.hero;
    expect(rectangular(h.raster)).toBe(true);
    expect(h.raster.width % h.frameWidth).toBe(0);
    expect(h.raster.height).toBe(h.frameHeight);
    for (const a of ['idle', 'run', 'jump', 'fall', 'attack', 'hurt']) expect(h.animations[a], a).toBeDefined();
    expect(h.animations.run!.frames.length).toBeGreaterThanOrEqual(6);
    const n = frameCount(h);
    for (const a of Object.values(h.animations)) {
      expect(a.fps).toBeGreaterThan(0);
      for (const f of a.frames) expect(f).toBeLessThan(n);
    }
    for (let f = 0; f < n; f++) expect(frameOpaque(h, f), `frame ${f}`).toBeGreaterThan(60);
    // the run cycle actually moves: neighbouring frames differ
    const run = h.animations.run!.frames;
    for (let i = 0; i < run.length; i++) expect(frameEqual(h, run[i]!, run[(i + 1) % run.length]!)).toBe(false);
    // idle breathes
    const idle = new Set(h.animations.idle!.frames);
    expect(idle.size).toBeGreaterThanOrEqual(3);
    expect(h.hitbox).toBeDefined();
  });

  it('enemy, pickup, goal and extras have their animations', () => {
    const S = t.sprites;
    const need: [string, string[]][] = [
      ['enemy', ['walk', 'hurt']],
      ['pickup', ['idle']],
      ['goal', ['idle']],
      ['checkpoint', ['idle', 'lit']],
      ['flyer', ['fly']],
    ];
    for (const [k, anims] of need) {
      const s = S[k];
      expect(s, k).toBeDefined();
      expect(rectangular(s!.raster), k).toBe(true);
      expect(s!.raster.width % s!.frameWidth, k).toBe(0);
      for (const a of anims) expect(s!.animations[a], `${k}.${a}`).toBeDefined();
      for (const a of Object.values(s!.animations)) for (const f of a.frames) expect(f).toBeLessThan(frameCount(s!));
    }
  });

  it('has props with valid placement info', () => {
    const names = Object.keys(t.props);
    expect(names.length).toBeGreaterThanOrEqual(6);
    for (const [k, r] of Object.entries(t.props)) expect(rectangular(r), k).toBe(true);
    for (const [k, info] of Object.entries(t.propInfo ?? {})) {
      expect(names, k).toContain(k);
      expect(['ground', 'ceiling', 'wall', 'free']).toContain(info.anchor);
      if (info.light) expect(info.light.color).toMatch(HEX);
    }
  });

  it('has a sensible environment preset', () => {
    const e = t.environment;
    expect(e.ambient).toBeDefined();
    expect(e.ambient!.intensity).toBeGreaterThan(0);
    expect(e.ambient!.intensity).toBeLessThanOrEqual(1);
    expect(e.ambient!.color).toMatch(HEX);
    if (e.fog) expect(e.fog.density).toBeLessThanOrEqual(1);
    if (e.vignette !== undefined) expect(e.vignette).toBeLessThanOrEqual(1);
    if (e.grade?.tint) expect(e.grade.tint).toMatch(HEX);
    for (const p of e.particles ?? []) {
      expect(['rain', 'dust', 'fireflies', 'snow', 'embers', 'spores']).toContain(p.type);
      expect(p.density).toBeGreaterThanOrEqual(0);
      expect(p.density).toBeLessThanOrEqual(1);
    }
  });

  it('renders a full preview screenshot', () => {
    const r = renderPreview(t, { width: 480, height: 270 });
    expect([r.width, r.height]).toEqual([480, 270]);
    for (let i = 3; i < r.data.length; i += 4 * 101) expect(r.data[i]).toBe(255);
  });
});

describe('colour ramps', () => {
  it('shift hue: shadows lean cool, highlights lean warm', () => {
    const r = ramp('#4a8a3a', 5);
    expect(r).toHaveLength(5);
    const hues = r.map((c) => toHsl(rgb(c))[0]);
    const lum = r.map((c) => toHsl(rgb(c))[2]);
    for (let i = 1; i < lum.length; i++) expect(lum[i]!).toBeGreaterThan(lum[i - 1]!);
    // green base (~105°): the darkest moves toward blue (higher hue), the lightest toward yellow
    expect(hues[0]!).toBeGreaterThan(hues[2]!);
    expect(hues[4]!).toBeLessThan(hues[2]!);
  });
});
