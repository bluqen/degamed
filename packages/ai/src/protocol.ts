/**
 * The model protocol: request/response schemas, prompts, validation and the one-shot repair loop.
 *
 * This module is pure (zod only, no DOM, no engine) so the Cloudflare Worker can import it and
 * build exactly the same prompts as the browser. That keeps the hosted endpoint a narrow
 * "game spec generator", not an open LLM proxy.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------------------------
// Spec and catalogue types (mirror the engine contract; see docs/team/BRIEF.md)

export interface KitParam {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'choice';
  min?: number;
  max?: number;
  step?: number;
  choices?: string[];
  default: number | boolean | string;
  group?: string;
}

export interface GameSpec {
  kit: string;
  title: string;
  theme: string;
  seed?: number;
  params?: Record<string, number | boolean | string>;
  story?: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

/** Hard limits that keep every call small and cheap. The Worker rejects anything bigger. */
export const LIMITS = {
  promptChars: 600,
  historyTurns: 6,
  historyChars: 400,
  /** Script context sent with an edit or repair (sum of all files). */
  contextChars: 12_000,
  contextFiles: 6,
  fileChars: 8_000,
  paths: 80,
  errors: 8,
  errorChars: 500,
  edits: 8,
  findChars: 2_000,
  replaceChars: 3_000,
  maxTokens: { create: 400, edit: 900, repair: 900 },
} as const;

// ---------------------------------------------------------------------------------------------
// Request schemas (what the client may send to the hosted endpoint)

const Short = (n: number) => z.string().max(n);

export const KitParamSchema = z.object({
  key: z.string().min(1).max(40),
  label: Short(60),
  type: z.enum(['number', 'boolean', 'choice']),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  choices: z.array(Short(30)).max(12).optional(),
  default: z.union([z.number(), z.boolean(), Short(40)]),
  group: Short(30).optional(),
});

export const CatalogSchema = z.object({
  kits: z
    .array(z.object({ id: z.string().min(1).max(40), name: Short(60), description: Short(240), params: z.array(KitParamSchema).max(24) }))
    .min(1)
    .max(16),
  themes: z.array(z.object({ id: z.string().min(1).max(40), name: Short(60), description: Short(240) })).min(1).max(32),
});
/** The slice of the kit and theme catalogues the model sees. */
export type Catalog = z.infer<typeof CatalogSchema>;

const ParamValue = z.union([z.number(), z.boolean(), z.string().max(60)]);

export const GameSpecSchema = z.object({
  kit: z.string().min(1).max(40),
  theme: z.string().min(1).max(40),
  title: z.string().min(1).max(80),
  story: z.string().max(400).optional(),
  seed: z.number().int().optional(),
  params: z.record(z.string().max(40), ParamValue).optional(),
});

const Files = z
  .record(z.string().max(200), z.string().max(LIMITS.fileChars))
  .refine((f) => Object.keys(f).length <= LIMITS.contextFiles, `At most ${LIMITS.contextFiles} files`)
  .refine((f) => Object.values(f).reduce((n, s) => n + s.length, 0) <= LIMITS.contextChars, 'Too much code in one request');

export const TaskRequestSchema = z.discriminatedUnion('task', [
  z.object({ task: z.literal('create'), prompt: z.string().trim().min(2).max(LIMITS.promptChars), catalog: CatalogSchema }),
  z.object({
    task: z.literal('edit'),
    request: z.string().trim().min(1).max(LIMITS.promptChars),
    spec: GameSpecSchema.nullable(),
    history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(LIMITS.historyChars) })).max(LIMITS.historyTurns),
    /** Every text file in the project (so the model can ask for one). */
    paths: z.array(z.string().max(200)).max(LIMITS.paths),
    /** The files the model can edit right now. */
    files: Files,
    catalog: CatalogSchema,
  }),
  z.object({
    task: z.literal('repair'),
    errors: z.array(z.string().max(LIMITS.errorChars)).min(1).max(LIMITS.errors),
    files: Files,
    spec: GameSpecSchema.nullable().optional(),
  }),
]);
export type TaskRequest = z.infer<typeof TaskRequestSchema>;
export type TaskKind = TaskRequest['task'];

// ---------------------------------------------------------------------------------------------
// Response schemas (what the model must return)

