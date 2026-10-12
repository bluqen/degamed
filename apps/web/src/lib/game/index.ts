/**
 * The one place the app gets games, kits, themes and AI from.
 *
 * Contracts (docs/team/BRIEF.md):
 *   engine  → KITS, buildGame, readSpec, listThemes   (@degamed/engine/kits)
 *   art     → ART_THEMES                              (@degamed/engine/art)
 *   ai      → createGame, editGame, suggestions, availableProviders (@degamed/ai)
 * The UI imports only from here, so a contract change is a change to this file.
 */
import { ART_THEMES } from '@degamed/engine/art';
import * as kits from '@degamed/engine/kits';
import * as ai from '@degamed/ai';
import { rasterToDataUrl } from '../project-files';
import type { Encoder, GameSpec, Kit, ProjectFiles, ThemeArt } from './types';

export * from './types';

/** Encodes rasters as PNG data URLs in the browser. */
export const encode: Encoder = rasterToDataUrl;

export const KITS: Kit[] = kits.KITS;
export const buildGame: (spec: GameSpec, encode: Encoder) => ProjectFiles = kits.buildGame;
export const readSpec: (files: ProjectFiles) => GameSpec | null = kits.readSpec;

/** Art themes with their rasters (previews, the Look panel). */
export function themes(): ThemeArt[] {
  return ART_THEMES as unknown as ThemeArt[];
}

export const createGame = ai.createGame;
export const editGame = ai.editGame;
export const suggestions = ai.suggestions;
export const availableProviders = ai.availableProviders;
export const PROVIDER_LABELS = ai.PROVIDER_LABELS;

/** The bright, friendly look used for the demo (falls back to the first theme). */
export function demoTheme(): ThemeArt {
  const all = themes();
  return all.find((t) => t.id.includes('meadow')) ?? all[0]!;
}

/** The demo game every agent tests with at /editor/demo. */
export function demoGame(): ProjectFiles {
  return buildGame(
    { kit: KITS[0]!.id, theme: demoTheme().id, title: 'Demo game', seed: 1 },
    encode,
  );
}
