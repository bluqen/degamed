/**
 * The games someone has made on this device. Each game's files live in its draft
 * (see project-files.ts); this index keeps the list for the Home screen.
 */
import type { ProjectFiles } from '@degamed/shared';
import { loadDraft, saveDraft, clearDraft } from './project-files';

export interface GameEntry {
  id: string;
  title: string;
  prompt: string;
  kit: string;
  theme: string;
  createdAt: number;
  updatedAt: number;
}

const KEY = 'degamed.library.v1';

export function listGames(): GameEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as GameEntry[]) : [];
    return Array.isArray(list)
      ? list.filter((g) => g && typeof g.id === 'string').sort((a, b) => b.updatedAt - a.updatedAt)
      : [];
  } catch {
    return [];
  }
}

function writeList(list: GameEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 60)));
  } catch {
    // Storage full or blocked: the list just isn't remembered.
  }
}

export function getGame(id: string): GameEntry | null {
  return listGames().find((g) => g.id === id) ?? null;
}

export function newGameId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `g${Date.now().toString(36)}${rand}`;
}

/** Saves the files and upserts the entry. Returns false when the device is out of space. */
export function saveGame(
  entry: Omit<GameEntry, 'createdAt' | 'updatedAt'> & Partial<Pick<GameEntry, 'createdAt'>>,
  files: ProjectFiles,
): boolean {
  const ok = saveDraft(entry.id, files);
  const list = listGames();
  const prev = list.find((g) => g.id === entry.id);
  const now = Date.now();
  const next: GameEntry = {
    createdAt: prev?.createdAt ?? entry.createdAt ?? now,
    ...prev,
    ...entry,
    updatedAt: now,
  };
  writeList([next, ...list.filter((g) => g.id !== entry.id)]);
  return ok;
}

export function touchGame(id: string, patch: Partial<Omit<GameEntry, 'id'>>) {
  const list = listGames();
  const prev = list.find((g) => g.id === id);
  if (!prev) return;
  writeList([{ ...prev, ...patch, updatedAt: Date.now() }, ...list.filter((g) => g.id !== id)]);
}

export function removeGame(id: string) {
  clearDraft(id);
  writeList(listGames().filter((g) => g.id !== id));
}

export function loadGameFiles(id: string): ProjectFiles | null {
  return loadDraft(id);
}
