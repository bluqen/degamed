/**
 * Text model providers.
 *
 * - `instant`: no model at all (see instant.ts).
 * - `gemini`, `openai`, `anthropic`: bring-your-own-key, called straight from the browser. Keys
 *   never touch Degamed's servers.
 * - `degamed`: hosted, through our Worker (`POST /ai/generate`, Cloudflare Workers AI, capped).
 *
 * Every provider is used the same way: run a TaskRequest, get a validated result.
 */
import {
  runTask,
  validateOutput,
  type ModelCall,
  type ModelCallInput,
  type TaskKind,
  type TaskOutput,
  type TaskRequest,
  type Usage,
} from './protocol';
import { AiOutputError } from './protocol';

export type ProviderId = 'instant' | 'gemini' | 'openai' | 'anthropic' | 'degamed';

export interface AiSettings {
  provider: ProviderId;
  apiKey?: string;
  model?: string;
  /** Degamed API base URL (for `degamed`). */
  apiUrl?: string;
  /** Supabase access token (for `degamed`). */
  authToken?: string;
}

export const DEFAULT_MODELS: Record<Exclude<ProviderId, 'instant' | 'degamed'>, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-haiku-4-5',
};

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  instant: 'Instant (free, no AI)',
  degamed: 'Degamed AI (free daily)',
  gemini: 'Google Gemini (your key)',
  openai: 'OpenAI (your key)',
  anthropic: 'Anthropic Claude (your key)',
};

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly provider?: ProviderId,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

const NAMES: Record<ProviderId, string> = { instant: 'Instant mode', degamed: 'Degamed AI', gemini: 'Gemini', openai: 'OpenAI', anthropic: 'Claude' };

async function failure(res: Response, provider: ProviderId): Promise<ProviderError> {
  let detail = '';
  try {
    const body = (await res.json()) as { error?: { message?: string } | string };
    detail = typeof body.error === 'string' ? body.error : (body.error?.message ?? '');
  } catch {
    // Non-JSON error body; the status code is enough.
  }
  const name = NAMES[provider];
  if (provider === 'degamed' && detail && (res.status === 429 || res.status === 400 || res.status === 401)) {
    return new ProviderError(detail, res.status, provider);
  }
  if (res.status === 401 || res.status === 403) return new ProviderError(`${name} rejected the API key. Check it in Settings.`, res.status, provider);
  if (res.status === 429) return new ProviderError(`${name} is busy or out of quota right now. Try again in a minute.`, res.status, provider);
  return new ProviderError(`${name} failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`, res.status, provider);
}

const post = (url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal });

export function geminiModel(apiKey: string, model = DEFAULT_MODELS.gemini): ModelCall {
  return async (i: ModelCallInput) => {
    const res = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { 'x-goog-api-key': apiKey },
      {
        systemInstruction: { parts: [{ text: i.system }] },
        contents: i.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: i.maxTokens,
          temperature: 0.8,
          // No hidden "thinking" tokens: the spec is short and thinking would multiply the cost.
          ...(/2\.5/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      },
      i.signal,
    );
    if (!res.ok) throw await failure(res, 'gemini');
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const u = body.usageMetadata;
    return { text, usage: u?.promptTokenCount !== undefined ? { inputTokens: u.promptTokenCount, outputTokens: u.candidatesTokenCount ?? 0 } : undefined };
  };
}

export function openaiModel(apiKey: string, model = DEFAULT_MODELS.openai): ModelCall {
  return async (i) => {
    const res = await post(
      'https://api.openai.com/v1/chat/completions',
      { Authorization: `Bearer ${apiKey}` },
      {
        model,
        messages: [{ role: 'system', content: i.system }, ...i.messages],
        response_format: { type: 'json_object' },
        max_completion_tokens: i.maxTokens,
      },
      i.signal,
    );
    if (!res.ok) throw await failure(res, 'openai');
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const u = body.usage;
    return {
      text: body.choices?.[0]?.message?.content ?? '',
      usage: u?.prompt_tokens !== undefined ? { inputTokens: u.prompt_tokens, outputTokens: u.completion_tokens ?? 0 } : undefined,
    };
  };
}

export function anthropicModel(apiKey: string, model = DEFAULT_MODELS.anthropic): ModelCall {
  return async (i) => {
    const res = await post(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      {
        model,
        max_tokens: i.maxTokens,
        // The system prompt is the stable prefix; mark it cacheable for repeat calls.
        system: [{ type: 'text', text: i.system, cache_control: { type: 'ephemeral' } }],
        messages: i.messages,
      },
      i.signal,
    );
    if (!res.ok) throw await failure(res, 'anthropic');
    const body = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
    const u = body.usage;
    return {
      text: (body.content ?? []).map((c) => (c.type === 'text' ? (c.text ?? '') : '')).join(''),
      usage: u?.input_tokens !== undefined ? { inputTokens: u.input_tokens, outputTokens: u.output_tokens ?? 0 } : undefined,
    };
  };
}

export interface TaskResult<K extends TaskKind> {
  value: TaskOutput<K>;
  usage: Usage;
  attempts: number;
}
export type TaskRunner = <R extends TaskRequest>(req: R, signal?: AbortSignal) => Promise<TaskResult<R['task']>>;

/** The hosted tier. The Worker builds the prompt, calls Workers AI and validates; we re-validate. */
export function degamedRunner(apiUrl: string, authToken: string | undefined): TaskRunner {
  return async (req, signal) => {
    const res = await post(`${apiUrl.replace(/\/$/, '')}/ai/generate`, authToken ? { Authorization: `Bearer ${authToken}` } : {}, req, signal);
    if (!res.ok) throw await failure(res, 'degamed');
    const body = (await res.json()) as { result?: unknown; usage?: Usage; attempts?: number };
    const checked = validateOutput(req, body.result);
    if (!checked.ok) throw new AiOutputError(checked.errors);
    return {
      value: checked.value,
      usage: body.usage ?? { inputTokens: 0, outputTokens: 0, estimated: true, calls: 1 },
      attempts: body.attempts ?? 1,
    };
  };
}

/** Builds the runner for the chosen provider, or null for instant mode. */
export function runnerFor(settings: AiSettings): TaskRunner | null {
  const p = settings.provider;
  if (p === 'instant') return null;
  if (p === 'degamed') {
    if (!settings.apiUrl) throw new ProviderError('Degamed AI is not set up on this site.', undefined, p);
    return degamedRunner(settings.apiUrl, settings.authToken);
  }
  if (!settings.apiKey) throw new ProviderError(`Add your ${NAMES[p]} key in Settings first.`, undefined, p);
  const call = p === 'gemini' ? geminiModel(settings.apiKey, settings.model) : p === 'openai' ? openaiModel(settings.apiKey, settings.model) : anthropicModel(settings.apiKey, settings.model);
  return (req, signal) => runTask(req, call, signal);
}

/**
 * Providers the user can use right now, best first: their own keys (unlimited), then the hosted
 * free tier, then instant mode (always available, offline).
 */
export function availableProviders(keys: Record<string, string | undefined>, hosted: boolean): ProviderId[] {
  const out: ProviderId[] = [];
  for (const p of ['gemini', 'anthropic', 'openai'] as const) if (keys[p]?.trim()) out.push(p);
  if (hosted) out.push('degamed');
  out.push('instant');
  return out;
}
