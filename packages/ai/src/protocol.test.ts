import { describe, expect, it, vi } from 'vitest';
import { catalogFor, stubBackend } from './catalog';
import {
  AiOutputError,
  buildPrompt,
  checkSpec,
  estimateTokens,
  extractJson,
  LIMITS,
  runTask,
  TaskRequestSchema,
  validateOutput,
  type ModelCall,
  type TaskRequest,
} from './protocol';
import { multiBackend } from './test-helpers';

const catalog = catalogFor(stubBackend);
const create: TaskRequest & { task: 'create' } = { task: 'create', prompt: 'a spooky cave platformer', catalog };

describe('spec validation', () => {
  it('accepts a good spec and fixes small things', () => {
    const r = checkSpec(
      { kit: 'Platformer', theme: 'Rain Ruins', title: '  "Rust and Rain" ', story: 'A robot looks for home.', params: { enemies: '50', gravity: 333, night: 'true', difficulty: 'HARD', wings: 2 } },
      catalog,
    );
    expect(r.errors).toEqual([]);
    expect(r.spec).toEqual({
      kit: 'platformer',
      theme: 'rain-ruins',
      title: 'Rust and Rain',
      story: 'A robot looks for home.',
      params: { enemies: 12, gravity: 350, night: true, difficulty: 'hard' },
    });
  });

  it('rejects unknown kits and themes with a helpful list', () => {
    const r = checkSpec({ kit: 'racing', theme: 'mars', title: 'X' }, catalog);
    expect(r.spec).toBeUndefined();
    expect(r.errors.join(' ')).toMatch(/kit "racing" is not one of: platformer/);
    expect(r.errors.join(' ')).toMatch(/theme "mars"/);
  });

  it('rejects the wrong shape', () => {
    expect(checkSpec({ kit: 'platformer' }, catalog).errors.length).toBeGreaterThan(0);
    expect(checkSpec('nope', catalog).errors.length).toBeGreaterThan(0);
  });

  it('extracts JSON from fenced or chatty replies', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! Here it is: {"a":{"b":2}} Enjoy.')).toEqual({ a: { b: 2 } });
    expect(() => extractJson('no json here')).toThrow(/no JSON/);
  });
});

describe('prompts and budgets', () => {
  it('builds a compact, cache-friendly create prompt', () => {
    const p = buildPrompt(create);
    expect(p.system).toContain('platformer:');
    expect(p.system).toContain('rain-ruins:');
    expect(p.system).toContain('enemies 0..12=4');
    expect(p.maxTokens).toBe(LIMITS.maxTokens.create);
    // The system prompt doesn't depend on the idea, so providers can cache it.
    expect(buildPrompt({ ...create, prompt: 'something else' }).system).toBe(p.system);
    const tokens = estimateTokens(p.system) + estimateTokens(p.messages[0]!.content);
    expect(tokens).toBeLessThan(800);
  });

  it('keeps a bigger catalogue under budget too', () => {
    const p = buildPrompt({ ...create, catalog: catalogFor(multiBackend) });
    expect(estimateTokens(p.system)).toBeLessThan(1000);
  });

  it('the request schema enforces hard limits (the hosted endpoint relies on this)', () => {
    expect(TaskRequestSchema.safeParse(create).success).toBe(true);
    expect(TaskRequestSchema.safeParse({ ...create, prompt: 'x'.repeat(LIMITS.promptChars + 1) }).success).toBe(false);
    const edit = { task: 'edit', request: 'add a dash', spec: null, history: [], paths: [], files: {}, catalog };
    expect(TaskRequestSchema.safeParse(edit).success).toBe(true);
    const tooMany = Object.fromEntries(Array.from({ length: LIMITS.contextFiles + 1 }, (_, i) => [`scripts/s${i}.js`, 'x']));
    expect(TaskRequestSchema.safeParse({ ...edit, files: tooMany }).success).toBe(false);
    const tooBig = { 'scripts/a.js': 'x'.repeat(LIMITS.fileChars), 'scripts/b.js': 'x'.repeat(LIMITS.fileChars) };
    expect(TaskRequestSchema.safeParse({ ...edit, files: tooBig }).success).toBe(false);
    const longHistory = Array.from({ length: LIMITS.historyTurns + 1 }, () => ({ role: 'user', text: 'hi' }));
    expect(TaskRequestSchema.safeParse({ ...edit, history: longHistory }).success).toBe(false);
    expect(TaskRequestSchema.safeParse({ task: 'chat', prompt: 'write me an essay' }).success).toBe(false);
  });
});

