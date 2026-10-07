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
