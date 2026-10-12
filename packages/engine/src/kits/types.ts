import type { Environment } from '@degamed/shared';
import type { Raster } from '../pixel';

/** Turns raw pixels into a data URL (the browser uses a canvas; tests pass a fake). */
export type Encoder = (raster: Raster) => string;

export interface KitParam {
  key: string;
  /** Plain English, shown next to a slider or switch. */
  label: string;
  type: 'number' | 'boolean' | 'choice';
  min?: number;
  max?: number;
  step?: number;
  choices?: string[];
  default: number | boolean | string;
  /** Groups params in the simple editor: 'Feel', 'Level', 'Challenge', 'Look'. */
  group?: string;
  /** One-line help text. */
  hint?: string;
}

export interface Kit {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  params: KitParam[];
}

export interface GameSpec {
  kit: string;
  title: string;
  theme: string;
  seed?: number;
  params?: Record<string, number | boolean | string>;
  story?: string;
}

// ── Theme shape the kits consume (structurally the art agent's ArtTheme) ──────────────────────

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
  /** The solid body inside a frame, in frame pixels. */
  hitbox?: { x: number; y: number; w: number; h: number };
  /** The pixel that sits on the ground. */
  anchor?: { x: number; y: number };
}

export interface ThemeLight {
  color: string;
  radius: number;
  intensity: number;
  flicker?: number;
}

export interface PropInfo {
  anchor: 'ground' | 'ceiling' | 'wall' | 'free';
  front?: boolean;
  /** Light offset from the prop's top-left. */
  light?: ThemeLight & { x: number; y: number };
  weight?: number;
}

export interface KitTheme {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  palette: string[];
  background: string;
  layers: { name: string; raster: Raster; factor: number; y?: number; tiled?: boolean }[];
  tiles: { ground: Raster; fill: Raster; platform: Raster; [k: string]: Raster };
  sprites: { hero: SpriteSheet; enemy: SpriteSheet; pickup: SpriteSheet; goal: SpriteSheet; [k: string]: SpriteSheet };
  props: Record<string, Raster>;
  environment: Environment;
  propInfo?: Record<string, PropInfo>;
  lights?: { hero?: ThemeLight; pickup?: ThemeLight; goal?: ThemeLight; enemy?: ThemeLight };
  tileSize?: number;
}

export interface ThemeSummary {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  palette: string[];
}
