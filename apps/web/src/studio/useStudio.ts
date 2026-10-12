import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectFiles } from '@degamed/shared';
import { buildGame, demoGame, encode, readSpec, type GameSpec } from '../lib/game';
import { getGame, loadGameFiles, saveGame, touchGame } from '../lib/library';
import { saveDraft } from '../lib/project-files';

export const DEMO_ID = 'demo';

export type LoadState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; files: ProjectFiles; title: string };

/** Loads a game for the Studio: the demo, a game saved on this device, or nothing. */
export function loadForStudio(id: string): LoadState {
  if (id === DEMO_ID) {
    const files = loadGameFiles(DEMO_ID) ?? demoGame();
    return { status: 'ready', files, title: titleOf(files) ?? 'Demo game' };
  }
  const files = loadGameFiles(id);
  if (!files) return { status: 'missing' };
  return { status: 'ready', files, title: getGame(id)?.title ?? titleOf(files) ?? 'My game' };
}

function titleOf(files: ProjectFiles): string | null {
  try {
    return (JSON.parse(files['project.json'] ?? '{}') as { title?: string }).title ?? null;
  } catch {
    return null;
  }
}

function withTitle(files: ProjectFiles, title: string): ProjectFiles {
  const next = { ...files };
  try {
    next['project.json'] = JSON.stringify(
      { ...JSON.parse(files['project.json'] ?? '{}'), title },
      null,
      2,
    );
    const spec = readSpec(files);
    if (spec) next['game.spec.json'] = JSON.stringify({ ...spec, title }, null, 2);
  } catch {
    // A broken project.json stays as it is; Advanced can fix it.
  }
  return next;
}

interface Snapshot {
  files: ProjectFiles;
  label: string;
}

/**
 * Studio state: the current files, an undo stack, the spec (if the game came from a kit) and
 * spec edits that rebuild the game. Everything autosaves to this device.
 */
export function useStudio(id: string, initial: ProjectFiles, initialTitle: string) {
  const [files, setFiles] = useState(initial);
  const [title, setTitleState] = useState(initialTitle);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [saved, setSaved] = useState(true);
  const spec = useMemo(() => readSpec(files), [files]);
  /** Params shown in the Tune panel; may run ahead of `files` while a rebuild is debounced. */
  const [draftParams, setDraftParams] = useState<GameSpec['params']>(spec?.params ?? {});
  const lastKey = useRef<{ key: string; at: number } | null>(null);
  const rebuildTimer = useRef<number>(undefined);

  useEffect(() => {
    setDraftParams(spec?.params ?? {});
  }, [spec]);

  // Autosave a moment after each change.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const ok = id === DEMO_ID ? saveDraft(DEMO_ID, files) : saveDraft(id, files);
      setSaved(ok);
    }, 250);
    return () => window.clearTimeout(t);
  }, [id, files]);

  const filesRef = useRef(files);
  filesRef.current = files;
  const pastRef = useRef(past);
  pastRef.current = past;

  /** Replaces the files. Changes with the same `coalesce` key within a second share one undo step. */
  const apply = useCallback((next: ProjectFiles, label: string, coalesce?: string) => {
    const now = Date.now();
    const merge = coalesce && lastKey.current?.key === coalesce && now - lastKey.current.at < 1200;
    lastKey.current = coalesce ? { key: coalesce, at: now } : null;
    if (!merge) setPast((p) => [...p.slice(-49), { files: filesRef.current, label }]);
    filesRef.current = next;
    setFiles(next);
  }, []);

  const undo = useCallback(() => {
    const last = pastRef.current[pastRef.current.length - 1];
    if (!last) return;
    lastKey.current = null;
    setPast((p) => p.slice(0, -1));
    filesRef.current = last.files;
    setFiles(last.files);
  }, []);

  const specRef = useRef(spec);
  specRef.current = spec;
  const draftRef = useRef(draftParams);
  draftRef.current = draftParams;

  const rebuild = useCallback(
    (patch: Partial<GameSpec>, label: string, coalesce?: string) => {
      const s = specRef.current;
      if (!s) return;
      apply(
        buildGame({ ...s, ...patch, params: { ...s.params, ...patch.params } }, encode),
        label,
        coalesce,
      );
    },
    [apply],
  );

  const setParam = useCallback(
    (key: string, value: number | boolean | string, label: string) => {
      const next = { ...draftRef.current, [key]: value };
      draftRef.current = next;
      setDraftParams(next);
      window.clearTimeout(rebuildTimer.current);
      rebuildTimer.current = window.setTimeout(
        () => rebuild({ params: draftRef.current }, label, `param:${key}`),
        typeof value === 'number' ? 180 : 0,
      );
    },
    [rebuild],
  );

  const resetParams = useCallback(
    (defaults: Record<string, number | boolean | string>) => {
      draftRef.current = defaults;
      setDraftParams(defaults);
      const s = specRef.current;
      if (s) apply(buildGame({ ...s, params: defaults }, encode), 'Reset tuning');
    },
    [apply],
  );

  const setTheme = useCallback(
    (theme: string, name: string) => rebuild({ theme }, `Change the look to ${name}`),
    [rebuild],
  );

  const setTitle = useCallback(
    (t: string) => {
      const clean = t.replace(/\s+/g, ' ').trim().slice(0, 60) || 'Untitled game';
      setTitleState(clean);
      apply(withTitle(files, clean), 'Rename', 'title');
      if (id !== DEMO_ID) touchGame(id, { title: clean });
    },
    [apply, files, id],
  );

  /** Keeps the library entry in step (theme shown on the Home card). */
  useEffect(() => {
    if (id === DEMO_ID || !spec) return;
    const entry = getGame(id);
    if (entry && (entry.theme !== spec.theme || entry.kit !== spec.kit))
      touchGame(id, { theme: spec.theme, kit: spec.kit });
    if (!entry)
      saveGame({ id, title, prompt: spec.story ?? '', kit: spec.kit, theme: spec.theme }, files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, spec?.theme, spec?.kit]);

  return {
    id,
    files,
    title,
    spec,
    draftParams,
    saved,
    canUndo: past.length > 0,
    undoLabel: past[past.length - 1]?.label,
    apply,
    undo,
    setParam,
    resetParams,
    setTheme,
    setTitle,
    rebuild,
  };
}

export type Studio = ReturnType<typeof useStudio>;
