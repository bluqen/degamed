import { z } from 'zod';
import { ProjectFiles } from './project';

/**
 * Messages between the editor (host) and the sandboxed play iframe.
 * Every message carries `channel: 'degamed'` so unrelated postMessage traffic is ignored.
 */
const base = { channel: z.literal('degamed') };

export const HostToPlay = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('load'), files: ProjectFiles }),
  z.object({ ...base, type: z.literal('play') }),
  z.object({ ...base, type: z.literal('pause') }),
  z.object({ ...base, type: z.literal('step') }),
  z.object({ ...base, type: z.literal('restart') }),
  z.object({ ...base, type: z.literal('screenshot'), requestId: z.string() }),
]);
export type HostToPlay = z.infer<typeof HostToPlay>;

export const PlayToHost = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('ready'), engineVersion: z.string() }),
  z.object({
    ...base,
    type: z.literal('log'),
    level: z.enum(['info', 'warn', 'error']),
    message: z.string(),
    source: z.string().optional(),
  }),
  z.object({
    ...base,
    type: z.literal('error'),
    message: z.string(),
    stack: z.string().optional(),
    file: z.string().optional(),
    line: z.number().int().optional(),
  }),
  z.object({ ...base, type: z.literal('fps'), fps: z.number() }),
  /** Editor shortcuts pressed while the game has focus (keys inside the iframe never reach the editor). */
  z.object({ ...base, type: z.literal('hotkey'), key: z.enum(['F5', 'F6', 'F7', 'F8']) }),
  z.object({
    ...base,
    type: z.literal('screenshot'),
    requestId: z.string(),
    dataUrl: z.string().startsWith('data:image/'),
  }),
]);
export type PlayToHost = z.infer<typeof PlayToHost>;

/** Parses an untrusted postMessage payload. Returns null for anything that isn't ours. */
export function parsePlayMessage(data: unknown): PlayToHost | null {
  const result = PlayToHost.safeParse(data);
  return result.success ? result.data : null;
}

export function parseHostMessage(data: unknown): HostToPlay | null {
  const result = HostToPlay.safeParse(data);
  return result.success ? result.data : null;
}
