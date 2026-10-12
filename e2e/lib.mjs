// Shared helpers for the Degamed QA harness. Plain Node ESM, no repo dependencies.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/** Load Playwright from the global install (see BRIEF), falling back to a local one. */
export function loadPlaywright() {
  for (const base of ['/opt/node22/lib/node_modules/', import.meta.url]) {
    try {
      return createRequire(base)('playwright');
    } catch {
      // try the next location
    }
  }
  throw new Error('Playwright not found. Install it globally (npm i -g playwright) or locally.');
}

export const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

export function parseArgs(argv) {
  const out = { round: null, base: 'http://localhost:5173', player: 'http://localhost:5174', build: true, only: null, journey: true, out: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--round') out.round = next();
    else if (a === '--base') out.base = next();
    else if (a === '--player') out.player = next();
    else if (a === '--no-build') out.build = false;
    else if (a === '--no-journey') out.journey = false;
    else if (a === '--only') out.only = next().split(',');
    else if (a === '--out') out.out = next();
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

export function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** Walk a build folder and return per-file raw + gzip sizes (bytes). */
export function sizeTree(dir) {
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        const buf = fs.readFileSync(p);
        const gz = /\.(js|css|html|json|svg|txt|mjs|wasm)$/.test(e.name) ? zlib.gzipSync(buf, { level: 9 }).length : buf.length;
        files.push({ file: path.relative(dir, p), bytes: buf.length, gzip: gz });
      }
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  files.sort((a, b) => b.gzip - a.gzip);
  return files;
}

export const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

/**
 * Injected into every frame before any page script runs.
 * Records: fps messages from the player, a rAF frame counter for frames that own a canvas,
 * and long tasks. Read back with `window.__qa`.
 */
export const INIT_SCRIPT = `
(() => {
  const qa = (window.__qa = { fps: [], messages: 0, raf: { frames: 0, start: 0 }, longTasks: 0, t0: performance.now() });
  window.addEventListener('message', (e) => {
    const d = e.data;
    qa.messages++;
    if (d && typeof d === 'object' && d.type === 'fps' && typeof d.fps === 'number') qa.fps.push(d.fps);
  });
  const tick = () => {
    if (document.querySelector('canvas')) {
      if (!qa.raf.start) qa.raf.start = performance.now();
      qa.raf.frames++;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((l) => { qa.longTasks += l.getEntries().length; }).observe({ type: 'longtask', buffered: true });
  } catch {}
})();
`;

/** Cheap accessibility and layout checks run inside the page. Not a replacement for axe, but catches the basics. */
export const AUDIT_FN = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const name = (el) =>
    (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.getAttribute('alt') || '').trim() ||
    (el.getAttribute('aria-labelledby') ? 'labelled' : '') ||
    [...el.querySelectorAll('img[alt],svg[aria-label]')].map((i) => i.getAttribute('alt') || i.getAttribute('aria-label')).join('');
  const buttons = [...document.querySelectorAll('button, a[href], [role=button]')].filter(vis);
  const unnamed = buttons.filter((b) => !name(b)).map((b) => b.outerHTML.slice(0, 120));
  const inputs = [...document.querySelectorAll('input:not([type=hidden]), textarea, select')].filter(vis);
  const unlabelled = inputs
    .filter((i) => !(i.labels && i.labels.length) && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby') && !i.getAttribute('title'))
    .map((i) => i.outerHTML.slice(0, 120));
  const imgsNoAlt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length;
  const h1 = [...document.querySelectorAll('h1')].filter(vis).length;
  // Small tap targets on touch (< 40px either side), visible only.
  const small = buttons.filter((b) => {
    const r = b.getBoundingClientRect();
    return r.width < 40 || r.height < 40;
  }).length;
  // Text smaller than 12px that is visible.
  let tinyText = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const el = walker.currentNode.parentElement;
    if (!el || seen.has(el) || !walker.currentNode.textContent.trim()) continue;
    seen.add(el);
    if (vis(el) && parseFloat(getComputedStyle(el).fontSize) < 12) tinyText++;
  }
  const fonts = new Set();
  const sizes = new Set();
  for (const el of seen) {
    const s = getComputedStyle(el);
    fonts.add(s.fontFamily.split(',')[0].trim());
    sizes.add(s.fontSize);
  }
  // Effective page background: walk up from a point near the top-left content area.
  const effectiveBg = (x, y) => {
    for (let el = document.elementFromPoint(x, y); el; el = el.parentElement) {
      const c = getComputedStyle(el).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
    }
    return getComputedStyle(document.documentElement).backgroundColor;
  };
  return {
    title: document.title,
    lang: document.documentElement.lang || null,
    h1,
    interactive: buttons.length,
    unnamedControls: unnamed.slice(0, 8),
    unnamedCount: unnamed.length,
    unlabelledInputs: unlabelled.slice(0, 8),
    imgsNoAlt,
    smallTapTargets: small,
    tinyText,
    fontFamilies: [...fonts].slice(0, 8),
    fontSizes: [...sizes].sort((a, b) => parseFloat(a) - parseFloat(b)),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    scrollWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    bg: effectiveBg(Math.min(window.innerWidth - 4, 24), Math.min(window.innerHeight - 4, 120)),
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    hasMetaDescription: !!document.querySelector('meta[name=description]'),
    hasOgImage: !!document.querySelector('meta[property="og:image"]'),
    hasThemeColor: !!document.querySelector('meta[name=theme-color]'),
  };
};
