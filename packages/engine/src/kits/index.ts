/**
 * Genre kits: turn a tiny GameSpec ({ kit, title, theme, seed, params }) into a complete,
 * playable project built on an art theme. Phaser-free, so the web app and the AI can use it
 * without loading the engine.
 *
 *   const files = buildGame({ kit: 'platformer', title: 'Rust and Rain', theme: 'rain-ruins', seed: 7 }, encode);
 *   const spec = readSpec(files); // { kit: 'platformer', … } — edit params and build again
 */
import type { ProjectFiles } from '@degamed/shared';
import { ART_THEMES, getTheme } from '../art';
import { buildCave, CAVE_KIT } from './cave';
import { buildPlatformer, PLATFORMER_KIT } from './platformer';
import { buildRunner, RUNNER_KIT } from './runner';
import { stubTheme } from './stub-theme';
import type { Encoder, GameSpec, Kit, KitParam, KitTheme, ThemeSummary } from './types';

export type { Encoder, GameSpec, Kit, KitParam, KitTheme, ThemeSummary } from './types';
export { jumpReach, planPlatformer, PLATFORMER_CHUNKS } from './platformer';

export const KITS: Kit[] = [PLATFORMER_KIT, RUNNER_KIT, CAVE_KIT];

export const SPEC_PATH = 'game.spec.json';

const BUILDERS: Record<string, typeof buildPlatformer> = {
  platformer: buildPlatformer,
  runner: buildRunner,
  cave: buildCave,
};

let stub: KitTheme | null = null;
const starter = () => (stub ??= stubTheme());

/** Every theme a spec can name: the art library's themes, plus the small built-in starter theme. */
export function listThemes(): ThemeSummary[] {
  const out: ThemeSummary[] = ART_THEMES.map((t) => ({ id: t.id, name: t.name, description: t.description, keywords: t.keywords, palette: t.palette }));
  const s = starter();
  out.push({ id: s.id, name: s.name, description: s.description, keywords: s.keywords, palette: s.palette });
  return out;
}

/** The theme with this id, or the first art theme if it's unknown. */
export function resolveTheme(id: string | undefined): KitTheme {
  if (id === 'starter') return starter();
  if (id && ART_THEMES.some((t) => t.id === id)) return getTheme(id) as KitTheme;
  return ART_THEMES.length ? (getTheme(ART_THEMES[0]!.id) as KitTheme) : starter();
}

export function getKit(id: string | undefined): Kit {
  return KITS.find((k) => k.id === id) ?? KITS[0]!;
}

/** Fills in defaults and clamps every param to its allowed range. Unknown params are dropped. */
export function resolveParams(kit: Kit, params: GameSpec['params'] = {}): Record<string, number | boolean | string> {
  const out: Record<string, number | boolean | string> = {};
  for (const p of kit.params) out[p.key] = clampParam(p, params?.[p.key]);
  return out;
}

function clampParam(p: KitParam, value: unknown): number | boolean | string {
  switch (p.type) {
    case 'number': {
      const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
      if (!Number.isFinite(n)) return p.default;
      return Math.min(p.max ?? Infinity, Math.max(p.min ?? -Infinity, n));
    }
    case 'boolean':
      return typeof value === 'boolean' ? value : value === 'true' ? true : value === 'false' ? false : p.default;
    case 'choice':
      return typeof value === 'string' && p.choices?.includes(value) ? value : p.default;
  }
}

/** Makes any spec safe to build: known kit, known theme, a seed, clamped params. */
export function normalizeSpec(spec: Partial<GameSpec>): GameSpec {
  const kit = getKit(spec.kit);
  const theme = resolveTheme(spec.theme);
  const seed = Number.isFinite(spec.seed) ? Math.floor(Math.abs(spec.seed!)) % 2147483647 : 1;
  const title = String(spec.title ?? '').trim().slice(0, 60) || kit.name;
  const out: GameSpec = { kit: kit.id, title, theme: theme.id, seed, params: resolveParams(kit, spec.params) };
  if (spec.story) out.story = String(spec.story).slice(0, 2000);
  return out;
}

/** Builds a complete, playable project from a spec. Always succeeds for any input. */
export function buildGame(spec: GameSpec, encode: Encoder): ProjectFiles {
  const clean = normalizeSpec(spec);
  const files = BUILDERS[clean.kit]!(clean, resolveTheme(clean.theme), clean.params!, encode);
  files[SPEC_PATH] = JSON.stringify(clean, null, 2);
  return files;
}

/** Reads the spec a kit stored in a project, or null for hand-made projects. */
export function readSpec(files: ProjectFiles): GameSpec | null {
  const text = files[SPEC_PATH];
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as Partial<GameSpec>;
    if (!raw || typeof raw !== 'object' || typeof raw.kit !== 'string') return null;
    return normalizeSpec(raw);
  } catch {
    return null;
  }
}
