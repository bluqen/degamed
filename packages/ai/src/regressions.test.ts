/**
 * Regression tests for the critic's round-1 findings (docs/team/reviews/round-1.md):
 * 1. the story and title promised a hero the art couldn't draw (robot → cat, bat → knight);
 * 2. "add a boss" moved the game to the Ember Forge (theme keywords treated as world switches);
 * 3. "make it night" failed on the cave kit, then suggested "make it night".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { engineBackend, getBackend, setBackend, stubBackend, type GameBackend, type ThemeInfo } from './catalog';
import { checkPlayable } from './check';
import { createGame, editGame } from './game';
import { creatureIn, drawableText, heroFor } from './heroes';
import { instantEdit, instantSpec } from './instant';
import { catalogFor } from './catalog';
import { checkSpec, type GameSpec } from './protocol';
import { suggestions } from './suggest';
import { encode, gemini, geminiReply, mockFetch } from './test-helpers';

afterEach(() => {
  vi.unstubAllGlobals();
  setBackend(engineBackend());
});

const instant = { provider: 'instant' as const };
const engine = engineBackend();

/** A theme list where Rain Ruins can draw a robot (as art's hero variants will allow). */
const withHeroes: GameBackend = {
  ...stubBackend,
  themes: stubBackend.themes.map(
    (t): ThemeInfo =>
      t.id === 'rain-ruins'
        ? { ...t, heroes: [{ id: 'lantern-bot', name: 'Lantern robot', keywords: ['robot', 'bot'] }, { id: 'stray', name: 'Stray cat', keywords: ['cat'] }] }
        : t.id === 'hollow-caverns'
          ? { ...t, heroes: [{ id: 'cave-bat', name: 'Bat', keywords: ['bat'] }] }
          : t,
  ),
};

/** Every creature a text names must be drawable by the theme. */
function promisesOnlyDrawable(text: string, theme: ThemeInfo) {
  for (const w of text.split(/[^A-Za-z]+/)) {
    const c = creatureIn(w);
    if (c) expect(heroFor(theme, c.kind), `"${text}" names a ${c.word} the ${theme.id} theme can't draw`).not.toBeNull();
  }
}

