/**
 * Composes a still "key art" frame for a theme from its own layers, tiles and sprites,
 * so theme cards always show real game art.
 */
import { renderPreview, type ArtTheme } from '@degamed/engine/art';
import type { Raster, SpriteSheet, ThemeArt } from './types';

const cache = new Map<string, string>();

/**
 * The art agent's pre-rendered key art (480×270, apps/web/public/art/themes). Fast: use this
 * first, and fall back to `themePreview` (≈0.5 s of CPU per theme) only if it's missing.
 */
export function themeThumb(id: string): string {
  return `/art/themes/${id}.png`;
}

function toCanvas(r: Raster): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = r.width;
  c.height = r.height;
  c.getContext('2d')!.putImageData(
    new ImageData(new Uint8ClampedArray(r.data), r.width, r.height),
    0,
    0,
  );
  return c;
}

function frame(
  ctx: CanvasRenderingContext2D,
  s: SpriteSheet,
  index: number,
  x: number,
  y: number,
  flip = false,
) {
  const src = toCanvas(s.raster);
  const cols = Math.max(1, Math.floor(s.raster.width / s.frameWidth));
  const sx = (index % cols) * s.frameWidth;
  const sy = Math.floor(index / cols) * s.frameHeight;
  ctx.save();
  if (flip) {
    ctx.translate(x + s.frameWidth, y);
    ctx.scale(-1, 1);
    ctx.drawImage(src, sx, sy, s.frameWidth, s.frameHeight, 0, 0, s.frameWidth, s.frameHeight);
  } else ctx.drawImage(src, sx, sy, s.frameWidth, s.frameHeight, x, y, s.frameWidth, s.frameHeight);
  ctx.restore();
}

function tileRow(
  ctx: CanvasRenderingContext2D,
  r: Raster,
  x0: number,
  x1: number,
  y: number,
  rows = 1,
) {
  const c = toCanvas(r);
  for (let row = 0; row < rows; row++)
    for (let x = x0; x < x1; x += r.width) ctx.drawImage(c, x, y + row * r.height);
}

/** A PNG data URL of the theme's key art. Width × height in game pixels (shown pixelated). */
export function themePreview(theme: ThemeArt, width = 320, height = 180): string {
  const key = `${theme.id}:${width}x${height}`;
  const hit = cache.get(key);
  if (hit) return hit;
  // Real themes have an environment: use the art package's renderer (lighting, fog, particles).
  if (theme.environment) {
    try {
      const url = toCanvas(
        renderPreview(theme as unknown as ArtTheme, { width, height }),
      ).toDataURL('image/png');
      cache.set(key, url);
      return url;
    } catch {
      // Fall through to the simple compositor.
    }
  }
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);

  // Layers are authored for the game screen; anchor them to the bottom so ridges meet the ground.
  const groundY = height - 34;
  for (const l of theme.layers) {
    const img = toCanvas(l.raster);
    const y = height - l.raster.height;
    const offset = -Math.round((l.factor * 140) % l.raster.width);
    for (let x = offset; x < width; x += l.raster.width) ctx.drawImage(img, x, Math.round(y));
  }

  const { ground, fill, platform } = theme.tiles;
  tileRow(ctx, ground, 0, width, groundY);
  tileRow(
    ctx,
    fill,
    0,
    width,
    groundY + ground.height,
    Math.ceil((height - groundY) / fill.height),
  );
  const pw = platform.width * 4;
  const px = Math.round(width * 0.52);
  const py = groundY - 52;
  tileRow(ctx, platform, px, px + pw, py);

  const s = theme.sprites;
  frame(
    ctx,
    s.hero,
    s.hero.animations.jump?.frames[0] ?? 0,
    Math.round(width * 0.22),
    groundY - s.hero.frameHeight - 22,
  );
  frame(ctx, s.enemy, 0, Math.round(width * 0.4), groundY - s.enemy.frameHeight, true);
  for (let k = 0; k < 3; k++)
    frame(
      ctx,
      s.pickup,
      k % Math.max(1, s.pickup.animations.idle?.frames.length ?? 1),
      px + 6 + k * (s.pickup.frameWidth + 6),
      py - s.pickup.frameHeight - 6,
    );
  frame(ctx, s.goal, 0, Math.round(width * 0.86), groundY - s.goal.frameHeight);

  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
