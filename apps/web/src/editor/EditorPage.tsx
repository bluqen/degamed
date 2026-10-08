import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Code2, Gamepad2, LayoutTemplate, Palette, Pause, Play, Plus, Square, Star, X, Clapperboard, Upload } from 'lucide-react';
import type { ProjectFiles } from '@degamed/shared';
import { LogoMark } from '../components/Logo';
import { getProject, type ProjectRow } from '../lib/projects';
import { isAuthConfigured } from '../lib/env';
import { loadDraft, starterProject } from '../lib/project-files';
import { EdProvider, useEd, useEditorState, type Workspace } from './state';
import { buildCommands, handleShortcut, keyLabel, type Command } from './commands';
import { ContextMenuProvider, MenuBar, Splitter, useContextMenu, type MenuItem } from './ui';
import { SceneView } from './SceneView';
import { HierarchyDock } from './HierarchyDock';
import { FilesDock } from './FilesDock';
import { RightDock } from './PropertiesDock';
import { BottomPanel } from './BottomPanel';
import { CodeWorkspace } from './CodeWorkspace';
import { ArtWorkspace } from './ArtWorkspace';
import { GameView } from './GameView';
import { Dialogs } from './dialogs';
import { SimpleMode } from './SimpleMode';
import { displayName } from './file-tree';

type Mode = 'simple' | 'pro';
const MODE_KEY = 'degamed.editor.mode';

export function EditorPage() {
  const { id = 'demo' } = useParams();
  const isDemo = id === 'demo';
  const [project, setProject] = useState<ProjectRow | null | undefined>(isDemo ? null : undefined);
  const [initial, setInitial] = useState<ProjectFiles | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo || !isAuthConfigured) return;
    getProject(id)
      .then(setProject)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Could not load project'));
  }, [id, isDemo]);

  useEffect(() => {
    if (project === undefined && !isDemo && isAuthConfigured) return;
    setInitial(loadDraft(id) ?? starterProject(project?.title ?? 'Starter Platformer'));
  }, [id, isDemo, project]);

  const title = isDemo ? 'Demo: Starter Platformer' : (project?.title ?? 'Loading…');
  if (!initial) return <div className="flex h-screen items-center justify-center bg-bg text-muted">Opening {title}…</div>;
  return (
    <ContextMenuProvider>
      <Shell key={id} projectId={id} initial={initial} title={title} isDemo={isDemo} banner={loadError ?? (project === null && !isDemo ? 'This project doesn’t exist or you don’t have access.' : null)} />
    </ContextMenuProvider>
  );
}

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 899px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

function Shell({ projectId, initial, title, isDemo, banner }: { projectId: string; initial: ProjectFiles; title: string; isDemo: boolean; banner: string | null }) {
  const ed = useEditorState(projectId, initial);
  const narrow = useNarrow();
  const [modePref, setModePref] = useState<Mode>(() => {
    try {
      return localStorage.getItem(MODE_KEY) === 'simple' ? 'simple' : 'pro';
    } catch {
      return 'pro';
    }
  });
  const mode: Mode = narrow ? 'simple' : modePref;
  const setMode = (m: Mode) => {
    setModePref(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // Storage blocked.
    }
  };

  const commands = useMemo(() => buildCommands(ed), [ed]);

  // Keyboard shortcuts (not while a dialog is open; dialogs handle their own keys).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ed.dialog || mode !== 'pro') return;
      handleShortcut(e, commands, ed);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commands, ed, mode]);

  useEffect(() => {
    document.title = `${title} · Degamed`;
  }, [title]);

  return (
    <EdProvider value={ed}>
      <div className="flex h-screen flex-col overflow-hidden bg-bg text-[12.5px] text-ink select-none">
        <TopBar title={title} isDemo={isDemo} mode={mode} setMode={setMode} narrow={narrow} commands={commands} />
        {banner && <p className="bg-[#2A1215] px-4 py-1.5 text-bad">{banner}</p>}
        {mode === 'simple' ? <SimpleMode title={title} onOpenPro={() => setMode('pro')} /> : <ProLayout />}
      </div>
      <Dialogs />
    </EdProvider>
  );
}

/* ─── Top bar ─────────────────────────────────────────────────────────── */