describe('1. never promise a hero the art cannot draw', () => {
  it('rewrites creatures the theme cannot show, keeps the ones it can', () => {
    const plain: ThemeInfo = { id: 'x', name: 'X', description: 'Ruins with a small pale creature.', keywords: [] };
    expect(drawableText('A little robot looks for its family.', plain)).toBe('A little wanderer looks for its family.');
    expect(drawableText("Robot's Long Way Home", plain)).toBe("Wanderer's Long Way Home");
    expect(drawableText('An owl and two bats', plain)).toBe('A wanderer and two wanderers');
    expect(drawableText('The brave hero', plain)).toBe('The brave hero');
    const robotTheme: ThemeInfo = { ...plain, description: 'Ruins with a little lantern robot.' };
    expect(drawableText('A little robot looks for its family.', robotTheme)).toBe('A little robot looks for its family.');
  });

  it.each([
    'a moody rain-soaked platformer where a little robot looks for its family',
    'a bat collects crystals in a cave',
    'a fox escapes a volcano',
    'a knight rescues the princess',
    'a cat called Moonfall explores the ruins',
  ])('engine themes: "%s" names no undrawable hero in title, story or summary', async (prompt) => {
    setBackend(engine);
    const r = await createGame({ prompt, settings: instant, encode });
    const theme = engine.themes.find((t) => t.id === r.spec.theme)!;
    promisesOnlyDrawable(r.title, theme);
    promisesOnlyDrawable(r.spec.story ?? '', theme);
    promisesOnlyDrawable(r.summary, theme);
    expect(checkPlayable(r.files)).toEqual([]);
  });

  it('with hero variants: picks the matching hero and keeps it in the story', () => {
    const robot = instantSpec('a moody platformer where a little robot looks for its family', withHeroes).spec;
    expect(robot.theme).toBe('rain-ruins');
    expect(robot.hero).toBe('lantern-bot');
    expect(robot.story).toBe('A little robot looks for its family.');
    const bat = instantSpec('a bat collects crystals', withHeroes).spec;
    expect(bat.theme).toBe('hollow-caverns'); // the theme that can draw a bat wins
    expect(bat.hero).toBe('cave-bat');
    const none = instantSpec('a frog hops around', withHeroes).spec;
    expect(none.hero).toBeUndefined();
    expect(none.story).not.toMatch(/frog/i);
  });

  it('a model reply that names an undrawable hero is cleaned up', async () => {
    setBackend(stubBackend);
    mockFetch(() => geminiReply({ kit: 'platformer', theme: 'sunlit-meadow', title: 'Robot of the Meadow', story: 'A little robot looks for its family.' }));
    const r = await createGame({ prompt: 'a robot game', settings: gemini, encode });
    expect(r.title).toBe('Wanderer of the Meadow');
    expect(r.spec.story).toBe('A little wanderer looks for its family.');
    expect(r.summary).not.toMatch(/robot/i);
  });

  it('a hero id is only kept when the theme lists it', () => {
    const cat = catalogFor(withHeroes);
    expect(checkSpec({ kit: 'platformer', theme: 'rain-ruins', title: 'T', hero: 'lantern-bot' }, cat).spec?.hero).toBe('lantern-bot');
    expect(checkSpec({ kit: 'platformer', theme: 'rain-ruins', title: 'T', hero: 'dragon' }, cat).spec?.hero).toBeUndefined();
  });

  it('chat: swaps to a drawable hero, and says so honestly when it cannot', () => {
    const spec: GameSpec = { kit: 'platformer', theme: 'rain-ruins', title: 'T' };
    expect(instantEdit('play as a robot', spec, withHeroes)).toMatchObject({ understood: true, spec: { hero: 'lantern-bot' } });
    const no = instantEdit('make the hero a dragon', spec, withHeroes);
    expect(no.understood).toBe(false);
    expect(no.unsupported).toMatch(/can’t draw a dragon/);
    expect(no.spec).toEqual(spec);
  });
});

describe('2. only explicit place or mood words switch the world', () => {
  const meadow: GameSpec = { kit: 'platformer', theme: 'sunlit-meadow', title: 'T', seed: 1 };
  // A theme that (wrongly) lists genre words as keywords, like ember-forge did in round 1.
  const bossy: GameBackend = {
    ...engine,
    themes: [...engine.themes.filter((t) => t.id !== 'ember-forge'), { id: 'ember-forge', name: 'Ember Forge', description: 'Burning castle halls.', keywords: ['fire', 'castle', 'boss', 'combat', 'sword', 'epic', 'action'] }],
  };

  it.each(['add a boss', 'add a boss fight at the end', 'give me a sword', 'more combat and action', 'make it epic'])('"%s" keeps the world', (req) => {
    const r = instantEdit(req, meadow, bossy);
    expect(r.spec.theme).toBe('sunlit-meadow');
    expect(r.summary).not.toMatch(/Moved it/);
  });

  it('"add a boss" gets an honest answer with suggestions that work on this kit', async () => {
    const made = await createGame({ prompt: 'a happy meadow platformer', settings: instant, encode });
    const r = await editGame({ files: made.files, request: 'add a boss', settings: instant, encode });
    expect(r.changed).toEqual([]);
    expect(r.summary).toMatch(/^Bosses aren’t in free mode yet\. Add an AI key in Settings to try it or try “.+” or “.+”\.$/);
    const tried = [...r.summary.matchAll(/“([^”]+)”/g)].map((m) => m[1]!);
    for (const chip of tried) {
      const after = await editGame({ files: made.files, request: chip, settings: instant, encode });
      expect(after.changed, chip).not.toEqual([]);
    }
  });

  it('a model may not move the world either unless a place is named', async () => {
    setBackend(stubBackend);
    const made = await createGame({ prompt: 'a happy meadow platformer', settings: instant, encode });
    mockFetch(() => geminiReply({ summary: 'Added a boss in the Hollow Caverns.', spec: { theme: 'hollow-caverns', params: { enemies: 8 } } }));
    const r = await editGame({ files: made.files, request: 'add a big final boss with a huge health bar please', settings: gemini, encode });
    expect(getBackend().readSpec(r.files)).toMatchObject({ theme: 'sunlit-meadow', params: { enemies: 8 } });
    mockFetch(() => geminiReply({ summary: 'Moved it underground.', spec: { theme: 'hollow-caverns' } }));
    const moved = await editGame({ files: made.files, request: 'move the whole adventure underground please', settings: gemini, encode });
    expect(getBackend().readSpec(moved.files)!.theme).toBe('hollow-caverns');
  });

  it.each([
    ['move it to a cave', 'hollow-caverns'],
    ['make it a cave', 'hollow-caverns'],
    ['set it in the ember forge', 'ember-forge'],
    ['make it spooky', 'hollow-caverns'],
    ['take it to the rainy ruins', 'rain-ruins'],
  ])('"%s" → %s (world only, same kit)', (req, theme) => {
    const r = instantEdit(req, meadow, engine);
    expect(r.spec.theme).toBe(theme);
    expect(r.spec.kit).toBe('platformer');
  });

  it('a genre change needs the genre named outright', () => {
    expect(instantEdit('make it an endless runner', meadow, engine).spec.kit).toBe('runner');
    expect(instantEdit('make it a metroidvania', meadow, engine).spec.kit).toBe('cave');
  });
});