export const FileEditSchema = z.object({
  path: z.string().min(1).max(200),
  find: z.string().min(1).max(LIMITS.findChars),
  replace: z.string().max(LIMITS.replaceChars),
});
export type FileEdit = z.infer<typeof FileEditSchema>;

const SpecPatchSchema = z.object({
  kit: z.string().max(40).optional(),
  theme: z.string().max(40).optional(),
  title: z.string().max(80).optional(),
  story: z.string().max(400).optional(),
  params: z.record(z.string().max(40), ParamValue).optional(),
});
export type SpecPatch = z.infer<typeof SpecPatchSchema>;

const EditOutputSchema = z.object({
  summary: z.string().max(400).default(''),
  spec: SpecPatchSchema.nullish(),
  edits: z.array(FileEditSchema).max(LIMITS.edits).nullish(),
  needFiles: z.array(z.string().max(200)).max(4).nullish(),
});
const RepairOutputSchema = z.object({
  summary: z.string().max(400).default(''),
  edits: z.array(FileEditSchema).max(LIMITS.edits),
});

export interface CreateOutput {
  spec: GameSpec;
}
export interface EditOutput {
  summary: string;
  spec?: SpecPatch;
  edits: FileEdit[];
  needFiles: string[];
}
export interface RepairOutput {
  summary: string;
  edits: FileEdit[];
}
export type TaskOutput<K extends TaskKind> = K extends 'create' ? CreateOutput : K extends 'edit' ? EditOutput : RepairOutput;

/** JSON Schemas for providers with structured output (Workers AI, OpenAI-compatible). */
export function outputJsonSchema(task: TaskKind): Record<string, unknown> {
  // Param values are number | boolean | string; kept loose because JSON-mode engines differ in
  // what schema features they support. Values are validated against the kit afterwards.
  const params = { type: 'object' };
  const edits = {
    type: 'array',
    items: { type: 'object', properties: { path: { type: 'string' }, find: { type: 'string' }, replace: { type: 'string' } }, required: ['path', 'find', 'replace'] },
  };
  if (task === 'create') {
    return {
      type: 'object',
      properties: { kit: { type: 'string' }, theme: { type: 'string' }, title: { type: 'string' }, story: { type: 'string' }, params },
      required: ['kit', 'theme', 'title', 'story'],
    };
  }
  if (task === 'edit') {
    return {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        spec: { type: 'object', properties: { kit: { type: 'string' }, theme: { type: 'string' }, title: { type: 'string' }, story: { type: 'string' }, params } },
        edits,
        needFiles: { type: 'array', items: { type: 'string' } },
      },
      required: ['summary'],
    };
  }
  return { type: 'object', properties: { summary: { type: 'string' }, edits }, required: ['summary', 'edits'] };
}

// ---------------------------------------------------------------------------------------------
// Prompts. Static instructions first, then the catalogue, then the request: a stable prefix
// that providers with prompt caching can reuse.

const CREATE_RULES = `You design small 2D games for Degamed. Turn the player's idea into a game spec.
Reply with JSON only: {"kit":"<kit id>","theme":"<theme id>","title":"...","story":"...","params":{"<key>":<value>}}
Rules:
- kit and theme must be ids from the lists below. Pick the closest genre, then the closest mood and setting.
- title: 1-5 catchy words, no quotes. story: one sentence under 140 characters about the hero and their goal.
- params: only keys of the chosen kit, inside their ranges. Leave out keys that should keep the default. Match the idea ("very hard" -> hard difficulty and more enemies, "floaty" -> lower gravity, "short" -> shorter level).`;

const EDIT_RULES = `You change an existing Degamed game when the player asks.
Reply with JSON only: {"summary":"<one friendly sentence saying what changed>","spec":{<only changed fields: kit, theme, title, story, params>},"edits":[{"path":"...","find":"...","replace":"..."}]}
Rules:
- Prefer a spec change. Use only kit ids, theme ids and param keys from the lists below, inside their ranges.
- Only if the spec can't express the request (new abilities, new behaviour), add small code edits to the files shown. "find" must be an exact, unique snippet of the current file; "replace" is its new text. Never rewrite whole files.
- If you need a file that isn't shown, reply {"summary":"","needFiles":["<path>"]} instead.
- If the request is impossible, leave spec and edits out and explain kindly in summary.`;

