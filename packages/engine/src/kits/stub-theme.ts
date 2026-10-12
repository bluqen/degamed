/**
 * A small fallback theme built from the starter pixel art, used when the art library isn't
 * available (or a spec names a theme that doesn't exist). Real themes come from `../art`.
 */
import {
  COIN_FRAMES,
  ditheredSky,
  KNIGHT_FRAMES,
  rasterize,
  ridgeLayer,
  sheetOf,
  SLIME_FRAMES,
  SPRITES,
  SWEETIE16 as P,
  type PixelGrid,
} from '../pixel';
import type { KitTheme } from './types';

const LAMP: PixelGrid = {
  colors: { o: P.ink, g: P.gold, w: P.white, s: P.shadow, m: P.slate },
  rows: [
    '..ooo..',
    '.ogwgo.',
    '.ogwgo.',
    '.ogggo.',
    '..ooo..',
    '...s...',
    '...s...',
    '...s...',
    '...s...',
    '...s...',
    '...s...',
    '...s...',
    '...s...',
    '...m...',
    '...s...',
    '...s...',
    '...s...',
    '..sss..',
    '.smmms.',
  ],
};

const ROCK: PixelGrid = {
  colors: { o: P.ink, a: P.slate, b: P.silver, s: P.shadow },
  rows: ['...ooo....', '..oabbo...', '.oaabbbo..', '.oaaaabbo.', 'osaaaaaabo', 'ossssaaaao'],
};

const TUFT: PixelGrid = {
  colors: { g: P.green, l: P.lime, t: P.teal },
  rows: ['.l...l.', '.g.l.g.', 'tg.g.gt', 'tgtgtgt'],
};

const SHROOM: PixelGrid = {
  colors: { o: P.ink, c: P.cyan, w: P.white, s: P.silver, t: P.teal },
  rows: ['..ooo..', '.occco.', 'occwcco', 'ooooooo', '...s...', '...s...', '..tst..'],
};

export function stubTheme(): KitTheme {
  return {
    id: 'starter',
    name: 'Starter Hills',
    description: 'Bright starter hills at dusk with fireflies.',
    keywords: ['starter', 'hills', 'simple', 'classic'],
    palette: Object.values(P),
    background: P.navy,
    layers: [
      { name: 'sky', raster: ditheredSky(64, 270, [P.ink, P.navy, P.plum, P.red]), factor: 0, tiled: true },
      { name: 'mountains', raster: ridgeLayer(320, 270, { base: 110, amplitude: 34, color: P.shadow, rim: P.slate, seed: 7 }), factor: 0.15, tiled: true },
      { name: 'hills', raster: ridgeLayer(240, 270, { base: 70, amplitude: 18, color: P.teal, rim: P.green, seed: 21, roughness: 1.6 }), factor: 0.4, tiled: true },
    ],
    tiles: { ground: rasterize(SPRITES.grass), fill: rasterize(SPRITES.dirt), platform: rasterize(SPRITES.grass) },
    sprites: {
      hero: {
        raster: sheetOf(KNIGHT_FRAMES.map(rasterize)),
        frameWidth: 16,
        frameHeight: 16,
        animations: {
          idle: { frames: [0, 1], fps: 3, loop: true },
          run: { frames: [2, 3, 4, 3], fps: 10, loop: true },
          jump: { frames: [5], fps: 1, loop: true },
          fall: { frames: [6], fps: 1, loop: true },
        },
        hitbox: { x: 3, y: 2, w: 10, h: 14 },
      },
      enemy: {
        raster: sheetOf(SLIME_FRAMES.map(rasterize)),
        frameWidth: 16,
        frameHeight: 16,
        animations: { walk: { frames: [0, 1], fps: 4, loop: true } },
        hitbox: { x: 2, y: 6, w: 12, h: 10 },
      },
      pickup: {
        raster: sheetOf(COIN_FRAMES.map(rasterize)),
        frameWidth: 10,
        frameHeight: 10,
        animations: { idle: { frames: [0, 1, 2, 3], fps: 8, loop: true } },
      },
      goal: {
        raster: rasterize(SPRITES.flag),
        frameWidth: rasterize(SPRITES.flag).width,
        frameHeight: rasterize(SPRITES.flag).height,
        animations: { idle: { frames: [0], fps: 1, loop: true } },
      },
    },
    props: { lamp: rasterize(LAMP), rock: rasterize(ROCK), tuft: rasterize(TUFT), mushroom: rasterize(SHROOM) },
    propInfo: {
      lamp: { anchor: 'ground', light: { color: '#FFCD75', radius: 80, intensity: 1, flicker: 0.15, x: 3, y: 2 } },
      rock: { anchor: 'ground', weight: 2 },
      tuft: { anchor: 'ground', weight: 4 },
      mushroom: { anchor: 'ground', weight: 1, light: { color: '#73EFF7', radius: 26, intensity: 0.6, x: 3, y: 2 } },
    },
    lights: {
      hero: { color: '#FFE7B0', radius: 70, intensity: 0.7 },
      pickup: { color: '#FFCD75', radius: 22, intensity: 0.5 },
      goal: { color: '#73EFF7', radius: 90, intensity: 1 },
    },
    environment: {
      ambient: { color: '#8C7FB8', intensity: 0.8 },
      fog: { color: '#B13E53', density: 0.25, height: 0.5 },
      bloom: { strength: 0.5, threshold: 0.75 },
      vignette: 0.35,
      grade: { contrast: 1.05, saturation: 1.05 },
      particles: [{ type: 'fireflies', density: 0.5 }],
    },
    tileSize: 16,
  };
}
