import {
  buildPrompt,
  degamedProvider,
  geminiProvider,
  openaiProvider,
  processAsset,
  type AssetKind,
  type ImageProvider,
  type ProviderId,
  type RGBAImage,
  type ViewAngle,
} from '@degamed/art';
import { env, isAuthConfigured } from './env';
import { loadKeys } from './keys';
import { supabase } from './supabase';

/** Providers the user can use right now, best first: their own Gemini key, OpenAI key, then hosted. */
export function availableImageProviders(): ImageProvider[] {
  const keys = loadKeys();
  const list: ImageProvider[] = [];
  if (keys.gemini) list.push(geminiProvider({ apiKey: keys.gemini }));
  if (keys.openai) list.push(openaiProvider({ apiKey: keys.openai }));
  if (isAuthConfigured) {
    list.push(
      degamedProvider({
        apiUrl: env.apiUrl,
        getToken: async () => (await supabase?.auth.getSession())?.data.session?.access_token ?? null,
      }),
    );
  } else if (import.meta.env.DEV) {
    // Local development without Supabase: the local API (DEV_ANON_ART) runs Workers AI for free.
    list.push({
      ...degamedProvider({ apiUrl: env.apiUrl, getToken: async () => 'local-dev' }),
      label: 'Cloudflare Workers AI (local dev, free)',
    });
  }
  return list;
}

export async function decodeImage(bytes: Uint8Array, mimeType: string): Promise<RGBAImage> {
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: mimeType }));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: data.width, height: data.height, data: data.data };
}

export async function encodePng(img: RGBAImage): Promise<Blob> {
  const canvas = new OffscreenCanvas(img.width, img.height);
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

export interface GeneratedAsset {
  prompt: string;
  provider: ProviderId;
  raw: Blob;
  processed: Blob;
  width: number;
  height: number;
}

export async function generateAsset(opts: {
  provider: ImageProvider;
  style: string;
  kind: AssetKind;
  subject: string;
  view?: ViewAngle;
  palette?: string[];
  signal?: AbortSignal;
}): Promise<GeneratedAsset> {
  const prompt = buildPrompt({ style: opts.style, kind: opts.kind, subject: opts.subject, view: opts.view, palette: opts.palette });
  const image = await opts.provider.generate({ prompt, signal: opts.signal });
  const decoded = await decodeImage(image.bytes, image.mimeType);
  const processed = processAsset(decoded, { style: opts.style, kind: opts.kind, palette: opts.palette });
  return {
    prompt,
    provider: opts.provider.id,
    raw: new Blob([image.bytes as BlobPart], { type: image.mimeType }),
    processed: await encodePng(processed),
    width: processed.width,
    height: processed.height,
  };
}
