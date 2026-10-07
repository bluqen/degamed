import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router';
import { Clapperboard, Code2, FileImage, FileJson, Maximize2, Pause, Play, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { AnimationEditor } from '../components/AnimationEditor';
import { Scene, type ProjectFiles } from '@degamed/shared';
import { LogoMark } from '../components/Logo';
import { getProject, type ProjectRow } from '../lib/projects';
import { isAuthConfigured } from '../lib/env';
import { usePlayFrame } from '../lib/play';
import { isTextFile, loadDraft, saveDraft, starterProject } from '../lib/project-files';

type Mode = 'simple' | 'pro';

/** Reads/writes one numeric prop on the first entity running `scriptPath`. */
function scriptProp(files: ProjectFiles, scenePath: string, scriptPath: string, prop: string): number | undefined {
  try {
    const scene = JSON.parse(files[scenePath] ?? '{}') as { entities?: { components?: { Script?: { src: string; props?: Record<string, unknown> } } }[] };
    const e = scene.entities?.find((x) => x.components?.Script?.src === scriptPath);
    const v = e?.components?.Script?.props?.[prop];
    return typeof v === 'number' ? v : undefined;
  } catch {
    return undefined;
  }
}

function withScriptProp(files: ProjectFiles, scenePath: string, scriptPath: string, prop: string, value: number): ProjectFiles {
  const scene = JSON.parse(files[scenePath] ?? '{}') as { entities: { components: { Script?: { src: string; props?: Record<string, unknown> } } }[] };
  for (const e of scene.entities) {
    const s = e.components.Script;
    if (s?.src === scriptPath) s.props = { ...s.props, [prop]: value };
  }
  return { ...files, [scenePath]: JSON.stringify(scene, null, 2) };
}

const QUICK_EDITS = [
  { label: 'Run speed', prop: 'speed', min: 60, max: 320, fallback: 150 },
  { label: 'Jump power', prop: 'jump', min: 150, max: 560, fallback: 330 },
];

export function Editor() {
  const { id = 'demo' } = useParams();
  const isDemo = id === 'demo';
  const [project, setProject] = useState<ProjectRow | null | undefined>(isDemo ? null : undefined);
  const [files, setFiles] = useState<ProjectFiles | null>(null);
  const [saved, setSaved] = useState(true);
  const [mode, setMode] = useState<Mode>('simple');
  const [openFile, setOpenFile] = useState('scripts/player.js');
  const [paused, setPaused] = useState(false);
  const [asJson, setAsJson] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const play = usePlayFrame(files);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDemo || !isAuthConfigured) return;
    getProject(id)
      .then(setProject)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : 'Could not load project'));
  }, [id, isDemo]);

  // Load the local draft, or start from the platformer template.
  useEffect(() => {
    setFiles(loadDraft(id) ?? starterProject(project?.title ?? 'Starter Platformer'));
  }, [id, project?.title]);

  const update = useCallback(
    (next: ProjectFiles, runNow = false) => {
      setFiles(next);
      setSaved(saveDraft(id, next));
      if (runNow) play.run(next);
    },
    [id, play],
  );

  const scenePath = useMemo(() => {
    try {
      return (JSON.parse(files?.['project.json'] ?? '{}') as { startScene?: string }).startScene ?? 'scenes/main.scene.json';
    } catch {
      return 'scenes/main.scene.json';
    }
  }, [files]);

  const sceneProblem = useMemo(() => {
    if (!files?.[scenePath]) return null;
    try {
      const r = Scene.safeParse(JSON.parse(files[scenePath]!));
      return r.success ? null : r.error.issues[0]?.message ?? 'Invalid scene';
    } catch (e) {
      return (e as Error).message;
    }
  }, [files, scenePath]);

  const quickTimer = useRef<number>(undefined);
  const setQuick = (prop: string, value: number) => {
    if (!files) return;
    updateAndRunSoon(withScriptProp(files, scenePath, 'scripts/player.js', prop, value));
  };

  /** Saves a change and re-runs the game shortly after (for sliders and the animation editor). */
  const updateAndRunSoon = (next: ProjectFiles) => {
    update(next);
    window.clearTimeout(quickTimer.current);
    quickTimer.current = window.setTimeout(() => play.run(next), 400);
  };

  const openAnimations = (path: string) => {
    setOpenFile(path);
    setAsJson(false);
    setMode('pro');
  };

  const fullscreen = () => void stageRef.current?.requestFullscreen?.();
  const title = isDemo ? 'Demo: Starter Platformer' : (project?.title ?? 'Loading…');
  const textFiles = files ? Object.keys(files).filter(isTextFile).sort() : [];
  const animationFiles = textFiles.filter((p) => p.endsWith('.frames.json'));
  const isAnimFile = openFile.endsWith('.frames.json');
  const images = useMemo(
    () => Object.fromEntries(Object.entries(files ?? {}).filter(([, v]) => v.startsWith('data:image/'))),
    [files],
  );
  const assetFiles = files ? Object.keys(files).filter((p) => !isTextFile(p)).sort() : [];

  const onCodeKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const t = e.currentTarget;
      const { selectionStart: s, selectionEnd: end, value } = t;
      t.value = value.slice(0, s) + '  ' + value.slice(end);
      t.selectionStart = t.selectionEnd = s + 2;
      update({ ...files!, [openFile]: t.value });
    } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      play.run();
    }
  };

  const errors = play.lines.filter((l) => l.level === 'error').length;

  const stage = (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 bg-[#0A0B0F] p-3">
      <div ref={stageRef} className="relative flex min-h-[240px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-line bg-black">
        <iframe
          ref={play.frameRef}
          src={play.src}
          title="Game preview"
          sandbox="allow-scripts"
          allow="autoplay; fullscreen; gamepad"
          className="absolute inset-0 h-full w-full border-0"
        />
        {!play.ready && <span className="pointer-events-none text-muted">Starting the player…</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => play.run()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#1E3B30] px-3 font-semibold text-ok">
          <Play size={14} aria-hidden="true" /> Run
        </button>
        <button type="button" onClick={play.restart} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-panel px-3">
          <RotateCcw size={14} aria-hidden="true" /> Restart
        </button>
        <button
          type="button"
          onClick={() => {
            if (paused) play.resume();
            else play.pause();
            setPaused(!paused);
          }}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-panel px-3"
        >
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />} {paused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" onClick={fullscreen} aria-label="Fullscreen" className="inline-flex min-h-9 items-center rounded-lg border border-line-strong bg-panel px-2.5">
          <Maximize2 size={14} aria-hidden="true" />
        </button>
        <span className="text-muted">Arrows or WASD to move · Space to jump · click the game first</span>
        <span className={`ml-auto font-mono ${play.fps && play.fps < 50 ? 'text-warn' : 'text-ok'}`}>{play.fps ? `${play.fps} fps` : ''}</span>
      </div>
    </div>
  );

  const consolePanel = (
    <section aria-label="Console" className="flex max-h-44 min-h-28 flex-col border-t border-[#1F222B] bg-sunken">
      <div className="flex items-center gap-3 border-b border-[#1F222B] px-3 py-1.5 text-[13px]">
        <strong>Console</strong>
        {errors > 0 && <span className="text-bad">{errors} error{errors > 1 ? 's' : ''}</span>}
        {sceneProblem && <span className="text-warn">Scene: {sceneProblem}</span>}
        <button type="button" onClick={play.clearConsole} aria-label="Clear console" className="ml-auto text-muted hover:text-white">
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
      <ol className="flex-1 overflow-auto px-3 py-1.5 font-mono text-xs leading-relaxed">
        {play.lines.length === 0 && <li className="text-muted">No messages. Logs from Game.log() show up here.</li>}
        {play.lines.map((l) => (
          <li key={l.id} className={l.level === 'error' ? 'text-bad' : l.level === 'warn' ? 'text-warn' : 'text-ink-2'}>
            {l.file && (
              <button
                type="button"
                className="mr-2 underline decoration-dotted"
                onClick={() => {
                  if (files?.[l.file!]) {
                    setOpenFile(l.file!);
                    setMode('pro');
                  }
                }}
              >
                {l.file}
              </button>
            )}
            {l.message}
          </li>
        ))}
      </ol>
    </section>
  );

  return (
    <div className="flex h-screen flex-col text-sm">
      <header className="flex h-13 shrink-0 flex-wrap items-center gap-3.5 border-b border-[#1F222B] bg-sunken px-4">
        <Link to={isDemo ? '/' : '/dashboard'} aria-label="Back" className="flex">
          <LogoMark size={22} hole="#121419" />
        </Link>
        <strong className="text-[15px]">{title}</strong>
        <span className={saved ? 'text-[13px] text-ok' : 'text-[13px] text-warn'}>{saved ? '● Saved on this device' : '● Not saved'}</span>
        <div role="group" aria-label="Editor mode" className="mx-auto inline-flex rounded-[10px] border border-line bg-bg p-[3px]">
          {(['simple', 'pro'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-[7px] px-3.5 py-1.5 ${mode === m ? 'bg-brand font-semibold text-white' : 'text-muted hover:text-white'}`}
            >
              {m === 'simple' ? 'Simple' : 'Pro'}
            </button>
          ))}
        </div>
        <button type="button" disabled title="Coming soon" className="rounded-lg border border-line-strong px-3.5 py-1.5 text-muted">
          Export
        </button>
      </header>

      {loadError && <p className="bg-[#2A1215] px-4 py-2 text-bad">{loadError}</p>}
      {project === null && !isDemo && <p className="bg-[#241C0E] px-4 py-2 text-warn">This project doesn’t exist or you don’t have access.</p>}

      <div className="flex min-h-0 flex-1 flex-wrap">
        {mode === 'simple' ? (
          <aside className="flex max-w-[400px] min-w-0 flex-[1_1_320px] flex-col gap-4 overflow-auto border-r border-[#1F222B] bg-sunken p-4">
            <div className="flex flex-col gap-2 rounded-xl border border-[#3A2F80] bg-[#17142A] p-4">
              <strong className="flex items-center gap-2">
                <Sparkles size={16} className="text-cyan" aria-hidden="true" /> AI Copilot
              </strong>
              <p className="text-muted">
                Describe changes in plain words and AI edits the game. It arrives in the next milestone. Add your keys in{' '}
                <Link to="/settings" className="text-brand-soft underline">
                  Settings
                </Link>{' '}
                to be ready.
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4">
              <strong>Quick edit</strong>
              {files &&
                QUICK_EDITS.map((q) => {
                  const value = scriptProp(files, scenePath, 'scripts/player.js', q.prop) ?? q.fallback;
                  return (
                    <label key={q.prop} className="flex flex-col gap-1.5">
                      <span className="flex justify-between">
                        <span>{q.label}</span>
                        <span className="font-mono text-muted">{value}</span>
                      </span>
                      <input type="range" min={q.min} max={q.max} value={value} onChange={(e) => setQuick(q.prop, Number(e.target.value))} />
                    </label>
                  );
                })}
              <button
                type="button"
                onClick={() => update(starterProject(project?.title ?? 'Starter Platformer'), true)}
                className="self-start text-[13px] text-muted underline hover:text-white"
              >
                Reset to the starter template
              </button>
            </div>
            {animationFiles.length > 0 && (
              <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-4">
                <strong>Animations</strong>
                {animationFiles.map((p) => {
                  let names = '';
                  try {
                    names = Object.keys((JSON.parse(files![p]!) as { animations: object }).animations).join(', ');
                  } catch {
                    names = 'needs fixing';
                  }
                  return (
                    <button key={p} type="button" onClick={() => openAnimations(p)} className="flex flex-col items-start rounded-lg px-2 py-1.5 text-left hover:bg-panel-2">
                      <span className="flex items-center gap-2">
                        <Clapperboard size={14} className="text-cyan" aria-hidden="true" />
                        {p.split('/').pop()!.replace('.frames.json', '')}
                      </span>
                      <span className="text-[12px] text-muted">{names}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-4">
              <strong>Art</strong>
              <p className="text-muted">The starter art is placeholder pixel art. Generate your own sprites in the Art Lab.</p>
              <Link to="/art" className="self-start text-brand-soft underline">
                Open Art Lab
              </Link>
            </div>
          </aside>
        ) : (
          <aside className="flex max-w-[260px] min-w-0 flex-[1_1_200px] flex-col overflow-auto border-r border-[#1F222B] bg-sunken py-2 text-[13px]">
            <span className="px-3 py-1.5 font-semibold text-muted">Files</span>
            {textFiles.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setOpenFile(p);
                  setAsJson(false);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 text-left font-mono text-xs ${openFile === p ? 'bg-[#2B2550] text-white' : 'text-ink-2 hover:text-white'}`}
              >
                {p.endsWith('.frames.json') ? (
                  <Clapperboard size={13} aria-hidden="true" />
                ) : p.endsWith('.json') ? (
                  <FileJson size={13} aria-hidden="true" />
                ) : (
                  <Code2 size={13} aria-hidden="true" />
                )}
                {p}
              </button>
            ))}
            <span className="mt-3 px-3 py-1.5 font-semibold text-muted">Assets</span>
            {assetFiles.map((p) => (
              <span key={p} className="flex items-center gap-2 px-3 py-1 font-mono text-xs text-ink-2">
                {files?.[p]?.startsWith('data:image/') ? (
                  <img src={files[p]} alt="" className="size-5 object-contain [image-rendering:pixelated]" />
                ) : (
                  <FileImage size={13} aria-hidden="true" />
                )}
                <span className="truncate">{p.split('/').pop()}</span>
              </span>
            ))}
          </aside>
        )}

        <main className="flex min-w-0 flex-[999_1_480px] flex-col">
          {mode === 'pro' && files && (
            <div className="flex min-h-[220px] flex-1 flex-col border-b border-[#1F222B]">
              <div className="flex items-center gap-3 border-b border-[#1F222B] bg-sunken px-3 py-1.5 text-[13px]">
                <span className="font-mono">{openFile}</span>
                {isAnimFile ? (
                  <button type="button" onClick={() => setAsJson(!asJson)} className="text-brand-soft underline">
                    {asJson ? 'Animation view' : 'Edit as JSON'}
                  </button>
                ) : (
                  <span className="text-muted">Ctrl+S to save and run</span>
                )}
                <button type="button" onClick={() => play.run()} className="ml-auto rounded-md bg-[#1E3B30] px-2.5 py-1 font-semibold text-ok">
                  Save &amp; run
                </button>
              </div>
              {isAnimFile && !asJson ? (
                <AnimationEditor
                  path={openFile}
                  json={files[openFile] ?? ''}
                  images={images}
                  onChange={(json) => updateAndRunSoon({ ...files, [openFile]: json })}
                />
              ) : (
                <>
                  <label htmlFor="code" className="sr-only">
                    {openFile}
                  </label>
                  <textarea
                    id="code"
                    spellCheck={false}
                    value={files[openFile] ?? ''}
                    onChange={(e) => update({ ...files, [openFile]: e.target.value })}
                    onKeyDown={onCodeKey}
                    className="min-h-0 flex-1 resize-none bg-[#0B0C10] p-4 font-mono text-[13px] leading-relaxed text-ink outline-none"
                  />
                </>
              )}
            </div>
          )}
          {stage}
          {consolePanel}
        </main>
      </div>
    </div>
  );
}
