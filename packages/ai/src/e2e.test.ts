/**
 * End to end in free instant mode: prompt → spec → buildGame → the player's own pre-flight checks.
 * Uses the engine's real kits and art themes when `@degamed/engine/kits` is available, and the
 * local stub otherwise (the kit/theme expectations then only cover what the stub offers).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { backendFromKits, getBackend, setBackend, stubBackend, type GameBackend, type KitsModule } from './catalog';
import { checkPlayable, checkProject } from './check';
import { createGame } from './game';
import { encode } from './test-helpers';

async function realKits(): Promise<KitsModule | null> {
  const id = '@degamed/engine/kits';
  try {
    return (await import(/* @vite-ignore */ id)) as KitsModule;
  } catch {
    return null;
  }
}

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
  describe(`instant mode end to end (${mode} kits)`, async () => {
    const mod = mode === 'engine' ? await realKits() : null;
    const backend: GameBackend | null = mode === 'stub' ? stubBackend : mod ? backendFromKits(mod) : null;
    let previous: GameBackend;
    beforeAll(() => {
      previous = getBackend();
      if (backend) setBackend(backend);
    });
    afterAll(() => setBackend(previous));

    it.skipIf(!backend).each(CASES)('%s', async (prompt, kit, theme) => {
      const b = backend!;
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
    });
  });
}
