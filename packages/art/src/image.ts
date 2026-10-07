/**
 * Pure RGBA image operations used to turn raw AI output into game-ready assets.
 * Works on plain buffers so it runs in browsers, workers and tests alike.
 */

export interface RGBAImage {
  width: number;
  height: number;
  /** Row-major RGBA, 4 bytes per pixel. */
  data: Uint8ClampedArray;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function createImage(width: number, height: number): RGBAImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Invalid colour: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

const dist2 = (a: RGB, b: RGB) => (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;

/** Most common colour along the image border, used to detect the key background. */
export function detectBackground(img: RGBAImage): RGB {
  const counts = new Map<number, number>();
  const { width: w, height: h, data } = img;
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    // Bucket to 5 bits per channel so JPEG noise still groups together.
    const key = ((data[i]! >> 3) << 10) | ((data[i + 1]! >> 3) << 5) | (data[i + 2]! >> 3);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (let x = 0; x < w; x++) {
    sample(x, 0);
    sample(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    sample(0, y);
    sample(w - 1, y);
  }
  let best = 0;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return { r: ((best >> 10) & 31) * 8 + 4, g: ((best >> 5) & 31) * 8 + 4, b: (best & 31) * 8 + 4 };
}

/**
 * Removes the background by flood-filling from the borders through pixels close to the key colour.
 * Interior pixels of the same colour (e.g. a magenta gem inside the sprite) are kept.
 * Edge pixels next to the cut get their key-colour spill removed.
 */
export function removeBackground(img: RGBAImage, opts: { key?: RGB; tolerance?: number } = {}): RGBAImage {
  const key = opts.key ?? detectBackground(img);
  const tol2 = (opts.tolerance ?? 90) ** 2;
  const { width: w, height: h } = img;
  const out: RGBAImage = { width: w, height: h, data: new Uint8ClampedArray(img.data) };
  const d = out.data;
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  const isKey = (p: number) => dist2({ r: d[p * 4]!, g: d[p * 4 + 1]!, b: d[p * 4 + 2]! }, key) <= tol2;

  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);

  while (stack.length) {
    const p = stack.pop()!;
    if (visited[p]) continue;
    visited[p] = 1;
    if (!isKey(p)) continue;
    d[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }

  // Despill: pixels bordering transparency lose the key tint and fade slightly.
  for (let p = 0; p < w * h; p++) {
    if (d[p * 4 + 3] === 0) continue;
    const x = p % w;
    const y = (p - x) / w;
    const touches =
      (x > 0 && d[(p - 1) * 4 + 3] === 0) ||
      (x < w - 1 && d[(p + 1) * 4 + 3] === 0) ||
      (y > 0 && d[(p - w) * 4 + 3] === 0) ||
      (y < h - 1 && d[(p + w) * 4 + 3] === 0);
    if (!touches) continue;
    const i = p * 4;
    const closeness = 1 - Math.min(1, Math.sqrt(dist2({ r: d[i]!, g: d[i + 1]!, b: d[i + 2]! }, key)) / 255);
    if (closeness > 0.5) {
      // Pull the strongest key channels down towards the pixel's neutral level.
      const neutral = Math.min(d[i]!, d[i + 1]!, d[i + 2]!) + (Math.max(d[i]!, d[i + 1]!, d[i + 2]!) - Math.min(d[i]!, d[i + 1]!, d[i + 2]!)) * 0.3;
      if (key.r > 128) d[i] = Math.min(d[i]!, neutral);
      if (key.g > 128) d[i + 1] = Math.min(d[i + 1]!, neutral);
      if (key.b > 128) d[i + 2] = Math.min(d[i + 2]!, neutral);
      d[i + 3] = Math.round(d[i + 3]! * (1.5 - closeness));
    }
  }
  return out;
}

/** Bounding box of pixels with alpha above `threshold`, or null if fully transparent. */
export function opaqueBounds(img: RGBAImage, threshold = 8) {
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3]! > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function crop(img: RGBAImage, x: number, y: number, width: number, height: number): RGBAImage {
  const out = createImage(width, height);
  for (let row = 0; row < height; row++) {
    const sy = y + row;
    if (sy < 0 || sy >= img.height) continue;
    for (let col = 0; col < width; col++) {
      const sx = x + col;
      if (sx < 0 || sx >= img.width) continue;
      const si = (sy * img.width + sx) * 4;
      const di = (row * width + col) * 4;
      out.data[di] = img.data[si]!;
      out.data[di + 1] = img.data[si + 1]!;
      out.data[di + 2] = img.data[si + 2]!;
      out.data[di + 3] = img.data[si + 3]!;
    }
  }
  return out;
}

/** Crops to the visible pixels plus `padding` transparent pixels on each side. */
export function trim(img: RGBAImage, padding = 0): RGBAImage {
  const b = opaqueBounds(img);
  if (!b) return createImage(1, 1);
  return crop(img, b.x - padding, b.y - padding, b.width + padding * 2, b.height + padding * 2);
}

/**
 * Downscales to real pixel art: every output pixel takes the most common colour in its source block
 * (not the average, which would blur), and becomes transparent if most of the block is.
 */
export function pixelate(img: RGBAImage, targetHeight: number): RGBAImage {
  const scale = img.height / targetHeight;
  const outW = Math.max(1, Math.round(img.width / scale));
  const outH = Math.max(1, targetHeight);
  const out = createImage(outW, outH);
  const counts = new Map<number, [number, number, number, number]>();
  for (let oy = 0; oy < outH; oy++) {
    for (let ox = 0; ox < outW; ox++) {
      const x0 = Math.floor(ox * scale);
      const y0 = Math.floor(oy * scale);
      const x1 = Math.min(img.width, Math.max(x0 + 1, Math.floor((ox + 1) * scale)));
      const y1 = Math.min(img.height, Math.max(y0 + 1, Math.floor((oy + 1) * scale)));
      counts.clear();
      let opaque = 0;
      let total = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * img.width + x) * 4;
          total++;
          if (img.data[i + 3]! < 128) continue;
          opaque++;
          const r = img.data[i]!;
          const g = img.data[i + 1]!;
          const b = img.data[i + 2]!;
          const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
          const entry = counts.get(key);
          if (entry) {
            entry[0]++;
            entry[1] += r;
            entry[2] += g;
            entry[3] += b;
          } else counts.set(key, [1, r, g, b]);
        }
      }
      const di = (oy * outW + ox) * 4;
      if (opaque * 2 < total) continue;
      let best: [number, number, number, number] | undefined;
      for (const entry of counts.values()) if (!best || entry[0] > best[0]) best = entry;
      if (!best) continue;
      out.data[di] = best[1] / best[0];
      out.data[di + 1] = best[2] / best[0];
      out.data[di + 2] = best[3] / best[0];
      out.data[di + 3] = 255;
    }
  }
  return out;
}

