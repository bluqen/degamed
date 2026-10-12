import { vi } from 'vitest';
import type { Encoder } from '@degamed/engine/templates';
import { stubBackend, type GameBackend, type KitInfo, type ThemeInfo } from './catalog';

/** Tests have no canvas: encode rasters as a short fake data URL. */
export const encode: Encoder = (r) => `data:image/png;base64,${r.width}x${r.height}`;

const extraKits: KitInfo[] = [
  {
    id: 'runner',
    name: 'Runner',
    description: 'Endless auto-runner: jump over gaps and dodge hazards.',
    keywords: ['runner', 'endless', 'auto-run'],
    params: [
      { key: 'speed', label: 'Speed', type: 'number', min: 100, max: 400, step: 10, default: 200 },
      { key: 'length', label: 'Level length', type: 'number', min: 1, max: 10, step: 1, default: 3 },
    ],
  },
  {
    id: 'topdown',
    name: 'Top-down adventure',
    description: 'Explore rooms from above, find keys, avoid monsters.',
    keywords: ['top-down', 'zelda', 'dungeon'],
    params: [{ key: 'rooms', label: 'Rooms', type: 'number', min: 2, max: 12, step: 1, default: 5 }],
  },
  {
    id: 'shooter',
    name: 'Shooter',
    description: 'Fly and shoot waves of enemies.',
    keywords: ['shooter', 'shmup', 'spaceship'],
    params: [{ key: 'waves', label: 'Enemy waves', type: 'number', min: 1, max: 10, step: 1, default: 4 }],
  },
];

const extraThemes: ThemeInfo[] = [
  { id: 'frost-peaks', name: 'Frost Peaks', description: 'Snowy mountain cliffs with blizzards.', keywords: ['snow', 'ice', 'winter', 'mountain'] },
  { id: 'neon-city', name: 'Neon City', description: 'Rainy cyberpunk rooftops glowing with neon.', keywords: ['neon', 'cyberpunk', 'city', 'robot', 'future'] },
];

/** A catalogue with several kits and themes (the stub has one kit), still building the stub game. */
export const multiBackend: GameBackend = {
  ...stubBackend,
  kits: [
    {
      ...stubBackend.kits[0]!,
      params: [...stubBackend.kits[0]!.params, { key: 'length', label: 'Level length', type: 'number', min: 1, max: 8, step: 1, default: 3 }],
    },
    ...extraKits,
  ],
  themes: [...stubBackend.themes, ...extraThemes],
};

export interface FetchCall {
  url: string;
  init: RequestInit;
  body: Record<string, unknown>;
}

/** Stubs global fetch with a handler; returns the recorded calls. */
export function mockFetch(handler: (call: FetchCall, index: number) => Response | Promise<Response>): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const call = { url: String(url), init, body: init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {} };
      calls.push(call);
      return handler(call, calls.length - 1);
    }),
  );
  return calls;
}

/** A Gemini-shaped reply carrying `text`. */
export const geminiReply = (text: string | object) =>
  Response.json({
    candidates: [{ content: { parts: [{ text: typeof text === 'string' ? text : JSON.stringify(text) }] } }],
    usageMetadata: { promptTokenCount: 700, candidatesTokenCount: 90 },
  });

export const gemini = { provider: 'gemini' as const, apiKey: 'test-key' };
