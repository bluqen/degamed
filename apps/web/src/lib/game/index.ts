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
import { ART_THEMES } from '@degamed/engine/art';
import { STUB_KITS, makeStubBuildGame, stubReadSpec } from './stub-kits';
import { stubThemes } from './stub-themes';
import * as ai from '@degamed/ai';
import type { Encoder, GameSpec, Kit, ProjectFiles, ThemeArt } from './types';

export * from './types';

/** Encodes rasters as PNG data URLs in the browser. */
export const encode: Encoder = rasterToDataUrl;

export const KITS: Kit[] = STUB_KITS;
export const buildGame: (spec: GameSpec, encode: Encoder) => ProjectFiles = makeStubBuildGame(themes);
export const readSpec: (files: ProjectFiles) => GameSpec | null = stubReadSpec;

/** Art themes with their rasters (for previews). The art agent's themes once there are any. */
export function themes(): ThemeArt[] {
  return ART_THEMES.length ? (ART_THEMES as unknown as ThemeArt[]) : stubThemes();
}

// The AI package builds games through a backend; give it the same kits and themes the UI shows.
ai.setBackend({
  kits: KITS,
  themes: themes().map((t) => ({ id: t.id, name: t.name, description: t.description, keywords: t.keywords })),
  buildGame,
  readSpec,
});

export const createGame = ai.createGame;
export const editGame = ai.editGame;
export const suggestions = ai.suggestions;
export const availableProviders = ai.availableProviders;
export const PROVIDER_LABELS = ai.PROVIDER_LABELS;

/** Which pieces are still stand-ins (noted in docs/team/design.md). */
export const USING_STUBS = { kits: true, themes: ART_THEMES.length === 0, ai: false };

/** The demo game every agent tests with at /editor/demo. */
export function demoGame(): ProjectFiles {
  return buildGame({ kit: KITS[0]!.id, theme: demoTheme().id, title: 'Demo game', seed: 1 }, encode);
}

/** The bright, friendly look used for the demo (falls back to the first theme). */
export function demoTheme(): ThemeArt {
  const all = themes();
  return all.find((t) => t.id.includes('meadow')) ?? all[0]!;
}
