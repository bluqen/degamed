/**
 * Targeted file edits and spec rebuilds that keep the player's custom changes.
 *
 * The AI never rewrites whole files. Code changes are `{ path, find, replace }` edits, and every
 * applied edit is recorded in `game.mods.json` so it can be replayed when the game is rebuilt
 * from its spec (for example after "make it night" regenerates the scene).
 */
import type { ProjectFiles } from '@degamed/shared';
import type { FileEdit } from './protocol';

export const MODS_FILE = 'game.mods.json';

export interface Mod extends FileEdit {
  /** The chat request that produced the edit. */
  request?: string;
}

export class EditError extends Error {
  constructor(
    message: string,
    readonly edit: FileEdit,
  ) {
    super(message);
    this.name = 'EditError';
  }
}

/** Is this a text file the AI may read and edit (scripts, scenes, data; not images)? */
export const isTextFile = (path: string, content: string) => !content.startsWith('data:') && /\.(js|py|json|txt|md)$/.test(path);
export const isScript = (path: string) => /\.(js|py)$/.test(path);

/** Applies edits in order. Throws EditError if a `find` isn't present exactly once. */
export function applyEdits(files: ProjectFiles, edits: FileEdit[]): ProjectFiles {
  const out = { ...files };
  for (const e of edits) {
    const text = out[e.path];
    if (text === undefined) throw new EditError(`${e.path} doesn't exist`, e);
    const at = text.indexOf(e.find);
    if (at < 0) throw new EditError(`Couldn't find the text to change in ${e.path}`, e);
    if (text.indexOf(e.find, at + 1) >= 0) throw new EditError(`The text to change appears more than once in ${e.path}`, e);
    out[e.path] = text.slice(0, at) + e.replace + text.slice(at + e.find.length);
  }
  return out;
}

export function readMods(files: ProjectFiles): Mod[] {
  try {
    const mods = JSON.parse(files[MODS_FILE] ?? '[]') as unknown;
    return Array.isArray(mods) ? mods.filter((m): m is Mod => !!m && typeof m.path === 'string' && typeof m.find === 'string' && typeof m.replace === 'string') : [];
  } catch {
    return [];
  }
}

export function writeMods(files: ProjectFiles, mods: Mod[]): ProjectFiles {
  const out = { ...files };
  if (mods.length) out[MODS_FILE] = JSON.stringify(mods, null, 2);
  else delete out[MODS_FILE];
  return out;
}

/** Replays recorded mods on freshly built files, skipping ones that no longer apply. */
export function replayMods(files: ProjectFiles, mods: Mod[]): { files: ProjectFiles; kept: Mod[]; dropped: Mod[] } {
  let out = files;
  const kept: Mod[] = [];
  const dropped: Mod[] = [];
  for (const m of mods) {
    if (out[m.path]?.includes(m.replace) && !out[m.path]?.includes(m.find)) {
      kept.push(m); // already applied (the file was carried over unchanged)
      continue;
    }
    try {
      out = applyEdits(out, [m]);
      kept.push(m);
    } catch {
      dropped.push(m);
    }
  }
  return { files: out, kept, dropped };
}

/**
 * Three-way merge at file level after a spec change.
 * - base: what the old spec built; ours: the current project; theirs: what the new spec builds.
 * A file the player (or an AI edit) changed is kept unless the new spec also changes it; then the
 * new version wins and recorded mods are replayed on top.
 */
export function mergeRebuild(base: ProjectFiles, ours: ProjectFiles, theirs: ProjectFiles): { files: ProjectFiles; dropped: Mod[] } {
  const out: ProjectFiles = {};
  const paths = new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)]);
  for (const p of paths) {
    const b = base[p];
    const o = ours[p];
    const t = theirs[p];
    if (o === undefined) {
      // Deleted by the player: stay deleted unless it's new in the rebuild.
      if (t !== undefined && b === undefined) out[p] = t;
      continue;
    }
    if (b === undefined) {
      out[p] = t ?? o; // added by the player (or new in both)
      continue;
    }
    if (o === b) {
      if (t !== undefined) out[p] = t;
      continue;
    }
    // Changed by the player.
    out[p] = t === b || t === undefined ? o : t;
  }
  const mods = readMods(ours);
  const { files, kept, dropped } = replayMods(out, mods);
  return { files: writeMods(files, kept), dropped };
}

/** Paths whose content differs between two projects (added, changed or removed). */
export function changedPaths(before: ProjectFiles, after: ProjectFiles): string[] {
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...paths].filter((p) => before[p] !== after[p]).sort();
}
