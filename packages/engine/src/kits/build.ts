/**
 * Shared building blocks for genre kits: a text grid for levels, a project builder that turns a
 * theme's rasters into assets and sprite sheets, and decoration that makes levels look composed
 * (props standing on surfaces, hanging from ceilings, lamps with real lights, dark foreground
 * silhouettes for depth).
 */
import type { Environment, ProjectFiles, ProjectManifest } from '@degamed/shared';
import { mulberry32, type Raster } from '../pixel';
import type { Encoder, GameSpec, KitTheme, PropInfo, SpriteSheet, ThemeLight } from './types';

export const VIEW_W = 480;
export const VIEW_H = 270;

type Json = Record<string, unknown>;

/** A mutable character grid. Terrain: '#' solid, '=' one-way platform, '+' back wall. Other characters are markers. */
export class Level {
  readonly cells: string[][];
  constructor(
    readonly width: number,
    readonly height: number,
    fill = '.',
  ) {
    this.cells = Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
  }
  get(x: number, y: number): string {
    if (y < 0) return '.';
    if (y >= this.height || x < 0 || x >= this.width) return '#';
    return this.cells[y]![x]!;
  }
  set(x: number, y: number, ch: string) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.cells[y]![x] = ch;
  }
  solid(x: number, y: number) {
    return this.get(x, y) === '#';
  }
  /** Something stands here: the cell is open and the one below holds you up. */
  standable(x: number, y: number) {
    const c = this.get(x, y);
    const below = this.get(x, y + 1);
    return c !== '#' && c !== '=' && (below === '#' || below === '=') && x >= 0 && x < this.width;
  }
  /** Copies a chunk with its bottom-left corner at (x0, bottomRow). */
  stamp(rows: readonly string[], x0: number, bottomRow: number) {
    const top = bottomRow - rows.length + 1;
    rows.forEach((row, dy) => [...row].forEach((ch, dx) => this.set(x0 + dx, top + dy, ch)));
  }
  /** Terrain only, ready for a Tilemap component. */
  terrainRows(): string[] {
    return this.cells.map((row) => row.map((c) => (c === '#' || c === '=' || c === '+' ? c : '.')).join(''));
  }
  /** Every marker cell (anything that isn't terrain or empty). */
  markers(): { x: number; y: number; ch: string }[] {
    const out: { x: number; y: number; ch: string }[] = [];
    this.cells.forEach((row, y) => row.forEach((ch, x) => !'.#=+'.includes(ch) && out.push({ x, y, ch })));
    return out;
  }
  /** The run of standable cells around x on row y (for patrol ranges). */
  ledge(x: number, y: number): [number, number] {
    let a = x;
    let b = x;
    while (this.standable(a - 1, y)) a--;
    while (this.standable(b + 1, y)) b++;
    return [a, b];
  }
}

export interface ParamValues {
  [key: string]: number | boolean | string;
}

const hexLum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
};

/** Builds a project's files from a theme. */
export class KitBuilder {
  readonly T: number;
  readonly rand: () => number;
  readonly entities: Json[] = [];
  /** Inactive entities that scripts copy with Game.spawn. */
  readonly prefabs: Json[] = [];
  readonly files: ProjectFiles = {};
  private readonly rasters = new Map<string, Raster>();
  private readonly sheets = new Map<string, string>();
  private n = 0;

  constructor(
    readonly theme: KitTheme,
    seed: number,
  ) {
    this.T = theme.tileSize ?? theme.tiles.ground.width;
    this.rand = mulberry32(seed);
  }