/** Builds a palette of up to `maxColors` with median cut over the opaque pixels. */
export function medianCutPalette(img: RGBAImage, maxColors: number): RGB[] {
  const pixels: RGB[] = [];
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3]! >= 128) pixels.push({ r: img.data[i]!, g: img.data[i + 1]!, b: img.data[i + 2]! });
  }
  if (!pixels.length) return [];
  let boxes: RGB[][] = [pixels];
  while (boxes.length < maxColors) {
    let target = -1;
    let targetRange = 0;
    let channel: keyof RGB = 'r';
    boxes.forEach((box, idx) => {
      if (box.length < 2) return;
      for (const c of ['r', 'g', 'b'] as const) {
        let lo = 255;
        let hi = 0;
        for (const p of box) {
          if (p[c] < lo) lo = p[c];
          if (p[c] > hi) hi = p[c];
        }
        if (hi - lo > targetRange) {
          targetRange = hi - lo;
          target = idx;
          channel = c;
        }
      }
    });
    if (target < 0 || targetRange === 0) break;
    const box = boxes[target]!.sort((a, b) => a[channel] - b[channel]);
    const mid = box.length >> 1;
    boxes = [...boxes.slice(0, target), box.slice(0, mid), box.slice(mid), ...boxes.slice(target + 1)];
  }
  return boxes.map((box) => {
    const sum = box.reduce((s, p) => ({ r: s.r + p.r, g: s.g + p.g, b: s.b + p.b }), { r: 0, g: 0, b: 0 });
    return { r: Math.round(sum.r / box.length), g: Math.round(sum.g / box.length), b: Math.round(sum.b / box.length) };
  });
}

