/**
 * Art themes: complete, hand-crafted procedural art sets (parallax layers, autotiles, animated
 * sprites, props and an environment preset) that genre kits plug into. Everything here is pure
 * TypeScript and works in Node and the browser.
 *
 * Themes are built lazily on first access and cached, so importing this module is cheap.
 */
import type { ArtTheme } from './types';
import { rainRuins } from './themes/rain-ruins';
import { hollowCaverns } from './themes/hollow-caverns';
import { sunlitMeadow } from './themes/sunlit-meadow';

export type { Raster } from '../pixel';
export type { ArtTheme, SheetAnim, SpriteSheet, Environment, Light, ParallaxLayer, PropInfo } from './types';
export { renderPreview, PREVIEW_LEVEL, type PreviewOptions } from './preview';

interface ThemeEntry {
  id: string;
  build: () => ArtTheme;
}

const ENTRIES: ThemeEntry[] = [
  { id: 'rain-ruins', build: rainRuins },
  { id: 'hollow-caverns', build: hollowCaverns },
  { id: 'sunlit-meadow', build: sunlitMeadow },
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

/** A theme whose heavy fields (layers, tiles, sprites, props) are generated on first access. */
function lazyTheme(e: ThemeEntry): ArtTheme {
  const proxy = {} as ArtTheme;
  for (const key of ['id', 'name', 'description', 'keywords', 'palette', 'background', 'layers', 'tiles', 'sprites', 'props', 'environment', 'propInfo', 'lights', 'tileSize'] as const) {
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
