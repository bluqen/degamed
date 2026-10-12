#!/usr/bin/env node
// Checks the BRIEF's cross-agent contracts statically (exports exist, package subpaths are wired,
// dependencies declared) and optionally runs `pnpm typecheck` and `pnpm test`.
//   node e2e/contracts.mjs            static checks only (seconds)
//   node e2e/contracts.mjs --full     plus workspace typecheck + tests
// Prints a list and exits 1 on any failure. Used by run.mjs (results go into report.json).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => {
  try {
    return fs.readFileSync(path.join(ROOT, p), 'utf8');
  } catch {
    return null;
  }
};
const json = (p) => {
  const s = read(p);
  return s ? JSON.parse(s) : null;
};

/** Each contract: file + names that must be exported from it (directly or re-exported). */
const CONTRACTS = [
  { owner: 'art', file: 'packages/engine/src/art/index.ts', names: ['ART_THEMES', 'getTheme', 'ArtTheme', 'SpriteSheet', 'SheetAnim'] },
  { owner: 'engine', file: 'packages/engine/src/kits/index.ts', names: ['KITS', 'buildGame', 'readSpec', 'Kit', 'KitParam', 'GameSpec'] },
  { owner: 'engine', file: 'packages/shared/src/index.ts', names: ['Environment', 'Light'], deep: true },
  { owner: 'ai', file: 'packages/ai/src/index.ts', names: ['createGame', 'editGame', 'suggestions', 'availableProviders', 'ProviderId', 'AiSettings', 'Progress', 'ChatTurn'] },
];

/** Package subpath exports that other agents import. */
const SUBPATHS = [
  { owner: 'engine', pkg: 'packages/engine/package.json', sub: './kits', usedBy: ['packages/ai/src', 'apps/web/src'] , spec: '@degamed/engine/kits' },
  { owner: 'engine', pkg: 'packages/engine/package.json', sub: './art', usedBy: ['apps/web/src', 'packages/ai/src'], spec: '@degamed/engine/art' },
];

/** Workspace deps a consumer must declare when it imports the package. */
const DEPS = [
  { owner: 'design', consumer: 'apps/web', dep: '@degamed/ai' },
  { owner: 'ai', consumer: 'packages/ai', dep: '@degamed/engine' },
  { owner: 'engine', consumer: 'apps/play', dep: '@degamed/engine' },
];

function grepDir(dir, needle) {
  const hits = [];
  const walk = (d) => {
    let entries = [];
    try {
      entries = fs.readdirSync(path.join(ROOT, d), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx|mjs|js)$/.test(e.name) && (read(p) || '').includes(needle)) hits.push(p);
    }
  };
  walk(dir);
  return hits;
}

/** Very small export scanner: `export (const|function|type|interface|class) X`, `export { X }`, `export * from`. */
function exportsOf(file, seen = new Set()) {
  if (seen.has(file)) return new Set();
  seen.add(file);
  const src = read(file);
  const out = new Set();
  if (!src) return out;
  for (const m of src.matchAll(/export\s+(?:declare\s+)?(?:const|let|function|type|interface|class|enum)\s+([A-Za-z0-9_]+)/g)) out.add(m[1]);
  for (const m of src.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g))
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim();
      if (name) out.add(name);
    }
  for (const m of src.matchAll(/export\s+\*\s+from\s+['"](\.[^'"]+)['"]/g)) {
    const base = path.join(path.dirname(file), m[1]);
    for (const cand of [base + '.ts', base + '.tsx', path.join(base, 'index.ts')]) if (read(cand) != null) for (const n of exportsOf(cand, seen)) out.add(n);
  }
  return out;
}

export function checkContracts() {
  const results = [];
  const add = (ok, owner, what) => results.push({ ok, owner, what });
  for (const c of CONTRACTS) {
    if (read(c.file) == null) {
      add(false, c.owner, `${c.file} is missing`);
      continue;
    }
    let names = exportsOf(c.file);
    if (c.deep) {
      // Environment/Light may be defined in a sibling module re-exported by index.
      const dir = path.dirname(c.file);
      for (const f of fs.readdirSync(path.join(ROOT, dir))) if (f.endsWith('.ts')) for (const n of exportsOf(path.join(dir, f))) names.add(n);
    }
    const missing = c.names.filter((n) => !names.has(n));
    add(!missing.length, c.owner, missing.length ? `${c.file} does not export: ${missing.join(', ')}` : `${c.file} exports ${c.names.join(', ')}`);
  }
  for (const s of SUBPATHS) {
    const pkg = json(s.pkg);
    const users = s.usedBy.flatMap((d) => grepDir(d, `'${s.spec}'`));
    const has = !!pkg?.exports?.[s.sub];
    if (users.length && !has) add(false, s.owner, `${s.spec} is imported by ${users.slice(0, 3).join(', ')} but ${s.pkg} has no "exports"["${s.sub}"]`);
    else add(true, s.owner, `${s.spec}: ${has ? 'exported' : 'not exported (and not imported yet)'}`);
  }
  for (const d of DEPS) {
    const pkg = json(`${d.consumer}/package.json`);
    const uses = grepDir(`${d.consumer}/src`, `'${d.dep}`).length > 0;
    const declared = !!(pkg?.dependencies?.[d.dep] || pkg?.devDependencies?.[d.dep]);
    if (uses && !declared) add(false, d.owner, `${d.consumer} imports ${d.dep} but doesn't declare it in package.json`);
    else add(true, d.owner, `${d.consumer} → ${d.dep}: ${uses ? 'imported and declared' : 'not imported'}`);
  }
  // Stubs still in use by the app (informational, not a failure).
  const stubs = read('apps/web/src/lib/game/index.ts');
  if (stubs) {
    const m = stubs.match(/USING_STUBS\s*=\s*(\{[^}]*\})/);
    if (m) results.push({ ok: true, owner: 'design', what: `web glue USING_STUBS = ${m[1].replace(/\s+/g, ' ')}`, info: true });
  }
  return results;
}

export function runChecks() {
  const out = {};
  for (const [k, cmd] of [
    ['typecheck', ['typecheck']],
    ['test', ['test']],
  ]) {
    const r = spawnSync('pnpm', cmd, { cwd: ROOT, encoding: 'utf8', timeout: 600_000, maxBuffer: 64 * 1024 * 1024 });
    const text = (r.stdout || '') + (r.stderr || '');
    const failing = [...new Set([...text.matchAll(/(packages\/[a-z-]+|apps\/[a-z-]+)[^\n]*(?:Failed|ERR_PNPM|error TS)/g)].map((m) => m[1]))];
    out[k] = { ok: r.status === 0, failing, tail: text.split('\n').filter((l) => /error|fail|✗|×/i.test(l)).slice(0, 20).join('\n') };
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = checkContracts();
  for (const r of res) console.log(`${r.ok ? (r.info ? 'info' : ' ok ') : 'FAIL'} [${r.owner}] ${r.what}`);
  let bad = res.some((r) => !r.ok);
  if (process.argv.includes('--full')) {
    const c = runChecks();
    for (const [k, v] of Object.entries(c)) {
      console.log(`${v.ok ? ' ok ' : 'FAIL'} pnpm ${k}${v.failing.length ? ` (${v.failing.join(', ')})` : ''}`);
      if (!v.ok) console.log(v.tail);
      bad ||= !v.ok;
    }
  }
  process.exitCode = bad ? 1 : 0;
}
