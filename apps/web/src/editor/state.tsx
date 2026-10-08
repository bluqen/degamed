import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ProjectManifest, type Entity, type ProjectFiles, type Scene } from '@degamed/shared';
import { usePlayFrame } from '../lib/play';
import { saveDraft } from '../lib/project-files';
import * as H from './history';
import { parseScene, serializeScene } from './scene-ops';
import { fileType } from './file-tree';

export type Workspace = 'scene' | 'game' | 'code' | 'art';
export type Tool = 'select' | 'move' | 'rotate' | 'scale' | 'pan' | 'ruler';
export type BottomTab = 'console' | 'problems' | 'animation';
export type RightTab = 'properties' | 'history';

export type DialogState =
  | null
  | { type: 'add-entity'; parentId: string | null; afterId: string | null; at?: { x: number; y: number } }
  | { type: 'settings'; section?: string }
  | { type: 'palette' }
  | { type: 'shortcuts' }
  | { type: 'new-script'; attachTo?: string[] }
  | { type: 'new-scene' }
  | { type: 'rename-file'; path: string }
  | { type: 'confirm'; title: string; body: ReactNode; confirm: string; danger?: boolean; onConfirm: () => void };

export interface Layout {
  left: number;
  right: number;
  bottom: number;
  /** Fraction of the left dock given to the hierarchy (the rest is files). */
  leftSplit: number;
  showLeft: boolean;
  showRight: boolean;
  showBottom: boolean;
}

export interface ViewOptions {
  grid: boolean;
  snap: boolean;
  step: number;
  rotateSnap: boolean;
  rulers: boolean;
}

const LAYOUT_KEY = 'degamed.editor.layout.v1';
const DEFAULT_LAYOUT: Layout = { left: 264, right: 300, bottom: 200, leftSplit: 0.55, showLeft: true, showRight: true, showBottom: true };
const DEFAULT_VIEW: ViewOptions = { grid: true, snap: false, step: 16, rotateSnap: true, rulers: true };

function readStored<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : fallback;
  } catch {
    return fallback;
  }
}
function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: layout just won't be remembered.
  }
}

