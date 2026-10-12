#!/usr/bin/env node
// Degamed QA harness. Rerun every round:
//   node e2e/run.mjs --round 2               full run: pages × viewports × themes, journey, fps, bundle sizes
//   node e2e/run.mjs --round 2 --no-build    skip the production builds (faster)
//   node e2e/run.mjs --round 2 --only landing,editor-simple   (page ids from e2e/pages.mjs, plus 'journey' and 'build')
//   node e2e/run.mjs --round 0 --out docs/team/shots/critic/baseline
// Expects the dev servers (web :5173, player :5174) to be running already. Does not start any.
// Writes PNGs + report.json + summary.md to docs/team/shots/critic/round-N/ (or --out).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, LAUNCH_ARGS, parseArgs, ensureDir, sizeTree, kb, INIT_SCRIPT, AUDIT_FN } from './lib.mjs';
import { PAGES, VIEWPORTS, SCHEMES, JOURNEY_PROMPT } from './pages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Budgets: keep in sync with docs/team/reviews/BAR.md.
export const BUDGET = {
  consoleErrors: 0,
  journeySeconds: 60,
  journeyClicks: 3,
  fpsMedian: 55, // on real hardware; headless SwiftShader is slower, so the harness warns below 30 there.
  fpsMedianHeadless: 30,
  initialJsGzip: 170 * 1024, // what the landing page needs before first paint
  largestChunkGzip: 400 * 1024,
  cssGzip: 35 * 1024,
  playerJsGzip: 250 * 1024, // everything a shared play link needs
  pageLoadMs: 2500, // dev server, desktop, domcontentloaded → network quiet
};

const args = parseArgs(process.argv);
if (args.help || (!args.round && !args.out)) {
  console.log('Usage: node e2e/run.mjs --round N [--no-build] [--no-journey] [--only id,id] [--out dir] [--base url]');
  process.exit(args.help ? 0 : 1);
}
const OUT = path.resolve(ROOT, args.out || `docs/team/shots/critic/round-${args.round}`);
ensureDir(OUT);
const rel = (p) => path.relative(ROOT, p);

const report = { round: args.round, startedAt: new Date().toISOString(), base: args.base, pages: [], journey: null, bundles: null, budget: BUDGET };

function log(...m) {
  console.log('[qa]', ...m);
}

/* ─── Bundle sizes ─────────────────────────────────────────────────────── */

function buildAndMeasure(pkg, label) {
  const outDir = path.join(os.tmpdir(), `degamed-qa-${label}-${process.pid}`);
  const t = Date.now();
  // Build into a temp folder so we never touch the repo's dist/ or race the other agents.
  const r = spawnSync('pnpm', ['--filter', pkg, 'exec', 'vite', 'build', '--outDir', outDir, '--emptyOutDir'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  const ms = Date.now() - t;
  const stdout = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0) return { pkg, ok: false, ms, error: stdout.split('\n').slice(-25).join('\n') };
  const files = sizeTree(outDir);
  const js = files.filter((f) => /\.m?js$/.test(f.file));
  const css = files.filter((f) => f.file.endsWith('.css'));
  // Initial = scripts/styles referenced from index.html (entry + modulepreloads).
  let initial = 0;
  const initialFiles = [];
  const html = path.join(outDir, 'index.html');
  if (fs.existsSync(html)) {
    const src = fs.readFileSync(html, 'utf8');
    for (const m of src.matchAll(/(?:src|href)="\/?([^"]+\.(?:js|css))"/g)) {
      const f = files.find((x) => x.file === m[1]);
      if (f) {
        initial += f.gzip;
        initialFiles.push(f.file);
      }
    }
  }
  const warnings = stdout.split('\n').filter((l) => /warn|larger than/i.test(l)).slice(0, 5);
  fs.rmSync(outDir, { recursive: true, force: true });
  return {
    pkg,
    ok: true,
    ms,
    totalBytes: files.reduce((a, f) => a + f.bytes, 0),
    jsGzip: js.reduce((a, f) => a + f.gzip, 0),
    cssGzip: css.reduce((a, f) => a + f.gzip, 0),
    initialGzip: initial,
    initialFiles,
    largest: files.slice(0, 8),
    fileCount: files.length,
    warnings,
  };
}

