import type { GameSpec } from './game/types';

/**
 * Share links carry the game's small recipe (its spec) in the URL, so anyone can rebuild and
 * play it without a server. Version 1 links are compact: only the params that differ from the
 * kit's defaults, as a short JSON array, deflated and base64url-encoded (typically ~60–120
 * characters). Games edited in Advanced need cloud publishing (a short id from the API) later.
 */

type Params = NonNullable<GameSpec['params']>;

const b64url = (bytes: Uint8Array) => {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (s: string) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Only the params that differ from the defaults (the rebuild fills the rest in). */
export function diffParams(params: Params | undefined, defaults: Params): Params {
  const out: Params = {};
  for (const [k, v] of Object.entries(params ?? {})) if (defaults[k] !== v) out[k] = v;
  return out;
}

export async function encodeSpec(spec: GameSpec, defaults: Params = {}): Promise<string> {
  const p = diffParams(spec.params, defaults);
  const tuple: unknown[] = [spec.kit, spec.theme, spec.title, spec.seed ?? 0];
  if (Object.keys(p).length) tuple.push(p);
  const json = new TextEncoder().encode(JSON.stringify(tuple));
  if (typeof CompressionStream === 'undefined') return `0${b64url(json)}`;
  return `1${b64url(await pipe(json, new CompressionStream('deflate-raw')))}`;
}

export async function decodeSpec(code: string): Promise<GameSpec | null> {
  try {
    const version = code[0];
    let bytes: Uint8Array;
    if (version === '1')
      bytes = await pipe(unb64url(code.slice(1)), new DecompressionStream('deflate-raw'));
    else if (version === '0') bytes = unb64url(code.slice(1));
    else return decodeLegacy(code);
    const t = JSON.parse(new TextDecoder().decode(bytes)) as unknown[];
    if (
      !Array.isArray(t) ||
      typeof t[0] !== 'string' ||
      typeof t[1] !== 'string' ||
      typeof t[2] !== 'string'
    )
      return null;
    return {
      kit: t[0],
      theme: t[1],
      title: t[2].slice(0, 80),
      seed: typeof t[3] === 'number' ? t[3] : undefined,
      params: cleanParams(t[4]),
    };
  } catch {
    return null;
  }
}

function cleanParams(p: unknown): Params | undefined {
  if (!p || typeof p !== 'object') return undefined;
  return Object.fromEntries(
    Object.entries(p).filter(([, v]) => ['number', 'string', 'boolean'].includes(typeof v)),
  ) as Params;
}

/** Links made earlier this round: base64url of a JSON object. */
function decodeLegacy(code: string): GameSpec | null {
  try {
    const o = JSON.parse(new TextDecoder().decode(unb64url(code))) as {
      k?: unknown;
      t?: unknown;
      n?: unknown;
      s?: unknown;
      p?: unknown;
    };
    if (typeof o.k !== 'string' || typeof o.t !== 'string' || typeof o.n !== 'string') return null;
    return {
      kit: o.k,
      theme: o.t,
      title: o.n.slice(0, 80),
      seed: typeof o.s === 'number' ? o.s : undefined,
      params: cleanParams(o.p),
    };
  } catch {
    return null;
  }
}

export async function shareUrl(
  spec: GameSpec,
  defaults: Params = {},
  origin = window.location.origin,
): Promise<string> {
  return `${origin}/p/${await encodeSpec(spec, defaults)}`;
}