const REPAIR_RULES = `You fix runtime errors in a Degamed game's scripts with the smallest possible change.
Reply with JSON only: {"summary":"<one plain sentence>","edits":[{"path":"...","find":"...","replace":"..."}]}
"find" must be an exact, unique snippet of the file as shown. Never rewrite whole files. Keep the game's behaviour otherwise unchanged.`;

function describeParam(p: KitParam): string {
  const def = JSON.stringify(p.default);
  if (p.type === 'number') return `${p.key} ${p.min ?? '?'}..${p.max ?? '?'}=${def}`;
  if (p.type === 'choice') return `${p.key} ${(p.choices ?? []).join('|')}=${def}`;
  return `${p.key} true|false=${def}`;
}

/** Compact catalogue text: about 30 tokens per kit and 15 per theme. */
export function catalogText(catalog: Catalog): string {
  const kits = catalog.kits.map((k) => `${k.id}: ${k.description}${k.params.length ? ` | params: ${k.params.map(describeParam).join('; ')}` : ''}`);
  const themes = catalog.themes.map((t) => `${t.id}: ${t.description}`);
  return `KITS\n${kits.join('\n')}\nTHEMES\n${themes.join('\n')}`;
}

function filesText(files: Record<string, string>): string {
  return Object.entries(files)
    .map(([path, text]) => `--- ${path}\n${text}`)
    .join('\n');
}

export interface ModelMessage {
  role: 'user' | 'assistant';
  content: string;
}
export interface BuiltPrompt {
  system: string;
  messages: ModelMessage[];
  maxTokens: number;
  jsonSchema: Record<string, unknown>;
}

export function buildPrompt(req: TaskRequest): BuiltPrompt {
  if (req.task === 'create') {
    return {
      system: `${CREATE_RULES}\n${catalogText(req.catalog)}`,
      messages: [{ role: 'user', content: `Idea: ${req.prompt}` }],
      maxTokens: LIMITS.maxTokens.create,
      jsonSchema: outputJsonSchema('create'),
    };
  }
  if (req.task === 'edit') {
    const parts = [`Current spec: ${JSON.stringify(req.spec)}`];
    const others = req.paths.filter((p) => !(p in req.files));
    if (others.length) parts.push(`Other files: ${others.join(', ')}`);
    if (Object.keys(req.files).length) parts.push(`Files:\n${filesText(req.files)}`);
    if (req.history.length) parts.push(`Recent chat:\n${req.history.map((t) => `${t.role}: ${t.text}`).join('\n')}`);
    parts.push(`Request: ${req.request}`);
    return {
      system: `${EDIT_RULES}\n${catalogText(req.catalog)}`,
      messages: [{ role: 'user', content: parts.join('\n') }],
      maxTokens: LIMITS.maxTokens.edit,
      jsonSchema: outputJsonSchema('edit'),
    };
  }
  const parts = [`Errors:\n${req.errors.map((e) => `- ${e}`).join('\n')}`, `Files:\n${filesText(req.files)}`];
  return {
    system: REPAIR_RULES,
    messages: [{ role: 'user', content: parts.join('\n') }],
    maxTokens: LIMITS.maxTokens.repair,
    jsonSchema: outputJsonSchema('repair'),
  };
}

// ---------------------------------------------------------------------------------------------
// Parsing and validation

/** Pulls the JSON object out of a model reply (tolerates code fences and chatter around it). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The reply had no JSON object');
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new Error('The reply was not valid JSON');
  }
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_]+/g, '-');

function findId<T extends { id: string; name: string }>(list: T[], value: string | undefined): T | undefined {
  if (!value) return undefined;
  const v = norm(value);
  return list.find((x) => norm(x.id) === v) ?? list.find((x) => norm(x.name) === v);
}

function roundStep(n: number, p: KitParam): number {
  let v = n;
  if (p.min !== undefined) v = Math.max(p.min, v);
  if (p.max !== undefined) v = Math.min(p.max, v);
  if (p.step && p.step > 0) {
    const base = p.min ?? 0;
    v = base + Math.round((v - base) / p.step) * p.step;
    v = Number(v.toFixed(6));
  }
  return v;
}

/**
 * Cleans params against a kit: drops unknown keys, coerces "5" → 5 and "true" → true, clamps
 * numbers into range and matches choices case-insensitively. Returns the problems it couldn't fix.
 */