  id(prefix: string) {
    return `${prefix}-${++this.n}`;
  }

  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.rand() * list.length)]!;
  }

  asset(path: string, raster: Raster) {
    this.rasters.set(path, raster);
    return path;
  }

  /** Every theme tile, by role, as assets. */
  tiles(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [role, raster] of Object.entries(this.theme.tiles)) out[role] = this.asset(`assets/tiles/${role}.png`, raster);
    return out;
  }

  /** Writes a theme sprite sheet and its .frames.json; returns the frames path. */
  sheet(key: string, sheet: SpriteSheet | undefined = this.theme.sprites[key]): string | null {
    if (!sheet) return null;
    const done = this.sheets.get(key);
    if (done) return done;
    const png = this.asset(`assets/sprites/${key}.png`, sheet.raster);
    const path = `assets/anims/${key}.frames.json`;
    this.files[path] = JSON.stringify({ sheet: png, frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight, animations: sheet.animations }, null, 2);
    this.sheets.set(key, path);
    return path;
  }

  /** Hitbox for a sheet: the art's hitbox size, centred horizontally (so flipping stays aligned). */
  body(sheet: SpriteSheet, extra: Json = {}): Json {
    const hb = sheet.hitbox;
    if (!hb) return { type: 'dynamic', ...extra };
    return {
      type: 'dynamic',
      width: hb.w,
      height: hb.h,
      offset: { x: Math.round((sheet.frameWidth - hb.w) / 2), y: hb.y },
      ...extra,
    };
  }

  /** Distance from a sprite's centre down to its feet. */
  feet(sheet: SpriteSheet): number {
    const bottom = sheet.hitbox ? sheet.hitbox.y + sheet.hitbox.h : sheet.anchor?.y ?? sheet.frameHeight;
    return bottom - sheet.frameHeight / 2;
  }

  parallax(): Json[] {
    return this.theme.layers.map((l, i) => ({
      asset: this.asset(`assets/backgrounds/${i}-${l.name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.png`, l.raster),
      factor: l.factor,
      y: l.y ?? 0,
      tiled: l.tiled ?? true,
    }));
  }

  prop(name: string): string | null {
    const r = this.theme.props[name];
    return r ? this.asset(`assets/props/${name}.png`, r) : null;
  }

  /** Accent colour for sparkles and banners: the pickup light, else the theme's brightest colour. */
  accent(): string {
    return this.theme.lights?.pickup?.color ?? [...this.theme.palette].sort((a, b) => hexLum(b) - hexLum(a))[0] ?? '#FFE38A';
  }

  /** A dark colour from the theme, for silhouettes and dust. */
  shade(rank = 0): string {
    return [...this.theme.palette].sort((a, b) => hexLum(a) - hexLum(b))[rank] ?? '#101018';
  }

  dustColor(): string {
    const sorted = [...this.theme.palette].sort((a, b) => hexLum(a) - hexLum(b));
    return sorted[Math.floor(sorted.length * 0.6)] ?? '#C8C0B0';
  }

  finish(encode: Encoder): ProjectFiles {
    for (const [path, raster] of this.rasters) this.files[path] = encode(raster);
    return this.files;
  }
}

/** A light component from a theme light (or a default). */
export function lightOf(l: ThemeLight | undefined, fallback: ThemeLight, offset = { x: 0, y: 0 }): Json {
  const src = l ?? fallback;
  return { color: src.color, radius: src.radius, intensity: src.intensity, flicker: src.flicker ?? 0, offset };
}

interface PropChoice {
  name: string;
  raster: Raster;
  info: PropInfo;
}

/** Guesses placement for props when the theme has no propInfo. */
export function propInfoFor(theme: KitTheme, name: string): PropInfo {
  const known = theme.propInfo?.[name];
  if (known) return known;
  const n = name.toLowerCase();
  if (/chain|vine|stalactite|hanging|root/.test(n)) return { anchor: 'ceiling', weight: 2 };
  if (/sign|fan|banner|torch|window/.test(n)) return { anchor: 'wall', weight: 1 };
  return { anchor: 'ground', weight: /grass|tuft|weed|reed|moss/.test(n) ? 4 : 2 };
}

function weighted(list: PropChoice[], rand: () => number): PropChoice | null {
  const total = list.reduce((s, p) => s + (p.info.weight ?? 1), 0);
  let r = rand() * total;
  for (const p of list) {
    r -= p.info.weight ?? 1;
    if (r <= 0) return p;
  }
  return list[list.length - 1] ?? null;
}

export interface DecorateOptions {
  /** World position of the level's top-left corner. */
  x0?: number;
  y0?: number;
  /** 0..1 how much greenery and clutter to scatter. */
  density?: number;
  /** Cells to keep clear ("x,y"). */
  avoid?: Set<string>;
  /** Where entities are added (scene list, or a prefab's children). */
  into?: Json[];
}

/**
 * Scatters theme props over a level so it looks lived-in: clutter on the ground, things hanging
 * from ceilings, a few dark foreground silhouettes, and lamp posts at 'L' markers.
 */
