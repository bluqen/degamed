import { useState } from 'react';
import { FilePlus2, Play, Search, XCircle } from 'lucide-react';
import { useEd } from './state';
import { CodeEditor } from './CodeEditor';
import { fileType } from './file-tree';
import { FILE_ICON } from './FilesDock';
import { IconButton } from './ui';

/** Text files, scripts first. Images and audio live in the Art workspace. */
function editable(path: string) {
  const t = fileType(path);
  return t === 'script' || t === 'scene' || t === 'frames' || t === 'json' || t === 'config' || t === 'text';
}

export function CodeWorkspace() {
  const ed = useEd();
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const all = Object.keys(ed.files).filter(editable);
  const scripts = all.filter((p) => fileType(p) === 'script').sort();
  const data = all.filter((p) => fileType(p) !== 'script').sort();
  const match = (p: string) => !q || p.toLowerCase().includes(q.toLowerCase());
  const path = ed.files[ed.codeFile] !== undefined ? ed.codeFile : (scripts[0] ?? all[0]);
  const errors = ed.play.lines.filter((l) => l.level === 'error' && l.file === path);

  const item = (p: string) => (
    <li key={p}>
      <button
        type="button"
        onClick={() => ed.setCodeFile(p)}
        title={p}
        className={`flex w-full items-center gap-1.5 px-2.5 py-1 text-left ${p === path ? 'bg-brand-tint text-ink' : 'text-ink-2 hover:bg-surface-2'}`}
      >
        <span className="flex shrink-0" style={{ color: FILE_ICON[fileType(p)].color }}>
          {FILE_ICON[fileType(p)].icon}
        </span>
        <span className="truncate">{p.slice(p.lastIndexOf('/') + 1)}</span>
        {ed.play.lines.some((l) => l.level === 'error' && l.file === p) && <XCircle size={11} className="ml-auto shrink-0 text-bad" aria-label="Has errors" />}
      </button>
    </li>
  );

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-52 shrink-0 flex-col border-r border-line bg-surface">
        <div className="flex h-8 shrink-0 items-center gap-1 border-b border-line px-1.5">
          <label className="flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded border border-line bg-sunken px-1.5 focus-within:border-brand">
            <Search size={12} className="text-muted" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find file" aria-label="Find file" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none" />
          </label>
          <IconButton label="New script" onClick={() => ed.setDialog({ type: 'new-script' })}>
            <FilePlus2 size={14} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-auto py-1 text-[12.5px]">
          <div className="px-2.5 pt-1 pb-0.5 text-[10.5px] font-semibold tracking-wide text-muted uppercase">Scripts</div>
          <ul>{scripts.filter(match).map(item)}</ul>
          <div className="px-2.5 pt-3 pb-0.5 text-[10.5px] font-semibold tracking-wide text-muted uppercase">Scenes & data</div>
          <ul>{data.filter(match).map(item)}</ul>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {path ? (
          <>
            <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 text-[12px]">
              <span className="font-mono text-ink">{path}</span>
              <span className="text-muted">{path.endsWith('.py') ? 'Python' : path.endsWith('.json') ? 'JSON' : 'JavaScript'}</span>
              <span className="ml-auto text-muted tabular-nums">
                Ln {cursor.line}, Col {cursor.col}
              </span>
              <button type="button" onClick={() => ed.run('project')} disabled={!ed.play.ready} className="flex h-6 items-center gap-1 rounded bg-ok-tint px-2 font-semibold text-ok disabled:opacity-40">
                <Play size={12} /> Run <kbd className="font-sans text-[10.5px] opacity-70">F5</kbd>
              </button>
            </div>
            {errors.length > 0 && (
              <div className="max-h-20 shrink-0 overflow-auto border-b border-bad-tint bg-bad-tint px-3 py-1 font-mono text-[11.5px] text-bad">
                {errors.slice(-3).map((l) => (
                  <p key={l.id}>{l.message}</p>
                ))}
              </div>
            )}
            {path.endsWith('.py') && (
              <div className="shrink-0 border-b border-warn/40 bg-warn-tint px-3 py-1 text-[11.5px] text-warn">Python scripts can be written now; running them arrives with the Python engine update.</div>
            )}
            <div className="min-h-0 flex-1">
              <CodeEditor
                key={path}
                path={path}
                value={ed.files[path] ?? ''}
                onChange={(text) => ed.commitWith((f) => (f[path] === text ? null : { ...f, [path]: text }), `Edit ${path.slice(path.lastIndexOf('/') + 1)}`, `code:${path}`)}
                onCursor={(line, col) => setCursor({ line, col })}
              />
            </div>
          </>
        ) : (
          <p className="p-4 text-muted">No text files. Create a script to start coding.</p>
        )}
      </div>
    </div>
  );
}
