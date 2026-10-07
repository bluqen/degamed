/**
 * Image generation providers.
 *
 * - `degamed`: hosted, through our API (Cloudflare Workers AI, FLUX.1 schnell). Free daily quota.
 * - `gemini`: the user's own Google AI key. Image models need billing enabled on the key (the free
 *   tier covers text only). Supports reference images, which keeps characters consistent.
 * - `openai`: the user's own OpenAI key. Can return transparent backgrounds natively.
 *
 * BYOK providers are called straight from the browser; keys never touch Degamed's servers.
 */

export type ProviderId = 'degamed' | 'gemini' | 'openai';

export interface GenerateRequest {
  prompt: string;
  seed?: number;
  /** PNG/JPEG bytes of images the result should match (character sheets, earlier frames). */
  references?: { mimeType: string; data: Uint8Array }[];
  signal?: AbortSignal;
}

export interface GeneratedImage {
  mimeType: string;
  bytes: Uint8Array;
}

export interface ImageProvider {
  id: ProviderId;
  label: string;
  supportsReferences: boolean;
  generate(req: GenerateRequest): Promise<GeneratedImage>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function failure(res: Response, provider: string): Promise<ProviderError> {
  let detail = '';
  try {
    const body = (await res.json()) as { error?: { message?: string } | string };
    detail = typeof body.error === 'string' ? body.error : (body.error?.message ?? '');
  } catch {
    // Non-JSON error body; the status code is enough.
  }
  if (res.status === 401 || res.status === 403) return new ProviderError(`${provider} rejected the API key.`, res.status);
  if (res.status === 429) {
    if (/limit:\s*0\b/.test(detail)) {
      return new ProviderError(
        `Your ${provider} key has no quota for this model (free keys can't generate images). Enable billing for the key, or use another generator.`,
        res.status,
      );
    }
    return new ProviderError(`${provider} rate limit reached. Try again shortly.`, res.status);
  }
  return new ProviderError(`${provider} failed (${res.status})${detail ? `: ${detail}` : ''}`, res.status);
}

/** Hosted generation through the Degamed API. `getToken` returns the user's Supabase access token. */
export function degamedProvider(opts: { apiUrl: string; getToken: () => Promise<string | null>; fetchImpl?: typeof fetch }): ImageProvider {
  const f = opts.fetchImpl ?? fetch;
  return {
    id: 'degamed',
    label: 'Degamed (free daily images)',
    supportsReferences: false,
    async generate(req) {
      const token = await opts.getToken();
      if (!token) throw new ProviderError('Sign in to use Degamed image generation.', 401);
      const res = await f(`${opts.apiUrl}/art/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: req.prompt, seed: req.seed }),
        signal: req.signal,
      });
      if (!res.ok) throw await failure(res, 'Degamed');
      return { mimeType: res.headers.get('Content-Type') ?? 'image/jpeg', bytes: new Uint8Array(await res.arrayBuffer()) };
    },
  };
}

export function geminiProvider(opts: { apiKey: string; model?: string; fetchImpl?: typeof fetch }): ImageProvider {
  const f = opts.fetchImpl ?? fetch;
  const model = opts.model ?? 'gemini-2.5-flash-image';
  return {
    id: 'gemini',
    label: 'Google Gemini (your key)',
    supportsReferences: true,
    async generate(req) {
      const parts: unknown[] = [{ text: req.prompt }];
      for (const ref of req.references ?? []) {
        parts.push({ inline_data: { mime_type: ref.mimeType, data: bytesToBase64(ref.data) } });
      }
      const res = await f(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': opts.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'] } }),
        signal: req.signal,
      });
      if (!res.ok) throw await failure(res, 'Gemini');
      const body = (await res.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[];
      };
      const image = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
      if (!image) throw new ProviderError('Gemini returned no image. Try rephrasing the prompt.');
      return { mimeType: image.mimeType, bytes: base64ToBytes(image.data) };
    },
  };
}

export function openaiProvider(opts: { apiKey: string; model?: string; fetchImpl?: typeof fetch }): ImageProvider {
  const f = opts.fetchImpl ?? fetch;
  const model = opts.model ?? 'gpt-image-1';
  return {
    id: 'openai',
    label: 'OpenAI (your key)',
    supportsReferences: false,
    async generate(req) {
      const res = await f('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: req.prompt, size: '1024x1024', n: 1 }),
        signal: req.signal,
      });
      if (!res.ok) throw await failure(res, 'OpenAI');
      const body = (await res.json()) as { data?: { b64_json?: string }[] };
      const b64 = body.data?.[0]?.b64_json;
      if (!b64) throw new ProviderError('OpenAI returned no image.');
      return { mimeType: 'image/png', bytes: base64ToBytes(b64) };
    },
  };
}