export function decorate(b: KitBuilder, level: Level, opts: DecorateOptions = {}) {
  const T = b.T;
  const x0 = opts.x0 ?? 0;
  const y0 = opts.y0 ?? 0;
  const density = opts.density ?? 0.5;
  const into = opts.into ?? b.entities;
  const avoid = opts.avoid ?? new Set<string>();
  const used = new Set<string>();
  const theme = b.theme;
  const props: PropChoice[] = Object.entries(theme.props).map(([name, raster]) => ({ name, raster, info: propInfoFor(theme, name) }));
  // Glowing ground things (mushrooms, crystals) are scattered too, just more rarely.
  const ground = props
    .filter((p) => p.info.anchor === 'ground' && (!p.info.light || p.raster.height <= 2 * T))
    .map((p) => (p.info.light ? { ...p, info: { ...p.info, weight: (p.info.weight ?? 1) * 0.4 } } : p));
  const wall = props.filter((p) => p.info.anchor === 'wall');
  const ceiling = props.filter((p) => p.info.anchor === 'ceiling' && !p.info.light);
  const lamps = props.filter((p) => p.info.light);
  const fog = theme.environment.fog?.color;

  const add = (p: PropChoice, cx: number, top: number, depth: number, extra: Json = {}) => {
    const asset = b.prop(p.name);
    if (!asset) return;
    const w = p.raster.width;
    const h = p.raster.height;
    const flip = typeof extra.flipX === 'boolean' ? extra.flipX : p.info.light ? false : b.rand() < 0.5;
    const l = p.info.light;
    into.push({
      id: b.id(`prop-${p.name}`),
      name: p.name,
      tags: ['decor'],
      components: {
        Transform: { position: { x: Math.round(cx), y: Math.round(top + h / 2) } },
        Sprite: { asset, depth, ...extra, flipX: flip },
        ...(l ? { Light: lightOf(l, l, { x: (flip ? w - l.x : l.x) - Math.round(w / 2), y: l.y - Math.round(h / 2) }) } : {}),
      },
    });
  };

  const fits = (x: number, y: number, cellsWide: number) => {
    for (let i = 0; i < cellsWide; i++) {
      if (!level.standable(x + i, y) || used.has(`${x + i},${y}`) || avoid.has(`${x + i},${y}`)) return false;
    }
    return true;
  };

  // Lamps at 'L' markers: a ground lamp stands there; a hanging lamp gets a post to hang from.
  for (const m of level.markers()) {
    if (m.ch !== 'L' || !lamps.length) continue;
    if (!level.standable(m.x, m.y)) continue;
    const groundLamps = lamps.filter((l) => l.info.anchor === 'ground');
    const surface = y0 + (m.y + 1) * T;
    const cx = x0 + m.x * T + T / 2;
    used.add(`${m.x},${m.y}`);
    if (groundLamps.length) {
      const p = weighted(groundLamps, b.rand)!;
      add(p, cx, surface - p.raster.height + 1, 2);
      continue;
    }
    const hanging = weighted(lamps, b.rand)!;
    const postH = Math.max(40, hanging.raster.height + 30);
    const post = lampPost(b, postH, hanging.raster.width);
    const postPath = b.asset(`assets/props/lamp-post-${postH}.png`, post);
    into.push({
      id: b.id('lamp-post'),
      name: 'Lamp post',
      tags: ['decor'],
      components: { Transform: { position: { x: Math.round(cx + post.width / 2 - 3), y: Math.round(surface - postH / 2 + 1) } }, Sprite: { asset: postPath, depth: 1 } },
    });
    add(hanging, cx + post.width - 6, surface - postH + 5, 2);
  }

  // Ceiling things: hang from the underside of solid cells.
  if (ceiling.length || lamps.some((l) => l.info.anchor === 'ceiling')) {
    for (let y = 1; y < level.height; y++)
      for (let x = 0; x < level.width; x++) {
        if (!level.solid(x, y - 1) || level.get(x, y) === '#' || level.get(x, y) === '=' || y - 1 < 0) continue;
        if (used.has(`${x},${y}`) || avoid.has(`${x},${y}`)) continue;
        // Only under real overhangs (there's open space below), not a 1-tile gap.
        if (level.solid(x, y + 1) || level.solid(x, y + 2)) continue;
        const roll = b.rand();
        const hangingLamps = lamps.filter((l) => l.info.anchor === 'ceiling');
        let p: PropChoice | null = null;
        if (hangingLamps.length && roll < 0.035 * (0.5 + density)) p = weighted(hangingLamps, b.rand);
        else if (ceiling.length && roll < 0.22 * density) p = weighted(ceiling, b.rand);
        if (!p) continue;
        used.add(`${x},${y}`);
        add(p, x0 + x * T + T / 2, y0 + y * T - 1, -2);
      }
  }

  // Ground clutter: grass, rubble, barrels… mostly behind the hero, a few in front.
  if (ground.length) {
    for (let y = 0; y < level.height; y++)
      for (let x = 0; x < level.width; x++) {
        if (b.rand() > 0.34 * density) continue;
        const p = weighted(ground, b.rand);
        if (!p) continue;
        const cells = Math.max(1, Math.ceil(p.raster.width / T));
        if (!fits(x, y, cells)) continue;
        for (let i = 0; i < cells; i++) used.add(`${x + i},${y}`);
        const front = p.info.front || (p.raster.height <= T && b.rand() < 0.25);
        const surface = y0 + (y + 1) * T;
        add(p, x0 + x * T + (cells * T) / 2 + Math.round((b.rand() - 0.5) * 6), surface - p.raster.height + 2, front ? 20 : -1);
      }
  }

  // Wall things (torches, signs, banners): on the side of rock faces, or on background walls.
  if (wall.length) {
    for (let y = 1; y < level.height - 1; y++)
      for (let x = 0; x < level.width; x++) {
        const c = level.get(x, y);
        if (c !== '.' && c !== '+') continue;
        if (used.has(`${x},${y}`) || avoid.has(`${x},${y}`) || level.standable(x, y)) continue;
        const side = level.solid(x - 1, y) ? -1 : level.solid(x + 1, y) ? 1 : 0;
        const onBack = c === '+' && level.get(x, y - 1) === '+' && level.get(x, y + 1) === '+';
        if (!side && !onBack) continue;
        // Keep them at about head height: 2–3 tiles above a floor.
        if (!(level.standable(x, y + 2) || level.standable(x, y + 3))) continue;
        if (b.rand() > (side ? 0.12 : 0.03) * density) continue;
        const p = weighted(wall, b.rand);
        if (!p) continue;
        used.add(`${x},${y}`);
        const cx = x0 + x * T + T / 2 + (side ? side * (T / 2 - p.raster.width / 2) : 0);
        add(p, cx, y0 + y * T + T / 2 - p.raster.height / 2, -2, side ? { flipX: side > 0 } : {});
      }
  }

  // A few big dark silhouettes in the very front, passing faster than the world (depth) —
  // unless the theme paints its own foreground layer.
  const hasForeground = theme.layers.some((l) => l.factor > 1);
  const tall = [...ground].filter((p) => !p.info.light).sort((a, b2) => b2.raster.height - a.raster.height).slice(0, 3);
  if (tall.length && density > 0 && !hasForeground) {
    const tint = fog ? darken(fog, 0.22) : b.shade(0);
    const step = 340;
    for (let wx = 160 + b.rand() * 200; wx < level.width * T; wx += step + b.rand() * 260) {
      const p = b.pick(tall);
      const asset = b.prop(p.name);
      if (!asset) continue;
      into.push({
        id: b.id('silhouette'),
        name: 'Foreground',
        tags: ['decor'],
        components: {
          Transform: { position: { x: Math.round(x0 + wx * 1.25), y: Math.round(y0 + level.height * T - p.raster.height * 0.9) }, scale: { x: 2, y: 2 } },
          Sprite: { asset, depth: 40, tint, scrollFactor: 1.25, flipX: b.rand() < 0.5 },
        },
      });
    }
  }
}

