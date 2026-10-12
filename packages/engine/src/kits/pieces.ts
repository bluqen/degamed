/**
 * Entity recipes shared by the kits: the hero, pickups, enemies, hazards, checkpoints, the goal.
 * Each returns plain scene JSON.
 */
import type { Raster } from '../pixel';
import { KitBuilder, lightOf, type Level } from './build';
import type { SpriteSheet } from './types';

type Json = Record<string, unknown>;

const rgba = (hex: string): [number, number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
};

function raster(w: number, h: number, paint: (set: (x: number, y: number, hex: string) => void) => void): Raster {
  const data = new Uint8ClampedArray(w * h * 4);
  paint((x, y, hex) => {
    if (x >= 0 && y >= 0 && x < w && y < h) data.set(rgba(hex), (y * w + x) * 4);
  });
  return { width: w, height: h, data };
}

/** The theme's spike tile, or a row of little metal spikes drawn in its colours. */
export function spikeRaster(b: KitBuilder): Raster {
  const own = b.theme.tiles.spike ?? b.theme.tiles.spikes ?? b.theme.props.spikes ?? b.theme.props.spike;
  if (own) return own;
  const T = b.T;
  const light = b.accent();
  const mid = b.shade(Math.min(4, b.theme.palette.length - 1));
  const dark = b.shade(0);
  return raster(T, 8, (set) => {
    for (let s = 0; s < T; s += 4) {
      for (let y = 0; y < 8; y++) {
        const half = Math.floor((y + 1) / 2);
        for (let x = 2 - half; x <= 1 + half; x++) set(s + x, y, x === 2 - half ? dark : y < 2 ? light : mid);
      }
    }
    for (let x = 0; x < T; x++) set(x, 7, dark);
  });
}

/** A checkpoint beacon: a slim post with a lantern cage on top (lit by its Light). */
function beaconRaster(b: KitBuilder): Raster {
  const dark = b.shade(0);
  const mid = b.shade(2);
  const glow = b.accent();
  return raster(9, 30, (set) => {
    for (let y = 8; y < 30; y++) {
      set(4, y, dark);
      set(5, y, mid);
    }
    for (let x = 2; x < 7; x++) set(x, 29, dark);
    // cage
    for (let x = 1; x < 8; x++) {
      set(x, 0, dark);
      set(x, 8, dark);
    }
    for (let y = 0; y < 9; y++) {
      set(1, y, dark);
      set(7, y, dark);
    }
    for (let y = 2; y < 7; y++) for (let x = 3; x < 6; x++) set(x, y, y === 2 || x === 3 ? '#FFFFFF' : glow);
  });
}

export interface HeroOptions {
  x: number;
  y: number;
  script: string;
  props: Record<string, number | boolean | string>;
}

export function heroEntity(b: KitBuilder, o: HeroOptions): Json {
  const sheet = b.theme.sprites.hero;
  const frames = b.sheet('hero')!;
  return {
    id: 'player',
    name: 'Player',
    tags: ['player'],
    components: {
      Transform: { position: { x: o.x, y: o.y - b.feet(sheet) } },
      AnimatedSprite: { frames, auto: true, depth: 10 },
      Body: b.body(sheet),
      Script: { src: o.script, props: o.props },
      Light: lightOf(b.theme.lights?.hero, { color: '#FFE7B0', radius: 60, intensity: 0.5 }),
    },
  };
}

export function cameraEntity(o: { lookAhead: number; deadZone: { width: number; height: number }; smoothing?: number }): Json {
  return {
    id: 'camera',
    name: 'Camera',
    tags: [],
    components: {
      Transform: { position: { x: 0, y: 0 } },
      Camera: { follow: 'player', lookAhead: o.lookAhead, deadZone: o.deadZone, smoothing: o.smoothing ?? 0.12 },
    },
  };
}

export function coinEntity(b: KitBuilder, x: number, y: number): Json {
  const sheet = b.theme.sprites.pickup;
  const frames = b.sheet('pickup')!;
  return {
    id: b.id('coin'),
    name: 'Pickup',
    tags: ['coin'],
    components: {
      Transform: { position: { x, y } },
      AnimatedSprite: { frames, depth: 6 },
      Body: { type: 'static', sensor: true, width: Math.min(sheet.frameWidth, 14), height: Math.min(sheet.frameHeight, 14) },
      Script: { src: 'scripts/pickup.js' },
      Light: lightOf(b.theme.lights?.pickup, { color: b.accent(), radius: 26, intensity: 0.55 }),
    },
  };
}

function enemySheet(b: KitBuilder, flying: boolean): { key: string; sheet: SpriteSheet } {
  const flyer = flying ? b.theme.sprites.flyer ?? b.theme.sprites.bat : undefined;
  if (flyer) return { key: b.theme.sprites.flyer ? 'flyer' : 'bat', sheet: flyer };
  return { key: 'enemy', sheet: b.theme.sprites.enemy };
}

export function walkerEntity(b: KitBuilder, level: Level, cx: number, cy: number, o: { speed: number; hp?: number; x0?: number; y0?: number }): Json {
  const T = b.T;
  const { key, sheet } = enemySheet(b, false);
  const frames = b.sheet(key)!;
  const [a, z] = level.ledge(cx, cy);
  const x0 = o.x0 ?? 0;
  const y0 = o.y0 ?? 0;
  const surface = y0 + (cy + 1) * T;
  const walk = sheet.animations.walk ? 'walk' : Object.keys(sheet.animations)[0];
  return {
    id: b.id('enemy'),
    name: 'Enemy',
    tags: ['enemy'],
    components: {
      Transform: { position: { x: x0 + cx * T + T / 2, y: surface - b.feet(sheet) - 1 } },
      AnimatedSprite: { frames, animation: walk, depth: 8 },
      Body: b.body(sheet),
      Script: {
        src: 'scripts/walker.js',
        props: { speed: o.speed, hp: o.hp ?? 1, left: Math.max(0, (cx - a) * T - 4), right: Math.max(0, (z - cx) * T - 4), color: b.dustColor() },
      },
      ...(b.theme.lights?.enemy ? { Light: lightOf(b.theme.lights.enemy, b.theme.lights.enemy) } : {}),
    },
  };
}

