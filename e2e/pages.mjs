// What the harness visits. Edit this list as the product grows (new routes, new flows).
// Each page: { id, path, setup?(page), game?: true, optional?: true, settle?: ms }
//  - setup runs after navigation (click things, switch modes).
//  - game: wait for the player iframe, collect fps for `fpsWindow` ms, and screenshot the game canvas alone.
//  - optional: route may not exist yet; a 404 is reported but does not count as a failure.

const MODE_KEY = 'degamed.editor.mode';

async function setMode(page, mode) {
  await page.evaluate(([k, m]) => localStorage.setItem(k, m), [MODE_KEY, mode]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Newer UIs may expose the toggle as a button instead of storage.
  const btn = page.getByRole('button', { name: mode === 'pro' ? /^(pro|advanced)$/i : /^simple$/i });
  if (await btn.count().catch(() => 0)) await btn.first().click({ timeout: 2000 }).catch(() => {});
}

async function pressRun(page) {
  const run = page.getByRole('button', { name: /^(run game|play)$/i });
  if (await run.count().catch(() => 0)) await run.first().click({ timeout: 5000 }).catch(() => {});
}

export const PAGES = [
  { id: 'landing', path: '/' },
  { id: 'create', path: '/create' },
  { id: 'pricing', path: '/pricing' },
  { id: 'login', path: '/login' },
  { id: 'settings', path: '/settings' },
  { id: 'explore', path: '/explore' },
  // The Studio (round 1+): the beginner view of a game. Baseline: Simple mode of the old editor.
  { id: 'studio', path: '/editor/demo', setup: (p) => setMode(p, 'simple'), game: true, settle: 2500 },
  {
    id: 'advanced',
    path: '/editor/demo/advanced',
    setup: async (p) => {
      await setMode(p, 'pro');
      await p.waitForTimeout(1500);
      await pressRun(p);
    },
    game: true,
    optional: true,
  },
  // Share/play page: what a friend sees from a link.
  { id: 'play-demo', path: '/play/demo', optional: true, game: true, settle: 2500, themeExempt: true },
  { id: 'gallery', path: '/gallery', optional: true },
  { id: 'not-found', path: '/this-page-does-not-exist' },
];

export const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900, mobile: false },
  { id: 'phone', width: 390, height: 844, mobile: true },
];

export const SCHEMES = ['dark', 'light'];

/** Prompts for the landing → playing journey. The first is the canonical one from the BRIEF. */
export const JOURNEY_PROMPT = 'a moody rain-soaked platformer where a little robot looks for its family';
