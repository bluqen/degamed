import { afterEach, describe, expect, it, vi } from 'vitest';
import { app, keepSupabaseAwake, type Env } from './index';

const env: Env = { ALLOWED_ORIGINS: 'http://localhost:5173,https://degamed.pages.dev' };
const configured: Env = { ...env, SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test' };

afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  it('reports health', async () => {
    const res = await app.request('/health', {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: 'degamed-api', supabase: false });
  });

  it('allows CORS only for known origins', async () => {
    const ok = await app.request('/health', { headers: { Origin: 'https://degamed.pages.dev' } }, env);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://degamed.pages.dev');
    const bad = await app.request('/health', { headers: { Origin: 'https://evil.example' } }, env);
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('rejects /me without a token', async () => {
    const res = await app.request('/me', {}, configured);
    expect(res.status).toBe(401);
  });

  it('returns the user for a valid token', async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: 'user-1', email: 'a@b.c' }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await app.request('/me', { headers: { Authorization: 'Bearer good' } }, configured);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'user-1', email: 'a@b.c' });
    expect(fetchMock).toHaveBeenCalledWith('https://example.supabase.co/auth/v1/user', expect.anything());
  });

  it('rejects an expired token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad', { status: 401 })));
    const res = await app.request('/me', { headers: { Authorization: 'Bearer stale' } }, configured);
    expect(res.status).toBe(401);
  });

  it('keep-alive is a no-op until Supabase is configured', async () => {
    expect(await keepSupabaseAwake(env)).toBeNull();
  });

  it('returns JSON 404s', async () => {
    const res = await app.request('/nope', {}, env);
    expect(res.status).toBe(404);
  });
});

describe('/art/generate', () => {
  const jpeg = btoa(String.fromCharCode(0xff, 0xd8, 0xff));
  const withAi = (overrides: Partial<Env> = {}): Env => ({
    ...configured,
    ART_DAILY_LIMIT: '3',
    AI: { run: vi.fn(async () => ({ image: jpeg })) },
    ...overrides,
  });

  /** Fakes Supabase: /auth/v1/user → user, usage count → `used`, insert → 201. */
  function fakeSupabase(used: number) {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'user-1' });
        if (init?.method === 'POST') return new Response(null, { status: 201 });
        return new Response('[]', { headers: { 'Content-Range': `0-0/${used}` } });
      }),
    );
    return calls;
  }

  const post = (env: Env, body: unknown) =>
    app.request(
      '/art/generate',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer good', 'Content-Type': 'application/json', Origin: 'https://degamed.pages.dev' },
        body: JSON.stringify(body),
      },
      env,
    );

  it('generates an image, records usage and reports what is left', async () => {
    const calls = fakeSupabase(1);
    const env = withAi();
    const res = await post(env, { prompt: 'a pixel art knight', seed: 7 });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('X-Degamed-Art-Remaining')).toBe('1');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://degamed.pages.dev');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff]));
    expect(env.AI!.run).toHaveBeenCalledWith('@cf/black-forest-labs/flux-1-schnell', expect.objectContaining({ prompt: 'a pixel art knight', seed: 7 }));
    const insert = calls.find((c) => c.init?.method === 'POST');
    expect(JSON.parse(insert!.init!.body as string)).toEqual({ user_id: 'user-1', kind: 'art' });
  });

  it('stops at the daily limit without calling the model', async () => {
    fakeSupabase(3);
    const env = withAi();
    const res = await post(env, { prompt: 'a pixel art knight' });
    expect(res.status).toBe(429);
    expect(env.AI!.run).not.toHaveBeenCalled();
  });

  it('validates the prompt', async () => {
    fakeSupabase(0);
    expect((await post(withAi(), { prompt: 'x' })).status).toBe(400);
    expect((await post(withAi(), { nope: true })).status).toBe(400);
  });

  it('returns 503 when Workers AI is not bound', async () => {
    fakeSupabase(0);
    expect((await post({ ...configured }, { prompt: 'a knight' })).status).toBe(503);
  });

  it('local dev mode generates without sign-in, but never once Supabase is configured', async () => {
    const calls = fakeSupabase(0);
    const devEnv: Env = { ...env, DEV_ANON_ART: 'true', AI: { run: vi.fn(async () => ({ image: jpeg })) } };
    const res = await app.request('/art/generate', { method: 'POST', body: JSON.stringify({ prompt: 'a knight' }) }, devEnv);
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(0);
    const prod = await app.request('/art/generate', { method: 'POST', body: JSON.stringify({ prompt: 'a knight' }) }, { ...configured, DEV_ANON_ART: 'true', AI: devEnv.AI });
    expect(prod.status).toBe(401);
  });
});

