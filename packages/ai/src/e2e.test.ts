/**
 * End to end in free instant mode: prompt → spec → buildGame → the player's own pre-flight checks.
 * Runs on the engine's real kits and art themes (`@degamed/engine/kits`), and on the local stub
 * (whose kit/theme expectations only cover what the stub offers).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { engineBackend, getBackend, setBackend, stubBackend, type GameBackend } from './catalog';
import { checkPlayable, checkProject } from './check';
import { createGame, editGame } from './game';
import { suggestions } from './suggest';
import { instantSpec } from './instant';
import { creatureIn, heroFor } from './heroes';
import { encode } from './test-helpers';

/** [prompt, kit, theme]. `null` = any. */
const CASES: [string, string | null, string | null][] = [
  ['a moody rain-soaked platformer where a little robot looks for its family', 'platformer', 'rain-ruins'],
  ['a spooky platformer about a ghost in a haunted crypt', 'platformer', 'hollow-caverns'],
  ['a happy platformer where a frog collects flowers in a sunny meadow', 'platformer', 'sunlit-meadow'],
  ['an endless runner through stormy abandoned ruins', 'runner', 'rain-ruins'],
  ['a cheerful endless runner for kids', 'runner', 'sunlit-meadow'],
  ['explore dark underground caves with a sword, like hollow knight', 'cave', 'hollow-caverns'],
  ['a creepy metroidvania in glowing caverns full of bugs', 'cave', 'hollow-caverns'],
  ['a very hard platformer with lots of enemies', 'platformer', null],
  ['a short easy game for my little sister about a bunny', null, 'sunlit-meadow'],
  ['a floaty moon jumping game at night', 'platformer', null],
  ['a platformer called Moonfall with 3 enemies', 'platformer', null],
  ['rainy melancholy game about a lonely lamp robot', null, 'rain-ruins'],
  ['make me a game', null, null],
  ['dash through a happy spring meadow as fast as you can, endless!', 'runner', 'sunlit-meadow'],
  ['delve into the haunted depths and slash spooky monsters', 'cave', 'hollow-caverns'],
];

for (const mode of ['engine', 'stub'] as const) {
  describe(`instant mode end to end (${mode} kits)`, () => {
    const backend: GameBackend = mode === 'stub' ? stubBackend : engineBackend();
    let previous: GameBackend;
    beforeAll(() => {
      previous = getBackend();
      setBackend(backend);
    });
    afterAll(() => setBackend(previous));

    it.each(CASES)('%s', async (prompt, kit, theme) => {
      const b = backend;
      const r = await createGame({ prompt, settings: { provider: 'instant' }, encode });
      const kits = b.kits.map((k) => k.id);
      const themes = b.themes.map((t) => t.id);
      if (kit && kits.includes(kit)) expect(r.spec.kit).toBe(kit);
      else expect(kits).toContain(r.spec.kit);
      if (theme && themes.includes(theme)) expect(r.spec.theme).toBe(theme);
      else expect(themes).toContain(r.spec.theme);
      expect(r.provider).toBe('instant');
      expect(r.title.length).toBeGreaterThan(1);
      expect(b.readSpec(r.files)).toMatchObject({ kit: r.spec.kit, theme: r.spec.theme });
      expect(checkPlayable(r.files)).toEqual([]);
      expect(checkProject(r.files)).toEqual([]);
      // Never promise a hero the theme can't draw (critic, round 1).
      const chosen = b.themes.find((t) => t.id === r.spec.theme)!;
      for (const w of `${r.title} ${r.summary}`.split(/[^A-Za-z]+/)) {
        const c = creatureIn(w);
        if (c) expect(heroFor(chosen, c.kind), `${r.summary} names a ${c.word}`).not.toBeNull();
      }
    });

    it('instant time-to-spec is far under the 300 ms bar', () => {
      const t0 = performance.now();
      for (const [prompt] of CASES) instantSpec(prompt, backend);
      const avg = (performance.now() - t0) / CASES.length;
      console.info(`[degamed/ai] instant time-to-spec (${mode}): ${avg.toFixed(2)} ms average`);
      expect(avg).toBeLessThan(30);
    });
  });
}

