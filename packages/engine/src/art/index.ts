/**
 * Art themes: complete, hand-crafted procedural art sets (parallax layers, autotiles, animated
 * sprites, props and an environment preset) that genre kits plug into. Everything here is pure
 * TypeScript and works in Node and the browser.
 *
 * Themes are built lazily on first access and cached, so importing this module is cheap.
 */
import type { ArtTheme } from './types';
import { rainRuins, RAIN_RUINS_META } from './themes/rain-ruins';
import { hollowCaverns, HOLLOW_CAVERNS_META } from './themes/hollow-caverns';
import { sunlitMeadow, SUNLIT_MEADOW_META } from './themes/sunlit-meadow';
import { emberForge, EMBER_FORGE_META } from './themes/ember-forge';

export type { Raster } from '../pixel';
export type { ArtTheme, SheetAnim, SpriteSheet, Environment, Light, ParallaxLayer, PropInfo, AmbientSprite, HeroVariant } from './types';
export { renderPreview, PREVIEW_LEVEL, type PreviewOptions } from './preview';

/** Cheap fields, available without generating any pixels. */
type ThemeMeta = Pick<ArtTheme, 'id' | 'name' | 'description' | 'keywords' | 'palette' | 'background'>;

interface ThemeEntry {
  id: string;
  meta: ThemeMeta;
  build: () => ArtTheme;
}

const ENTRIES: ThemeEntry[] = [
  { id: 'rain-ruins', meta: RAIN_RUINS_META, build: rainRuins },
  { id: 'hollow-caverns', meta: HOLLOW_CAVERNS_META, build: hollowCaverns },
  { id: 'sunlit-meadow', meta: SUNLIT_MEADOW_META, build: sunlitMeadow },
  { id: 'ember-forge', meta: EMBER_FORGE_META, build: emberForge },
];

const cache = new Map<string, ArtTheme>();

function built(e: ThemeEntry): ArtTheme {
  let t = cache.get(e.id);
  if (!t) {
    t = e.build();
    cache.set(e.id, t);
  }
  return t;
}

/**
 * A theme whose metadata is ready immediately and whose heavy fields (layers, tiles, sprites,
 * props) are generated on first access, so listing themes costs nothing.
 */
function lazyTheme(e: ThemeEntry): ArtTheme {
  const proxy = { ...e.meta } as ArtTheme;
  for (const key of ['layers', 'tiles', 'sprites', 'props', 'environment', 'propInfo', 'lights', 'tileSize', 'decals', 'ambientSprites', 'heroes'] as const) {
    Object.defineProperty(proxy, key, { enumerable: true, get: () => built(e)[key] });
  }
  return proxy;
}

export const ART_THEMES: ArtTheme[] = ENTRIES.map(lazyTheme);

export const THEME_IDS: string[] = ENTRIES.map((e) => e.id);

/** Returns the theme with this id, or the first theme if it is unknown. */
export function getTheme(id: string): ArtTheme {
  const e = ENTRIES.find((x) => x.id === id) ?? ENTRIES[0]!;
  return built(e);
}
