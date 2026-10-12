import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Check, CloudOff, Gamepad2, Maximize2, MessageCircle, MoreHorizontal, Palette, Play, RotateCcw, Share2, SlidersHorizontal, Undo2, Wrench } from 'lucide-react';
import type { ProjectFiles } from '@degamed/shared';
import { LogoMark } from '../components/Logo';
import { Stage, type StageHandle } from '../components/Stage';
import { themes } from '../lib/game';
import { themePreview } from '../lib/game/preview';
import { Button, ButtonLink, EmptyState, IconButton, Kbd, Menu, Skeleton, Tabs, ThemeToggle, Tooltip, tabPanelProps, cx } from '../ui';
import { ChatPanel } from '../studio/ChatPanel';
import { TunePanel } from '../studio/TunePanel';
import { LookPanel } from '../studio/LookPanel';
import { ShareDialog } from '../studio/ShareDialog';
import { DEMO_ID, loadForStudio, useStudio, type LoadState } from '../studio/useStudio';

type Panel = 'chat' | 'tune' | 'look';

export function StudioPage() {
  const { id = DEMO_ID } = useParams();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  useEffect(() => {
    // Building the demo encodes its art; let the skeleton paint first.
    const t = window.setTimeout(() => setState(loadForStudio(id)), 0);
    return () => window.clearTimeout(t);
  }, [id]);

  if (state.status === 'loading') return <StudioSkeleton />;
  if (state.status === 'missing')
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <EmptyState
          icon={<Gamepad2 size={22} />}
          title="We can’t find this game"
          body="Games are saved on the device they were made on. It may have been made in another browser, or deleted."
          action={<ButtonLink to="/create">Make a new game</ButtonLink>}
        />
      </div>
    );
  return <Studio key={id} id={id} initial={state.files} title={state.title} />;
}

