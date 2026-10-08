import { useEffect } from 'react';
import { Link } from 'react-router';
import { Clapperboard, Sparkles } from 'lucide-react';
import type { ProjectFiles } from '@degamed/shared';
import { useEd } from './state';
import { GameView } from './GameView';
import { starterProject } from '../lib/project-files';

/** Reads one numeric prop on the first entity running `scriptPath`. */
function scriptProp(files: ProjectFiles, scenePath: string, scriptPath: string, prop: string): number | undefined {
  try {
    const scene = JSON.parse(files[scenePath] ?? '{}') as { entities?: { components?: { Script?: { src: string; props?: Record<string, unknown> } } }[] };
    const v = scene.entities?.find((x) => x.components?.Script?.src === scriptPath)?.components?.Script?.props?.[prop];
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

/** The beginner layout: AI and a few sliders on the left, the running game on the right. */
export function SimpleMode({ onOpenPro, title }: { onOpenPro: () => void; title: string }) {
  const ed = useEd();
  const { files, startScene } = ed;

  // The game is the point of this view: start it right away (the player queues it until it has loaded).
  useEffect(() => {
    if (ed.running === 'stopped') ed.run('project');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run shortly after slider changes.
  useEffect(() => {
    if (ed.running === 'stopped') return;
    const t = window.setTimeout(() => ed.run('project'), 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files[startScene]]);

  const animations = Object.keys(files).filter((p) => p.endsWith('.frames.json'));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto md:flex-row-reverse md:overflow-hidden">
      <div className="flex h-[62vw] min-h-[240px] shrink-0 flex-col md:h-auto md:min-w-0 md:flex-1">
        <GameView visible />
      </div>
      <aside className="flex shrink-0 flex-col gap-3 border-[#1F222B] bg-[#121419] p-3 text-[13px] md:w-[360px] md:overflow-auto md:border-r">
        <div className="flex flex-col gap-2 rounded-lg border border-[#3A2F80] bg-[#17142A] p-3.5">
          <strong className="flex items-center gap-2">
            <Sparkles size={15} className="text-cyan" aria-hidden="true" /> AI Copilot
          </strong>
          <p className="text-muted">
            Describe changes in plain words and AI edits {title}. It arrives in the next update. Add your AI keys in{' '}
            <Link to="/settings" className="text-brand-soft underline">
              Settings
            </Link>{' '}
            to be ready.
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-[#232734] bg-[#16181F] p-3.5">
          <strong>Quick edit</strong>
          {QUICK_EDITS.map((q) => {
            const value = scriptProp(files, startScene, 'scripts/player.js', q.prop) ?? q.fallback;
            return (
              <label key={q.prop} className="flex flex-col gap-1.5">
                <span className="flex justify-between">
                  <span>{q.label}</span>
                  <span className="font-mono text-muted">{value}</span>
                </span>
                <input
                  type="range"
                  min={q.min}
                  max={q.max}
                  value={value}
                  className="accent-[#7C5CFF]"
                  onChange={(e) => ed.commit(withScriptProp(files, startScene, 'scripts/player.js', q.prop, Number(e.target.value)), `Change ${q.label}`, `quick:${q.prop}`)}
                />
              </label>
            );
          })}
          <button
            type="button"
            onClick={() => ed.commit(starterProject(title), 'Reset to starter template')}
            className="self-start text-[12.5px] text-muted underline hover:text-white"
          >
            Reset to the starter template
          </button>
        </div>
        {animations.length > 0 && (
          <div className="flex flex-col gap-1 rounded-lg border border-[#232734] bg-[#16181F] p-3.5">
            <strong className="mb-1">Animations</strong>
            {animations.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  onOpenPro();
                  ed.openFile(p);
                }}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-[#1C1F28]"
              >
                <Clapperboard size={14} className="text-cyan" aria-hidden="true" />
                {p.slice(p.lastIndexOf('/') + 1).replace('.frames.json', '')}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 rounded-lg border border-[#232734] bg-[#16181F] p-3.5">
          <strong>Want full control?</strong>
          <p className="text-muted">Pro mode has the scene editor, hierarchy, properties, code editor and animation tools.</p>
          <button type="button" onClick={onOpenPro} className="self-start rounded bg-[#6B4EFF] px-3 py-1.5 font-medium text-white hover:bg-[#7C61FF]">
            Switch to Pro
          </button>
        </div>
      </aside>
    </div>
  );
}