describe('edit and repair validation', () => {
  const edit: TaskRequest & { task: 'edit' } = {
    task: 'edit',
    request: 'add a double jump',
    spec: { kit: 'platformer', theme: 'rain-ruins', title: 'T' },
    history: [],
    paths: ['scripts/player.js', 'scripts/slime.js'],
    files: { 'scripts/player.js': 'const a = 1;\nconst b = 2;\n' },
    catalog,
  };

  it('accepts a spec patch and exact edits', () => {
    const r = validateOutput(edit, { summary: 'ok', spec: { theme: 'hollow-caverns' }, edits: [{ path: 'scripts/player.js', find: 'const b = 2;', replace: 'const b = 3;' }] });
    expect(r.ok).toBe(true);
  });

  it('rejects edits that do not match the file, or files it was not shown', () => {
    const r1 = validateOutput(edit, { summary: '', edits: [{ path: 'scripts/player.js', find: 'nope', replace: '' }] });
    expect(r1.ok).toBe(false);
    const r2 = validateOutput(edit, { summary: '', edits: [{ path: 'scripts/player.js', find: 'const', replace: '' }] });
    expect(r2.ok === false && r2.errors[0]).toMatch(/appears 2 times/);
    const r3 = validateOutput(edit, { summary: '', edits: [{ path: 'scripts/slime.js', find: 'x', replace: '' }] });
    expect(r3.ok === false && r3.errors[0]).toMatch(/needFiles/);
    const r4 = validateOutput(edit, { summary: '', spec: { theme: 'moon-base' } });
    expect(r4.ok).toBe(false);
  });

  it('keeps only real, unseen files in needFiles', () => {
    const r = validateOutput(edit, { summary: '', needFiles: ['scripts/slime.js', 'scripts/player.js', '../../etc/passwd'] });
    expect(r.ok && r.value.needFiles).toEqual(['scripts/slime.js']);
  });
});

describe('runTask: validate, repair once, then give up', () => {
  const good = JSON.stringify({ kit: 'platformer', theme: 'hollow-caverns', title: 'Spore Light', story: 'A moth seeks the light.' });

  it('returns a valid first reply with reported usage', async () => {
    const call = vi.fn<ModelCall>(async () => ({ text: good, usage: { inputTokens: 500, outputTokens: 40 } }));
    const r = await runTask(create, call);
    expect(r.value.spec.theme).toBe('hollow-caverns');
    expect(r.attempts).toBe(1);
    expect(r.usage).toEqual({ inputTokens: 500, outputTokens: 40, estimated: false, calls: 1 });
  });

  it('shows the model its mistakes once and accepts the fix', async () => {
    const call = vi.fn<ModelCall>().mockResolvedValueOnce({ text: '{"kit":"racing","theme":"hollow-caverns","title":"X"}' }).mockResolvedValueOnce({ text: good });
    const r = await runTask(create, call);
    expect(r.attempts).toBe(2);
    expect(r.usage.calls).toBe(2);
    expect(r.usage.estimated).toBe(true);
    const second = call.mock.calls[1]![0];
    expect(second.messages).toHaveLength(3);
    expect(second.messages[2]!.content).toMatch(/kit "racing" is not one of/);
  });

  it('throws AiOutputError after the second bad reply', async () => {
    const call = vi.fn<ModelCall>(async () => ({ text: 'I love games!' }));
    await expect(runTask(create, call)).rejects.toBeInstanceOf(AiOutputError);
    expect(call).toHaveBeenCalledTimes(2);
  });
});
