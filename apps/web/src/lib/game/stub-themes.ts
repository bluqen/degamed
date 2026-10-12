/**
 * Stand-in art themes used until `ART_THEMES` from the art agent lands. They follow the
 * ArtTheme contract, so previews and theme switching work the same way with the real thing.
 */
import { createPlatformerTemplate } from '@degamed/engine/templates';
import type { Raster, SpriteSheet, ThemeArt } from './types';

const H = 270;

/** The starter template's sprites and tiles, captured as rasters through a recording encoder. */
function starterRasters(): Record<string, Raster> {
  const seen = new Map<string, Raster>();
  let n = 0;
  const files = createPlatformerTemplate((r) => {
    const key = `raster:${n++}`;
    seen.set(key, r);
    return key;
  });
  const out: Record<string, Raster> = {};
  for (const [path, value] of Object.entries(files)) {
    const r = seen.get(value);
    if (r) out[path] = r;
  }
  return out;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const rgba = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
};

function ditheredSky(width: number, height: number, stops: string[], blend = 0.3): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  const colors = stops.map(rgba);
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

function ridgeLayer(width: number, height: number, o: { base: number; amplitude: number; color: string; rim: string; seed: number; roughness?: number }): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  let a = o.seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const waves = Array.from({ length: 4 }, (_, i) => ({ freq: (i + 1) * (1 + Math.floor(rand() * 2)), phase: rand() * Math.PI * 2, amp: o.amplitude / (i + 1) ** (o.roughness ?? 1.2) }));
  const fill = rgba(o.color);
  const rim = rgba(o.rim);
  for (let x = 0; x < width; x++) {
    const u = (x / width) * Math.PI * 2;
    const ridge = Math.round(height - o.base - waves.reduce((s, w) => s + Math.sin(u * w.freq + w.phase) * w.amp, 0));
    for (let y = Math.max(0, ridge); y < height; y++) data.set(y - ridge < 2 ? rim : fill, (y * width + x) * 4);
  }
  return { width, height, data };
}

function recolor(r: Raster, map: Record<string, string>): Raster {
  const lut = new Map<number, [number, number, number]>();
  for (const [from, to] of Object.entries(map)) {
    const a = parseInt(from.slice(1), 16);
    const b = parseInt(to.slice(1), 16);
    lut.set(a, [(b >> 16) & 255, (b >> 8) & 255, b & 255]);
  }
  const data = new Uint8ClampedArray(r.data);
  for (let i = 0; i < data.length; i += 4) {
    const key = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
    const to = lut.get(key);
    if (to) data.set(to, i);
  }
  return { width: r.width, height: r.height, data };
}

const sheet = (raster: Raster, w: number, h: number, animations: SpriteSheet['animations']): SpriteSheet => ({ raster, frameWidth: w, frameHeight: h, animations });

interface Look {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  sky: string[];
  far: [string, string];
  near: [string, string];
  grass: Record<string, string>;
}

