/**
 * The public flows: describe → game, chat → change, runtime errors → fix.
 *
 * Reliability rules:
 * - Every model reply is validated; an invalid one gets one repair attempt (protocol.runTask).
 * - If a model fails for any reason other than the user cancelling, createGame falls back to
 *   instant mode, so the player ALWAYS gets a playable game.
 * - Code edits are small find/replace patches, recorded so they survive spec rebuilds and can be
 *   undone when they break the game.
 */
import type { Encoder } from '@degamed/engine/templates';
import type { ProjectFiles } from '@degamed/shared';
import { catalogFor, getBackend, SPEC_FILE, type GameBackend } from './catalog';
import { checkProject, jsSyntaxError } from './check';
import { hash, instantEdit, instantSpec, words } from './instant';
import { applyEdits, changedPaths, EditError, isScript, isTextFile, MODS_FILE, mergeRebuild, readMods, writeMods, type Mod } from './patch';
import {
  addUsage,
  applySpecPatch,
  LIMITS,
  NO_USAGE,
  type ChatTurn,
  type EditOutput,
  type FileEdit,
  type GameSpec,
  type TaskRequest,
  type Usage,
} from './protocol';
import { PROVIDER_LABELS, ProviderError, runnerFor, type AiSettings, type ProviderId, type TaskRunner } from './providers';

export interface Progress {
  stage: 'understanding' | 'designing' | 'building' | 'testing' | 'fixing' | 'done';
  message: string;
}

type OnProgress = ((p: Progress) => void) | undefined;

// ---------------------------------------------------------------------------------------------
// Logging: estimated tokens per call, so cost is always visible in the console.

export type AiLogger = (entry: { task: string; provider: ProviderId; usage: Usage; ms: number }) => void;

let logger: AiLogger = ({ task, provider, usage, ms }) => {
  if (!usage.calls) return;
  console.info(
    `[degamed/ai] ${task} via ${provider}: ${usage.estimated ? '~' : ''}${usage.inputTokens} in / ${usage.outputTokens} out tokens, ${usage.calls} call${usage.calls > 1 ? 's' : ''}, ${ms} ms`,
  );
};

export function setAiLogger(l: AiLogger): void {
  logger = l;
}

// ---------------------------------------------------------------------------------------------

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

function friendlyFailure(e: unknown, provider: ProviderId): string {
  if (e instanceof ProviderError) return e.message;
  if (e instanceof TypeError) return `Couldn't reach ${PROVIDER_LABELS[provider]}. Check your connection.`;
  return `${PROVIDER_LABELS[provider]} gave an answer I couldn't use.`;
}

function tryRunner(settings: AiSettings): { runner: TaskRunner | null; notice?: string } {
  try {
    return { runner: runnerFor(settings) };
  } catch (e) {
    return { runner: null, notice: e instanceof Error ? e.message : String(e) };
  }
}

function describe(spec: GameSpec, backend: GameBackend): string {
  const kit = backend.kits.find((k) => k.id === spec.kit)?.name.toLowerCase() ?? spec.kit;
  const theme = backend.themes.find((t) => t.id === spec.theme)?.name ?? spec.theme;
  return `Made “${spec.title}”, a ${kit} set in the ${theme}.${spec.story ? ` ${spec.story}` : ''}`;
}

export interface CreateResult {
  files: ProjectFiles;
  spec: GameSpec;
  title: string;
  summary: string;
  /** Which provider actually produced the spec ('instant' after a fallback). */
  provider: ProviderId;
  /** Set when something didn't go to plan but the player still got a game (e.g. a fallback). */
  notice?: string;
  usage: Usage;
}

