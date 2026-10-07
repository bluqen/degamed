/**
 * Bring-your-own-key storage. Keys live only in this browser's localStorage and are sent
 * directly to the provider's API, never to Degamed's servers.
 */

export type KeyProvider = 'anthropic' | 'gemini' | 'openai' | 'openrouter';

export type StoredKeys = Partial<Record<KeyProvider, string>>;

const STORAGE_KEY = 'degamed.keys.v1';

export function loadKeys(): StoredKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    const out: StoredKeys = {};
    for (const p of ['anthropic', 'gemini', 'openai', 'openrouter'] as const) {
      const v = (parsed as Record<string, unknown>)[p];
      if (typeof v === 'string' && v.trim()) out[p] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function saveKey(provider: KeyProvider, key: string | null): StoredKeys {
  const keys = loadKeys();
  if (key && key.trim()) keys[provider] = key.trim();
  else delete keys[provider];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Private mode or blocked storage: keys last for this page only.
  }
  return keys;
}

/** "sk-ant-…3f" style preview so a saved key is recognisable but not readable. */
export function maskKey(key: string): string {
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}
