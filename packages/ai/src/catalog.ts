/**
 * The game backend: kit + theme catalogues, buildGame and readSpec.
 *
 * The default is the engine's real genre kits (`@degamed/engine/kits`) with the art team's themes.
 * A small local stub (one platformer kit, three theme ids) remains for fast, engine-independent
 * unit tests. Everything in this package goes through `getBackend()`.
 */
import * as engineKits from '@degamed/engine/kits';
import { createPlatformerTemplate, type Encoder } from '@degamed/engine/templates';
import type { ProjectFiles } from '@degamed/shared';
import type { Catalog, GameSpec, KitParam } from './protocol';

export interface KitInfo {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  params: KitParam[];
}

export interface ThemeInfo {
  id: string;
  name: string;
  description: string;
  keywords: string[];
}

export interface GameBackend {
  kits: KitInfo[];
  themes: ThemeInfo[];
  buildGame(spec: GameSpec, encode: Encoder): ProjectFiles;
  readSpec(files: ProjectFiles): GameSpec | null;
}

export const SPEC_FILE = 'game.spec.json';

// ---------------------------------------------------------------------------------------------
// Local stub (replace with the engine's KITS/buildGame/readSpec and art's ART_THEMES)

const STUB_KITS: KitInfo[] = [
  {
    id: 'platformer',
    name: 'Platformer',
    description: 'Side-scrolling run and jump: stomp enemies, grab coins, reach the flag.',
    keywords: ['platformer', 'platform', 'jump', 'side-scroller', 'mario', 'celeste', 'metroidvania'],
    params: [
      { key: 'difficulty', label: 'Difficulty', type: 'choice', choices: ['easy', 'normal', 'hard'], default: 'normal', group: 'Challenge' },
      { key: 'enemies', label: 'Enemies', type: 'number', min: 0, max: 12, step: 1, default: 4, group: 'Challenge' },
      { key: 'coins', label: 'Coins', type: 'number', min: 0, max: 18, step: 1, default: 18, group: 'Level' },
      { key: 'jumpHeight', label: 'Jump height', type: 'number', min: 200, max: 520, step: 10, default: 330, group: 'Feel' },
      { key: 'gravity', label: 'Gravity', type: 'number', min: 300, max: 1500, step: 50, default: 900, group: 'Feel' },
      { key: 'speed', label: 'Run speed', type: 'number', min: 80, max: 260, step: 10, default: 150, group: 'Feel' },
      { key: 'night', label: 'Night time', type: 'boolean', default: false, group: 'Look' },
    ],
  },
];

const STUB_THEMES: ThemeInfo[] = [
  {
    id: 'sunlit-meadow',
    name: 'Sunlit Meadow',
    description: 'Bright, warm grassland with flowers, soft clouds and drifting pollen. Cheerful.',
    keywords: ['happy', 'sunny', 'meadow', 'grass', 'flowers', 'bright', 'cute', 'cozy', 'spring', 'summer'],
  },
  {
    id: 'rain-ruins',
    name: 'Rain Ruins',
    description: 'Moody, rain-soaked overgrown ruins under grey skies, with lamps and puddles.',
    keywords: ['rain', 'storm', 'ruins', 'moody', 'melancholy', 'abandoned', 'overgrown', 'robot', 'city'],
  },
  {
    id: 'hollow-caverns',
    name: 'Hollow Caverns',
    description: 'Dark, eerie caverns lit by glowing fungi and lanterns, with floating spores.',
    keywords: ['spooky', 'dark', 'cave', 'cavern', 'underground', 'eerie', 'haunted', 'bugs', 'crypt', 'night'],
  },
];