const LOOKS: Look[] = [
  {
    id: 'meadow',
    name: 'Sunny Meadow',
    description: 'Bright skies, rolling green hills and a cheerful, classic feel.',
    keywords: ['sunny', 'happy', 'classic', 'meadow', 'grass', 'day', 'cute'],
    sky: ['#29366F', '#3B5DC9', '#41A6F6', '#73EFF7'],
    far: ['#566C86', '#94B0C2'],
    near: ['#257179', '#38B764'],
    grass: {},
  },
  {
    id: 'rain-ruins',
    name: 'Rain Ruins',
    description: 'Moody, rain-soaked ruins under a heavy teal sky.',
    keywords: ['rain', 'moody', 'ruins', 'night', 'robot', 'sad', 'storm', 'city'],
    sky: ['#0b1220', '#13243a', '#1d3a4f', '#2c5a66'],
    far: ['#16283a', '#2a4a5c'],
    near: ['#0f1c26', '#2f5a5a'],
    grass: { '#A7F070': '#6fa59a', '#38B764': '#3a6f6a', '#257179': '#1f4448' },
  },
  {
    id: 'ember-caves',
    name: 'Ember Caves',
    description: 'Deep caverns lit by glowing embers and molten rock.',
    keywords: ['cave', 'fire', 'lava', 'dungeon', 'ember', 'hot', 'underground', 'dark'],
    sky: ['#120a10', '#2a1018', '#4a1a1f', '#7a2e22'],
    far: ['#2a1218', '#5a2324'],
    near: ['#1a0c10', '#8a3a24'],
    grass: { '#A7F070': '#ffb05a', '#38B764': '#c2582f', '#257179': '#5d275d' },
  },
  {
    id: 'frost-peaks',
    name: 'Frost Peaks',
    description: 'Crisp snowy mountains, pale light and icy blue shadows.',
    keywords: ['snow', 'ice', 'winter', 'cold', 'frost', 'mountain', 'christmas'],
    sky: ['#3d4f7a', '#6a86b8', '#a8c4e6', '#e4f0fb'],
    far: ['#7d93b8', '#dfe9f5'],
    near: ['#5a6f96', '#f4f8fc'],
    grass: { '#A7F070': '#f4f8fc', '#38B764': '#b9cde6', '#257179': '#6f86ad' },
  },
  {
    id: 'neon-night',
    name: 'Neon Night',
    description: 'A synth-wave city at midnight with glowing magenta and cyan.',
    keywords: ['neon', 'cyber', 'cyberpunk', 'city', 'synth', 'retro', 'future', 'night'],
    sky: ['#0d0221', '#261447', '#541f6b', '#b33f8a'],
    far: ['#1b0f3a', '#3d2a7a'],
    near: ['#120a26', '#22d3ee'],
    grass: { '#A7F070': '#ff5ca8', '#38B764': '#9b2f8a', '#257179': '#3d1a5a' },
  },
];

function build(l: Look, art: Record<string, Raster>): ThemeArt {
  const grass = recolor(art['assets/tiles/grass.png']!, l.grass);
  const flag = art['assets/sprites/flag.png']!;
  return {
    id: l.id,
    name: l.name,
    description: l.description,
    keywords: l.keywords,
    palette: [...l.sky, ...l.far, ...l.near],
    background: l.sky[0]!,
    layers: [
      { name: 'sky', raster: ditheredSky(64, H, l.sky), factor: 0 },
      { name: 'far', raster: ridgeLayer(320, H, { base: 120, amplitude: 34, color: l.far[0], rim: l.far[1], seed: 7 }), factor: 0.2 },
      { name: 'near', raster: ridgeLayer(240, H, { base: 56, amplitude: 18, color: l.near[0], rim: l.near[1], seed: 21, roughness: 1.6 }), factor: 0.45 },
    ],
    tiles: { ground: grass, fill: recolor(art['assets/tiles/dirt.png']!, l.grass), platform: grass },
    sprites: {
      hero: sheet(art['assets/sprites/knight-sheet.png']!, 16, 16, { idle: { frames: [0, 1], fps: 3, loop: true }, run: { frames: [2, 3, 4, 3], fps: 10, loop: true }, jump: { frames: [5], fps: 1, loop: true }, fall: { frames: [6], fps: 1, loop: true } }),
      enemy: sheet(art['assets/sprites/slime-sheet.png']!, 16, 16, { walk: { frames: [0, 1], fps: 4, loop: true } }),
      pickup: sheet(art['assets/sprites/coin-sheet.png']!, 10, 10, { idle: { frames: [0, 1, 2, 3], fps: 8, loop: true } }),
      goal: sheet(flag, flag.width, flag.height, { idle: { frames: [0], fps: 1, loop: true } }),
    },
  };
}

let cache: ThemeArt[] | null = null;
export function stubThemes(): ThemeArt[] {
  if (!cache) {
    const art = starterRasters();
    cache = LOOKS.map((l) => build(l, art));
  }
  return cache;
}