export function sanitizeParams(
  params: Record<string, unknown> | undefined,
  kitParams: KitParam[],
): { params: Record<string, number | boolean | string>; dropped: string[] } {
  const out: Record<string, number | boolean | string> = {};
  const dropped: string[] = [];
  for (const [key, raw] of Object.entries(params ?? {})) {
    const p = kitParams.find((k) => k.key === key) ?? kitParams.find((k) => k.key.toLowerCase() === key.toLowerCase());
    if (!p) {
      dropped.push(key);
      continue;
    }
    if (p.type === 'number') {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
      if (Number.isFinite(n)) out[p.key] = roundStep(n, p);
      else dropped.push(key);
    } else if (p.type === 'boolean') {
      if (typeof raw === 'boolean') out[p.key] = raw;
      else if (raw === 'true' || raw === 'false') out[p.key] = raw === 'true';
      else dropped.push(key);
    } else {
      const choice = (p.choices ?? []).find((c) => c.toLowerCase() === String(raw).toLowerCase());
      if (choice !== undefined) out[p.key] = choice;
      else dropped.push(key);
    }
  }
  return { params: out, dropped };
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const cleanTitle = (s: string) => clip(s.trim().replace(/^["'“”]+|["'“”]+$/g, '').replace(/\s+/g, ' ').trim(), 48);

/** Validates a full spec against the catalogue. Fixable details are fixed; real problems are listed. */
export function checkSpec(raw: unknown, catalog: Catalog): { spec?: GameSpec; errors: string[] } {
  const parsed = GameSpecSchema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'spec'}: ${i.message}`) };
  const s = parsed.data;
  const errors: string[] = [];
  const kit = findId(catalog.kits, s.kit);
  const theme = findId(catalog.themes, s.theme);
  if (!kit) errors.push(`kit "${s.kit}" is not one of: ${catalog.kits.map((k) => k.id).join(', ')}`);
  if (!theme) errors.push(`theme "${s.theme}" is not one of: ${catalog.themes.map((t) => t.id).join(', ')}`);
  const title = cleanTitle(s.title);
  if (!title) errors.push('title is empty');
  if (errors.length || !kit || !theme) return { errors };
  const spec: GameSpec = { kit: kit.id, theme: theme.id, title };
  const story = s.story?.trim();
  if (story) spec.story = clip(story, 200);
  if (s.seed !== undefined) spec.seed = s.seed;
  const { params } = sanitizeParams(s.params, kit.params);
  if (Object.keys(params).length) spec.params = params;
  return { spec, errors: [] };
}

/** Applies a spec patch from an edit. Switching kit resets params that don't exist on the new kit. */
export function applySpecPatch(spec: GameSpec, patch: SpecPatch, catalog: Catalog): { spec?: GameSpec; errors: string[] } {
  const kitChanged = patch.kit !== undefined && norm(patch.kit) !== norm(spec.kit);
  const merged = {
    ...spec,
    ...(patch.kit !== undefined ? { kit: patch.kit } : {}),
    ...(patch.theme !== undefined ? { theme: patch.theme } : {}),
    ...(patch.title !== undefined && patch.title.trim() ? { title: patch.title } : {}),
    ...(patch.story !== undefined ? { story: patch.story } : {}),
    params: { ...(kitChanged ? {} : spec.params), ...patch.params },
  };
  return checkSpec(merged, catalog);
}

function checkEdits(edits: FileEdit[], files: Record<string, string>, errors: string[]) {
  for (const e of edits) {
    const text = files[e.path];
    if (text === undefined) {
      errors.push(`edit for ${e.path}: that file wasn't shown; ask for it with needFiles`);
      continue;
    }
    const count = text.split(e.find).length - 1;
    if (count === 0) errors.push(`edit for ${e.path}: "find" text not found: ${clip(e.find, 60)}`);
    else if (count > 1) errors.push(`edit for ${e.path}: "find" text appears ${count} times; make it unique`);
  }
}

export type Checked<T> = { ok: true; value: T } | { ok: false; errors: string[] };

/** Validates a model reply for a task. */
export function validateOutput<R extends TaskRequest>(req: R, raw: unknown): Checked<TaskOutput<R['task']>> {
  return validateAny(req, raw) as Checked<TaskOutput<R['task']>>;
}

type AnyOutput = CreateOutput | EditOutput | RepairOutput;

function validateAny(req: TaskRequest, raw: unknown): Checked<AnyOutput> {
  type Out = AnyOutput;
  if (req.task === 'create') {
    const { spec, errors } = checkSpec(raw, req.catalog);
    return spec ? { ok: true, value: { spec } as Out } : { ok: false, errors };
  }
  if (req.task === 'edit') {
    const parsed = EditOutputSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
    const o = parsed.data;
    const errors: string[] = [];
    const edits = o.edits ?? [];
    const needFiles = (o.needFiles ?? []).filter((p) => req.paths.includes(p) && !(p in req.files));
    const spec = o.spec && Object.values(o.spec).some((v) => v !== undefined) ? o.spec : undefined;
    if (spec) {
      const base: GameSpec = req.spec ?? { kit: req.catalog.kits[0]!.id, theme: req.catalog.themes[0]!.id, title: 'My Game' };
      errors.push(...applySpecPatch(base, spec, req.catalog).errors);
    }
    checkEdits(edits, req.files, errors);
    if (errors.length) return { ok: false, errors };
    const value: EditOutput = { summary: o.summary.trim(), edits, needFiles };
    if (spec) value.spec = spec;
    return { ok: true, value: value as Out };
  }
  const parsed = RepairOutputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  const errors: string[] = [];
  checkEdits(parsed.data.edits, req.files, errors);
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { summary: parsed.data.summary.trim(), edits: parsed.data.edits } as Out };
}

