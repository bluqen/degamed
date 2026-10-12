/**
 * Stand-in for `@degamed/ai` until it lands: free "instant mode" by keyword matching.
 * Follows the contract (createGame / editGame / suggestions / availableProviders).
 */
import { titleFromIdea } from '../titles';
import type { AiSettings, ChatTurn, CreateResult, EditResult, Encoder, GameSpec, Kit, Progress, ProjectFiles, ProviderId, ThemeArt } from './types';

interface Deps {
  kits: Kit[];
  themes: () => { id: string; name: string; keywords: string[] }[];
  buildGame: (spec: GameSpec, encode: Encoder) => ProjectFiles;
  readSpec: (files: ProjectFiles) => GameSpec | null;
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelled', 'AbortError'));
    const t = window.setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      window.clearTimeout(t);
      reject(new DOMException('Cancelled', 'AbortError'));
    });
  });

function score(text: string, keywords: string[]) {
  const t = text.toLowerCase();
  return keywords.reduce((s, k) => s + (t.includes(k.toLowerCase()) ? 1 : 0), 0);
}

export function pickBest<T extends { keywords: string[] }>(text: string, list: T[]): T {
  let best = list[0]!;
  let bestScore = 0;
  for (const item of list) {
    const s = score(text, item.keywords);
    if (s > bestScore) {
      best = item;
      bestScore = s;
    }
  }
  return best;
}

export function makeStubAi(d: Deps) {
  async function createGame(i: { prompt: string; settings: AiSettings; encode: Encoder; signal?: AbortSignal; onProgress?: (p: Progress) => void }): Promise<CreateResult> {
    const step = async (p: Progress, ms: number) => {
      i.onProgress?.(p);
      await wait(ms, i.signal);
    };
    await step({ stage: 'understanding', message: 'Reading your idea' }, 700);
    const kit = pickBest(i.prompt, d.kits);
    const theme = pickBest(i.prompt, d.themes());
    await step({ stage: 'designing', message: `Designing a ${kit.name.toLowerCase()} in ${theme.name}` }, 800);
    const title = titleFromIdea(i.prompt);
    const spec: GameSpec = { kit: kit.id, theme: theme.id, title, seed: Math.floor(Math.random() * 1e6), story: i.prompt.trim() };
    await step({ stage: 'building', message: 'Building the level and drawing the art' }, 200);
    const files = d.buildGame(spec, i.encode);
    await wait(600, i.signal);
    await step({ stage: 'testing', message: 'Playtesting it' }, 700);
    i.onProgress?.({ stage: 'done', message: 'Ready to play' });
    return { files, spec, title, summary: `A ${kit.name.toLowerCase()} set in ${theme.name}. Try the arrow keys and Space.` };
  }

  async function editGame(i: { files: ProjectFiles; request: string; history?: ChatTurn[]; settings: AiSettings; encode: Encoder; signal?: AbortSignal; onProgress?: (p: Progress) => void }): Promise<EditResult> {
    const spec = d.readSpec(i.files);
    i.onProgress?.({ stage: 'understanding', message: 'Thinking about your change' });
    await wait(600, i.signal);
    if (!spec) return { files: i.files, summary: "This game was made by hand, so I can't change it by chat yet. Try Advanced.", changed: [] };
    const kit = d.kits.find((k) => k.id === spec.kit) ?? d.kits[0]!;
    const p: Record<string, number | boolean | string> = { ...Object.fromEntries(kit.params.map((x) => [x.key, x.default])), ...spec.params };
    const r = i.request.toLowerCase();
    const notes: string[] = [];
    const num = (k: string) => Number(p[k]);
    const clamp = (k: string, v: number) => {
      const def = kit.params.find((x) => x.key === k);
      return Math.min(def?.max ?? v, Math.max(def?.min ?? v, v));
    };
    if (/float|floaty|moon|higher jump|jump higher|bigger jump/.test(r)) {
      p.jump = clamp('jump', num('jump') + 60);
      p.gravity = clamp('gravity', num('gravity') - 200);
      notes.push('made the jumps higher and floatier');
    }
    if (/heav|lower jump|less floaty|snappier/.test(r)) {
      p.gravity = clamp('gravity', num('gravity') + 250);
      notes.push('made jumps snappier');
    }
    if (/fast|speed up|quicker/.test(r)) {
      p.speed = clamp('speed', num('speed') + 40);
      notes.push('sped the hero up');
    }
    if (/slow/.test(r)) {
      p.speed = clamp('speed', num('speed') - 40);
      notes.push('slowed the hero down');
    }
    if (/no enem|remove enem|without enem|peaceful/.test(r)) {
      p.enemies = false;
      notes.push('removed the enemies');
    } else if (/enem|monster|harder|danger/.test(r)) {
      p.enemies = true;
      p.difficulty = 'tricky';
      notes.push('made the enemies tougher');
    }
    if (/easier|relax|chill/.test(r)) {
      p.difficulty = 'relaxed';
      notes.push('made it more relaxed');
    }
    let theme = spec.theme;
    const themes = d.themes();
    const match = themes.find((t) => score(r, [...t.keywords, t.name]) > 0 && t.id !== spec.theme);
    if (/night|dark|moody|rain/.test(r) && !match) theme = themes.find((t) => t.id === 'rain-ruins')?.id ?? theme;
    else if (match) theme = match.id;
    if (theme !== spec.theme) notes.push(`switched the look to ${themes.find((t) => t.id === theme)?.name}`);

    i.onProgress?.({ stage: 'building', message: 'Rebuilding the game' });
    await wait(500, i.signal);
    if (!notes.length) {
      return {
        files: i.files,
        summary: "I'm in free instant mode, so I can only do simple changes like “make the jumps floatier”, “faster”, “no enemies” or “make it snowy”. Add an AI key in Settings for anything else.",
        changed: [],
      };
    }
    const files = d.buildGame({ ...spec, theme, params: p }, i.encode);
    i.onProgress?.({ stage: 'done', message: 'Done' });
    const text = notes.join(', ');
    return { files, summary: `Done: I ${text}.`, changed: Object.keys(files).filter((k) => files[k] !== i.files[k]) };
  }

  function suggestions(files: ProjectFiles): string[] {
    const spec = d.readSpec(files);
    if (!spec) return [];
    const others = d.themes().filter((t) => t.id !== spec.theme);
    const p = spec.params ?? {};
    return [
      'Make the jumps floatier',
      p.enemies === false ? 'Add enemies back' : 'Make the enemies tougher',
      'Make the hero faster',
      others[0] ? `Make it ${others[0].keywords[0]}` : 'Make it night-time',
    ];
  }

  function availableProviders(keys: Record<string, string | undefined>, hosted: boolean): ProviderId[] {
    const out: ProviderId[] = ['instant'];
    if (hosted) out.push('degamed');
    for (const id of ['gemini', 'openai', 'anthropic'] as const) if (keys[id]) out.push(id);
    return out;
  }

  return { createGame, editGame, suggestions, availableProviders };
}

export type { ThemeArt };
