import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';

export interface Env {
  ALLOWED_ORIGINS: string;
  ART_DAILY_LIMIT?: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  AI?: { run(model: string, input: Record<string, unknown>): Promise<unknown> };
}

interface SupabaseUser {
  id: string;
  email?: string;
}

type AppEnv = { Bindings: Env; Variables: { user: SupabaseUser } };

export const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
  const allowed = c.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : null),
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  })(c, next);
});

app.get('/health', (c) =>
  c.json({ ok: true, service: 'degamed-api', supabase: Boolean(c.env.SUPABASE_URL && c.env.SUPABASE_SECRET_KEY) }),
);

/** Verifies the caller's Supabase access token and exposes the user to the route. */
const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return c.json({ error: 'Not signed in' }, 401);
  if (!c.env.SUPABASE_URL || !c.env.SUPABASE_SECRET_KEY) {
    return c.json({ error: 'Server is not configured' }, 503);
  }
  const res = await fetch(`${c.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: c.env.SUPABASE_SECRET_KEY },
  });
  if (!res.ok) return c.json({ error: 'Session expired. Please sign in again.' }, 401);
  c.set('user', (await res.json()) as SupabaseUser);
  await next();
});

app.get('/me', requireUser, (c) => {
  const user = c.get('user');
  return c.json({ id: user.id, email: user.email ?? null });
});

/** Server-side Supabase REST calls with the secret key (bypasses RLS: only for metering). */
function supabaseRest(env: Env, path: string, init: RequestInit = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SECRET_KEY!,
      Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}

/** How many metered events of `kind` the user has today (UTC). */
export async function usageToday(env: Env, userId: string, kind: 'art' | 'ai', now = new Date()): Promise<number> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const res = await supabaseRest(
    env,
    `usage_events?select=id&user_id=eq.${encodeURIComponent(userId)}&kind=eq.${kind}&created_at=gte.${encodeURIComponent(start)}`,
    { headers: { Prefer: 'count=exact', Range: '0-0' } },
  );
  if (!res.ok) throw new Error(`usage lookup failed: ${res.status}`);
  const total = Number(res.headers.get('Content-Range')?.split('/')[1]);
  return Number.isFinite(total) ? total : 0;
}

const GenerateArt = z.object({
  prompt: z.string().trim().min(3).max(2000),
  seed: z.number().int().min(0).max(2 ** 31).optional(),
});

/** Hosted image generation with Cloudflare Workers AI. Metered per user per day. */
app.post('/art/generate', requireUser, async (c) => {
  if (!c.env.AI) return c.json({ error: 'Image generation is not enabled on this server' }, 503);
  const parsed = GenerateArt.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Send a prompt between 3 and 2000 characters' }, 400);

  const user = c.get('user');
  const limit = Number(c.env.ART_DAILY_LIMIT ?? 25);
  const used = await usageToday(c.env, user.id, 'art');
  if (used >= limit) {
    return c.json({ error: `You've used all ${limit} free images for today. Add your own Gemini key in Settings for more.` }, 429);
  }

  const result = (await c.env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
    prompt: parsed.data.prompt,
    steps: 6,
    ...(parsed.data.seed !== undefined ? { seed: parsed.data.seed } : {}),
  })) as { image?: string };
  if (!result.image) return c.json({ error: 'The image model returned nothing. Try again.' }, 502);

  await supabaseRest(c.env, 'usage_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: user.id, kind: 'art' }),
  });

  const bytes = Uint8Array.from(atob(result.image), (ch) => ch.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-store',
      'X-Degamed-Art-Remaining': String(Math.max(0, limit - used - 1)),
      'Access-Control-Expose-Headers': 'X-Degamed-Art-Remaining',
    },
  });
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Something went wrong' }, 500);
});

/** Daily keep-alive so the free Supabase project is never paused for inactivity. */
export async function keepSupabaseAwake(env: Env): Promise<number | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) return null;
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, {
    headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` },
  });
  return res.status;
}

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(keepSupabaseAwake(env).then((status) => console.log('keep-alive', status)));
  },
} satisfies ExportedHandler<Env>;
