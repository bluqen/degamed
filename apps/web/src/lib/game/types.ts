/**
 * Local copies of the cross-agent contracts (docs/team/BRIEF.md). The UI codes against these;
 * `./index.ts` decides whether the real packages or the local stubs provide them.
 */
import type { ProjectFiles } from '@degamed/shared';
import type { Raster } from '@degamed/engine/templates';

export type Encoder = (raster: Raster) => string;
export type { Raster, ProjectFiles };

// engine → design: kits
export interface KitParam {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'choice';
  min?: number;
  max?: number;
  step?: number;
  choices?: string[];
  default: number | boolean | string;
  group?: string;
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

// art → everyone: the parts of an ArtTheme the app shows (the real ArtTheme is a superset).
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
}
export interface ThemeArt {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  palette: string[];
  background: string;
  layers: { name: string; raster: Raster; factor: number; y?: number; tiled?: boolean }[];
  tiles: { ground: Raster; fill: Raster; platform: Raster; [k: string]: Raster };
  sprites: { hero: SpriteSheet; enemy: SpriteSheet; pickup: SpriteSheet; goal: SpriteSheet; [k: string]: SpriteSheet };
  props?: Record<string, Raster>;
  /** Lighting, fog, particles and grade (rendered by the engine). */
  environment?: Record<string, unknown>;
  tileSize?: number;
}

// ai → design
export type ProviderId = 'instant' | 'gemini' | 'openai' | 'anthropic' | 'degamed';
export interface AiSettings {
  provider: ProviderId;
  apiKey?: string;
  model?: string;
  apiUrl?: string;
  authToken?: string;
}
export interface Progress {
  stage: 'understanding' | 'designing' | 'building' | 'testing' | 'fixing' | 'done';
  message: string;
}
export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}
export interface CreateResult {
  files: ProjectFiles;
  spec: GameSpec;
  title: string;
  summary: string;
}
export interface EditResult {
  files: ProjectFiles;
  summary: string;
  changed: string[];
}
