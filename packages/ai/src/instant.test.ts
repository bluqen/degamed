import { describe, expect, it } from 'vitest';
import { stubBackend } from './catalog';
import { instantEdit, instantSpec } from './instant';
import { checkSpec, type GameSpec } from './protocol';
import { catalogFor } from './catalog';
import { multiBackend } from './test-helpers';

const spec = (prompt: string, backend = multiBackend) => instantSpec(prompt, backend).spec;

describe('instant mode: prompt → spec', () => {
  it('reads the flagship prompt: moody rain platformer with a robot looking for its family', () => {
    const s = spec('a moody rain-soaked platformer where a little robot looks for its family');
    expect(s.kit).toBe('platformer');
    expect(s.theme).toBe('rain-ruins');
    expect(s.title).toMatch(/Robot/);
    expect(s.story).toBe('A little robot looks for its family.');
  });

  it.each([
    ['a spooky haunted game', 'hollow-caverns'],
    ['creepy bugs in the dark underground', 'hollow-caverns'],
    ['it is raining on old ruins', 'rain-ruins'],
    ['a happy cheerful game for kids with flowers', 'sunlit-meadow'],
    ['frozen winter mountain climb', 'frost-peaks'],
    ['cyberpunk neon rooftops', 'neon-city'],
  ])('mood "%s" → %s', (prompt, theme) => {
    expect(spec(prompt).theme).toBe(theme);
  });

  it.each([
    ['an endless runner', 'runner'],
    ['a top-down zelda dungeon crawler', 'topdown'],
    ['a top down adventure', 'topdown'],
    ['space shooter with a tiny spaceship', 'shooter'],
    ['a game about a cat', 'platformer'],
  ])('genre "%s" → %s', (prompt, kit) => {
    expect(spec(prompt).kit).toBe(kit);
  });

  it('turns difficulty words into params', () => {
    expect(spec('a very hard platformer').params).toMatchObject({ difficulty: 'hard', enemies: 10 });
    expect(spec('a hard platformer').params).toMatchObject({ difficulty: 'hard' });
    expect(spec('a relaxing easy platformer').params).toMatchObject({ difficulty: 'easy' });
    expect(spec('a peaceful platformer with no enemies').params).toMatchObject({ enemies: 0 });
  });

  it('understands length, feel and time of day', () => {
    expect(spec('a short platformer').params).toMatchObject({ length: 1 });
    expect(spec('an epic long platformer').params).toMatchObject({ length: 7 });
    const floaty = spec('a floaty moon platformer').params!;
    expect(floaty.gravity as number).toBeLessThan(900);
    expect(spec('a fast platformer').params!.speed as number).toBeGreaterThan(150);
    expect(spec('a platformer at night').params).toMatchObject({ night: true });
  });

  it('reads explicit numbers and clamps them to the kit range', () => {
    expect(spec('a platformer with 7 enemies').params).toMatchObject({ enemies: 7 });
    expect(spec('a platformer with three slimes and 5 coins').params).toMatchObject({ enemies: 3, coins: 5 });
    expect(spec('a platformer with 50 enemies').params).toMatchObject({ enemies: 12 });
  });

  it('uses a name the player gives', () => {
    expect(spec('a platformer called Moonfall about a fox').title).toBe('Moonfall');
    expect(spec('"Rust and Rain" — a robot game').title).toBe('Rust And Rain');
  });

  it('is deterministic and always valid against the catalogue', () => {
    const prompts = ['', 'x', 'make me a game', 'a moody rain-soaked platformer', '🙂🙂', 'a'.repeat(600), 'lava dragon castle with lots of enemies'];
    for (const p of prompts) {
      const a = spec(p);
      expect(spec(p)).toEqual(a);
      expect(checkSpec(a, catalogFor(multiBackend)).errors).toEqual([]);
    }
  });

  it('gives vague prompts some variety', () => {
    const themes = new Set(['a game', 'my game', 'fun times', 'something cool', 'surprise me', 'anything'].map((p) => spec(p).theme));
    expect(themes.size).toBeGreaterThan(1);
  });

  it('only sets params that differ from the defaults', () => {
    expect(spec('a platformer').params).toBeUndefined();
  });
});

describe('instant mode: chat edits', () => {
  const base: GameSpec = { kit: 'platformer', theme: 'sunlit-meadow', title: 'Test', seed: 1 };
  const edit = (req: string, s = base, backend = stubBackend) => instantEdit(req, s, backend);

  it('makes it harder and easier', () => {
    const harder = edit('make it harder');
    expect(harder.understood).toBe(true);
    expect(harder.spec.params).toMatchObject({ difficulty: 'hard' });
    expect(harder.spec.params!.enemies as number).toBeGreaterThan(4);
    expect(harder.summary).toBe('Made it harder.');
    expect(edit('make it easier').spec.params).toMatchObject({ difficulty: 'easy' });
  });

  it('nudges feel params relative to their current value', () => {
    const once = edit('Floatier jumps');
    expect(once.spec.params!.gravity as number).toBeLessThan(900);
    const twice = edit('Floatier jumps', once.spec);
    expect(twice.spec.params!.gravity as number).toBeLessThan(once.spec.params!.gravity as number);
    expect(edit('add more enemies').spec.params!.enemies as number).toBeGreaterThan(4);
    expect(edit('remove the enemies').spec.params).toMatchObject({ enemies: 0 });
  });

  it('turns night on with a param, or switches to a darker world when the kit has none', () => {
    expect(edit('make it night').spec.params).toMatchObject({ night: true });
    const noNight = { ...stubBackend, kits: [{ ...stubBackend.kits[0]!, params: stubBackend.kits[0]!.params.filter((p) => p.key !== 'night') }] };
    const r = edit('make it night', base, noNight);
    expect(r.spec.theme).toBe('hollow-caverns');
  });

  it('switches world and genre', () => {
    expect(edit('set it somewhere snowy and frozen', base, multiBackend).spec.theme).toBe('frost-peaks');
    const shooter = edit('make it a shooter', { ...base, params: { enemies: 9 } }, multiBackend);
    expect(shooter.spec.kit).toBe('shooter');
    expect(shooter.spec.params).toBeUndefined();
  });

  it('renames', () => {
    const r = edit('call it "Moss & Rust"');
    expect(r.spec.title).toBe('Moss & Rust');
    expect(r.summary).toContain('Moss & Rust');
  });

  it('says so when it does not understand', () => {
    const r = edit('add a grappling hook that swings');
    expect(r.understood).toBe(false);
    expect(r.spec).toEqual({ ...base, params: undefined });
  });
});