export async function createGame(i: {
  prompt: string;
  settings: AiSettings;
  encode: Encoder;
  signal?: AbortSignal;
  onProgress?: (p: Progress) => void;
}): Promise<CreateResult> {
  const backend = getBackend();
  const say = (stage: Progress['stage'], message: string) => i.onProgress?.({ stage, message });
  const started = Date.now();
  const prompt = i.prompt.trim().replace(/\s+/g, ' ').slice(0, LIMITS.promptChars) || 'a platformer';
  say('understanding', 'Reading your idea…');
  i.signal?.throwIfAborted();

  let spec: GameSpec | undefined;
  let usage = NO_USAGE;
  let provider: ProviderId = i.settings.provider;
  let { runner, notice } = tryRunner(i.settings);

  if (runner) {
    say('designing', 'Dreaming up the world, the hero and the rules…');
    try {
      const r = await runner({ task: 'create', prompt, catalog: catalogFor(backend) }, i.signal);
      spec = r.value.spec;
      usage = r.usage;
    } catch (e) {
      if (isAbort(e) || i.signal?.aborted) throw e;
      notice = `${friendlyFailure(e, provider)} I used free instant mode instead.`;
    }
    logger({ task: 'create', provider, usage, ms: Date.now() - started });
  }
  if (!spec) {
    provider = 'instant';
    say('designing', 'Picking a world, a hero and a style…');
    spec = instantSpec(prompt, backend).spec;
  }
  spec.seed ??= hash(prompt) % 100000;
  i.signal?.throwIfAborted();

  say('building', `Building “${spec.title}”…`);
  let files = backend.buildGame(spec, i.encode);

  say('testing', 'Checking it plays…');
  const problems = checkProject(files);
  if (problems.length) {
    console.warn('[degamed/ai] built game has problems', problems);
    if (provider !== 'instant') {
      // A kit should never build a broken game, but an odd spec might trip it: use the safe path.
      say('fixing', 'Fixing a small problem…');
      spec = { ...instantSpec(prompt, backend).spec, seed: spec.seed };
      provider = 'instant';
      files = backend.buildGame(spec, i.encode);
    }
  }
  say('done', 'Ready to play!');
  return { files, spec, title: spec.title, summary: describe(spec, backend), provider, notice, usage };
}

// ---------------------------------------------------------------------------------------------

export interface EditResult {
  files: ProjectFiles;
  summary: string;
  changed: string[];
  provider: ProviderId;
  notice?: string;
  usage: Usage;
}

const SHORT_REQUEST_WORDS = 5;