/** Snaps every opaque pixel to its nearest palette colour. */
export function applyPalette(img: RGBAImage, palette: RGB[]): RGBAImage {
  const out: RGBAImage = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
  if (!palette.length) return out;
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i + 3]! === 0) continue;
    const px = { r: out.data[i]!, g: out.data[i + 1]!, b: out.data[i + 2]! };
    let best = palette[0]!;
    let bestD = Infinity;
    for (const c of palette) {
      const dd = dist2(px, c);
      if (dd < bestD) {
        bestD = dd;
        best = c;
      }
    }
    out.data[i] = best.r;
    out.data[i + 1] = best.g;
    out.data[i + 2] = best.b;
  }
  return out;
}

/** Adds a 1px outline (in `color`) around opaque pixels, growing the image by 1px per side. */
export function outline(img: RGBAImage, color: RGB): RGBAImage {
  const w = img.width + 2;
  const h = img.height + 2;
  const out = createImage(w, h);
  const alphaAt = (x: number, y: number) =>
    x < 0 || y < 0 || x >= img.width || y >= img.height ? 0 : img.data[(y * img.width + x) * 4 + 3]!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x - 1;
      const sy = y - 1;
      const di = (y * w + x) * 4;
      if (alphaAt(sx, sy) > 0) {
        const si = (sy * img.width + sx) * 4;
        out.data.set(img.data.subarray(si, si + 4), di);
      } else if (alphaAt(sx - 1, sy) || alphaAt(sx + 1, sy) || alphaAt(sx, sy - 1) || alphaAt(sx, sy + 1)) {
        out.data[di] = color.r;
        out.data[di + 1] = color.g;
        out.data[di + 2] = color.b;
        out.data[di + 3] = 255;
      }
    }
  }
  return out;
}

/** Nearest-neighbour upscale, for showing pixel art crisply at a larger size. */
export function scaleNearest(img: RGBAImage, factor: number): RGBAImage {
  const f = Math.max(1, Math.floor(factor));
  const out = createImage(img.width * f, img.height * f);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const si = (Math.floor(y / f) * img.width + Math.floor(x / f)) * 4;
      out.data.set(img.data.subarray(si, si + 4), (y * out.width + x) * 4);
    }
  }
  return out;
}

export interface SheetFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Packs equally-sized animation frames left-to-right into one sprite sheet. */
export function packSheet(frames: RGBAImage[], columns = frames.length): { sheet: RGBAImage; frames: SheetFrame[] } {
  if (!frames.length) throw new Error('No frames to pack');
  const fw = Math.max(...frames.map((f) => f.width));
  const fh = Math.max(...frames.map((f) => f.height));
  const cols = Math.max(1, Math.min(columns, frames.length));
  const rows = Math.ceil(frames.length / cols);
  const sheet = createImage(fw * cols, fh * rows);
  const rects: SheetFrame[] = [];
  frames.forEach((f, idx) => {
    const ox = (idx % cols) * fw + Math.floor((fw - f.width) / 2);
    // Bottom-align so characters' feet line up across frames.
    const oy = Math.floor(idx / cols) * fh + (fh - f.height);
    for (let y = 0; y < f.height; y++) {
      const si = y * f.width * 4;
      sheet.data.set(f.data.subarray(si, si + f.width * 4), ((oy + y) * sheet.width + ox) * 4);
    }
    rects.push({ x: (idx % cols) * fw, y: Math.floor(idx / cols) * fh, width: fw, height: fh });
  });
  return { sheet, frames: rects };
}
