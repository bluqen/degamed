import type { GameSpec } from './game/types';

/**
 * Share links carry the game's small spec in the URL, so anyone can rebuild and play it
 * without a server. (Games edited in Advanced need cloud publishing, coming later.)
 */
export function encodeSpec(spec: GameSpec): string {
  const json = JSON.stringify({
    k: spec.kit,
    t: spec.theme,
    n: spec.title,
    s: spec.seed,
    p: spec.params,
    y: spec.story?.slice(0, 280),
  });
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSpec(code: string): GameSpec | null {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const o = JSON.parse(json) as {
      k?: unknown;
      t?: unknown;
      n?: unknown;
      s?: unknown;
      p?: unknown;
      y?: unknown;
    };
    if (typeof o.k !== 'string' || typeof o.t !== 'string' || typeof o.n !== 'string') return null;
    const params =
      o.p && typeof o.p === 'object'
        ? (Object.fromEntries(
            Object.entries(o.p).filter(([, v]) =>
              ['number', 'string', 'boolean'].includes(typeof v),
            ),
          ) as GameSpec['params'])
        : undefined;
    return {
      kit: o.k,
      theme: o.t,
      title: o.n.slice(0, 80),
      seed: typeof o.s === 'number' ? o.s : undefined,
      params,
      story: typeof o.y === 'string' ? o.y : undefined,
    };
  } catch {
    return null;
  }
}

export function shareUrl(spec: GameSpec, origin = window.location.origin): string {
  return `${origin}/p/${encodeSpec(spec)}`;
}