function stubBuildGame(spec: GameSpec, encode: Encoder): ProjectFiles {
  const files = createPlatformerTemplate(encode, spec.title);
  const p = spec.params ?? {};
  const num = (k: string) => (typeof p[k] === 'number' ? (p[k] as number) : undefined);
  const manifest = JSON.parse(files['project.json']!) as { physics: { gravity: { y: number } } };
  if (num('gravity') !== undefined) manifest.physics.gravity.y = num('gravity')!;
  files['project.json'] = JSON.stringify(manifest, null, 2);
  const speed = num('speed');
  const jump = num('jumpHeight');
  if (speed !== undefined || jump !== undefined) {
    files['scripts/player.js'] = files['scripts/player.js']!.replace(
      /static props = \{ speed: (\d+), jump: (\d+),/,
      (_m, s: string, j: string) => `static props = { speed: ${speed ?? s}, jump: ${jump ?? j},`,
    );
  }
  const scene = JSON.parse(files['scenes/main.scene.json']!) as { entities: { tags: string[] }[] };
  const keep = (tag: string, n: number | undefined) => {
    if (n === undefined) return;
    let seen = 0;
    scene.entities = scene.entities.filter((e) => !e.tags.includes(tag) || seen++ < n);
  };
  keep('enemy', num('enemies'));
  keep('coin', num('coins'));
  files['scenes/main.scene.json'] = JSON.stringify(scene, null, 2);
  files[SPEC_FILE] = JSON.stringify(spec, null, 2);
  return files;
}

function stubReadSpec(files: ProjectFiles): GameSpec | null {
  const raw = files[SPEC_FILE];
  if (!raw) return null;
  try {
    const spec = JSON.parse(raw) as GameSpec;
    return spec && typeof spec.kit === 'string' && typeof spec.theme === 'string' ? spec : null;
  } catch {
    return null;
  }
}

export const stubBackend: GameBackend = { kits: STUB_KITS, themes: STUB_THEMES, buildGame: stubBuildGame, readSpec: stubReadSpec };

let current: GameBackend | undefined;

/** The real thing: the engine's genre kits and the art team's themes. */
export function engineBackend(): GameBackend {
  return backendFromKits(engineKits);
}

export function getBackend(): GameBackend {
  return (current ??= engineBackend());
}

/** Swap the backend (tests, or the web app wiring in the engine's real kits before they're the default). */
export function setBackend(backend: GameBackend): void {
  current = backend;
}

/** The shape of `@degamed/engine/kits` (BRIEF contract plus engine's `listThemes`). */
export interface KitsModule {
  KITS: KitInfo[];
  buildGame(spec: GameSpec, encode: Encoder): ProjectFiles;
  readSpec(files: ProjectFiles): GameSpec | null;
  listThemes?(): { id: string; name: string; description: string; keywords?: string[] }[];
}

/**
 * Adapts the engine's kits module into a backend. Usage once it lands:
 *   setBackend(backendFromKits(await import('@degamed/engine/kits')))
 * Themes the engine doesn't list fall back to the stub ids so instant mode keeps working.
 */
export function backendFromKits(mod: KitsModule): GameBackend {
  let themes: ThemeInfo[] | undefined;
  return {
    kits: mod.KITS,
    // Listing themes builds their art, so do it on first use, not on import.
    get themes() {
      if (!themes) {
        const listed = mod.listThemes?.().map((t) => ({ id: t.id, name: t.name, description: t.description, keywords: t.keywords ?? [] }));
        themes = listed?.length ? listed : STUB_THEMES;
      }
      return themes;
    },
    buildGame: (spec, encode) => mod.buildGame(spec, encode),
    readSpec: (files) => mod.readSpec(files),
  };
}

/** The slice of the catalogue sent to the model: no keywords, short descriptions. */
export function catalogFor(backend: GameBackend = getBackend()): Catalog {
  return {
    kits: backend.kits.slice(0, 16).map((k) => ({ id: k.id, name: k.name, description: k.description.slice(0, 240), params: k.params.slice(0, 24) })),
    themes: backend.themes.slice(0, 32).map((t) => ({ id: t.id, name: t.name, description: t.description.slice(0, 240) })),
  };
}
