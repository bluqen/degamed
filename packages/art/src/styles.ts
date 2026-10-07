/**
 * The art style catalog. Each style is a recipe: how to prompt the image model, and how to
 * post-process the result so assets in one game look like they belong together.
 */

export type StyleFamily = 'pixel' | 'painted' | 'illustrated' | 'graphic';

export interface PixelSettings {
  /** Height in game pixels a character sprite is reduced to. Tiles use `tile`. */
  sprite: number;
  tile: number;
  /** Maximum colours after quantization. */
  colors: number;
  /** Draw a 1px dark outline around sprites after downscaling. */
  outline: boolean;
}

export interface ArtStyleDef {
  id: string;
  name: string;
  family: StyleFamily;
  blurb: string;
  /** Appended to every prompt for this style. */
  prompt: string;
  /** Things the model should avoid. */
  avoid: string;
  /** Representative colours, used for previews and as palette hints. */
  swatch: [string, string, string, string];
  pixel?: PixelSettings;
}

export const ART_STYLES = [
  {
    id: 'pixel-16',
    name: '16-bit Pixel Art',
    family: 'pixel',
    blurb: 'Rich SNES-era sprites with smooth shading.',
    prompt:
      '16-bit pixel art, SNES era video game sprite style, crisp pixels, limited palette, clean dithering, strong readable silhouette',
    avoid: 'blurry, anti-aliasing, gradients, photorealistic, 3d render, text, watermark',
    swatch: ['#1B1F3B', '#4F7CAC', '#F2C14E', '#E4572E'],
    pixel: { sprite: 48, tile: 16, colors: 24, outline: true },
  },
  {
    id: 'pixel-8',
    name: '8-bit Retro',
    family: 'pixel',
    blurb: 'Chunky NES-style sprites and bold colours.',
    prompt: '8-bit NES style pixel art, very low resolution, chunky pixels, 4 colours per sprite, high contrast, retro arcade',
    avoid: 'smooth shading, gradients, anti-aliasing, photorealistic, text, watermark',
    swatch: ['#000000', '#FC3800', '#F8B800', '#3CBCFC'],
    pixel: { sprite: 24, tile: 16, colors: 12, outline: false },
  },
  {
    id: 'pixel-hd',
    name: 'HD Pixel Art',
    family: 'pixel',
    blurb: 'Modern, detailed pixel art with atmospheric lighting.',
    prompt:
      'modern high detail pixel art, indie game, atmospheric lighting, rim light, vibrant palette, crisp pixels, detailed animation-ready sprite',
    avoid: 'blurry, photorealistic, 3d render, text, watermark',
    swatch: ['#16132B', '#5B3F9C', '#4DD0E1', '#FFB86B'],
    pixel: { sprite: 96, tile: 32, colors: 40, outline: false },
  },
  {
    id: 'hand-painted',
    name: 'Hand-painted',
    family: 'painted',
    blurb: 'Lush painterly fantasy, like a storybook come alive.',
    prompt: 'hand-painted 2D game art, painterly brush strokes, soft lighting, rich fantasy colours, highly detailed',
    avoid: 'pixel art, photorealistic, 3d render, text, watermark, blurry',
    swatch: ['#203A43', '#2C5364', '#E0A96D', '#F6E7C8'],
  },
  {
    id: 'anime',
    name: 'Anime Cel-shaded',
    family: 'illustrated',
    blurb: 'Clean line art with crisp cel shading.',
    prompt: 'anime style 2D game art, clean line art, cel shading, vibrant colours, expressive',
    avoid: 'photorealistic, 3d render, sketchy, text, watermark, blurry',
    swatch: ['#2B2D42', '#EF476F', '#FFD166', '#8ECAE6'],
  },
  {
    id: 'cartoon',
    name: 'Bold Cartoon',
    family: 'illustrated',
    blurb: 'Thick outlines, saturated colours, lots of personality.',
    prompt: 'bold cartoon 2D game art, thick black outlines, saturated flat colours, playful exaggerated shapes',
    avoid: 'photorealistic, 3d render, muted colours, text, watermark',
    swatch: ['#1A1A2E', '#FF6B35', '#F7C59F', '#4ECDC4'],
  },
  {
    id: 'watercolor',
    name: 'Storybook Watercolour',
    family: 'painted',
    blurb: 'Soft washes and paper texture.',
    prompt: 'storybook watercolour illustration, soft washes, visible paper texture, gentle colours, ink linework',
    avoid: 'photorealistic, 3d render, harsh neon, text, watermark',
    swatch: ['#F4EDE1', '#A3C4BC', '#E6A57E', '#5B6C8F'],
  },
  {
    id: 'dark-fantasy',
    name: 'Dark Fantasy',
    family: 'painted',
    blurb: 'Moody, gritty and dramatic.',
    prompt: 'dark fantasy 2D game art, moody dramatic lighting, gritty textures, muted palette with glowing accents',
    avoid: 'cute, pastel, photorealistic, text, watermark',
    swatch: ['#0D0D0D', '#3A2E39', '#8C1C13', '#C6AC8F'],
  },
  {
    id: 'cozy',
    name: 'Cozy Pastel',
    family: 'illustrated',
    blurb: 'Soft, warm and friendly.',
    prompt: 'cozy pastel 2D game art, soft rounded shapes, warm gentle lighting, cute and friendly, clean shading',
    avoid: 'dark, gritty, photorealistic, text, watermark',
    swatch: ['#FFF1E6', '#FDE2E4', '#BEE1E6', '#CDB4DB'],
  },
  {
    id: 'neon',
    name: 'Neon Synthwave',
    family: 'graphic',
    blurb: 'Glowing neon on deep purple night.',
    prompt: 'neon synthwave 2D game art, glowing neon edges, deep purple and magenta night palette, cyan highlights',
    avoid: 'daylight, muted colours, photorealistic, text, watermark',
    swatch: ['#140830', '#7C5CFF', '#FF5CA8', '#22D3EE'],
  },
  {
    id: 'paper',
    name: 'Paper Cutout',
    family: 'graphic',
    blurb: 'Layered craft paper with soft drop shadows.',
    prompt: 'paper cutout craft 2D game art, layered coloured paper, subtle paper texture, soft drop shadows',
    avoid: 'photorealistic, 3d render, glossy, text, watermark',
    swatch: ['#F6E7C8', '#E3B587', '#7FB069', '#3D5A80'],
  },
  {
    id: 'comic',
    name: 'Comic Ink',
    family: 'illustrated',
    blurb: 'Inked lines and halftone shading.',
    prompt: 'comic book 2D game art, bold ink lines, halftone dot shading, dynamic, limited palette',
    avoid: 'photorealistic, 3d render, soft gradients, text, speech bubbles, watermark',
    swatch: ['#111111', '#F3EBDD', '#D94F3D', '#2E86AB'],
  },
  {
    id: 'flat',
    name: 'Clean Flat',
    family: 'graphic',
    blurb: 'Minimal shapes and crisp colour blocks.',
    prompt: 'clean flat vector 2D game art, simple geometric shapes, crisp colour blocks, minimal shading',
    avoid: 'texture, photorealistic, 3d render, text, watermark',
    swatch: ['#1D3557', '#457B9D', '#E63946', '#F1FAEE'],
  },
] as const satisfies readonly ArtStyleDef[];