// ---------------------------------------------------------------------------------------------
// Running a task against any chat model, with exactly one repair attempt

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  /** True when the provider didn't report usage and the numbers are estimates (≈ 4 chars/token). */
  estimated: boolean;
  calls: number;
}

export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export interface ModelCallInput extends BuiltPrompt {
  signal?: AbortSignal;
}
export interface ModelCallResult {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}
/** One round trip to a chat model. Providers implement this. */
export type ModelCall = (input: ModelCallInput) => Promise<ModelCallResult>;

export class AiOutputError extends Error {
  constructor(readonly errors: string[]) {
    super(`The AI reply was not usable: ${errors.slice(0, 3).join('; ')}`);
    this.name = 'AiOutputError';
  }
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    estimated: a.estimated || b.estimated,
    calls: a.calls + b.calls,
  };
}

export const NO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, estimated: false, calls: 0 };

function usageOf(prompt: BuiltPrompt, res: ModelCallResult): Usage {
  if (res.usage) return { ...res.usage, estimated: false, calls: 1 };
  const input = estimateTokens(prompt.system) + prompt.messages.reduce((n, m) => n + estimateTokens(m.content), 0);
  return { inputTokens: input, outputTokens: estimateTokens(res.text), estimated: true, calls: 1 };
}

/**
 * Runs a task: build the prompt, call the model, validate. If the reply is invalid, show the
 * model its errors once and validate again. Throws AiOutputError if it's still unusable.
 */
export async function runTask<R extends TaskRequest>(
  req: R,
  call: ModelCall,
  signal?: AbortSignal,
): Promise<{ value: TaskOutput<R['task']>; usage: Usage; attempts: number }> {
  const prompt = buildPrompt(req);
  let usage = NO_USAGE;
  let lastErrors: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await call({ ...prompt, signal });
    usage = addUsage(usage, usageOf(prompt, res));
    let raw: unknown;
    try {
      raw = extractJson(res.text);
    } catch (e) {
      lastErrors = [(e as Error).message];
      raw = undefined;
    }
    if (raw !== undefined) {
      const checked = validateOutput(req, raw);
      if (checked.ok) return { value: checked.value, usage, attempts: attempt };
      lastErrors = checked.errors;
    }
    prompt.messages = [
      ...prompt.messages,
      { role: 'assistant', content: clip(res.text, 2000) },
      { role: 'user', content: `That reply can't be used: ${lastErrors.slice(0, 5).join('; ')}. Reply again with corrected JSON only.` },
    ];
  }
  throw new AiOutputError(lastErrors);
}
