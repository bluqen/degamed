import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backendFromKits, getBackend, setBackend, SPEC_FILE, stubBackend } from './catalog';
import { checkProject } from './check';
import { createGame, editGame, repairFromErrors, setAiLogger, type Progress } from './game';
import { applyEdits, EditError, mergeRebuild, MODS_FILE, readMods } from './patch';
import { LIMITS, type GameSpec } from './protocol';
import { suggestions } from './suggest';
import { encode, gemini, geminiReply, mockFetch } from './test-helpers';
import { instantEdit } from './instant';

const logs: unknown[] = [];
beforeEach(() => {
  logs.length = 0;
  setAiLogger((e) => logs.push(e));
  setBackend(stubBackend);
});
afterEach(() => vi.unstubAllGlobals());

const specOf = (files: Record<string, string>) => JSON.parse(files[SPEC_FILE]!) as GameSpec;
const instant = { provider: 'instant' as const };

async function makeGame(prompt = 'a moody rain-soaked platformer where a little robot looks for its family') {
  return createGame({ prompt, settings: instant, encode });
}

describe('createGame', () => {
  it('instant mode: builds a playable game offline and reports friendly progress', async () => {
    const fetchSpy = mockFetch(() => new Response('should not be called', { status: 500 }));
    const stages: Progress[] = [];
    const r = await createGame({ prompt: 'a spooky cave game', settings: instant, encode, onProgress: (p) => stages.push(p) });
    expect(fetchSpy).toHaveLength(0);
    expect(r.provider).toBe('instant');
    expect(r.spec.theme).toBe('hollow-caverns');
    expect(r.files['project.json']).toBeDefined();
    expect(specOf(r.files)).toEqual(r.spec);
    expect(checkProject(r.files)).toEqual([]);
    expect(r.title).toBe(r.spec.title);
    expect(r.summary).toMatch(/platformer set in the Hollow Caverns/);
    expect(stages.map((s) => s.stage)).toEqual(['understanding', 'designing', 'building', 'testing', 'done']);
    expect(stages.every((s) => s.message.length > 3)).toBe(true);
  });

  it('applies params to the built game', async () => {
    const r = await createGame({ prompt: 'a floaty platformer with 2 enemies', settings: instant, encode });
    const manifest = JSON.parse(r.files['project.json']!) as { physics: { gravity: { y: number } } };
    expect(manifest.physics.gravity.y).toBeLessThan(900);
    const scene = JSON.parse(r.files['scenes/main.scene.json']!) as { entities: { tags: string[] }[] };
    expect(scene.entities.filter((e) => e.tags.includes('enemy'))).toHaveLength(2);
  });

  it('uses the model spec when the model answers well, and logs tokens', async () => {
    mockFetch(() => geminiReply({ kit: 'platformer', theme: 'sunlit-meadow', title: 'Clover Hop', story: 'A frog hops home.', params: { gravity: 600 } }));
    const r = await createGame({ prompt: 'a frog game', settings: gemini, encode });
    expect(r.provider).toBe('gemini');
    expect(r.spec).toMatchObject({ title: 'Clover Hop', params: { gravity: 600 } });
    expect(r.notice).toBeUndefined();
    expect(r.usage).toMatchObject({ inputTokens: 700, outputTokens: 90, calls: 1 });
    expect(logs).toEqual([expect.objectContaining({ task: 'create', provider: 'gemini' })]);
  });

  it('repairs an invalid reply once', async () => {
    const calls = mockFetch((_c, n) =>
      n === 0 ? geminiReply('{"kit":"kart-racer","theme":"rain-ruins","title":"Vroom"}') : geminiReply({ kit: 'platformer', theme: 'rain-ruins', title: 'Vroom' }),
    );
    const r = await createGame({ prompt: 'a racing game', settings: gemini, encode });
    expect(calls).toHaveLength(2);
    expect(r.provider).toBe('gemini');
    expect(r.spec.title).toBe('Vroom');
  });

  it('falls back to instant mode when the model keeps failing, so there is always a game', async () => {
    const calls = mockFetch(() => geminiReply('Sorry, I cannot help with that.'));
    const r = await createGame({ prompt: 'a happy meadow game', settings: gemini, encode });
    expect(calls).toHaveLength(2);
    expect(r.provider).toBe('instant');
    expect(r.notice).toMatch(/instant mode instead/);
    expect(r.spec.theme).toBe('sunlit-meadow');
    expect(checkProject(r.files)).toEqual([]);
  });

  it('falls back on a rejected key or a network error', async () => {
    mockFetch(() => new Response('{}', { status: 403 }));
    const r1 = await createGame({ prompt: 'a game', settings: gemini, encode });
    expect(r1.notice).toMatch(/rejected the API key/);
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    const r2 = await createGame({ prompt: 'a game', settings: gemini, encode });
    expect(r2.notice).toMatch(/Couldn't reach/);
    const r3 = await createGame({ prompt: 'a game', settings: { provider: 'openai' }, encode });
    expect(r3.notice).toMatch(/Add your OpenAI key/);
    expect(r3.provider).toBe('instant');
  });

  it('does not fall back when the player cancels', async () => {
    const ctrl = new AbortController();
    mockFetch(() => {
      ctrl.abort();
      throw new DOMException('aborted', 'AbortError');
    });
    await expect(createGame({ prompt: 'a game', settings: gemini, encode, signal: ctrl.signal })).rejects.toThrow(/abort/i);
  });

  it('switches to whatever backend is installed (the engine kits, once they land)', async () => {
    const buildGame = vi.fn(stubBackend.buildGame);
    setBackend({ ...stubBackend, buildGame });
    await makeGame();
    expect(buildGame).toHaveBeenCalledOnce();
    expect(getBackend().buildGame).toBe(buildGame);
  });
});

describe('backendFromKits', () => {
  it('adapts the engine kits module, using its theme list when present', async () => {
    const mod = { KITS: stubBackend.kits, buildGame: vi.fn(stubBackend.buildGame), readSpec: stubBackend.readSpec, listThemes: () => [{ id: 'rain-ruins', name: 'Rain Ruins', description: 'Rain.' }] };
    setBackend(backendFromKits(mod));
    const r = await createGame({ prompt: 'a spooky cave', settings: instant, encode });
    expect(r.spec.theme).toBe('rain-ruins');
    expect(mod.buildGame).toHaveBeenCalledOnce();
    expect(backendFromKits({ ...mod, listThemes: undefined }).themes).toBe(stubBackend.themes);
  });
});

describe('editGame', () => {
  it('instant: "make it harder" changes the spec and rebuilds', async () => {
    const { files } = await makeGame();
    const r = await editGame({ files, request: 'Make it harder', settings: instant, encode });
    expect(specOf(r.files).params).toMatchObject({ difficulty: 'hard' });
    expect(r.changed).toContain(SPEC_FILE);
    expect(r.summary).toBe('Made it harder.');
  });

  it('short clear requests never call a model, even with a key', async () => {
    const calls = mockFetch(() => geminiReply({}));
    const { files } = await makeGame();
    const r = await editGame({ files, request: 'Floatier jumps', settings: gemini, encode });
    expect(calls).toHaveLength(0);
    expect(r.provider).toBe('instant');
    expect(specOf(r.files).params!.gravity as number).toBeLessThan(900);
  });

  it('instant: explains kindly when it cannot understand', async () => {
    const { files } = await makeGame();
    const r = await editGame({ files, request: 'add a grappling hook', settings: instant, encode });
    expect(r.changed).toEqual([]);
    expect(r.summary).toMatch(/free mode/);
  });

  it('model: applies a spec patch (cheap: no code is sent)', async () => {
    const calls = mockFetch(() => geminiReply({ summary: 'Moved it underground and made it tougher.', spec: { theme: 'hollow-caverns', params: { enemies: 8 } } }));
    const { files } = await makeGame();
    const r = await editGame({ files, request: 'move everything underground into glowing caves and make it a bit tougher please', settings: gemini, encode });
    expect(specOf(r.files)).toMatchObject({ theme: 'hollow-caverns', params: { enemies: 8 } });
    expect(r.summary).toBe('Moved it underground and made it tougher.');
    const userMsg = (calls[0]!.body.contents as { parts: { text: string }[] }[])[0]!.parts[0]!.text;
    expect(userMsg).toContain('Current spec:');
    expect(userMsg).not.toContain('--- scripts/player.js');
  });

  it('model: code edits for things the spec cannot express, recorded and kept across rebuilds', async () => {
    const { files } = await makeGame();
    const find = 'if (!Input.down(\'jump\') && v.y < -120) v.y = -120;';
    expect(files['scripts/player.js']).toContain(find);
    const calls = mockFetch(() =>
      geminiReply({
        summary: 'Added a double jump.',
        edits: [{ path: 'scripts/player.js', find, replace: `${find}\n    if (!this.onFloor && Input.pressed('jump') && !this.used) { v.y = -this.jump; this.used = true; }\n    if (this.onFloor) this.used = false;` }],
      }),
    );
    const r = await editGame({ files, request: 'let the hero do a second jump in mid-air like a bird', settings: gemini, encode });
    const sent = (calls[0]!.body.contents as { parts: { text: string }[] }[])[0]!.parts[0]!.text;
    expect(sent).toContain('--- scripts/player.js');
    expect(r.files['scripts/player.js']).toContain('this.used = true');
    expect(readMods(r.files)).toHaveLength(1);
    expect(r.changed).toEqual(['game.mods.json', 'scripts/player.js']);

    // A later spec change rebuilds player.js (speed lives there) and the double jump survives.
    const faster = await editGame({ files: r.files, request: 'make it faster', settings: instant, encode });
    expect(faster.files['scripts/player.js']).toContain('speed: 190');
    expect(faster.files['scripts/player.js']).toContain('this.used = true');
  });

  it('model: asks for a file it was not shown, then edits it (two calls at most)', async () => {
    const { files } = await makeGame();
    const calls = mockFetch((_c, n) =>
      n === 0
        ? geminiReply({ summary: '', needFiles: ['scripts/coin.js'] })
        : geminiReply({ summary: 'Coins now spin faster.', edits: [{ path: 'scripts/coin.js', find: files['scripts/coin.js']!.split('\n')[0]!, replace: `${files['scripts/coin.js']!.split('\n')[0]!}\n// spin faster` }] }),
    );
    const r = await editGame({ files, request: 'the shiny round collectibles should twirl quicker', settings: gemini, encode });
    expect(calls).toHaveLength(2);
    const second = (calls[1]!.body.contents as { parts: { text: string }[] }[])[0]!.parts[0]!.text;
    expect(second).toContain('--- scripts/coin.js');
    expect(r.files['scripts/coin.js']).toContain('// spin faster');
  });

  it('model: a code edit that breaks the script is fixed once, or undone', async () => {
    const { files } = await makeGame();
    const find = 'this.coyote = 0;\n    this.buffer = 0;';
    expect(files['scripts/player.js']).toContain(find);
    const broken = { summary: 'Added a dash.', edits: [{ path: 'scripts/player.js', find, replace: `${find}\n    this.dash = {{;` }] };

    // Fix works.
    const calls = mockFetch((_c, n) => (n === 0 ? geminiReply(broken) : geminiReply({ summary: 'Fixed a typo.', edits: [{ path: 'scripts/player.js', find: 'this.dash = {{;', replace: 'this.dash = 0;' }] })));
    const fixed = await editGame({ files, request: 'give the hero a quick dash move on shift', settings: gemini, encode });
    expect(calls).toHaveLength(2);
    expect(fixed.files['scripts/player.js']).toContain('this.dash = 0;');
    expect(checkProject(fixed.files)).toEqual([]);

    // Fix fails: the code part is undone, the game still plays.
    mockFetch(() => geminiReply(broken));
    const undone = await editGame({ files, request: 'give the hero a quick dash move on shift', settings: gemini, encode });
    expect(undone.files['scripts/player.js']).toBe(files['scripts/player.js']);
    expect(undone.files[MODS_FILE]).toBeUndefined();
    expect(undone.summary).toMatch(/undid that part/);
  });

  it('model failure falls back to instant when instant understands', async () => {
    mockFetch(() => new Response('{}', { status: 500 }));
    const { files } = await makeGame();
    const r = await editGame({ files, request: 'please make the whole thing a lot harder for me and my friends', settings: gemini, encode });
    expect(r.provider).toBe('instant');
    expect(specOf(r.files).params).toMatchObject({ difficulty: 'hard' });
    expect(r.notice).toMatch(/free instant mode instead/);
  });

  it('stays within the budget: trims history and code context', async () => {
    const calls = mockFetch(() => geminiReply({ summary: 'ok' }));
    const { files } = await makeGame();
    const big = { ...files };
    for (let k = 0; k < 10; k++) big[`scripts/extra${k}.js`] = `// jump helper ${k}\n${'const x = 1;\n'.repeat(250)}`;
    const history = Array.from({ length: 20 }, (_, n) => ({ role: 'user' as const, text: `turn ${n} ${'blah '.repeat(200)}` }));
    await editGame({ files: big, request: 'add a wall jump to the jump code', history, settings: gemini, encode });
    const text = (calls[0]!.body.contents as { parts: { text: string }[] }[])[0]!.parts[0]!.text;
    expect((text.match(/^--- /gm) ?? []).length).toBeLessThanOrEqual(LIMITS.contextFiles);
    expect(text.length).toBeLessThan(LIMITS.contextChars + LIMITS.historyTurns * LIMITS.historyChars + 3000);
    expect(text).not.toContain('turn 13 ');
    expect(text).toContain('turn 19 ');
  });
});

describe('repairFromErrors', () => {
  it('asks the model for a minimal fix to the script named in the error', async () => {
    const { files } = await makeGame();
    const calls = mockFetch(() => geminiReply({ summary: 'Guarded against a missing spawn.', edits: [{ path: 'scripts/player.js', find: 'this.spawn = { x: this.entity.x, y: this.entity.y };', replace: 'this.spawn = { x: this.entity.x, y: this.entity.y }; // fixed' }] }));
    const r = await repairFromErrors(files, ['TypeError: cannot read properties of undefined (reading x) at scripts/player.js:42'], gemini);
    expect(r.fixed).toBe(true);
    expect(r.files['scripts/player.js']).toContain('// fixed');
    const sent = (calls[0]!.body.contents as { parts: { text: string }[] }[])[0]!.parts[0]!.text;
    expect(sent).toContain('scripts/player.js:42');
    expect(sent).toContain('--- scripts/player.js');
  });

  it('without a model, undoes the AI code changes behind the error', async () => {
    const { files } = await makeGame();
    const modded = { ...applyEdits(files, [{ path: 'scripts/slime.js', find: 'export default', replace: 'oops(); export default' }]) };
    modded[MODS_FILE] = JSON.stringify([{ path: 'scripts/slime.js', find: 'export default', replace: 'oops(); export default' }]);
    const r = await repairFromErrors(modded, ['ReferenceError: oops is not defined (scripts/slime.js:1)'], instant);
    expect(r.fixed).toBe(true);
    expect(r.files['scripts/slime.js']).toBe(files['scripts/slime.js']);
    expect(r.files[MODS_FILE]).toBeUndefined();
  });

  it('says so when there is nothing safe to do', async () => {
    const { files } = await makeGame();
    const r = await repairFromErrors(files, ['Error: something odd'], instant);
    expect(r.fixed).toBe(false);
    expect(r.files).toBe(files);
  });
});

describe('suggestions', () => {
  it('returns 4-6 chips that all work for free', async () => {
    const { files } = await makeGame();
    const chips = suggestions(files);
    expect(chips.length).toBeGreaterThanOrEqual(4);
    expect(chips.length).toBeLessThanOrEqual(6);
    const spec = specOf(files);
    for (const chip of chips) expect(instantEdit(chip, spec, stubBackend).understood).toBe(true);
    expect(chips).toContain('Make it night');
  });

  it('follows the current spec', async () => {
    const { files } = await makeGame();
    const night = await editGame({ files, request: 'Make it night', settings: instant, encode });
    expect(suggestions(night.files)).toContain('Make it day');
    const hard = await editGame({ files, request: 'make it a lot harder', settings: instant, encode });
    const harder = await editGame({ files: hard.files, request: 'make it a lot harder', settings: instant, encode });
    expect(suggestions(harder.files)).toContain('Make it easier');
  });

  it('adds a creative chip when a model is available, and works for any project', async () => {
    const { files } = await makeGame();
    expect(suggestions(files, { ai: true }).length).toBeLessThanOrEqual(6);
    expect(suggestions({ 'project.json': '{}' }).length).toBeGreaterThanOrEqual(4);
  });
});

describe('patches', () => {
  it('applies exact, unique edits only', () => {
    const f = { 'a.js': 'one two two' };
    expect(applyEdits(f, [{ path: 'a.js', find: 'one', replace: '1' }])['a.js']).toBe('1 two two');
    expect(() => applyEdits(f, [{ path: 'a.js', find: 'two', replace: '2' }])).toThrow(EditError);
    expect(() => applyEdits(f, [{ path: 'b.js', find: 'x', replace: '' }])).toThrow(/doesn't exist/);
  });

  it('three-way merge keeps the player’s files and changes', () => {
    const base = { 'a.js': 'A', 'b.js': 'B', 'c.png': 'img1' };
    const ours = { 'a.js': 'A-mine', 'b.js': 'B', 'c.png': 'img1', 'notes.md': 'hi' };
    const theirs = { 'a.js': 'A', 'b.js': 'B2', 'c.png': 'img2', 'd.js': 'D' };
    expect(mergeRebuild(base, ours, theirs).files).toEqual({ 'a.js': 'A-mine', 'b.js': 'B2', 'c.png': 'img2', 'd.js': 'D', 'notes.md': 'hi' });
  });
});