export type ArtStyleId = (typeof ART_STYLES)[number]['id'];

export const ART_STYLE_IDS = ART_STYLES.map((s) => s.id) as [ArtStyleId, ...ArtStyleId[]];

export function getStyle(id: string): ArtStyleDef {
  const style = ART_STYLES.find((s) => s.id === id);
  if (!style) throw new Error(`Unknown art style: ${id}`);
  return style;
}

export type AssetKind = 'sprite' | 'tile' | 'background' | 'item' | 'ui';
export type ViewAngle = 'side' | 'top-down' | 'isometric' | 'front';

/** Solid key colour the model paints behind sprites so we can cut them out cleanly. */
export const KEY_COLOR = { r: 255, g: 0, b: 255, hex: '#FF00FF' } as const;

const KIND_PROMPTS: Record<AssetKind, (subject: string, view: ViewAngle) => string> = {
  sprite: (s, v) =>
    `a single ${s}, ${v} view, full body, centered, game character sprite, isolated on a solid flat pure magenta ${KEY_COLOR.hex} background, no ground, no shadow`,
  item: (s, v) =>
    `a single ${s}, ${v} view, centered, game item icon, isolated on a solid flat pure magenta ${KEY_COLOR.hex} background, no shadow`,
  ui: (s) => `a ${s}, game user interface element, centered, isolated on a solid flat pure magenta ${KEY_COLOR.hex} background`,
  tile: (s, v) => `a seamless tileable ${s} texture tile, ${v} view, fills the whole square edge to edge, no border`,
  background: (s, v) => `a wide ${s} game background scene, ${v} view, parallax layer, no characters, no text`,
};

export interface PromptRequest {
  style: string;
  kind: AssetKind;
  subject: string;
  view?: ViewAngle;
  /** Hex colours the asset should stick to (e.g. the project palette). */
  palette?: string[];
}

/** Builds the full text prompt for one asset. Pure, so it can be tested and shown to users. */
export function buildPrompt(req: PromptRequest): string {
  const style = getStyle(req.style);
  const subject = req.subject.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!subject) throw new Error('Describe what to draw.');
  const view = req.view ?? 'side';
  const parts = [KIND_PROMPTS[req.kind](subject, view), style.prompt];
  if (req.palette?.length) parts.push(`colour palette: ${req.palette.slice(0, 8).join(', ')}`);
  parts.push(`avoid: ${style.avoid}`);
  return parts.join('. ');
}

/** Whether an asset kind is cut out from a key-colour background. */
export function needsCutout(kind: AssetKind): boolean {
  return kind === 'sprite' || kind === 'item' || kind === 'ui';
}