/** Picks the scripts most relevant to a request, within the context budget. */
function pickContext(request: string, files: ProjectFiles, extra: string[] = []): Record<string, string> {
  const ws = new Set(words(request).filter((w) => w.length > 2));
  const scored = Object.entries(files)
    .filter(([p, t]) => isScript(p) && isTextFile(p, t) && t.length <= LIMITS.fileChars)
    .map(([p, t]) => {
      let score = extra.includes(p) ? 1000 : 0;
      const lower = t.toLowerCase();
      for (const w of ws) {
        if (p.toLowerCase().includes(w)) score += 5;
        score += Math.min(3, lower.split(w).length - 1);
      }
      if (/player|hero/.test(p)) score += 2; // most ability requests land in the player script
      return { p, t, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const out: Record<string, string> = {};
  let used = 0;
  for (const { p, t } of scored) {
    if (Object.keys(out).length >= LIMITS.contextFiles || used + t.length > LIMITS.contextChars) continue;
    out[p] = t;
    used += t.length;
  }
  return out;
}

function textPaths(files: ProjectFiles): string[] {
  return Object.entries(files)
    .filter(([p, t]) => isTextFile(p, t) && p !== SPEC_FILE && p !== MODS_FILE)
    .map(([p]) => p)
    .sort((a, b) => Number(isScript(b)) - Number(isScript(a)))
    .slice(0, LIMITS.paths);
}

function trimHistory(history: ChatTurn[] | undefined): ChatTurn[] {
  return (history ?? []).slice(-LIMITS.historyTurns).map((t) => ({ role: t.role, text: t.text.slice(0, LIMITS.historyChars) }));
}

/** Rebuilds from a new spec, keeping the player's own changes and replaying recorded code edits. */
function rebuild(files: ProjectFiles, oldSpec: GameSpec, newSpec: GameSpec, encode: Encoder, backend: GameBackend) {
  const base = backend.buildGame(oldSpec, encode);
  const theirs = backend.buildGame(newSpec, encode);
  return mergeRebuild(base, files, theirs);
}

/** Static problems in the given (changed) files only. */
function problemsIn(files: ProjectFiles, paths: string[]): string[] {
  const out: string[] = [];
  for (const p of paths) {
    const text = files[p];
    if (text === undefined) continue;
    if (p.endsWith('.js')) {
      const err = jsSyntaxError(text);
      if (err) out.push(`${p}: SyntaxError: ${err}`);
    } else if (p.endsWith('.json')) {
      try {
        JSON.parse(text);
      } catch (e) {
        out.push(`${p}: ${(e as Error).message}`);
      }
    }
  }
  if (out.length === 0 && paths.some((p) => p.endsWith('.json'))) {
    for (const prob of checkProject(files)) if (paths.includes(prob.path)) out.push(`${prob.path}: ${prob.message}`);
  }
  return out;
}

function recordMods(files: ProjectFiles, edits: FileEdit[], request: string): ProjectFiles {
  const applied = applyEdits(files, edits);
  return writeMods(applied, [...readMods(files), ...edits.map((e): Mod => ({ ...e, request: request.slice(0, 120) }))]);
}

export async function editGame(i: {
  files: ProjectFiles;
  request: string;
  history?: ChatTurn[];
  settings: AiSettings;
  encode: Encoder;
  signal?: AbortSignal;
  onProgress?: (p: Progress) => void;
}): Promise<EditResult> {
  const backend = getBackend();
  const say = (stage: Progress['stage'], message: string) => i.onProgress?.({ stage, message });
  const started = Date.now();
  const request = i.request.trim().replace(/\s+/g, ' ').slice(0, LIMITS.promptChars);
  const spec = backend.readSpec(i.files);
  const finish = (files: ProjectFiles, summary: string, provider: ProviderId, usage: Usage, notice?: string): EditResult => {
    say('done', 'Done!');
    return { files, summary, changed: changedPaths(i.files, files), provider, usage, ...(notice ? { notice } : {}) };
  };
  say('understanding', 'Reading your request…');
  if (!request) return finish(i.files, 'Tell me what to change, like “make the jumps floatier”.', 'instant', NO_USAGE);

  const free = spec ? instantEdit(request, spec, backend) : undefined;
  const { runner, notice } = tryRunner(i.settings);
  // Short, clear requests ("make it night", the quick-action chips) never need a model: free and instant.
  const simple = free?.understood && words(request).length <= SHORT_REQUEST_WORDS;

  const applyFree = (why?: string): EditResult => {
    if (!spec || !free?.understood) {
      const msg = spec
        ? 'I couldn’t work that one out in free mode. Try something like “make it harder”, “floatier jumps” or “make it night”, or add an AI key in Settings for any change.'
        : 'This game wasn’t made from a description, so free mode can’t change it. Add an AI key in Settings to edit it by chatting.';
      return finish(i.files, msg, 'instant', NO_USAGE, why);
    }
    say('building', 'Rebuilding your game…');
    const { files } = rebuild(i.files, spec, free.spec, i.encode, backend);
    return finish(files, free.summary, 'instant', NO_USAGE, why);
  };

  if (!runner || simple) return applyFree(runner ? undefined : notice);

  // ----- Model edit
  const provider = i.settings.provider;
  const catalog = catalogFor(backend);
  const paths = textPaths(i.files);
  // Spec-shaped requests don't need code in the prompt: keep them cheap.
  const context = free?.understood ? {} : pickContext(request, i.files);
  const base: Omit<TaskRequest & { task: 'edit' }, 'files'> = { task: 'edit', request, spec, history: trimHistory(i.history), paths, catalog };
  let usage = NO_USAGE;
  let out: EditOutput;
  say('designing', 'Working out the change…');
  try {
    let r = await runner({ ...base, files: context }, i.signal);
    usage = r.usage;
    if (r.value.needFiles.length && !r.value.edits.length && !r.value.spec) {
      say('designing', 'Looking at the code…');
      r = await runner({ ...base, files: pickContext(request, i.files, r.value.needFiles) }, i.signal);
      usage = addUsage(usage, r.usage);
    }
    out = r.value;
  } catch (e) {
    if (isAbort(e) || i.signal?.aborted) throw e;
    logger({ task: 'edit', provider, usage, ms: Date.now() - started });
    return applyFree(`${friendlyFailure(e, provider)}${free?.understood ? ' I made the change with free instant mode instead.' : ''}`);
  }
  logger({ task: 'edit', provider, usage, ms: Date.now() - started });
  i.signal?.throwIfAborted();

  say('building', 'Rebuilding your game…');
  let files = i.files;
  let summary = out.summary || 'Done.';
  if (out.edits.length) {
    try {
      files = recordMods(files, out.edits, request);
    } catch (e) {
      if (!(e instanceof EditError)) throw e;
      out.edits = [];
      summary += ' (I couldn’t apply the code part of that change.)';
    }
  }
  if (out.spec && spec) {
    const next = applySpecPatch(spec, out.spec, catalog).spec;
    if (next && JSON.stringify(next) !== JSON.stringify(spec)) files = rebuild(files, spec, next, i.encode, backend).files;
  }

  // ----- Test, then fix once, then undo the code part if it's still broken.
  if (out.edits.length) {
    say('testing', 'Checking it still plays…');
    const touched = [...new Set(out.edits.map((e) => e.path))];
    const problems = problemsIn(files, touched);
    if (problems.length) {
      say('fixing', 'Fixing a small problem…');
      const fixed = await repairWith(runner, files, problems, i.signal).catch((e) => {
        if (isAbort(e)) throw e;
        return null;
      });
      if (fixed) usage = addUsage(usage, fixed.usage);
      if (fixed && problemsIn(fixed.files, touched).length === 0) files = fixed.files;
      else {
        files = undoMods(files, (m) => out.edits.some((e) => e.path === m.path && e.find === m.find && e.replace === m.replace));
        summary = `${summary} The code change broke the game, so I undid that part.`;
      }
    }
  }
  return finish(files, summary, provider, usage, notice);
}

// ---------------------------------------------------------------------------------------------
// Repair

/** Undoes recorded mods matching `which` (newest first) by reversing their edits. */
function undoMods(files: ProjectFiles, which: (m: Mod) => boolean): ProjectFiles {
  const mods = readMods(files);
  let out = files;
  const keep: Mod[] = [];
  for (let k = mods.length - 1; k >= 0; k--) {
    const m = mods[k]!;
    if (!which(m)) {
      keep.unshift(m);
      continue;
    }
    try {
      if (m.replace) out = applyEdits(out, [{ path: m.path, find: m.replace, replace: m.find }]);
    } catch {
      // Already gone or ambiguous: drop the record anyway.
    }
  }
  return writeMods(out, keep);
}

async function repairWith(runner: TaskRunner, files: ProjectFiles, errors: string[], signal?: AbortSignal) {
  const named = Object.keys(files).filter((p) => isScript(p) && errors.some((e) => e.includes(p)));
  const context = pickContext(errors.join(' '), files, named);
  if (!Object.keys(context).length) return null;
  const r = await runner(
    { task: 'repair', errors: errors.slice(0, LIMITS.errors).map((e) => e.slice(0, LIMITS.errorChars)), files: context, spec: getBackend().readSpec(files) },
    signal,
  );
  return { files: recordMods(files, r.value.edits, 'auto-fix'), summary: r.value.summary, usage: r.usage };
}

export interface RepairResult {
  files: ProjectFiles;
  summary: string;
  changed: string[];
  /** False if nothing could be fixed (the files are unchanged). */
  fixed: boolean;
  usage: Usage;
}

/**
 * Takes runtime errors from the player console and asks for a minimal fix. Without a model (or if
 * the model's fix doesn't help), it undoes the AI code changes to the scripts named in the errors,
 * which returns them to the kit's known-good version.
 */
export async function repairFromErrors(
  files: ProjectFiles,
  errors: string[],
  settings: AiSettings,
  opts: { signal?: AbortSignal; onProgress?: (p: Progress) => void } = {},
): Promise<RepairResult> {
  const say = (stage: Progress['stage'], message: string) => opts.onProgress?.({ stage, message });
  const started = Date.now();
  const errs = errors.map((e) => e.trim()).filter(Boolean);
  const result = (out: ProjectFiles, summary: string, usage = NO_USAGE): RepairResult => {
    say('done', summary);
    const changed = changedPaths(files, out);
    return { files: out, summary, changed, fixed: changed.length > 0, usage };
  };
  if (!errs.length) return result(files, 'Nothing to fix.');
  say('fixing', 'Fixing a small problem…');

  const { runner } = tryRunner(settings);
  if (runner) {
    try {
      const r = await repairWith(runner, files, errs, opts.signal);
      logger({ task: 'repair', provider: settings.provider, usage: r?.usage ?? NO_USAGE, ms: Date.now() - started });
      if (r) {
        const touched = changedPaths(files, r.files).filter((p) => p !== MODS_FILE);
        if (touched.length && problemsIn(r.files, touched).length === 0) return result(r.files, r.summary || 'Fixed it.', r.usage);
      }
    } catch (e) {
      if (isAbort(e) || opts.signal?.aborted) throw e;
    }
  }

  // Free fallback: undo AI code changes in the scripts the errors point at (or all of them).
  const mods = readMods(files);
  if (!mods.length) return result(files, 'I couldn’t find a safe fix for that error.');
  const named = new Set(mods.map((m) => m.path).filter((p) => errs.some((e) => e.includes(p))));
  const out = undoMods(files, (m) => (named.size ? named.has(m.path) : true));
  return result(out, 'I undid the last code changes that caused the problem.');
}
