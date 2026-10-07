import { describe, expect, it, vi } from 'vitest';
import {
  applyPalette,
  createImage,
  detectBackground,
  hexToRgb,
  medianCutPalette,
  outline,
  packSheet,
  pixelate,
  removeBackground,
  rgbToHex,
  scaleNearest,
  trim,
  type RGB,
  type RGBAImage,
} from './image';
import { ART_STYLES, buildPrompt, getStyle, KEY_COLOR, needsCutout } from './styles';
import { processAsset } from './pipeline';
import { base64ToBytes, bytesToBase64, degamedProvider, geminiProvider, openaiProvider, ProviderError } from './providers';

const MAGENTA: RGB = { r: 255, g: 0, b: 255 };
const BLUE: RGB = { r: 30, g: 60, b: 200 };

function fill(img: RGBAImage, x0: number, y0: number, w: number, h: number, c: RGB, a = 255) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * img.width + x) * 4;
      img.data[i] = c.r;
      img.data[i + 1] = c.g;
      img.data[i + 2] = c.b;
      img.data[i + 3] = a;
    }
}

const px = (img: RGBAImage, x: number, y: number) => {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
};

/** 64×64 magenta canvas with a blue 20×30 "character" that has a magenta gem inside it. */
function spriteOnKey(): RGBAImage {
  const img = createImage(64, 64);
  fill(img, 0, 0, 64, 64, MAGENTA);
  fill(img, 22, 17, 20, 30, BLUE);
  fill(img, 30, 25, 3, 3, MAGENTA); // enclosed, must survive
  return img;
}

describe('colours', () => {
  it('round-trips hex', () => {
    expect(rgbToHex(hexToRgb('#7c5cff'))).toBe('#7C5CFF');
    expect(() => hexToRgb('purple')).toThrow();
  });

  it('detects the border colour even with JPEG-like noise', () => {
    const img = spriteOnKey();
    img.data[0] = 250; // noise
    const bg = detectBackground(img);
    expect(Math.abs(bg.r - 255)).toBeLessThan(10);
    expect(bg.g).toBeLessThan(10);
  });
});

describe('removeBackground', () => {
  it('clears the connected background but keeps enclosed key-coloured pixels', () => {
    const out = removeBackground(spriteOnKey(), { key: MAGENTA });
    expect(px(out, 0, 0)[3]).toBe(0);
    expect(px(out, 63, 63)[3]).toBe(0);
    expect(px(out, 25, 20)).toEqual([30, 60, 200, 255]);
    expect(px(out, 31, 26)[3]).toBe(255);
  });

  it('does not modify the input', () => {
    const img = spriteOnKey();
    removeBackground(img, { key: MAGENTA });
    expect(px(img, 0, 0)[3]).toBe(255);
  });
});

describe('trim', () => {
  it('crops to visible pixels with padding', () => {
    const t = trim(removeBackground(spriteOnKey(), { key: MAGENTA }), 2);
    expect([t.width, t.height]).toEqual([24, 34]);
    expect(px(t, 0, 0)[3]).toBe(0);
    expect(px(t, 2, 2)[3]).toBe(255);
  });

  it('returns a 1×1 image when nothing is visible', () => {
    const t = trim(createImage(10, 10));
    expect([t.width, t.height]).toEqual([1, 1]);
  });
});

describe('pixelate', () => {
  it('uses the majority colour of each block instead of blurring', () => {
    const img = createImage(8, 8);
    fill(img, 0, 0, 8, 8, BLUE);
    fill(img, 0, 0, 1, 1, { r: 255, g: 255, b: 255 }); // one stray pixel in the first 4×4 block
    const out = pixelate(img, 2);
    expect([out.width, out.height]).toEqual([2, 2]);
    expect(px(out, 0, 0)).toEqual([30, 60, 200, 255]);
  });

  it('makes mostly-transparent blocks transparent', () => {
    const img = createImage(4, 4);
    fill(img, 0, 0, 1, 1, BLUE);
    expect(px(pixelate(img, 1), 0, 0)[3]).toBe(0);
  });
});