export function useEditorState(projectId: string, initial: ProjectFiles) {
  const [history, setHistory] = useState(() => H.startHistory(initial));
  const files = H.current(history);
  const [saved, setSaved] = useState(true);

  const manifest = useMemo(() => {
    try {
      const r = ProjectManifest.safeParse(JSON.parse(files['project.json'] ?? ''));
      return r.success ? r.data : null;
    } catch {
      return null;
    }
  }, [files]);
  const startScene = manifest?.startScene ?? 'scenes/main.scene.json';

  const [openScenes, setOpenScenes] = useState<string[]>([startScene]);
  const [scenePath, setScenePath] = useState(startScene);
  const [selection, setSelection] = useState<string[]>([]);
  const [workspace, setWorkspace] = useState<Workspace>('scene');
  const [codeFile, setCodeFile] = useState<string>(() => Object.keys(initial).find((p) => p.endsWith('.js')) ?? 'project.json');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [framesFile, setFramesFile] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [bottomTab, setBottomTab] = useState<BottomTab>('console');
  const [rightTab, setRightTab] = useState<RightTab>('properties');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [clipboard, setClipboard] = useState<Entity[] | null>(null);
  const [layout, setLayoutState] = useState<Layout>(() => readStored(LAYOUT_KEY, DEFAULT_LAYOUT));
  const [view, setViewState] = useState<ViewOptions>(() => readStored(`${LAYOUT_KEY}.view`, DEFAULT_VIEW));
  const [focusMode, setFocusMode] = useState(false);
  const [running, setRunning] = useState<'stopped' | 'running' | 'paused'>('stopped');
  /** Bumped to ask the scene view to frame something ("all" or the selection). */
  const [frameRequest, setFrameRequest] = useState<{ what: 'all' | 'selection'; n: number }>({ what: 'all', n: 0 });

  const hotkeys = useRef<(key: 'F5' | 'F6' | 'F7' | 'F8') => void>(() => {});
  const play = usePlayFrame(files, { autoLoad: false, onHotkey: (k) => hotkeys.current(k) });
  /** World point at the middle of the scene view, kept current by the view (for placing new things). */
  const viewCenter = useRef({ x: 240, y: 135 });

  // Autosave to this device, a moment after the last change.
  const saveTimer = useRef<number>(undefined);
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => setSaved(saveDraft(projectId, files)), 300);
    return () => window.clearTimeout(saveTimer.current);
  }, [projectId, files]);

  const setLayout = useCallback((patch: Partial<Layout>) => {
    setLayoutState((l) => {
      const next = { ...l, ...patch };
      writeStored(LAYOUT_KEY, next);
      return next;
    });
  }, []);
  const setView = useCallback((patch: Partial<ViewOptions>) => {
    setViewState((v) => {
      const next = { ...v, ...patch };
      writeStored(`${LAYOUT_KEY}.view`, next);
      return next;
    });
  }, []);

  const commit = useCallback((next: ProjectFiles, label: string, mergeKey?: string) => {
    setSaved(false);
    setHistory((h) => H.commit(h, next, label, mergeKey));
  }, []);

  /** Like commit, but computed from the latest files (safe inside rapid events). */
  const commitWith = useCallback((fn: (files: ProjectFiles) => ProjectFiles | null, label: string, mergeKey?: string) => {
    setHistory((h) => {
      const next = fn(H.current(h));
      if (!next) return h;
      setSaved(false);
      return H.commit(h, next, label, mergeKey);
    });
  }, []);

  const sceneState = useMemo(() => parseScene(files[scenePath]), [files, scenePath]);
  const scene = sceneState.scene;

  /** Applies `fn` to the open scene and records it as one undo step. */
  const editScene = useCallback(
    (fn: (scene: Scene) => Scene, label: string, mergeKey?: string) => {
      commitWith((f) => {
        const { scene: s } = parseScene(f[scenePath]);
        if (!s) return null;
        const next = fn(s);
        return next === s ? null : { ...f, [scenePath]: serializeScene(next) };
      }, label, mergeKey);
    },
    [commitWith, scenePath],
  );

  const seal = useCallback(() => setHistory((h) => H.seal(h)), []);
  const undo = useCallback(() => setHistory((h) => H.undo(h)), []);
  const redo = useCallback(() => setHistory((h) => H.redo(h)), []);
  const jumpTo = useCallback((step: number) => setHistory((h) => H.jumpTo(h, step)), []);

  // Drop selected ids that no longer exist (after undo, delete, scene switch).
  useEffect(() => {
    if (!scene) return;
    const ids = new Set<string>();
    const visit = (list: Entity[]) => list.forEach((e) => (ids.add(e.id), visit(e.children)));
    visit(scene.entities);
    setSelection((sel) => (sel.every((id) => ids.has(id)) ? sel : sel.filter((id) => ids.has(id))));
  }, [scene]);

  const openScene = useCallback((path: string) => {
    setOpenScenes((list) => (list.includes(path) ? list : [...list, path]));
    setScenePath(path);
    setSelection([]);
    setWorkspace('scene');
  }, []);

  const closeScene = useCallback(
    (path: string) => {
      setOpenScenes((list) => {
        const next = list.filter((p) => p !== path);
        if (path === scenePath) setScenePath(next[next.length - 1] ?? startScene);
        return next.length ? next : [startScene];
      });
    },
    [scenePath, startScene],
  );

  /** Opens any project file in the place that edits it. */
  const openFile = useCallback(
    (path: string) => {
      setSelectedFile(path);
      switch (fileType(path)) {
        case 'scene':
          openScene(path);
          break;
        case 'frames':
          setFramesFile(path);
          setBottomTab('animation');
          setLayout({ showBottom: true });
          break;
        case 'image':
        case 'audio':
          setWorkspace('art');
          break;
        case 'config':
          setDialog({ type: 'settings' });
          break;
        default:
          setCodeFile(path);
          setWorkspace('code');
      }
    },
    [openScene, setLayout],
  );

  const run = useCallback(
    (which: 'project' | 'scene' = 'project', scene = scenePath) => {
      let toRun = files;
      if (which === 'scene' && manifest && scene !== manifest.startScene) {
        toRun = { ...files, 'project.json': JSON.stringify({ ...manifest, startScene: scene }, null, 2) };
      }
      setWorkspace('game');
      setRunning('running');
      play.run(toRun);
    },
    [files, manifest, scenePath, play],
  );
  const stop = useCallback(() => {
    play.pause();
    setRunning('stopped');
    setWorkspace((w) => (w === 'game' ? 'scene' : w));
  }, [play]);
  const togglePause = useCallback(() => {
    if (running === 'running') {
      play.pause();
      setRunning('paused');
    } else if (running === 'paused') {
      play.resume();
      setRunning('running');
    }
  }, [running, play]);

  hotkeys.current = (k) => {
    if (k === 'F5') run('project');
    else if (k === 'F6') run('scene');
    else if (k === 'F7') togglePause();
    else stop();
  };

  return {
    projectId,
    files,
    manifest,
    history,
    saved,
    commit,
    commitWith,
    seal,
    undo,
    redo,
    jumpTo,
    canUndo: history.past.length > 1,
    canRedo: history.future.length > 0,
    scenePath,
    startScene,
    openScenes,
    openScene,
    closeScene,
    scene,
    sceneError: sceneState.error,
    editScene,
    selection,
    select: setSelection,
    workspace,
    setWorkspace,
    codeFile,
    setCodeFile,
    selectedFile,
    setSelectedFile,
    framesFile,
    setFramesFile,
    openFile,
    tool,
    setTool,
    bottomTab,
    setBottomTab,
    rightTab,
    setRightTab,
    dialog,
    setDialog,
    clipboard,
    setClipboard,
    layout,
    setLayout,
    view,
    setView,
    focusMode,
    setFocusMode,
    frameRequest,
    requestFrame: (what: 'all' | 'selection') => setFrameRequest((r) => ({ what, n: r.n + 1 })),
    viewCenter,
    play,
    running,
    run,
    stop,
    togglePause,
  };
}

export type Ed = ReturnType<typeof useEditorState>;

const EdContext = createContext<Ed | null>(null);
export function EdProvider({ value, children }: { value: Ed; children: ReactNode }) {
  return <EdContext.Provider value={value}>{children}</EdContext.Provider>;
}
export function useEd(): Ed {
  const ed = useContext(EdContext);
  if (!ed) throw new Error('useEd outside EdProvider');
  return ed;
}

/** Image files as data URLs, keyed by path. */
export function useImages(files: ProjectFiles) {
  return useMemo(() => Object.fromEntries(Object.entries(files).filter(([, v]) => v.startsWith('data:image/'))), [files]);
}