const WORKSPACES: { id: Workspace; label: string; icon: ReactNode; key: string }[] = [
  { id: 'scene', label: 'Scene', icon: <LayoutTemplate size={14} />, key: 'Ctrl+1' },
  { id: 'game', label: 'Game', icon: <Gamepad2 size={14} />, key: 'Ctrl+2' },
  { id: 'code', label: 'Code', icon: <Code2 size={14} />, key: 'Ctrl+3' },
  { id: 'art', label: 'Art', icon: <Palette size={14} />, key: 'Ctrl+4' },
];

function TopBar({ title, isDemo, mode, setMode, narrow, commands }: { title: string; isDemo: boolean; mode: Mode; setMode: (m: Mode) => void; narrow: boolean; commands: Command[] }) {
  const ed = useEd();
  const byId = new Map(commands.map((c) => [c.id, c]));
  const item = (id: string, label?: string): MenuItem => {
    const c = byId.get(id)!;
    return { label: label ?? c.label, shortcut: c.shortcut && keyLabel(c.shortcut), disabled: c.enabled === false, checked: c.checked, onSelect: c.run };
  };
  const sep: MenuItem = { type: 'separator' };
  const menus: { label: string; items: MenuItem[] }[] = [
    {
      label: 'Game',
      items: [
        item('scene.new'),
        item('script.new'),
        { label: 'Import Images or Audio…', icon: <Upload size={13} />, onSelect: () => ed.setWorkspace('art') },
        sep,
        {
          type: 'submenu',
          label: 'Open Scene',
          items: Object.keys(ed.files)
            .filter((p) => p.endsWith('.scene.json'))
            .map((p) => ({ label: displayName(p), checked: p === ed.scenePath, onSelect: () => ed.openScene(p) })),
        },
        item('game.save'),
        sep,
        item('game.settings'),
        item('game.input'),
        sep,
        { label: 'Export…', disabled: true, onSelect: () => {} },
        sep,
        { label: isDemo ? 'Back to Home' : 'Back to Dashboard', onSelect: () => (window.location.href = isDemo ? '/' : '/dashboard') },
      ],
    },
    {
      label: 'Edit',
      items: [
        item('edit.undo'),
        item('edit.redo'),
        sep,
        item('edit.cut'),
        item('edit.copy'),
        item('edit.paste'),
        item('edit.duplicate'),
        item('edit.delete'),
        sep,
        item('edit.selectAll'),
        item('edit.deselect'),
        sep,
        { label: 'History', onSelect: () => (ed.setRightTab('history'), ed.setLayout({ showRight: true })) },
      ],
    },
    {
      label: 'Scene',
      items: [
        item('scene.add'),
        sep,
        item('scene.moveUp'),
        item('scene.moveDown'),
        sep,
        item('tool.select'),
        item('tool.move'),
        item('tool.rotate'),
        item('tool.scale'),
        item('tool.pan'),
        item('tool.ruler'),
        sep,
        item('view.snap'),
        item('view.grid'),
      ],
    },
    {
      label: 'View',
      items: [
        item('workspace.scene', 'Scene'),
        item('workspace.game', 'Game'),
        item('workspace.code', 'Code'),
        item('workspace.art', 'Art'),
        sep,
        item('view.frameSel'),
        item('view.frameAll'),
        item('view.rulers'),
        sep,
        item('view.left'),
        item('view.right'),
        item('view.bottom'),
        { label: 'Animation Panel', onSelect: () => (ed.setBottomTab('animation'), ed.setLayout({ showBottom: true })) },
        { label: 'Problems', onSelect: () => (ed.setBottomTab('problems'), ed.setLayout({ showBottom: true })) },
        sep,
        item('view.focus'),
        item('view.reset'),
      ],
    },
    { label: 'Run', items: [item('run.project'), item('run.scene'), sep, item('run.pause'), item('run.stop'), item('run.restart')] },
    {
      label: 'Help',
      items: [
        item('help.palette'),
        item('help.shortcuts'),
        sep,
        { label: 'Scripting Guide', onSelect: () => window.open('https://github.com/bluqen/degamed/blob/main/docs/ANIMATION.md', '_blank', 'noopener') },
      ],
    },
  ];

  const runBtn = 'flex h-7 items-center justify-center rounded text-[#A3A9B8] hover:bg-[#232734] hover:text-white disabled:opacity-35';

  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b border-[#1F222B] bg-[#121419] px-2">
      <Link to={isDemo ? '/' : '/dashboard'} aria-label={isDemo ? 'Back to home' : 'Back to dashboard'} className="flex shrink-0 rounded p-1 hover:bg-[#1C1F28]">
        <LogoMark size={20} hole="#121419" />
      </Link>
      {mode === 'pro' && <MenuBar menus={menus} />}
      <span className="mx-1 hidden h-5 w-px bg-[#262A35] lg:block" />
      <span className="hidden min-w-0 truncate text-[12.5px] font-semibold lg:block" title={title}>
        {title}
      </span>

      {mode === 'pro' && (
        <nav aria-label="Workspaces" className="mx-auto flex items-center gap-0.5 rounded-md bg-[#0B0C10] p-0.5">
          {WORKSPACES.map((w) => (
            <button
              key={w.id}
              type="button"
              aria-pressed={ed.workspace === w.id}
              title={`${w.label} (${keyLabel(w.key)})`}
              onClick={() => ed.setWorkspace(w.id)}
              className={`flex h-7 items-center gap-1.5 rounded px-3 text-[12.5px] ${ed.workspace === w.id ? 'bg-[#232734] text-white shadow-[inset_0_-2px_0_#7C5CFF]' : 'text-[#8C93A5] hover:text-white'}`}
            >
              {w.icon}
              <span className="hidden xl:inline">{w.label}</span>
              {w.id === 'game' && ed.running === 'running' && <span className="size-1.5 rounded-full bg-ok" aria-label="running" />}
            </button>
          ))}
        </nav>
      )}
      {mode === 'simple' && <span className="mx-auto" />}

      {mode === 'pro' && (
        <div className="flex items-center gap-0.5 rounded-md bg-[#0B0C10] p-0.5" role="group" aria-label="Run controls">
          <button type="button" title={`Run game (${keyLabel('F5')})`} aria-label="Run game" disabled={!ed.play.ready} onClick={() => ed.run('project')} className={`${runBtn} w-8 text-ok`}>
            <Play size={15} fill="currentColor" />
          </button>
          <button type="button" title={`Run this scene (${keyLabel('F6')})`} aria-label="Run this scene" disabled={!ed.play.ready} onClick={() => ed.run('scene')} className={`${runBtn} w-8`}>
            <Clapperboard size={14} />
          </button>
          <button type="button" title={`${ed.running === 'paused' ? 'Resume' : 'Pause'} (F7)`} aria-label={ed.running === 'paused' ? 'Resume' : 'Pause'} disabled={ed.running === 'stopped'} onClick={ed.togglePause} className={`${runBtn} w-8 ${ed.running === 'paused' ? 'text-warn' : ''}`}>
            <Pause size={14} />
          </button>
          <button type="button" title="Stop (F8)" aria-label="Stop" disabled={ed.running === 'stopped'} onClick={ed.stop} className={`${runBtn} w-8`}>
            <Square size={13} />
          </button>
        </div>
      )}

      {!narrow && (
        <div role="group" aria-label="Editor mode" className="flex rounded-md bg-[#0B0C10] p-0.5">
          {(['simple', 'pro'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`h-7 rounded px-2.5 text-[12px] ${mode === m ? 'bg-[#6B4EFF] font-semibold text-white' : 'text-[#8C93A5] hover:text-white'}`}
            >
              {m === 'simple' ? 'Simple' : 'Pro'}
            </button>
          ))}
        </div>
      )}
      <button type="button" disabled title="Export to web, Windows, Android: coming soon" className="h-7 rounded border border-[#2E3342] px-2.5 text-[12px] text-muted">
        Export
      </button>
    </header>
  );
}