describe('palettes', () => {
  it('median cut returns at most the requested colours', () => {
    const img = createImage(16, 1);
    for (let x = 0; x < 16; x++) fill(img, x, 0, 1, 1, { r: x * 16, g: 0, b: 255 - x * 16 });
    const palette = medianCutPalette(img, 4);
    expect(palette.length).toBe(4);
  });

  it('applyPalette snaps to the nearest colour and keeps alpha', () => {
    const img = createImage(2, 1);
    fill(img, 0, 0, 1, 1, { r: 250, g: 10, b: 10 });
    const out = applyPalette(img, [hexToRgb('#FF0000'), hexToRgb('#0000FF')]);
    expect(px(out, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(px(out, 1, 0)[3]).toBe(0);
  });
});

describe('outline, scale and sheets', () => {
  it('outline grows the image and rings opaque pixels', () => {
    const img = createImage(1, 1);
    fill(img, 0, 0, 1, 1, BLUE);
    const out = outline(img, { r: 0, g: 0, b: 0 });
    expect([out.width, out.height]).toEqual([3, 3]);
    expect(px(out, 1, 1)).toEqual([30, 60, 200, 255]);
    expect(px(out, 0, 1)).toEqual([0, 0, 0, 255]);
    expect(px(out, 0, 0)[3]).toBe(0); // diagonal stays clear
  });

  it('scaleNearest keeps hard edges', () => {
    const img = createImage(2, 1);
    fill(img, 1, 0, 1, 1, BLUE);
    const out = scaleNearest(img, 3);
    expect([out.width, out.height]).toEqual([6, 3]);
    expect(px(out, 2, 2)[3]).toBe(0);
    expect(px(out, 3, 0)[3]).toBe(255);
  });

  it('packSheet bottom-aligns frames of different heights', () => {
    const a = createImage(2, 4);
    fill(a, 0, 0, 2, 4, BLUE);
    const b = createImage(2, 2);
    fill(b, 0, 0, 2, 2, BLUE);
    const { sheet, frames } = packSheet([a, b]);
    expect([sheet.width, sheet.height]).toEqual([4, 4]);
    expect(frames[1]).toEqual({ x: 2, y: 0, width: 2, height: 4 });
    expect(px(sheet, 2, 0)[3]).toBe(0);
    expect(px(sheet, 2, 3)[3]).toBe(255);
  });
});

describe('styles and prompts', () => {
  it('has unique ids and pixel settings for pixel styles', () => {
    const ids = ART_STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of ART_STYLES) if (s.family === 'pixel') expect(getStyle(s.id).pixel).toBeDefined();
  });

  it('builds sprite prompts with the key colour and style', () => {
    const prompt = buildPrompt({ style: 'pixel-16', kind: 'sprite', subject: '  a  knight with a lantern ' });
    expect(prompt).toContain('a knight with a lantern');
    expect(prompt).toContain(KEY_COLOR.hex);
    expect(prompt).toContain('16-bit pixel art');
  });

  it('does not ask for a key background on tiles and backgrounds', () => {
    expect(buildPrompt({ style: 'hand-painted', kind: 'background', subject: 'misty forest' })).not.toContain(KEY_COLOR.hex);
    expect(needsCutout('tile')).toBe(false);
  });

  it('rejects empty subjects and unknown styles', () => {
    expect(() => buildPrompt({ style: 'pixel-16', kind: 'sprite', subject: '   ' })).toThrow();
    expect(() => getStyle('vaporwave-3000')).toThrow();
  });
});

describe('processAsset', () => {
  it('turns a big key-background sprite into a small pixel sprite with outline', () => {
    const raw = createImage(256, 256);
    fill(raw, 0, 0, 256, 256, MAGENTA);
    fill(raw, 88, 40, 80, 192, BLUE);
    const out = processAsset(raw, { style: 'pixel-16', kind: 'sprite' });
    // 48px tall sprite + 1px outline on each side.
    expect(out.height).toBe(50);
    expect(out.width).toBe(22);
    expect(px(out, 0, 0)[3]).toBe(0);
    expect(px(out, 11, 25)).toEqual([30, 60, 200, 255]);
  });

  it('leaves non-pixel backgrounds untouched', () => {
    const raw = createImage(4, 4);
    fill(raw, 0, 0, 4, 4, BLUE);
    expect(processAsset(raw, { style: 'watercolor', kind: 'background' })).toBe(raw);
  });

  it('snaps pixel art to the project palette when given', () => {
    const raw = createImage(64, 64);
    fill(raw, 0, 0, 64, 64, MAGENTA);
    fill(raw, 16, 8, 32, 48, { r: 40, g: 70, b: 190 });
    const out = processAsset(raw, { style: 'pixel-8', kind: 'sprite', palette: ['#3CBCFC', '#FC3800'] });
    expect(px(out, Math.floor(out.width / 2), Math.floor(out.height / 2))).toEqual([60, 188, 252, 255]);
  });
});

describe('providers', () => {
  it('base64 round trip', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('gemini sends the key in a header and returns image bytes', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ candidates: [{ content: { parts: [{ text: 'ok' }, { inlineData: { mimeType: 'image/png', data: btoa('PNG') } }] } }] }),
    );
    const img = await geminiProvider({ apiKey: 'k', fetchImpl }).generate({ prompt: 'a cat', references: [{ mimeType: 'image/png', data: new Uint8Array([1]) }] });
    expect(new TextDecoder().decode(img.bytes)).toBe('PNG');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('gemini-2.5-flash-image:generateContent');
    expect(url).not.toContain('key=');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
    expect(JSON.parse(init.body as string).contents[0].parts).toHaveLength(2);
  });

  it('explains bad keys and rate limits', async () => {
    const bad = geminiProvider({ apiKey: 'k', fetchImpl: async () => new Response('{}', { status: 403 }) });
    await expect(bad.generate({ prompt: 'x' })).rejects.toThrow('rejected the API key');
    const limited = openaiProvider({ apiKey: 'k', fetchImpl: async () => new Response('{}', { status: 429 }) });
    await expect(limited.generate({ prompt: 'x' })).rejects.toBeInstanceOf(ProviderError);
  });

  it('explains keys that have no image quota at all', async () => {
    const body = { error: { message: 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: x' } };
    const p = geminiProvider({ apiKey: 'k', fetchImpl: async () => Response.json(body, { status: 429 }) });
    await expect(p.generate({ prompt: 'x' })).rejects.toThrow('no quota for this model');
  });

  it('degamed provider requires sign-in and posts to the API', async () => {
    const signedOut = degamedProvider({ apiUrl: 'https://api.test', getToken: async () => null });
    await expect(signedOut.generate({ prompt: 'x' })).rejects.toThrow('Sign in');
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([9, 9]), { headers: { 'Content-Type': 'image/jpeg' } }));
    const p = degamedProvider({ apiUrl: 'https://api.test', getToken: async () => 'tok', fetchImpl });
    const img = await p.generate({ prompt: 'x', seed: 4 });
    expect(img.mimeType).toBe('image/jpeg');
    expect(fetchImpl).toHaveBeenCalledWith('https://api.test/art/generate', expect.objectContaining({ method: 'POST' }));
  });
});
