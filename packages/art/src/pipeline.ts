import {
  applyPalette,
  hexToRgb,
  medianCutPalette,
  outline,
  pixelate,
  removeBackground,
  trim,
  type RGBAImage,
} from './image';
import { getStyle, KEY_COLOR, needsCutout, type AssetKind } from './styles';

export interface ProcessOptions {
  style: string;
  kind: AssetKind;
  /** Project palette to snap pixel art to. Falls back to an automatic palette. */
  palette?: string[];
}

/**
 * Turns a raw generated image into a game asset:
 * cut out the key background (sprites, items, UI), trim, and for pixel styles reduce to a
 * true low-resolution, limited-palette pixel grid.
 */
export function processAsset(raw: RGBAImage, opts: ProcessOptions): RGBAImage {
  const style = getStyle(opts.style);
  let img = raw;
  if (needsCutout(opts.kind)) {
    img = trim(removeBackground(img, { key: KEY_COLOR }), 0);
  }
  if (!style.pixel || opts.kind === 'background') return img;

  const target = opts.kind === 'tile' ? style.pixel.tile : opts.kind === 'ui' ? Math.round(style.pixel.sprite / 2) : style.pixel.sprite;
  img = pixelate(img, Math.min(target, img.height));
  const palette = opts.palette?.length ? opts.palette.map(hexToRgb) : medianCutPalette(img, style.pixel.colors);
  img = applyPalette(img, palette);
  if (style.pixel.outline && needsCutout(opts.kind)) {
    const darkest = [...palette].sort((a, b) => a.r + a.g + a.b - (b.r + b.g + b.b))[0] ?? { r: 16, g: 16, b: 24 };
    img = outline(img, darkest);
  }
  return img;
}
