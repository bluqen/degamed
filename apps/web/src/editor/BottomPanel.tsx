import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Clapperboard, Copy, Info, Search, Terminal, Trash2, XCircle } from 'lucide-react';
import type { Entity } from '@degamed/shared';
import { useEd, useImages, type BottomTab } from './state';
import { AnimationEditor } from '../components/AnimationEditor';
import { findProblems, type Problem } from './problems';
import { fileType } from './file-tree';
import { IconButton, TabStrip } from './ui';

export function BottomPanel() {
  const ed = useEd();
  const problems = useMemo(() => findProblems(ed.files, ed.startScene), [ed.files, ed.startScene]);
  const errors = ed.play.lines.filter((l) => l.level === 'error').length;
  const tabs: { id: BottomTab; label: React.ReactNode; badge?: React.ReactNode }[] = [
    {
      id: 'console',
      label: (
        <span className="flex items-center gap-1.5">
          <Terminal size={12} /> Console
        </span>
      ),
      badge: errors ? <span className="rounded-full bg-[#4A1D24] px-1.5 text-[10.5px] text-[#FFB4B4]">{errors}</span> : undefined,
    },
    {
      id: 'problems',
      label: (
        <span className="flex items-center gap-1.5">
          <AlertTriangle size={12} /> Problems
        </span>
      ),
      badge: problems.length ? <span className="rounded-full bg-[#3A2A10] px-1.5 text-[10.5px] text-warn">{problems.length}</span> : undefined,
    },
    {
      id: 'animation',
      label: (
        <span className="flex items-center gap-1.5">
          <Clapperboard size={12} /> Animation
        </span>
      ),
    },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#101116]">
      <TabStrip
        dense
        tabs={tabs}
        active={ed.layout.showBottom ? ed.bottomTab : null}
        onChange={(t) => {
          // Clicking the open tab folds the panel away.
          if (ed.layout.showBottom && t === ed.bottomTab) ed.setLayout({ showBottom: false });
          else {
            ed.setBottomTab(t);
            ed.setLayout({ showBottom: true });
          }
        }}
        right={
          <>
            <span className="mr-2 text-[11px] text-[#6E7587]">{ed.saved ? 'Saved on this device' : 'Saving…'}</span>
            <IconButton label={ed.layout.showBottom ? 'Hide panel' : 'Show panel'} shortcut="Ctrl+J" onClick={() => ed.setLayout({ showBottom: !ed.layout.showBottom })} className="size-6">
              <ChevronDown size={14} className={ed.layout.showBottom ? '' : 'rotate-180'} />
            </IconButton>
          </>
        }
      />
      {ed.layout.showBottom && (
        <div className="flex min-h-0 flex-1 flex-col">
          {ed.bottomTab === 'console' && <ConsoleTab />}
          {ed.bottomTab === 'problems' && <ProblemsTab problems={problems} />}
          {ed.bottomTab === 'animation' && <AnimationTab />}
        </div>
      )}
    </div>
  );
}

