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