/** Darkens a hex colour towards black by `k` (0..1 = how much brightness to keep). */
export function darken(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v * k).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`.toUpperCase();
}

/** A simple iron lamp post with an arm, in the theme's darkest colours. */
function lampPost(b: KitBuilder, height: number, lampWidth: number): Raster {
  const w = Math.max(14, lampWidth + 8);
  const data = new Uint8ClampedArray(w * height * 4);
  const rgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  };
  const dark = rgb(b.shade(0));
  const mid = rgb(b.shade(2));
  const set = (x: number, y: number, c: number[]) => {
    if (x >= 0 && y >= 0 && x < w && y < height) data.set(c, (y * w + x) * 4);
  };
  for (let y = 2; y < height; y++) {
    set(1, y, dark);
    set(2, y, y % 7 === 0 ? dark : mid);
  }
  for (let x = 1; x < w - 4; x++) {
    set(x, 1, dark);
    set(x, 2, mid);
  }
  set(w - 5, 3, dark);
  set(w - 5, 4, dark);
  // a little brace under the arm
  for (let i = 0; i < 5; i++) set(3 + i, 3 + i, dark);
  for (let x = 0; x < 4; x++) {
    set(x, height - 1, dark);
    set(x, height - 2, mid);
  }
  return { width: w, height, data };
}

/** Applies the kit's "time of day" and "weather" choices on top of a theme's environment. */
export function moodEnvironment(base: Environment, time: string, weather: string): Environment {
  const env: Environment = JSON.parse(JSON.stringify(base ?? {}));
  if (time === 'day') {
    env.ambient = { color: '#FFFFFF', intensity: 1 };
    if (env.bloom) env.bloom.strength = Math.min(env.bloom.strength, 0.3);
    env.vignette = Math.min(env.vignette ?? 0.2, 0.25);
  } else if (time === 'dusk') {
    env.ambient = { color: '#C8A0B8', intensity: 0.85 };
    env.grade = { ...(env.grade ?? {}), tint: '#FFE0D0' };
  } else if (time === 'night') {
    env.ambient = { color: env.ambient?.color ?? '#506080', intensity: Math.min(0.42, (env.ambient?.intensity ?? 1) * 0.6) };
    env.bloom = { strength: Math.max(0.6, env.bloom?.strength ?? 0), threshold: env.bloom?.threshold ?? 0.65 };
    env.vignette = Math.max(env.vignette ?? 0, 0.5);
  }
  if (weather && weather !== 'theme') {
    const keep = (env.particles ?? []).filter((p) => p.type === 'dust');
    if (weather === 'clear') env.particles = keep;
    else env.particles = [...keep, { type: weather as 'rain', density: weather === 'rain' ? 0.75 : 0.55 }];
  }
  return env;
}

function paletteOf(theme: KitTheme): string[] {
  const pal = [...new Set(theme.palette.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c)).map((c) => c.toUpperCase()))].slice(0, 16);
  return pal.length >= 2 ? pal : ['#000000', '#FFFFFF'];
}

/** Standard keyboard actions for kit games. */
export function manifestFor(spec: GameSpec, theme: KitTheme, o: { gravity: number; touch: ProjectManifest['touch']; input?: Record<string, string[]> }): ProjectManifest {
  return {
    engine: 'degamed',
    engineVersion: '0.1.0',
    title: (spec.title || 'Untitled').slice(0, 80),
    resolution: { width: VIEW_W, height: VIEW_H },
    artStyle: 'pixel-16',
    palette: paletteOf(theme),
    defaultLanguage: 'javascript',
    physics: { engine: 'arcade', gravity: { x: 0, y: o.gravity } },
    startScene: 'scenes/main.scene.json',
    input: o.input ?? {
      left: ['ArrowLeft', 'KeyA'],
      right: ['ArrowRight', 'KeyD'],
      up: ['ArrowUp', 'KeyW'],
      down: ['ArrowDown', 'KeyS'],
      jump: ['Space', 'KeyZ', 'ArrowUp', 'KeyW'],
      attack: ['KeyX', 'KeyJ'],
      action: ['Enter', 'KeyE'],
    },
    touch: o.touch,
  };
}

/** The HUD text entity (top-left, on the UI layer). */
export function hudEntity(show: string): Json {
  return {
    id: 'hud',
    name: 'HUD',
    tags: ['ui'],
    components: {
      Transform: { position: { x: 8, y: 7 } },
      Text: { text: '', size: 8, color: '#FFFFFF' },
      Script: { src: 'scripts/hud.js', props: { show } },
    },
  };
}

/** A title card shown for the first seconds of play. */
export function titleEntity(title: string): Json {
  return {
    id: 'title',
    name: 'Title',
    tags: ['ui'],
    components: {
      Transform: { position: { x: VIEW_W / 2, y: 40 } },
      Text: { text: title.toUpperCase(), size: 20, color: '#FFFFFF', align: 'center' },
      Script: { src: 'scripts/title.js' },
    },
  };
}

export const TITLE_JS = `import { Behaviour, Game } from 'degamed';

// Shows the game's name for a moment, then fades away.
export default class Title extends Behaviour {
  onUpdate() {
    const t = Game.time;
    this.entity.alpha = t < 0.3 ? t / 0.3 : t < 2.2 ? 1 : Math.max(0, 1 - (t - 2.2) / 0.6);
    if (t > 3) this.entity.visible = false;
  }
}
`;