/* ─── Browser helpers ──────────────────────────────────────────────────── */

function attachLogging(page, sink) {
  page.on('console', (m) => {
    if (m.type() === 'error') sink.consoleErrors.push(m.text().slice(0, 300));
    else if (m.type() === 'warning') sink.consoleWarnings.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => sink.pageErrors.push(String(e.message || e).slice(0, 300)));
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (!u.startsWith('data:')) sink.failedRequests.push(`${r.failure()?.errorText || 'failed'} ${u.slice(0, 160)}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) sink.failedRequests.push(`${r.status()} ${r.url().slice(0, 160)}`);
  });
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith('http')) sink.hosts[u.host] = (sink.hosts[u.host] || 0) + 1;
    if (/\/api\/|workers\.dev|:8787/.test(r.url())) sink.apiRequests.push(`${r.method()} ${u.pathname}`);
  });
}

/** Read fps samples from all frames (the player posts {type:'fps'} to its parent). */
async function readQa(page) {
  const out = { fps: [], rafFps: [], longTasks: 0 };
  for (const f of page.frames()) {
    const q = await f.evaluate(() => window.__qa && { fps: window.__qa.fps, raf: window.__qa.raf, longTasks: window.__qa.longTasks, now: performance.now() }).catch(() => null);
    if (!q) continue;
    out.fps.push(...q.fps);
    out.longTasks += q.longTasks;
    if (q.raf.frames > 10 && q.raf.start) out.rafFps.push(Math.round((q.raf.frames * 1000) / (q.now - q.raf.start)));
  }
  return out;
}

async function resetFps(page) {
  for (const f of page.frames()) await f.evaluate(() => window.__qa && ((window.__qa.fps = []), (window.__qa.raf = { frames: 0, start: 0 }))).catch(() => {});
}

const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);

async function gameFrameHandle(page) {
  // Prefer the player iframe; fall back to the biggest canvas on the page.
  const iframe = page.locator('iframe').first();
  if (await iframe.count()) return iframe;
  const canvas = page.locator('canvas').first();
  if (await canvas.count()) return canvas;
  return null;
}

/** Play a little: move right and jump, so screenshots show motion and we exercise input. */
async function playABit(page, handle) {
  try {
    const box = await handle.boundingBox();
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(500);
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(600);
    await page.keyboard.up('ArrowRight');
  } catch {
    // ignore: page may not accept input
  }
}

async function visit(browser, def, vp, scheme) {
  const sink = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [], hosts: {}, apiRequests: [] };
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: 1,
    colorScheme: scheme,
  });
  await ctx.addInitScript(INIT_SCRIPT);
  const page = await ctx.newPage();
  attachLogging(page, sink);
  const tag = `${def.id}--${vp.id}-${scheme}`;
  const rec = { id: def.id, viewport: vp.id, scheme, path: def.path, shots: [] };
  try {
    const t0 = Date.now();
    const resp = await page.goto(args.base + def.path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    rec.status = resp?.status();
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    rec.loadMs = Date.now() - t0;
    if (def.setup) await def.setup(page);
    await page.waitForTimeout(def.settle ?? 1200);
    rec.finalUrl = page.url().replace(args.base, '');
    rec.audit = await page.evaluate(AUDIT_FN).catch((e) => ({ error: String(e) }));
    rec.looksLike404 = /not found|404|doesn.t exist/i.test((await page.locator('body').innerText().catch(() => '')).slice(0, 2000));
    const shot = path.join(OUT, `${tag}.png`);
    await page.screenshot({ path: shot });
    rec.shots.push(rel(shot));
    if (vp.id === 'desktop' && scheme === 'dark' && !def.game) {
      const full = path.join(OUT, `${tag}-full.png`);
      await page.screenshot({ path: full, fullPage: true });
      rec.shots.push(rel(full));
    }
    if (def.game) {
      const h = await gameFrameHandle(page);
      if (h) {
        await page.waitForTimeout(2500); // let the player boot and start posting fps
        await resetFps(page);
        await playABit(page, h);
        await page.waitForTimeout(4000);
        const q = await readQa(page);
        rec.fps = { samples: q.fps.slice(-12), median: median(q.fps), min: q.fps.length ? Math.min(...q.fps) : null, raf: q.rafFps, longTasks: q.longTasks };
        const g = path.join(OUT, `${tag}-game.png`);
        await h.screenshot({ path: g }).catch(() => {});
        if (fs.existsSync(g)) rec.shots.push(rel(g));
        const after = path.join(OUT, `${tag}-after-input.png`);
        await page.screenshot({ path: after });
        rec.shots.push(rel(after));
      } else rec.fps = { error: 'no iframe or canvas found' };
    }
  } catch (e) {
    rec.error = String(e.message || e).slice(0, 300);
  }
  Object.assign(rec, sink);
  await ctx.close();
  return rec;
}

/* ─── Journey: landing → playing my own game ──────────────────────────── */

const CTA = /^(create|make|build|generate|start|play|go|try|get started|new game|next|continue|done|finish|open|make (my|a) game|create (my|a) game|make it)/i;

async function journey(browser, vp) {
  const sink = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [], hosts: {}, apiRequests: [] };
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, colorScheme: 'dark' });
  await ctx.addInitScript(INIT_SCRIPT);
  const page = await ctx.newPage();
  attachLogging(page, sink);
  const steps = [];
  let clicks = 0;
  let typed = false;
  const t0 = Date.now();
  const shot = async (n) => {
    const p = path.join(OUT, `journey--${vp.id}-${String(steps.length).padStart(2, '0')}-${n}.png`);
    await page.screenshot({ path: p }).catch(() => {});
    return rel(p);
  };
  // "Playing my own game" = the person described a game (typed a prompt), and after that a game
  // started: the URL changed or a new player iframe/canvas appeared, and frames are being drawn.
  // The landing page's own demo canvas does not count.
  let baseline = null;
  const surface = async () => ({ url: page.url(), iframes: await page.locator('iframe').count(), canvases: await page.locator('canvas').count() });
  const playing = async () => {
    if (!typed || !baseline) return false;
    const now = await surface();
    const changed = now.url !== baseline.url || now.iframes > baseline.iframes || now.canvases > baseline.canvases;
    if (!changed) return false;
    // Only the player's own fps messages count; decorative canvases (backdrops) do not.
    const q = await readQa(page);
    return q.fps.length > 0;
  };
  try {
    await page.goto(args.base + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    steps.push({ at: 0, what: 'landing', shot: await shot('landing') });
    for (let i = 0; i < 6 && Date.now() - t0 < 90_000; i++) {
      if (await playing()) break;
      // 1. Type the prompt into the first visible free-text field, if there is one and we haven't yet.
      const field = page.locator('textarea:visible, input[type=text]:visible, input:not([type]):visible').first();
      if (!typed && (await field.count())) {
        await field.click();
        await field.fill(JOURNEY_PROMPT);
        typed = true;
        baseline = await surface();
        await resetFps(page);
        clicks++; // focusing the field counts as a click for a real person
        steps.push({ at: Date.now() - t0, what: 'typed prompt', shot: await shot('typed') });
      }
      // 2. Click the most likely primary action: the call-to-action closest to the prompt field
      //    (a person clicks the button next to what they typed, not the header link).
      const fieldBox = typed && (await field.count()) ? await field.boundingBox().catch(() => null) : null;
      const buttons = page.locator('button:visible, a:visible, [role=button]:visible');
      const n = await buttons.count();
      const candidates = [];
      for (let b = 0; b < n; b++) {
        const el = buttons.nth(b);
        const label = ((await el.getAttribute('aria-label')) || (await el.innerText().catch(() => '')) || '').trim();
        if (!CTA.test(label) || /sign|log ?in|pricing/i.test(label) || !(await el.isEnabled().catch(() => false))) continue;
        const box = await el.boundingBox().catch(() => null);
        const dist = fieldBox && box ? Math.hypot(box.x - (fieldBox.x + fieldBox.width), box.y - fieldBox.y) : b;
        candidates.push({ el, label, dist });
      }
      candidates.sort((x, y) => x.dist - y.dist);
      const target = candidates[0] || null;
      if (!target && typed) {
        await page.keyboard.press('Enter');
        steps.push({ at: Date.now() - t0, what: 'pressed Enter' });
      } else if (target) {
        await target.el.click({ timeout: 5000 }).catch(() => {});
        clicks++;
        steps.push({ at: Date.now() - t0, what: `clicked "${target.label.slice(0, 40)}"` });
      } else {
        steps.push({ at: Date.now() - t0, what: 'no input or call to action found' });
        break;
      }
      // Wait for something to happen (navigation, a game starting, a generation finishing).
      // Stop waiting early once the screen has changed and settled (a new step is ready for input).
      const sig = async () => `${page.url()}|${(await page.locator('body').innerText().catch(() => '')).length}`;
      const before = await sig();
      let last = before;
      let stable = 0;
      for (let w = 0; w < 60 && !(await playing()); w++) {
        await page.waitForTimeout(500);
        const now = await sig();
        stable = now === last ? stable + 1 : 0;
        last = now;
        if (now !== before && stable >= 3) break;
      }
      steps[steps.length - 1].url = page.url().replace(args.base, '');
      steps[steps.length - 1].shot = await shot('step');
    }
  } catch (e) {
    steps.push({ error: String(e.message || e).slice(0, 300) });
  }
  const ok = await playing();
  const res = { viewport: vp.id, reachedPlay: ok, seconds: ok ? Math.round((Date.now() - t0) / 100) / 10 : null, clicks, typed, finalUrl: page.url().replace(args.base, ''), steps, ...sink };
  if (ok) res.finalShot = await shot('playing');
  await ctx.close();
  return res;
}

/* ─── Main ─────────────────────────────────────────────────────────────── */

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const pages = args.only ? PAGES.filter((p) => args.only.includes(p.id)) : PAGES;

for (const def of pages) {
  for (const vp of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      log(`${def.id} ${vp.id} ${scheme}`);
      report.pages.push(await visit(browser, def, vp, scheme));
    }
  }
}
if (args.journey && (!args.only || args.only.includes('journey'))) {
  report.journey = [];
  for (const vp of VIEWPORTS) {
    log(`journey ${vp.id}`);
    report.journey.push(await journey(browser, vp));
  }
}
await browser.close();

if (args.build && (!args.only || args.only.includes('build'))) {
  log('building @degamed/web (temp outDir)…');
  const web = buildAndMeasure('@degamed/web', 'web');
  log('building @degamed/play (temp outDir)…');
  const play = buildAndMeasure('@degamed/play', 'play');
  report.bundles = { web, play };
}

/* ─── Summary ──────────────────────────────────────────────────────────── */

const fails = [];
const warns = [];
const lines = [`# QA run: ${args.round != null ? `round ${args.round}` : rel(OUT)}`, '', `Started ${report.startedAt}. Base ${args.base}.`, ''];

lines.push('## Pages', '', '| page | viewport | theme | status | load ms | console errors | page errors | overflow | unnamed controls | tap < 40px | text < 12px | fps median | bg |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of report.pages) {
  const a = r.audit || {};
  const missing = r.looksLike404 && r.id !== 'not-found';
  lines.push(
    `| ${r.id}${missing ? ' (404)' : ''} | ${r.viewport} | ${r.scheme} | ${r.status ?? 'ERR'} | ${r.loadMs ?? ''} | ${r.consoleErrors.length} | ${r.pageErrors.length} | ${a.horizontalOverflow ? 'YES' : 'no'} | ${a.unnamedCount ?? ''} | ${r.viewport === 'phone' ? a.smallTapTargets ?? '' : '-'} | ${a.tinyText ?? ''} | ${r.fps?.median ?? (r.fps?.error ? 'none' : '')} | ${a.bg ?? ''} |`,
  );
  if (missing && PAGES.find((p) => p.id === r.id)?.optional) continue;
  if (r.error) fails.push(`${r.id}/${r.viewport}/${r.scheme}: ${r.error}`);
  if (r.consoleErrors.length + r.pageErrors.length > BUDGET.consoleErrors) fails.push(`${r.id}/${r.viewport}/${r.scheme}: ${r.consoleErrors.length + r.pageErrors.length} console/page errors, first: ${(r.pageErrors[0] || r.consoleErrors[0] || '').slice(0, 140)}`);
  if (a.horizontalOverflow) fails.push(`${r.id}/${r.viewport}/${r.scheme}: horizontal overflow (scrollWidth ${a.scrollWidth} > ${a.viewport})`);
  if (r.fps?.median != null && r.fps.median < BUDGET.fpsMedianHeadless) warns.push(`${r.id}/${r.viewport}/${r.scheme}: fps median ${r.fps.median} (headless)`);
  if (r.loadMs > BUDGET.pageLoadMs && r.viewport === 'desktop') warns.push(`${r.id}/${r.viewport}/${r.scheme}: load ${r.loadMs} ms`);
}
// Theme check: does the page change at all between light and dark?
const themeRows = [];
for (const def of pages.filter((p) => !p.themeExempt)) {
  for (const vp of VIEWPORTS) {
    const d = report.pages.find((r) => r.id === def.id && r.viewport === vp.id && r.scheme === 'dark');
    const l = report.pages.find((r) => r.id === def.id && r.viewport === vp.id && r.scheme === 'light');
    if (d?.audit?.bg && l?.audit?.bg) themeRows.push(`${def.id}/${vp.id}: ${d.audit.bg === l.audit.bg ? 'SAME background in light and dark' : 'themes differ'}`);
  }
}
lines.push('', '## Light/dark', '', ...themeRows.map((t) => `- ${t}`));
if (themeRows.some((t) => t.includes('SAME'))) warns.push('Some pages ignore prefers-color-scheme (light theme missing).');

if (report.journey) {
  lines.push('', '## Journey: landing → playing my own game', '');
  for (const j of report.journey) {
    lines.push(`- **${j.viewport}**: ${j.reachedPlay ? `playing after ${j.seconds}s and ${j.clicks} clicks` : 'did NOT reach a running game'} (typed prompt: ${j.typed}; ended at ${j.finalUrl}; API requests ${j.apiRequests.length})`);
    for (const s of j.steps) lines.push(`  - ${s.at != null ? `${(s.at / 1000).toFixed(1)}s ` : ''}${s.what || s.error}${s.url ? ` → ${s.url}` : ''}${s.shot ? ` (${s.shot})` : ''}`);
    if (!j.reachedPlay) fails.push(`journey/${j.viewport}: never reached a running game`);
    else {
      if (j.seconds > BUDGET.journeySeconds) fails.push(`journey/${j.viewport}: ${j.seconds}s > ${BUDGET.journeySeconds}s`);
      if (j.clicks > BUDGET.journeyClicks) fails.push(`journey/${j.viewport}: ${j.clicks} clicks > ${BUDGET.journeyClicks}`);
    }
  }
}

if (report.bundles) {
  lines.push('', '## Bundles (gzip)', '');
  for (const [k, b] of Object.entries(report.bundles)) {
    if (!b.ok) {
      lines.push(`- **${k}**: BUILD FAILED\n\n\`\`\`\n${b.error}\n\`\`\``);
      fails.push(`${k} build failed`);
      continue;
    }
    lines.push(`- **${k}** (${b.pkg}): initial ${kb(b.initialGzip)}, all JS ${kb(b.jsGzip)}, CSS ${kb(b.cssGzip)}, total on disk ${kb(b.totalBytes)}, ${b.fileCount} files, built in ${(b.ms / 1000).toFixed(1)}s`);
    for (const f of b.largest) lines.push(`  - ${f.file}: ${kb(f.bytes)} raw, ${kb(f.gzip)} gzip`);
  }
  const w = report.bundles.web;
  const p = report.bundles.play;
  if (w?.ok) {
    if (w.initialGzip > BUDGET.initialJsGzip) fails.push(`web initial ${kb(w.initialGzip)} > ${kb(BUDGET.initialJsGzip)}`);
    const big = w.largest.find((f) => /\.js$/.test(f.file));
    if (big && big.gzip > BUDGET.largestChunkGzip) fails.push(`web largest chunk ${big.file} ${kb(big.gzip)} > ${kb(BUDGET.largestChunkGzip)}`);
    if (w.cssGzip > BUDGET.cssGzip) warns.push(`web CSS ${kb(w.cssGzip)} > ${kb(BUDGET.cssGzip)}`);
  }
  if (p?.ok && p.jsGzip > BUDGET.playerJsGzip) fails.push(`player JS ${kb(p.jsGzip)} > ${kb(BUDGET.playerJsGzip)}`);
}

// External hosts contacted (cost + privacy + offline).
const hosts = {};
for (const r of [...report.pages, ...(report.journey || [])]) for (const [h, n] of Object.entries(r.hosts)) hosts[h] = (hosts[h] || 0) + n;
lines.push('', '## Hosts contacted', '', ...Object.entries(hosts).map(([h, n]) => `- ${h}: ${n}`));

// Previous round comparison.
const prevRound = args.round != null && Number(args.round) > 0 ? path.resolve(ROOT, `docs/team/shots/critic/round-${Number(args.round) - 1}/report.json`) : null;
const prevPath = prevRound && fs.existsSync(prevRound) ? prevRound : path.resolve(ROOT, 'docs/team/shots/critic/baseline/report.json');
if (fs.existsSync(prevPath) && path.dirname(prevPath) !== OUT) {
  const prev = JSON.parse(fs.readFileSync(prevPath, 'utf8'));
  const errs = (rep) => rep.pages.reduce((a, r) => a + r.consoleErrors.length + r.pageErrors.length, 0);
  lines.push('', `## Versus ${rel(path.dirname(prevPath))}`, '', `- console + page errors: ${errs(prev)} → ${errs(report)}`);
  const pj = prev.journey?.[0];
  const cj = report.journey?.[0];
  if (pj && cj) lines.push(`- desktop journey: ${pj.reachedPlay ? `${pj.seconds}s/${pj.clicks} clicks` : 'not reached'} → ${cj.reachedPlay ? `${cj.seconds}s/${cj.clicks} clicks` : 'not reached'}`);
  if (prev.bundles?.web?.ok && report.bundles?.web?.ok) lines.push(`- web initial gzip: ${kb(prev.bundles.web.initialGzip)} → ${kb(report.bundles.web.initialGzip)}; all JS ${kb(prev.bundles.web.jsGzip)} → ${kb(report.bundles.web.jsGzip)}`);
}

lines.splice(4, 0, `**Result: ${fails.length ? `FAIL (${fails.length})` : 'PASS'}**, ${warns.length} warnings.`, '', ...fails.map((f) => `- FAIL ${f}`), ...warns.map((w) => `- warn ${w}`), '');
report.fails = fails;
report.warns = warns;
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT, 'summary.md'), lines.join('\n') + '\n');
log(`done: ${fails.length} fails, ${warns.length} warnings → ${rel(OUT)}/summary.md`);
process.exitCode = fails.length ? 1 : 0;