describe('3. honest free mode on every kit (night and day in the cave)', () => {
  it('cave: night and day map onto darkness, and "already" is said plainly', async () => {
    setBackend(engine);
    const made = await createGame({ prompt: 'a dark cave metroidvania', settings: instant, encode });
    expect(getBackend().readSpec(made.files)!.params).toMatchObject({ darkness: 'dark' });

    const night = await editGame({ files: made.files, request: 'make it night', settings: instant, encode });
    expect(night.summary).toBe('It’s already as dark as it gets.');
    expect(night.changed).toEqual([]);

    const day = await editGame({ files: made.files, request: 'make it day', settings: instant, encode });
    expect(getBackend().readSpec(day.files)!.params).toMatchObject({ darkness: 'light' });
    expect(day.summary).toBe('Turned it to day.');

    const back = await editGame({ files: day.files, request: 'make it night', settings: instant, encode });
    expect(getBackend().readSpec(back.files)!.params).toMatchObject({ darkness: 'dark' });
  });

  it('never suggests a chip that would not change the current game', async () => {
    setBackend(engine);
    for (const prompt of ['a dark cave metroidvania', 'a rainy platformer at night', 'an endless runner']) {
      const made = await createGame({ prompt, settings: instant, encode });
      const chips = suggestions(made.files);
      if (prompt.includes('cave')) expect(chips).not.toContain('Make it night');
      if (prompt.includes('night')) expect(chips).not.toContain('Make it night');
      const r = await editGame({ files: made.files, request: 'add a grappling hook', settings: instant, encode });
      expect(r.summary).toMatch(/free mode/);
      for (const chip of [...r.summary.matchAll(/“([^”]+)”/g)].map((m) => m[1]!)) {
        const after = await editGame({ files: made.files, request: chip, settings: instant, encode });
        expect(after.changed, `${prompt}: ${chip}`).not.toEqual([]);
      }
    }
  });

  it('says "already" instead of failing when a setting is at its limit', () => {
    const spec: GameSpec = { kit: 'platformer', theme: 'sunlit-meadow', title: 'T', params: { difficulty: 3, enemies: 'lots' } };
    const r = instantEdit('make it harder', spec, engine);
    expect(r).toMatchObject({ understood: true, summary: 'It’s already as hard as it goes.' });
  });
});