function ConsoleTab() {
  const ed = useEd();
  const [show, setShow] = useState({ info: true, warn: true, error: true });
  const [q, setQ] = useState('');
  const end = useRef<HTMLLIElement>(null);
  const lines = ed.play.lines.filter((l) => show[l.level] && (!q || l.message.toLowerCase().includes(q.toLowerCase())));
  const count = (lvl: 'info' | 'warn' | 'error') => ed.play.lines.filter((l) => l.level === lvl).length;
  useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [ed.play.lines.length]);
  const toggle = (lvl: 'info' | 'warn' | 'error', icon: React.ReactNode, color: string) => (
    <button
      type="button"
      aria-pressed={show[lvl]}
      title={`Show ${lvl === 'info' ? 'messages' : lvl === 'warn' ? 'warnings' : 'errors'}`}
      onClick={() => setShow((s) => ({ ...s, [lvl]: !s[lvl] }))}
      className={`flex h-6 items-center gap-1 rounded px-1.5 text-[11.5px] tabular-nums ${show[lvl] ? 'bg-[#1C1F28] text-ink' : 'text-[#6E7587]'}`}
    >
      <span style={{ color: show[lvl] ? color : undefined }} className="flex">
        {icon}
      </span>
      {count(lvl)}
    </button>
  );
  return (
    <>
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-[#1F222B] px-2">
        <label className="flex h-6 w-56 items-center gap-1.5 rounded border border-[#2A2E3A] bg-[#0F1015] px-1.5 focus-within:border-[#6B4EFF]">
          <Search size={12} className="text-muted" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter messages" aria-label="Filter messages" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none" />
        </label>
        <span className="ml-auto" />
        {toggle('info', <Info size={12} />, '#7DD3FC')}
        {toggle('warn', <AlertTriangle size={12} />, '#FBBF24')}
        {toggle('error', <XCircle size={12} />, '#F87171')}
        <IconButton label="Copy all" onClick={() => void navigator.clipboard?.writeText(ed.play.lines.map((l) => `[${l.level}] ${l.file ? `${l.file}: ` : ''}${l.message}`).join('\n'))} className="size-6">
          <Copy size={13} />
        </IconButton>
        <IconButton label="Clear" onClick={ed.play.clearConsole} className="size-6">
          <Trash2 size={13} />
        </IconButton>
      </div>
      <ol className="min-h-0 flex-1 overflow-auto py-1 font-mono text-[12px] leading-[1.55]">
        {lines.length === 0 && (
          <li className="px-3 font-sans text-muted">
            {ed.play.lines.length ? 'No messages match.' : 'Nothing yet. Run the game (F5); Game.log() and errors show up here.'}
          </li>
        )}
        {lines.map((l) => (
          <li
            key={l.id}
            className={`flex gap-2 border-b border-[#16181F] px-3 py-0.5 ${l.level === 'error' ? 'bg-[#1F1013] text-[#FFB4B4]' : l.level === 'warn' ? 'bg-[#1C170C] text-[#FCD58A]' : 'text-ink-2'}`}
          >
            <span className="shrink-0 text-[#5A6072] tabular-nums">{new Date(l.at).toLocaleTimeString([], { hour12: false })}</span>
            {l.file && (
              <button
                type="button"
                className="shrink-0 text-[#9A8CFF] underline decoration-dotted"
                onClick={() => ed.files[l.file!] !== undefined && ed.openFile(l.file!)}
              >
                {l.file}
              </button>
            )}
            <span className="min-w-0 break-words whitespace-pre-wrap">{l.message}</span>
          </li>
        ))}
        <li ref={end} />
      </ol>
    </>
  );
}

function ProblemsTab({ problems }: { problems: Problem[] }) {
  const ed = useEd();
  if (!problems.length) return <p className="px-3 py-2 text-[12px] text-ok">No problems found in the project.</p>;
  return (
    <ol className="min-h-0 flex-1 overflow-auto py-1 text-[12px]">
      {problems.map((p, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => {
              if (p.entityId) {
                ed.openScene(p.file);
                ed.select([p.entityId]);
                ed.requestFrame('selection');
              } else ed.openFile(p.file);
            }}
            className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-[#1C1F28]"
          >
            {p.level === 'error' ? <XCircle size={13} className="shrink-0 text-bad" /> : <AlertTriangle size={13} className="shrink-0 text-warn" />}
            <span className="min-w-0 flex-1 truncate text-ink-2">{p.message}</span>
            <span className="shrink-0 font-mono text-[11px] text-[#6E7587]">{p.file}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function AnimationTab() {
  const ed = useEd();
  const images = useImages(ed.files);
  const framesFiles = Object.keys(ed.files).filter((p) => fileType(p) === 'frames').sort();
  // Follow the selected entity's animation file when there is one.
  const selected = ed.selection.length === 1 && ed.scene ? findFrames(ed.scene.entities, ed.selection[0]!) : undefined;
  useEffect(() => {
    if (selected && selected !== ed.framesFile) ed.setFramesFile(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  const path = ed.framesFile && ed.files[ed.framesFile] !== undefined ? ed.framesFile : framesFiles[0];
  if (!path) return <p className="px-3 py-2 text-[12px] text-muted">No animation files yet. Add an Animated Sprite to an entity to create one.</p>;
  return (
    <div className="flex min-h-0 flex-1">
      <ul className="w-44 shrink-0 overflow-auto border-r border-[#1F222B] py-1 text-[12px]">
        {framesFiles.map((p) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => ed.setFramesFile(p)}
              className={`flex w-full items-center gap-1.5 px-2.5 py-1 text-left ${p === path ? 'bg-[#2B2550] text-white' : 'text-ink-2 hover:bg-[#1C1F28]'}`}
            >
              <Clapperboard size={12} className="shrink-0 text-cyan" />
              <span className="truncate">{p.slice(p.lastIndexOf('/') + 1).replace('.frames.json', '')}</span>
            </button>
          </li>
        ))}
      </ul>
      <AnimationEditor path={path} json={ed.files[path]!} images={images} onChange={(json) => ed.commit({ ...ed.files, [path]: json }, `Edit ${path.slice(path.lastIndexOf('/') + 1)}`, `anim:${path}`)} />
    </div>
  );
}

function findFrames(list: Entity[], id: string): string | undefined {
  for (const e of list) {
    if (e.id === id) return e.components.AnimatedSprite?.frames;
    const f = findFrames(e.children, id);
    if (f) return f;
  }
  return undefined;
}