function Studio({ id, initial, title }: { id: string; initial: ProjectFiles; title: string }) {
  const studio = useStudio(id, initial, title);
  const navigate = useNavigate();
  const location = useLocation() as { state?: { fresh?: boolean; summary?: string } };
  const [panel, setPanel] = useState<Panel>('chat');
  const [sharing, setSharing] = useState(false);
  const stage = useRef<StageHandle>(null);
  const tabsId = useId();
  const isDemo = id === DEMO_ID;

  const allThemes = useMemo(themes, []);
  const theme = allThemes.find((t) => t.id === studio.spec?.theme);
  const poster = useMemo(() => (theme ? themePreview(theme, 480, 270) : undefined), [theme]);

  useEffect(() => {
    document.title = `${studio.title} · Degamed`;
  }, [studio.title]);

  // Ctrl/Cmd+Z undoes the last change (outside text boxes).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !/INPUT|TEXTAREA|SELECT/.test(t.tagName)) {
        e.preventDefault();
        studio.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [studio]);

  const intro = location.state?.fresh
    ? `Your game is ready! ${location.state.summary ?? ''} Tell me what to change, or try a suggestion below.`
    : isDemo
      ? 'This is a demo game. Ask me to change anything: the jumps, the speed, the enemies or the look.'
      : 'Welcome back! What should we change?';

  const openAdvanced = () => navigate(`/editor/${id}/advanced`);
  const play = () => navigate(`/play/${id}`);

  const tabs = [
    { id: 'chat' as const, label: 'Chat', icon: <MessageCircle size={16} aria-hidden="true" /> },
    { id: 'tune' as const, label: 'Tune', icon: <SlidersHorizontal size={16} aria-hidden="true" /> },
    { id: 'look' as const, label: 'Look', icon: <Palette size={16} aria-hidden="true" /> },
  ];

  return (
    <div className="flex h-dvh flex-col bg-bg max-lg:h-auto max-lg:min-h-dvh">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 sm:px-3">
        <Tooltip label={isDemo ? 'Home' : 'Your games'}>
          <Link to={isDemo ? '/' : '/create'} aria-label={isDemo ? 'Home' : 'Your games'} className="flex h-10 items-center gap-1 rounded-md px-2 text-ink-2 hover:bg-surface-2 hover:text-ink">
            <ArrowLeft size={18} aria-hidden="true" />
            <LogoMark size={22} hole="var(--c-surface)" />
          </Link>
        </Tooltip>
        <span className="h-6 w-px bg-line" aria-hidden="true" />
        <h1 className="sr-only">{studio.title}</h1>
        <TitleField value={studio.title} onCommit={studio.setTitle} />
        <span className="hidden items-center gap-1.5 text-body-sm text-muted md:inline-flex" aria-live="polite">
          {studio.saved ? <Check size={15} className="text-ok" aria-hidden="true" /> : <CloudOff size={15} className="text-warn" aria-hidden="true" />}
          {studio.saved ? 'Saved' : 'Not saved: storage full'}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip label={studio.undoLabel ? `Undo: ${studio.undoLabel}` : 'Nothing to undo'}>
            <IconButton label="Undo" tooltip={false} disabled={!studio.canUndo} onClick={studio.undo} className="max-sm:hidden">
              <Undo2 size={18} />
            </IconButton>
          </Tooltip>
          <Button variant="ghost" icon={<Wrench size={16} />} onClick={openAdvanced} className="max-md:hidden">
            Advanced
          </Button>
          <ThemeToggle />
          <Button variant="secondary" icon={<Play size={16} />} onClick={play} className="max-md:hidden">
            Play
          </Button>
          <Button icon={<Share2 size={16} />} onClick={() => setSharing(true)} className="max-sm:hidden">
            Share
          </Button>
          <IconButton label="Share" variant="primary" className="sm:hidden" onClick={() => setSharing(true)}>
            <Share2 size={18} />
          </IconButton>
          <div className="md:hidden">
            <Menu
              label="More"
              width={220}
              trigger={
                <IconButton label="More" aria-haspopup="menu">
                  <MoreHorizontal size={20} />
                </IconButton>
              }
              items={[
                { label: 'Play full screen', icon: <Play size={16} />, onSelect: play },
                { label: 'Undo', icon: <Undo2 size={16} />, disabled: !studio.canUndo, onSelect: studio.undo },
                { type: 'separator' },
                { label: 'Advanced editor', description: 'Scenes, code and art', icon: <Wrench size={16} />, onSelect: openAdvanced },
              ]}
            />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Game */}
        <section aria-label="Game" className="flex min-h-0 min-w-0 flex-col items-center justify-center gap-4 p-3 sm:p-6 lg:p-8">
          <div className="flex w-full max-w-[min(100%,calc((100dvh-56px-140px)*16/9))] flex-col gap-3 max-lg:max-w-none">
            <Stage ref={stage} files={studio.files} title={studio.title} poster={poster} className="shadow-3 ring-1 ring-line" />
            <div className="flex items-center gap-3 px-1">
              <span className="hidden items-center gap-1.5 text-body-sm text-muted sm:inline-flex">
                <Kbd>←</Kbd>
                <Kbd>→</Kbd> move <span className="mx-1.5 text-faint">·</span> <Kbd>Space</Kbd> jump
              </span>
              <span className="text-body-sm text-muted sm:hidden">Tap the game to play</span>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="sm" icon={<RotateCcw size={15} />} onClick={() => stage.current?.restart()}>
                  Restart
                </Button>
                <Button variant="ghost" size="sm" icon={<Maximize2 size={15} />} onClick={() => stage.current?.fullscreen()}>
                  Full screen
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Panel */}
        <aside aria-label="Change your game" className="flex min-h-[520px] flex-col border-line bg-surface max-lg:border-t lg:min-h-0 lg:border-l">
          <div className="shrink-0 px-4 pt-4 pb-3">
            <Tabs idBase={tabsId} label="Ways to change your game" items={tabs} value={panel} onChange={setPanel} />
          </div>
          <div {...tabPanelProps(tabsId, 'chat', panel === 'chat')} className={cx('min-h-0 flex-1', panel === 'chat' ? 'flex flex-col' : 'hidden')}>
            <ChatPanel studio={studio} intro={intro} />
          </div>
          <div {...tabPanelProps(tabsId, 'tune', panel === 'tune')} className="min-h-0 flex-1 overflow-y-auto">
            {panel === 'tune' && <TunePanel studio={studio} onOpenAdvanced={openAdvanced} />}
          </div>
          <div {...tabPanelProps(tabsId, 'look', panel === 'look')} className="min-h-0 flex-1 overflow-y-auto">
            {panel === 'look' && <LookPanel studio={studio} />}
          </div>
        </aside>
      </div>

      <ShareDialog open={sharing} onClose={() => setSharing(false)} studio={studio} />
    </div>
  );
}

/** The game's name, editable in place. */
function TitleField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      aria-label="Game name"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() !== value && onCommit(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setText(value);
          e.currentTarget.blur();
        }
      }}
      size={Math.max(8, Math.min(text.length + 1, 36))}
      className="h-9 min-w-0 rounded-sm border border-transparent bg-transparent px-2 text-body font-semibold text-ink transition-colors hover:border-line focus:border-brand focus:bg-surface focus:outline-none focus-visible:outline-none max-sm:flex-1"
    />
  );
}

function StudioSkeleton() {
  return (
    <div className="flex h-dvh flex-col bg-bg" aria-busy="true" aria-label="Opening your game">
      <div className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4">
        <Skeleton className="h-6 w-6" rounded="rounded-full" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="ml-auto h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex items-center justify-center p-3 sm:p-6 lg:p-8">
          <Skeleton className="aspect-video w-full max-w-[min(100%,calc((100dvh-56px-140px)*16/9))]" rounded="rounded-xl" />
        </div>
        <div className="flex flex-col gap-4 border-line bg-surface p-4 lg:border-l">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-4/5" />
          <Skeleton className="h-10 w-3/5" />
        </div>
      </div>
    </div>
  );
}