/* ─── Pro layout ──────────────────────────────────────────────────────── */

function ProLayout() {
  const ed = useEd();
  const { layout, setLayout, focusMode } = ed;
  const showLeft = layout.showLeft && !focusMode;
  const showRight = layout.showRight && !focusMode && ed.workspace !== 'art';
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const [leftHeight, setLeftHeight] = useState(0);
  const leftRef = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(() => setLeftHeight(el.clientHeight));
    ro.observe(el);
  }, []);

  return (
    <div className="flex min-h-0 flex-1">
      {showLeft && (
        <>
          <aside ref={leftRef} style={{ width: layout.left }} className="flex shrink-0 flex-col bg-[#121419]" aria-label="Scene and files">
            <DockTitle>Hierarchy</DockTitle>
            <div style={{ flex: `${layout.leftSplit} 1 0` }} className="flex min-h-0 flex-col">
              <HierarchyDock />
            </div>
            <Splitter axis="y" label="Resize hierarchy and files" onDrag={(d) => leftHeight && setLayout({ leftSplit: clamp(layout.leftSplit + d / leftHeight, 0.15, 0.85) })} />
            <DockTitle>Files</DockTitle>
            <div style={{ flex: `${1 - layout.leftSplit} 1 0` }} className="flex min-h-0 flex-col">
              <FilesDock />
            </div>
          </aside>
          <Splitter axis="x" label="Resize left panel" onDrag={(d) => setLayout({ left: clamp(layout.left + d, 180, 520) })} />
        </>
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col">
          {ed.workspace === 'scene' && (
            <>
              <SceneTabs />
              <SceneView />
            </>
          )}
          {ed.workspace === 'code' && <CodeWorkspace />}
          {ed.workspace === 'art' && <ArtWorkspace />}
          <GameView visible={ed.workspace === 'game'} />
        </div>
        {!focusMode && (
          <>
            {layout.showBottom && <Splitter axis="y" label="Resize bottom panel" onDrag={(d) => setLayout({ bottom: clamp(layout.bottom - d, 90, 600) })} />}
            <div style={{ height: layout.showBottom ? layout.bottom : 28 }} className="flex shrink-0 flex-col">
              <BottomPanel />
            </div>
          </>
        )}
      </main>
      {showRight && (
        <>
          <Splitter axis="x" label="Resize properties panel" onDrag={(d) => setLayout({ right: clamp(layout.right - d, 220, 560) })} />
          <aside style={{ width: layout.right }} className="flex shrink-0 flex-col bg-[#121419]" aria-label="Properties">
            <RightDock />
          </aside>
        </>
      )}
    </div>
  );
}

function DockTitle({ children }: { children: ReactNode }) {
  return <div className="flex h-7 shrink-0 items-center border-b border-[#1F222B] bg-[#13151B] px-2.5 text-[11.5px] font-semibold text-[#9AA1B2]">{children}</div>;
}

function SceneTabs() {
  const ed = useEd();
  const show = useContextMenu();
  return (
    <div role="tablist" aria-label="Open scenes" className="flex h-8 shrink-0 items-end gap-0.5 border-b border-[#1F222B] bg-[#0F1015] px-1.5">
      {ed.openScenes.map((p) => {
        const active = p === ed.scenePath;
        return (
          <div
            key={p}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            onClick={() => ed.openScene(p)}
            onKeyDown={(e) => e.key === 'Enter' && ed.openScene(p)}
            onAuxClick={(e) => e.button === 1 && ed.closeScene(p)}
            onContextMenu={(e) => {
              e.preventDefault();
              show(
                [
                  { label: 'Close', onSelect: () => ed.closeScene(p) },
                  { label: 'Close Others', onSelect: () => ed.openScenes.filter((x) => x !== p).forEach(ed.closeScene) },
                  { type: 'separator' },
                  { label: 'Run This Scene', onSelect: () => ed.run('scene', p) },
                  { label: 'Show in Files', onSelect: () => ed.setSelectedFile(p) },
                ],
                e,
              );
            }}
            className={`group flex h-7 max-w-52 cursor-default items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 text-[12px] ${
              active ? 'border-[#262A35] bg-[#0B0C10] text-white' : 'border-transparent text-[#8C93A5] hover:bg-[#16181F] hover:text-white'
            }`}
          >
            {p === ed.startScene && <Star size={10} className="shrink-0 text-warn" fill="currentColor" aria-label="Start scene" />}
            <span className="truncate">{displayName(p)}</span>
            {ed.openScenes.length > 1 && (
              <button
                type="button"
                aria-label={`Close ${displayName(p)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  ed.closeScene(p);
                }}
                className={`rounded p-0.5 hover:bg-[#232734] ${active ? '' : 'opacity-0 group-hover:opacity-100'}`}
              >
                <X size={11} />
              </button>
            )}
          </div>
        );
      })}
      <button type="button" title="New scene" aria-label="New scene" onClick={() => ed.setDialog({ type: 'new-scene' })} className="mb-0.5 flex size-6 items-center justify-center rounded text-muted hover:bg-[#1C1F28] hover:text-white">
        <Plus size={13} />
      </button>
    </div>
  );
}
