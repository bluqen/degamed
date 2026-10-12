import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogFor, stubBackend } from './catalog';
import type { TaskRequest } from './protocol';
import { availableProviders, ProviderError, runnerFor } from './providers';
import { geminiReply, mockFetch } from './test-helpers';

afterEach(() => vi.unstubAllGlobals());

const req: TaskRequest & { task: 'create' } = { task: 'create', prompt: 'a rainy robot game', catalog: catalogFor(stubBackend) };
const spec = { kit: 'platformer', theme: 'rain-ruins', title: 'Rust and Rain', story: 'A robot looks for home.' };

describe('BYOK providers', () => {
  it('gemini: JSON mode, no thinking tokens, key in a header, real usage', async () => {
    const calls = mockFetch(() => geminiReply(spec));
    const r = await runnerFor({ provider: 'gemini', apiKey: 'g-key' })!(req);
    expect(r.value.spec.title).toBe('Rust and Rain');
    expect(r.usage).toMatchObject({ inputTokens: 700, outputTokens: 90, estimated: false });
    const c = calls[0]!;
    expect(c.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect((c.init.headers as Record<string, string>)['x-goog-api-key']).toBe('g-key');
    expect(c.body).toMatchObject({ generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } } });
  });

  it('openai: small model, json_object, bearer key', async () => {
    const calls = mockFetch(() => Response.json({ choices: [{ message: { content: JSON.stringify(spec) } }], usage: { prompt_tokens: 600, completion_tokens: 50 } }));
    const r = await runnerFor({ provider: 'openai', apiKey: 'sk-test' })!(req);
    expect(r.value.spec.theme).toBe('rain-ruins');
    expect(calls[0]!.url).toBe('https://api.openai.com/v1/chat/completions');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    expect(calls[0]!.body).toMatchObject({ model: 'gpt-4.1-mini', response_format: { type: 'json_object' }, max_completion_tokens: 400 });
    expect((calls[0]!.body.messages as { role: string }[])[0]!.role).toBe('system');
  });

  it('anthropic: Haiku, browser access header, cacheable system prompt', async () => {
    const calls = mockFetch(() => Response.json({ content: [{ type: 'text', text: JSON.stringify(spec) }], usage: { input_tokens: 650, output_tokens: 60 } }));
    const r = await runnerFor({ provider: 'anthropic', apiKey: 'sk-ant' })!(req);
    expect(r.value.spec.kit).toBe('platformer');
    const h = calls[0]!.init.headers as Record<string, string>;
    expect(h['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(h['x-api-key']).toBe('sk-ant');
    expect(calls[0]!.body).toMatchObject({ model: 'claude-haiku-4-5', max_tokens: 400 });
    expect((calls[0]!.body.system as { cache_control?: unknown }[])[0]!.cache_control).toEqual({ type: 'ephemeral' });
  });

  it('a custom model name is passed through', async () => {
    const calls = mockFetch(() => geminiReply(spec));
    await runnerFor({ provider: 'gemini', apiKey: 'k', model: 'gemini-2.5-flash-lite' })!(req);
    expect(calls[0]!.url).toContain('gemini-2.5-flash-lite');
  });

  it('turns HTTP failures into plain-English errors', async () => {
    mockFetch(() => Response.json({ error: { message: 'API key not valid' } }, { status: 400 }));
    await expect(runnerFor({ provider: 'gemini', apiKey: 'bad' })!(req)).rejects.toThrow(/Gemini failed \(400\): API key not valid/);
    mockFetch(() => new Response('nope', { status: 401 }));
    await expect(runnerFor({ provider: 'openai', apiKey: 'bad' })!(req)).rejects.toThrow(/rejected the API key/);
    mockFetch(() => new Response('slow down', { status: 429 }));
    await expect(runnerFor({ provider: 'anthropic', apiKey: 'k' })!(req)).rejects.toBeInstanceOf(ProviderError);
  });

  it('needs a key', () => {
    expect(() => runnerFor({ provider: 'gemini' })).toThrow(/Add your Gemini key/);
    expect(runnerFor({ provider: 'instant' })).toBeNull();
  });
});

describe('hosted provider', () => {
  it('sends the structured task (not a raw prompt) to our Worker and re-validates the result', async () => {
    const calls = mockFetch(() => Response.json({ result: spec, usage: { inputTokens: 650, outputTokens: 70, estimated: false, calls: 1 }, remaining: 29 }));
    const r = await runnerFor({ provider: 'degamed', apiUrl: 'https://api.example/', authToken: 'jwt' })!(req);
    expect(r.value.spec.title).toBe('Rust and Rain');
    expect(calls[0]!.url).toBe('https://api.example/ai/generate');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer jwt');
    expect(calls[0]!.body).toMatchObject({ task: 'create', prompt: 'a rainy robot game' });
  });

  it('passes the daily-limit message through', async () => {
    mockFetch(() => Response.json({ error: 'You’ve used all 30 free AI requests for today.' }, { status: 429 }));
    await expect(runnerFor({ provider: 'degamed', apiUrl: 'https://api.example' })!(req)).rejects.toThrow(/used all 30/);
  });

  it('rejects a bad result from the server', async () => {
    mockFetch(() => Response.json({ result: { kit: 'nope' } }));
    await expect(runnerFor({ provider: 'degamed', apiUrl: 'https://api.example' })!(req)).rejects.toThrow(/not usable/);
  });
});

describe('availableProviders', () => {
  it('lists own keys first, then hosted, and always instant last', () => {
    expect(availableProviders({}, false)).toEqual(['instant']);
    expect(availableProviders({}, true)).toEqual(['degamed', 'instant']);
    expect(availableProviders({ openai: 'sk', gemini: 'g', anthropic: ' ', openrouter: 'x' }, true)).toEqual(['gemini', 'openai', 'degamed', 'instant']);
  });
});
