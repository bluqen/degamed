import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Code2, Gamepad2, LayoutTemplate, Palette, Pause, Play, Plus, Square, Star, X, Clapperboard, Upload } from 'lucide-react';
import type { ProjectFiles } from '@degamed/shared';
import { getProject, type ProjectRow } from '../lib/projects';
import { isAuthConfigured } from '../lib/env';
import { loadDraft, starterProject } from '../lib/project-files';
import { demoGame } from '../lib/game';
import { getGame } from '../lib/library';
import { ThemeToggle } from '../ui';
import { EdProvider, useEd, useEditorState, type Workspace } from './state';
import { buildCommands, handleShortcut, keyLabel, type Command } from './commands';
import { ContextMenuProvider, MenuButton, Splitter, TabStrip, useContextMenu, type MenuItem } from './ui';
import { SceneView } from './SceneView';
import { HierarchyDock } from './HierarchyDock';
import { FilesDock } from './FilesDock';
import { RightDock } from './PropertiesDock';
import { BottomPanel } from './BottomPanel';
import { CodeWorkspace } from './CodeWorkspace';
import { ArtWorkspace } from './ArtWorkspace';
import { GameView } from './GameView';
import { Dialogs } from './dialogs';
import { displayName } from './file-tree';

export function EditorPage() {
  const { id = 'demo' } = useParams();
  const isDemo = id === 'demo';
  const [project, setProject] = useState<ProjectRow | null | undefined>(isDemo ? null : undefined);
  const [initial, setInitial] = useState<ProjectFiles | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const local = isDemo ? null : getGame(id);
  useEffect(() => {
    if (isDemo || local || !isAuthConfigured) return;
    getProject(id)
      .then(setProject)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Could not load project'));
  }, [id, isDemo]);

  useEffect(() => {
    if (project === undefined && !isDemo && !local && isAuthConfigured) return;
    setInitial(loadDraft(id) ?? (isDemo ? demoGame() : starterProject(project?.title ?? local?.title ?? 'Starter Platformer')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isDemo, project]);

  const title = isDemo ? 'Demo game' : (local?.title ?? project?.title ?? 'Loading…');
  if (!initial) return <div className="flex h-dvh items-center justify-center bg-bg text-body text-muted">Opening {title}…</div>;
  return (
    <ContextMenuProvider>
      <Shell key={id} projectId={id} initial={initial} title={title} isDemo={isDemo} banner={loadError ?? (project === null && !isDemo && !local && isAuthConfigured ? 'This project doesn’t exist or you don’t have access.' : null)} />
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
  const commands = useMemo(() => buildCommands(ed), [ed]);

  // Keyboard shortcuts (not while a dialog is open; dialogs handle their own keys).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ed.dialog || narrow) return;
      handleShortcut(e, commands, ed);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commands, ed, narrow]);

  useEffect(() => {
    document.title = `${title} · Advanced · Degamed`;
  }, [title]);

  if (narrow) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
        <h1 className="text-title font-bold">Advanced needs a bigger screen</h1>
        <p className="max-w-sm text-body text-muted">The scene editor and code tools are made for a computer. On a phone, change your game in the Studio by chatting or with Tune.</p>
        <Link to={`/editor/${projectId}`} className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-body font-semibold text-on-brand hover:bg-brand-hover">
          <ArrowLeft size={16} aria-hidden="true" /> Back to the Studio
        </Link>
      </div>
    );
  }

  return (
    <EdProvider value={ed}>
      <div className="flex h-dvh flex-col overflow-hidden bg-bg text-[13px] text-ink select-none">
        <TopBar title={title} projectId={projectId} isDemo={isDemo} commands={commands} />
        {banner && <p className="bg-bad-tint px-4 py-1.5 text-bad">{banner}</p>}
        <ProLayout />
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

function TopBar({ title, projectId, isDemo, commands }: { title: string; projectId: string; isDemo: boolean; commands: Command[] }) {
  const ed = useEd();
  const navigate = useNavigate();
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
        { label: 'Back to the Studio', onSelect: () => navigate(`/editor/${projectId}`) },
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

  const runBtn = 'flex h-8 w-8 items-center justify-center rounded-sm text-ink-2 hover:bg-surface-3 hover:text-ink disabled:opacity-35';
  void isDemo;

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface px-2">
      <Link
        to={`/editor/${projectId}`}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-sm px-2 text-[13px] font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Studio
      </Link>
      <span className="h-5 w-px bg-line" aria-hidden="true" />
      <MenuButton
        label="Menu"
        items={menus.map((m) => ({ type: 'submenu' as const, label: m.label, items: m.items }))}
        className="flex h-8 items-center gap-1 rounded-sm px-2.5 text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        Menu
      </MenuButton>
      <span className="min-w-0 truncate px-1 text-[13px] font-semibold" title={title}>
        {title}
      </span>
      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">Advanced</span>

      <nav aria-label="Workspaces" className="mx-auto flex items-center gap-0.5 rounded-md bg-surface-2 p-0.5 shadow-[inset_0_0_0_1px_var(--c-line)]">
        {WORKSPACES.map((w) => (
          <button
            key={w.id}
            type="button"
            aria-pressed={ed.workspace === w.id}
            title={`${w.label} (${keyLabel(w.key)})`}
            onClick={() => ed.setWorkspace(w.id)}
            className={`flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium transition-colors ${ed.workspace === w.id ? 'bg-surface text-ink shadow-1' : 'text-muted hover:text-ink'}`}
          >
            {w.icon}
            <span className="hidden xl:inline">{w.label}</span>
            {w.id === 'game' && ed.running === 'running' && <span className="size-1.5 rounded-full bg-ok" aria-label="running" />}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-0.5 rounded-md bg-surface-2 p-0.5 shadow-[inset_0_0_0_1px_var(--c-line)]" role="group" aria-label="Run controls">
        <button type="button" title={`Run game (${keyLabel('F5')})`} aria-label="Run game" disabled={!ed.play.ready} onClick={() => ed.run('project')} className={`${runBtn} !text-ok`}>
          <Play size={15} fill="currentColor" />
        </button>
        <button type="button" title={`Run this scene (${keyLabel('F6')})`} aria-label="Run this scene" disabled={!ed.play.ready} onClick={() => ed.run('scene')} className={runBtn}>
          <Clapperboard size={14} />
        </button>
        <button type="button" title={`${ed.running === 'paused' ? 'Resume' : 'Pause'} (F7)`} aria-label={ed.running === 'paused' ? 'Resume' : 'Pause'} disabled={ed.running === 'stopped'} onClick={ed.togglePause} className={`${runBtn} ${ed.running === 'paused' ? '!text-warn' : ''}`}>
          <Pause size={14} />
        </button>
        <button type="button" title="Stop (F8)" aria-label="Stop" disabled={ed.running === 'stopped'} onClick={ed.stop} className={runBtn}>
          <Square size={13} />
        </button>
      </div>
      <ThemeToggle size="sm" />
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
  const [leftTab, setLeftTab] = useState<'scene' | 'files'>('scene');

  return (
    <div className="flex min-h-0 flex-1">
      {showLeft && (
        <>
          <aside style={{ width: layout.left }} className="flex shrink-0 flex-col bg-surface" aria-label="Scene and files">
            <TabStrip
              tabs={[
                { id: 'scene', label: 'Objects' },
                { id: 'files', label: 'Files' },
              ]}
              active={leftTab}
              onChange={setLeftTab}
            />
            <div className={`min-h-0 flex-1 flex-col ${leftTab === 'scene' ? 'flex' : 'hidden'}`}>
              <HierarchyDock />
            </div>
            <div className={`min-h-0 flex-1 flex-col ${leftTab === 'files' ? 'flex' : 'hidden'}`}>
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
          <aside style={{ width: layout.right }} className="flex shrink-0 flex-col bg-surface" aria-label="Properties">
            <RightDock />
          </aside>
        </>
      )}
    </div>
  );
}

function SceneTabs() {
  const ed = useEd();
  const show = useContextMenu();
  return (
    <div role="tablist" aria-label="Open scenes" className="flex h-8 shrink-0 items-end gap-0.5 border-b border-line bg-sunken px-1.5">
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
              active ? 'border-line bg-sunken text-ink' : 'border-transparent text-muted hover:bg-surface hover:text-ink'
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
                className={`rounded p-0.5 hover:bg-surface-3 ${active ? '' : 'opacity-0 group-hover:opacity-100'}`}
              >
                <X size={11} />
              </button>
            )}
          </div>
        );
      })}
      <button type="button" title="New scene" aria-label="New scene" onClick={() => ed.setDialog({ type: 'new-scene' })} className="mb-0.5 flex size-6 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-ink">
        <Plus size={13} />
      </button>
    </div>
  );
}