export function flyerEntity(b: KitBuilder, x: number, y: number, o: { speed: number; range: number; chase: number }): Json {
  const { key, sheet } = enemySheet(b, true);
  const frames = b.sheet(key)!;
  const anim = sheet.animations.fly ? 'fly' : sheet.animations.walk ? 'walk' : Object.keys(sheet.animations)[0];
  return {
    id: b.id('flyer'),
    name: 'Flyer',
    tags: ['enemy'],
    components: {
      Transform: { position: { x, y } },
      AnimatedSprite: { frames, animation: anim, depth: 8 },
      Body: { ...b.body(sheet), gravity: false },
      Script: { src: 'scripts/flyer.js', props: { speed: o.speed, range: o.range, chase: o.chase, color: b.accent() } },
      Light: lightOf(b.theme.lights?.enemy, { color: '#C8A0FF', radius: 30, intensity: 0.45, flicker: 0.1 }),
    },
  };
}

/** A run of spikes standing on the surface at `surfaceY`. */
export function spikeEntity(b: KitBuilder, x: number, surfaceY: number, cells: number): Json {
  const r = spikeRaster(b);
  const asset = b.asset('assets/tiles/spikes.png', r);
  const w = cells * b.T;
  return {
    id: b.id('spikes'),
    name: 'Spikes',
    tags: ['hazard'],
    components: {
      Transform: { position: { x: x + w / 2, y: surfaceY - r.height / 2 } },
      Sprite: { asset, tiled: true, width: w, height: r.height, depth: 3 },
      Body: { type: 'static', sensor: true, width: w - 6, height: Math.max(4, r.height - 3) },
    },
  };
}

export function checkpointEntity(b: KitBuilder, x: number, surfaceY: number): Json {
  const own = b.theme.sprites.checkpoint;
  const accent = b.accent();
  if (own) {
    const frames = b.sheet('checkpoint')!;
    return {
      id: b.id('checkpoint'),
      name: 'Checkpoint',
      tags: ['checkpoint'],
      components: {
        Transform: { position: { x, y: surfaceY - b.feet(own) } },
        AnimatedSprite: { frames, animation: own.animations.idle ? 'idle' : Object.keys(own.animations)[0], depth: 4 },
        Body: { type: 'static', sensor: true, width: 20, height: own.frameHeight },
        Script: { src: 'scripts/checkpoint.js', props: { color: accent } },
      },
    };
  }
  const r = beaconRaster(b);
  const asset = b.asset('assets/sprites/checkpoint.png', r);
  return {
    id: b.id('checkpoint'),
    name: 'Checkpoint',
    tags: ['checkpoint'],
    components: {
      Transform: { position: { x, y: surfaceY - r.height / 2 + 1 } },
      Sprite: { asset, depth: 4 },
      Body: { type: 'static', sensor: true, width: 20, height: r.height },
      Script: { src: 'scripts/checkpoint.js', props: { color: accent } },
    },
  };
}

export function goalEntity(b: KitBuilder, x: number, surfaceY: number, need = 0): Json {
  const sheet = b.theme.sprites.goal;
  const frames = b.sheet('goal')!;
  const color = b.theme.lights?.goal?.color ?? b.accent();
  return {
    id: 'goal',
    name: 'Goal',
    tags: ['goal'],
    components: {
      Transform: { position: { x, y: surfaceY - b.feet(sheet) } },
      AnimatedSprite: { frames, animation: sheet.animations.idle ? 'idle' : Object.keys(sheet.animations)[0], depth: 4 },
      Body: { type: 'static', sensor: true, width: Math.max(16, Math.round(sheet.frameWidth * 0.6)), height: sheet.frameHeight },
      Script: { src: 'scripts/goal.js', props: { need, color } },
      Light: lightOf(b.theme.lights?.goal, { color, radius: 90, intensity: 1, flicker: 0.05 }, { x: 0, y: -Math.round(sheet.frameHeight * 0.2) }),
    },
  };
}

/** A rope or vine to climb, hanging from `top` down to `bottom` (world pixels). */
export function ladderEntity(b: KitBuilder, x: number, top: number, bottom: number): Json {
  const own = b.theme.props.rope ?? b.theme.props.vine ?? b.theme.props.ladder;
  const dark = b.shade(1);
  const mid = b.dustColor();
  const r =
    own && own.width <= 12
      ? own
      : raster(6, 8, (set) => {
          for (let y = 0; y < 8; y++) {
            set(1, y, dark);
            set(4, y, dark);
            set(2, y, y % 4 < 2 ? mid : dark);
            set(3, y, y % 4 >= 2 ? mid : dark);
          }
        });
  const asset = b.asset('assets/sprites/rope.png', r);
  const h = bottom - top;
  return {
    id: b.id('rope'),
    name: 'Rope',
    tags: ['ladder'],
    components: {
      Transform: { position: { x, y: top + h / 2 } },
      Sprite: { asset, tiled: true, width: r.width, height: h, depth: -1 },
      Body: { type: 'static', sensor: true, width: 10, height: h },
    },
  };
}
