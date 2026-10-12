/**
 * The one place the app gets games, kits, themes and AI from.
 *
 * Contracts (docs/team/BRIEF.md):
 *   engine  → KITS, buildGame, readSpec        (@degamed/engine/kits)
 *   art     → ART_THEMES                       (@degamed/engine/art)
 *   ai      → createGame, editGame, suggestions, availableProviders (@degamed/ai)
 * Until each package lands, a local stub with the same shapes stands in. Swapping is a
 * change to this file only.
 */
import { rasterToDataUrl } from '../project-files';
import { STUB_KITS, stubBuildGame, stubReadSpec } from './stub-kits';
import { stubThemes } from './stub-themes';
import { makeStubAi } from './stub-ai';
import type { Encoder, GameSpec, Kit, ProjectFiles, ThemeArt } from './types';

export * from './types';

/** Encodes rasters as PNG data URLs in the browser. */
export const encode: Encoder = rasterToDataUrl;

export const KITS: Kit[] = STUB_KITS;
export const buildGame: (spec: GameSpec, encode: Encoder) => ProjectFiles = stubBuildGame;
export const readSpec: (files: ProjectFiles) => GameSpec | null = stubReadSpec;

/** Art themes with their rasters (for previews). */
export function themes(): ThemeArt[] {
  return stubThemes();
}

const ai = makeStubAi({ kits: KITS, themes, buildGame, readSpec });
export const createGame = ai.createGame;
export const editGame = ai.editGame;
export const suggestions = ai.suggestions;
export const availableProviders = ai.availableProviders;

/** Which pieces are still stand-ins (shown in dev tools and the design log). */
export const USING_STUBS = { kits: true, themes: true, ai: true };

/** The demo game every agent tests with at /editor/demo. */
export function demoGame(): ProjectFiles {
  return buildGame({ kit: KITS[0]!.id, theme: themes()[0]!.id, title: 'Demo: Sunny Meadow', seed: 1 }, encode);
}