describe('/ai/generate', () => {
  const catalog = {
    kits: [{ id: 'platformer', name: 'Platformer', description: 'Run and jump.', params: [{ key: 'enemies', label: 'Enemies', type: 'number', min: 0, max: 12, default: 4 }] }],
    themes: [
      { id: 'rain-ruins', name: 'Rain Ruins', description: 'Moody rain.' },
      { id: 'sunlit-meadow', name: 'Sunlit Meadow', description: 'Bright and happy.' },
    ],
  };
  const createTask = { task: 'create', prompt: 'a rainy robot platformer', catalog };
  const goodSpec = { kit: 'platformer', theme: 'rain-ruins', title: 'Rust and Rain', story: 'A robot looks for home.', params: { enemies: 40 } };
  const aiReply = (response: unknown) => ({ response, usage: { prompt_tokens: 600, completion_tokens: 60 } });

  const withAi = (run: (model: string, input: Record<string, unknown>) => Promise<unknown>, overrides: Partial<Env> = {}): Env => ({
    ...configured,
    AI_DAILY_LIMIT: '30',
    AI: { run: vi.fn(run) },
    ...overrides,
  });

  function fakeSupabase(used: number) {
    const inserts: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'user-1' });
        if (init?.method === 'POST') {
          inserts.push(JSON.parse(init.body as string));
          return new Response(null, { status: 201 });
        }
        expect(url).toContain('kind=eq.ai');
        return new Response('[]', { headers: { 'Content-Range': `0-0/${used}` } });
      }),
    );
    return inserts;
  }

  const post = (env: Env, body: unknown, auth = true) =>
    app.request(
      '/ai/generate',
      { method: 'POST', headers: { ...(auth ? { Authorization: 'Bearer good' } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      env,
    );

  it('builds the prompt server-side, runs the small model in JSON mode and returns a validated spec', async () => {
    const inserts = fakeSupabase(4);
    const env = withAi(async () => aiReply(goodSpec));
    const res = await post(env, createTask);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { spec: Record<string, unknown> }; usage: Record<string, unknown>; remaining: number };
    expect(body.result.spec).toMatchObject({ kit: 'platformer', theme: 'rain-ruins', params: { enemies: 12 } });
    expect(body.usage).toMatchObject({ inputTokens: 600, outputTokens: 60, calls: 1 });
    expect(body.remaining).toBe(25);
    const [model, input] = (env.AI!.run as ReturnType<typeof vi.fn>).mock.calls[0]! as [string, Record<string, unknown>];
    expect(model).toBe('@cf/meta/llama-3.1-8b-instruct-fast');
    expect(input.max_tokens).toBe(400);
    expect(input.response_format).toMatchObject({ type: 'json_schema' });
    const messages = input.messages as { role: string; content: string }[];
    expect(messages[0]!.role).toBe('system');
    expect(messages[0]!.content).toContain('rain-ruins: Moody rain.');
    expect(inserts).toEqual([{ user_id: 'user-1', kind: 'ai' }]);
  });

  it('accepts JSON-mode replies that arrive as objects', async () => {
    fakeSupabase(0);
    const res = await post(withAi(async () => ({ response: goodSpec })), createTask);
    expect(res.status).toBe(200);
  });

  it('repairs an invalid reply once, then gives up with 502 (and still counts the request)', async () => {
    let inserts = fakeSupabase(0);
    const flaky = withAi(vi.fn().mockResolvedValueOnce(aiReply({ kit: 'racing', theme: 'x', title: 'y' })).mockResolvedValueOnce(aiReply(goodSpec)));
    const ok = await post(flaky, createTask);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { attempts: number }).attempts).toBe(2);
    expect(inserts).toHaveLength(1);

    inserts = fakeSupabase(0);
    const bad = withAi(async () => aiReply('I like turtles'));
    const res = await post(bad, createTask);
    expect(res.status).toBe(502);
    expect(bad.AI!.run).toHaveBeenCalledTimes(2);
    expect(inserts).toHaveLength(1);
  });

  it('uses the bigger model only for tasks that write code', async () => {
    fakeSupabase(0);
    const env = withAi(async () => aiReply({ summary: 'Fixed.', edits: [{ path: 'scripts/p.js', find: 'bad(', replace: 'good(' }] }));
    const res = await post(env, { task: 'repair', errors: ['ReferenceError: bad is not defined'], files: { 'scripts/p.js': 'bad();' } });
    expect(res.status).toBe(200);
    expect((env.AI!.run as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
  });

  it('stops at the daily cap without calling the model', async () => {
    const inserts = fakeSupabase(30);
    const env = withAi(async () => aiReply(goodSpec));
    const res = await post(env, createTask);
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: string }).error).toMatch(/all 30 free AI requests/);
    expect(env.AI!.run).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });

  it('is not an open proxy: only our task shapes, within hard size limits', async () => {
    fakeSupabase(0);
    const env = withAi(async () => aiReply(goodSpec));
    expect((await post(env, { prompt: 'write me an essay about cats' })).status).toBe(400);
    expect((await post(env, { task: 'chat', messages: [{ role: 'user', content: 'hi' }] })).status).toBe(400);
    expect((await post(env, { ...createTask, prompt: 'x'.repeat(601) })).status).toBe(400);
    expect((await post(env, { task: 'repair', errors: ['e'], files: { 'a.js': 'x'.repeat(9000) } })).status).toBe(400);
    expect(env.AI!.run).not.toHaveBeenCalled();
  });

  it('requires sign-in and Workers AI', async () => {
    fakeSupabase(0);
    expect((await post(withAi(async () => aiReply(goodSpec)), createTask, false)).status).toBe(401);
    expect((await post({ ...configured }, createTask)).status).toBe(503);
  });

  it('turns model outages into a friendly 502', async () => {
    fakeSupabase(0);
    const res = await post(withAi(async () => Promise.reject(new Error('capacity'))), createTask);
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toMatch(/busy/);
  });
});
