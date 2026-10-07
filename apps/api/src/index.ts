import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';

export interface Env {
  ALLOWED_ORIGINS: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
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