describe('instant chat edits on the engine kits', () => {
  let previous: GameBackend;
  beforeAll(() => {
    previous = getBackend();
    setBackend(engineBackend());
  });
  afterAll(() => setBackend(previous));

  const EDITS: [string, string, Record<string, unknown>][] = [
    ['a rainy robot platformer', 'Make it night', { time: 'night' }],
    ['a rainy robot platformer', 'make it harder', { difficulty: 3 }],
    ['a sunny meadow platformer', 'make it snow', { weather: 'snow' }],
    ['a sunny meadow platformer', 'Floatier jumps', {}],
    ['a sunny meadow platformer', 'remove the enemies', { enemies: 'none' }],
    ['a sunny meadow platformer', 'add a double jump', { doubleJump: true }],
    ['an endless runner', 'make it faster', {}],
    ['a dark cave metroidvania', 'make it brighter', { darkness: 'light' }],
    ['a dark cave metroidvania', 'more crystals', {}],
  ];

  it.each(EDITS)('%s → "%s"', async (prompt, request, expected) => {
    const made = await createGame({ prompt, settings: { provider: 'instant' }, encode });
    const before = getBackend().readSpec(made.files)!;
    const r = await editGame({ files: made.files, request, settings: { provider: 'instant' }, encode });
    const after = getBackend().readSpec(r.files)!;
    expect(r.changed.length).toBeGreaterThan(0);
    expect(after.params).toMatchObject(expected);
    expect(JSON.stringify(after.params)).not.toBe(JSON.stringify(before.params));
    expect(checkPlayable(r.files)).toEqual([]);
  });

  it.each(['a rainy robot platformer', 'an endless runner', 'a dark cave metroidvania'])('chips for "%s" all work for free', async (prompt) => {
    const made = await createGame({ prompt, settings: { provider: 'instant' }, encode });
    const chips = suggestions(made.files);
    expect(chips.length).toBeGreaterThanOrEqual(4);
    expect(chips.length).toBeLessThanOrEqual(6);
    for (const chip of chips) {
      const r = await editGame({ files: made.files, request: chip, settings: { provider: 'instant' }, encode });
      expect(r.changed, chip).not.toEqual([]);
    }
  });
});

it('the default backend is the engine’s kits and themes', async () => {
  vi.resetModules();
  const fresh = await import('./catalog');
  expect(fresh.getBackend().kits.map((k) => k.id)).toEqual(expect.arrayContaining(['platformer', 'runner', 'cave']));
  expect(fresh.getBackend().themes.map((t) => t.id)).toEqual(expect.arrayContaining(['rain-ruins', 'hollow-caverns', 'sunlit-meadow']));
  setBackend(engineBackend());
  expect(getBackend().kits.map((k) => k.id)).toEqual(expect.arrayContaining(['platformer', 'runner', 'cave']));
  expect(getBackend().themes.map((t) => t.id)).toEqual(expect.arrayContaining(['rain-ruins', 'hollow-caverns', 'sunlit-meadow']));
});

describe('instant params on the engine kits', () => {
  const b = engineBackend();
  it.each([
    ['a snowy meadow platformer at dusk', { weather: 'snow', time: 'dusk' }],
    ['a very hard platformer with lots of enemies', { difficulty: 3, enemies: 'lots' }],
    ['a relaxing platformer with no enemies', { difficulty: 1, enemies: 'none' }],
    ['a short platformer at night', { length: 3, time: 'night' }],
    ['a floaty platformer with a double jump', { doubleJump: true }],
    ['a small cave metroidvania with 2 enemies', { size: 'small', enemies: 'few' }],
    ['an endless runner in the rain-soaked ruins', {}],
  ])('%s', (prompt, params) => {
    const { spec } = instantSpec(prompt, b);
    expect(spec.params ?? {}).toMatchObject(params);
    if (prompt.includes('floaty')) expect(spec.params!.gravity as number).toBeLessThan(900);
    if (prompt.includes('rain-soaked')) expect(spec.params?.weather).toBeUndefined(); // the theme already rains
  });
});
