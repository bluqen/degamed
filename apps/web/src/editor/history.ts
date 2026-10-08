import type { ProjectFiles } from '@degamed/shared';

/**
 * Undo/redo over whole project snapshots. Snapshots share unchanged file strings,
 * so keeping a few hundred of them costs little memory.
 */
export interface HistoryEntry {
  files: ProjectFiles;
  label: string;
  /** Edits with the same key in a row (dragging, typing) merge into one undo step. */
  mergeKey?: string;
  at: number;
}

export interface HistoryState {
  /** past[past.length - 1] is the current state. */
  past: HistoryEntry[];
  future: HistoryEntry[];
}

const LIMIT = 200;
const MERGE_WINDOW_MS = 1500;

export function startHistory(files: ProjectFiles, label = 'Open project'): HistoryState {
  return { past: [{ files, label, at: Date.now() }], future: [] };
}

export function current(h: HistoryState): ProjectFiles {
  return h.past[h.past.length - 1]!.files;
}

export function commit(h: HistoryState, files: ProjectFiles, label: string, mergeKey?: string, now = Date.now()): HistoryState {
  const top = h.past[h.past.length - 1]!;
  if (files === top.files) return h;
  if (mergeKey && top.mergeKey === mergeKey && now - top.at < MERGE_WINDOW_MS && h.past.length > 1) {
    return { past: [...h.past.slice(0, -1), { files, label, mergeKey, at: now }], future: [] };
  }
  const past = [...h.past, { files, label, mergeKey, at: now }];
  return { past: past.length > LIMIT ? past.slice(past.length - LIMIT) : past, future: [] };
}

export function undo(h: HistoryState): HistoryState {
  if (h.past.length < 2) return h;
  return { past: h.past.slice(0, -1), future: [h.past[h.past.length - 1]!, ...h.future] };
}

export function redo(h: HistoryState): HistoryState {
  const [next, ...rest] = h.future;
  if (!next) return h;
  return { past: [...h.past, next], future: rest };
}

/** Jumps to a step: 0…past.length-1 are in the past, past.length… are redo steps. */
export function jumpTo(h: HistoryState, step: number): HistoryState {
  let s = h;
  while (s.past.length - 1 > step && s.past.length > 1) s = undo(s);
  while (s.past.length - 1 < step && s.future.length) s = redo(s);
  return s;
}

/** Ends merging, so the next edit starts its own undo step (e.g. on pointer up). */
export function seal(h: HistoryState): HistoryState {
  const top = h.past[h.past.length - 1]!;
  if (!top.mergeKey) return h;
  return { ...h, past: [...h.past.slice(0, -1), { ...top, mergeKey: undefined }] };
}
