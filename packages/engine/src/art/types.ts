import type { Raster } from '../pixel';

export interface SheetAnim {
  frames: number[];
  fps: number;
  loop: boolean;
}

export interface SpriteSheet {
  raster: Raster;
  frameWidth: number;
  frameHeight: number;
  animations: Record<string, SheetAnim>;
  /** Optional (additive): the solid body inside a frame, in frame pixels, for physics. */
  hitbox?: { x: number; y: number; w: number; h: number };
  /** Optional (additive): pixel inside a frame that should sit on the ground / at the entity origin. */
  anchor?: { x: number; y: number };
}

export interface Light {
  color: string;
  radius: number;
  intensity: number;
  flicker?: number;
}

/** Mirrors the engine's scene `environment` contract (packages/shared). */
export interface Environment {
  ambient?: { color: string; intensity: number };
  fog?: { color: string; density: number; height?: number };
  bloom?: { strength: number; threshold?: number };
  vignette?: number;
  grade?: { contrast?: number; saturation?: number; tint?: string };
  particles?: { type: 'rain' | 'dust' | 'fireflies' | 'snow' | 'embers' | 'spores'; density: number; color?: string }[];
}

export interface ParallaxLayer {
  name: string;
  raster: Raster;
  /** Scroll factor: 0 = fixed to the camera, 1 = moves with the world. */
  factor: number;
  /** Top of the layer in screen pixels at a 270px-tall view. */
  y?: number;
  /** Repeat horizontally. */
  tiled?: boolean;
}

/** Optional (additive) placement hints for a prop. */
export interface PropInfo {
  /** Where the prop attaches: standing on the ground, hanging from a ceiling, or free. */
  anchor: 'ground' | 'ceiling' | 'wall' | 'free';
  /** Draw in front of the hero (foreground) instead of behind. */
  front?: boolean;
  /** A light the prop emits, offset from the prop's top-left in pixels. */
  light?: Light & { x: number; y: number };
  /** Rough relative frequency when scattering decorations. */
  weight?: number;
}

export interface ArtTheme {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  palette: string[];
  background: string;
  layers: ParallaxLayer[];
  tiles: { ground: Raster; fill: Raster; platform: Raster; [k: string]: Raster };
  sprites: {
    hero: SpriteSheet;
    enemy: SpriteSheet;
    pickup: SpriteSheet;
    goal: SpriteSheet;
    [k: string]: SpriteSheet;
  };
  props: Record<string, Raster>;
  environment: Environment;
  /** Optional (additive): placement hints for `props`. */
  propInfo?: Record<string, PropInfo>;
  /** Optional (additive): lights the engine can attach to sprites. */
  lights?: { hero?: Light; pickup?: Light; goal?: Light; enemy?: Light };
  /** Optional (additive): tile size in pixels (all tiles are square). */
  tileSize?: number;
}
