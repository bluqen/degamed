import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ProjectManifest } from '@degamed/shared';
import { ART_STYLES } from '@degamed/art';
import { Clock, Gamepad2, Keyboard, Monitor, Plus, Search, Settings2, Star, Trash2, Zap } from 'lucide-react';
import { useEd } from './state';
import { PRESETS, PRESET_CATEGORIES, presetContext, type Preset } from './presets';
import { addFromPreset, attachScript, recentPresets } from './actions';
import { buildCommands, keyLabel, type Command } from './commands';
import { newScene, newScript, renameFile } from './file-actions';
import { Btn, Dialog, Kbd, fieldInput } from './ui';
import { COMPONENTS } from './PropertiesDock';
import type { ComponentName } from './scene-ops';

export function Dialogs() {
  const ed = useEd();
  const d = ed.dialog;
  const close = () => ed.setDialog(null);
  if (!d) return null;
  switch (d.type) {
    case 'add-entity':
      return <AddEntityDialog parentId={d.parentId} afterId={d.afterId} at={d.at} onClose={close} />;
    case 'settings':
      return <SettingsDialog section={d.section} onClose={close} />;
    case 'palette':
      return <CommandPalette onClose={close} />;
    case 'shortcuts':
      return <ShortcutsDialog onClose={close} />;
    case 'new-script':
      return <NewScriptDialog attachTo={d.attachTo} onClose={close} />;
    case 'new-scene':
      return <NameDialog title="New Scene" label="Scene name" initial="Level 2" action="Create" onClose={close} onSubmit={(name) => newScene(ed, name)} />;
    case 'rename-file':
      return (
        <NameDialog
          title="Rename File"
          label="Path"
          mono
          initial={d.path}
          action="Rename"
          note="Scenes and animation files that point at it are updated too."
          onClose={close}
          validate={(v) => (v === d.path ? null : ed.files[v] !== undefined ? 'A file with that name already exists' : !/^[\w./-]+$/.test(v) ? 'Use letters, numbers, - _ . and /' : null)}
          onSubmit={(v) => renameFile(ed, d.path, v)}
        />
      );
    case 'confirm':
      return (
        <Dialog
          title={d.title}
          onClose={close}
          width={420}
          footer={
            <>
              <Btn onClick={close}>Cancel</Btn>
              <Btn
                primary={!d.danger}
                danger={d.danger}
                onClick={() => {
                  close();
                  d.onConfirm();
                }}
              >
                {d.confirm}
              </Btn>
            </>
          }
        >
          <div className="p-4 leading-relaxed text-ink-2">{d.body}</div>
        </Dialog>
      );
  }
}

/* ─── Add Entity ──────────────────────────────────────────────────────── */

const FAV_KEY = 'degamed.editor.favoritePresets';
function readFavs(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function AddEntityDialog({ parentId, afterId, at, onClose }: { parentId: string | null; afterId: string | null; at?: { x: number; y: number }; onClose: () => void }) {
  const ed = useEd();
  const [q, setQ] = useState('');
  const [favs, setFavs] = useState(readFavs);
  const recent = useMemo(recentPresets, []);
  const list = PRESETS.filter((p) => !q || `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q.toLowerCase()));
  const [pick, setPick] = useState<Preset | undefined>(list[0]);
  const current = pick && list.includes(pick) ? pick : list[0];
  const listRef = useRef<HTMLDivElement>(null);
  const parentName = parentId && ed.scene ? (ed.scene.entities.length && findName(ed.scene.entities, parentId)) : null;

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
    setFavs(next);
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked.
    }
  };

  const create = (p = current) => {
    if (!p) return;
    addFromPreset(ed, p, { parentId, afterId, at });
    onClose();
  };

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const move = (d: 1 | -1) => {
    const i = current ? list.indexOf(current) : -1;
    setPick(list[Math.max(0, Math.min(list.length - 1, i + d))]);
  };

  const row = (p: Preset, key: string) => (
    <button
      key={key}
      type="button"
      role="option"
      aria-selected={current === p}
      onClick={() => setPick(p)}
      onDoubleClick={() => create(p)}
      className={`flex w-full items-center gap-2 px-3 py-1 text-left ${current === p ? 'bg-[#2B2550] text-white' : 'text-ink-2 hover:bg-[#1C1F28]'}`}
    >
      <PresetIcon p={p} />
      <span className="flex-1 truncate">{p.name}</span>
    </button>
  );

  const preview = current ? current.components(presetContext(ed.files, { x: 0, y: 0 })) : null;

  return (
    <Dialog
      title={parentName ? `Add Entity inside ${parentName}` : 'Add Entity'}
      onClose={onClose}
      width={720}
      height={520}
      footer={
        <>
          <span className="mr-auto text-[11.5px] text-muted">Enter to add · double-click works too</span>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn primary onClick={() => create()} disabled={!current}>
            Add
          </Btn>
        </>
      }
    >
      <div className="flex min-h-0 flex-1">
        <div className="flex w-[300px] shrink-0 flex-col border-r border-[#252935]">
          <div className="p-2">
            <label className="flex h-7 items-center gap-1.5 rounded border border-[#2A2E3A] bg-[#0F1015] px-2 focus-within:border-[#6B4EFF]">
              <Search size={13} className="text-muted" aria-hidden="true" />
              <input
                data-autofocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') (e.preventDefault(), move(1));
                  if (e.key === 'ArrowUp') (e.preventDefault(), move(-1));
                  if (e.key === 'Enter') create();
                }}
                placeholder="Search: player, coin, wall, text…"
                aria-label="Search entity types"
                className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
              />
            </label>
          </div>
          <div ref={listRef} role="listbox" aria-label="Entity types" className="min-h-0 flex-1 overflow-auto pb-2 text-[12.5px]">
            {!q && favs.length > 0 && (
              <>
                <Heading icon={<Star size={11} />}>Favourites</Heading>
                {favs.map((id) => PRESETS.find((p) => p.id === id)).filter((p): p is Preset => !!p).map((p) => row(p, `fav-${p.id}`))}
              </>
            )}
            {!q && recent.length > 0 && (
              <>
                <Heading icon={<Clock size={11} />}>Recent</Heading>
                {recent.map((id) => PRESETS.find((p) => p.id === id)).filter((p): p is Preset => !!p).map((p) => row(p, `recent-${p.id}`))}
              </>
            )}
            {PRESET_CATEGORIES.map((cat) => {
              const items = list.filter((p) => p.category === cat);
              if (!items.length) return null;
              return (
                <div key={cat}>
                  <Heading>{cat}</Heading>
                  {items.map((p) => row(p, p.id))}
                </div>
              );
            })}
            {list.length === 0 && <p className="px-3 py-2 text-muted">Nothing matches “{q}”.</p>}
          </div>
        </div>
        {current && preview && (
          <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-auto p-4">
            <div className="flex items-center gap-2">
              <PresetIcon p={current} big />
              <h3 className="text-[15px] font-semibold">{current.name}</h3>
              <button
                type="button"
                aria-pressed={favs.includes(current.id)}
                aria-label={favs.includes(current.id) ? 'Remove from favourites' : 'Add to favourites'}
                onClick={() => toggleFav(current.id)}
                className={`ml-auto rounded p-1 ${favs.includes(current.id) ? 'text-warn' : 'text-muted hover:text-white'}`}
              >
                <Star size={15} fill={favs.includes(current.id) ? 'currentColor' : 'none'} />
              </button>
            </div>
            <p className="leading-relaxed text-ink-2">{current.description}</p>
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-[#6E7587] uppercase">Comes with</div>
              <ul className="flex flex-col gap-1">
                {(Object.keys(preview) as ComponentName[]).map((name) => (
                  <li key={name} className="flex items-center gap-2 rounded bg-[#121419] px-2 py-1.5">
                    <span style={{ color: COMPONENTS[name].color }} className="flex">
                      {COMPONENTS[name].icon}
                    </span>
                    <span className="font-medium">{COMPONENTS[name].label}</span>
                    <span className="truncate text-[11.5px] text-muted">{COMPONENTS[name].description}</span>
                  </li>
                ))}
              </ul>
            </div>
            {current.tags?.length ? (
              <p className="text-[12px] text-muted">
                Tags: {current.tags.map((t) => <code key={t} className="mr-1 rounded bg-[#232734] px-1 text-ink-2">{t}</code>)}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </Dialog>
  );
}

function findName(list: import('@degamed/shared').Entity[], id: string): string | null {
  for (const e of list) {
    if (e.id === id) return e.name;
    const n = findName(e.children, id);
    if (n) return n;
  }
  return null;
}

function PresetIcon({ p, big }: { p: Preset; big?: boolean }) {
  const ed = useEd();
  const comps = p.components(presetContext(ed.files, { x: 0, y: 0 }));
  const main = (['Camera', 'Text', 'AnimatedSprite', 'Sprite', 'MusicPlayer', 'Body', 'Transform'] as ComponentName[]).find((c) => comps[c]) ?? 'Transform';
  return (
    <span className={`flex shrink-0 items-center justify-center rounded ${big ? 'size-7 bg-[#1C1F28]' : ''}`} style={{ color: COMPONENTS[main].color }}>
      {COMPONENTS[main].icon}
    </span>
  );
}

function Heading({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-1 px-3 pt-2.5 pb-1 text-[10.5px] font-semibold tracking-wide text-[#6E7587] uppercase">
      {icon}
      {children}
    </div>
  );
}

/* ─── Game settings ───────────────────────────────────────────────────── */

const KEY_NAMES: Record<string, string> = { Space: 'Space', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Enter: 'Enter', Escape: 'Esc', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift' };
const prettyKey = (code: string) => KEY_NAMES[code] ?? code.replace(/^Key/, '').replace(/^Digit/, '');

function SettingsDialog({ section, onClose }: { section?: string; onClose: () => void }) {
  const ed = useEd();
  const [tab, setTab] = useState(section ?? 'general');
  const m = ed.manifest;
  if (!m) {
    return (
      <Dialog title="Game Settings" onClose={onClose}>
        <p className="p-4 text-bad">project.json has a problem. Open it in the Code tab to fix it.</p>
      </Dialog>
    );
  }
  const save = (patch: Partial<ProjectManifest>, label: string, merge?: string) => {
    const next = ProjectManifest.safeParse({ ...m, ...patch });
    if (next.success) ed.commit({ ...ed.files, 'project.json': JSON.stringify(next.data, null, 2) }, label, merge);
  };
  const scenes = Object.keys(ed.files).filter((p) => p.endsWith('.scene.json'));
  const sections = [
    { id: 'general', label: 'General', icon: <Settings2 size={13} /> },
    { id: 'display', label: 'Display', icon: <Monitor size={13} /> },
    { id: 'physics', label: 'Physics', icon: <Zap size={13} /> },
    { id: 'input', label: 'Controls', icon: <Gamepad2 size={13} /> },
  ];
  return (
    <Dialog title="Game Settings" onClose={onClose} width={760} height={540} footer={<Btn primary onClick={onClose}>Done</Btn>}>
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Settings sections" className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-[#252935] p-2">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-current={tab === s.id ? 'page' : undefined}
              onClick={() => setTab(s.id)}
              className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-left ${tab === s.id ? 'bg-[#2B2550] text-white' : 'text-ink-2 hover:bg-[#1C1F28]'}`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 overflow-auto p-4">
          {tab === 'general' && (
            <Fields>
              <Field label="Title">
                <input className={fieldInput} defaultValue={m.title} onBlur={(e) => e.target.value.trim() && e.target.value !== m.title && save({ title: e.target.value.trim() }, 'Rename game')} />
              </Field>
              <Field label="Start scene" hint="What plays first when the game runs">
                <select className={fieldInput} value={m.startScene} onChange={(e) => save({ startScene: e.target.value }, 'Set start scene')}>
                  {scenes.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Art style" hint="Used when AI makes art for this game">
                <select className={fieldInput} value={m.artStyle} onChange={(e) => save({ artStyle: e.target.value as ProjectManifest['artStyle'] }, 'Change art style')}>
                  {ART_STYLES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Script language" hint="For new scripts">
                <select className={fieldInput} value={m.defaultLanguage} onChange={(e) => save({ defaultLanguage: e.target.value as ProjectManifest['defaultLanguage'] }, 'Change language')}>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python (running soon)</option>
                </select>
              </Field>
            </Fields>
          )}
          {tab === 'display' && (
            <Fields>
              <Field label="Game screen size" hint="In game pixels. Pixel art looks best small (e.g. 480 × 270), then scaled up.">
                <div className="flex items-center gap-2">
                  <input type="number" className={fieldInput} defaultValue={m.resolution.width} min={64} max={4096} aria-label="Width" onBlur={(e) => save({ resolution: { ...m.resolution, width: Number(e.target.value) } }, 'Change screen size')} />
                  <span className="text-muted">×</span>
                  <input type="number" className={fieldInput} defaultValue={m.resolution.height} min={64} max={4096} aria-label="Height" onBlur={(e) => save({ resolution: { ...m.resolution, height: Number(e.target.value) } }, 'Change screen size')} />
                </div>
              </Field>
              <Field label="Presets">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    [320, 180, 'Retro 16:9'],
                    [480, 270, 'Pixel 16:9'],
                    [640, 360, 'Crisp 16:9'],
                    [1280, 720, 'HD'],
                    [270, 480, 'Phone portrait'],
                  ].map(([w, h, label]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => save({ resolution: { width: w as number, height: h as number } }, 'Change screen size')}
                      className={`rounded border px-2 py-1 text-[12px] ${m.resolution.width === w && m.resolution.height === h ? 'border-[#6B4EFF] bg-[#1E1A3A] text-white' : 'border-[#2E3342] text-ink-2 hover:text-white'}`}
                    >
                      {label} <span className="text-muted">{w}×{h}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Palette" hint="Colours the AI and art tools stick to">
                <div className="flex flex-wrap gap-1">
                  {m.palette.map((c, i) => (
                    <input
                      key={i}
                      type="color"
                      value={c}
                      aria-label={`Palette colour ${i + 1}`}
                      onChange={(e) => save({ palette: m.palette.map((x, j) => (j === i ? e.target.value.toUpperCase() : x)) }, 'Change palette', 'palette')}
                      className="h-7 w-7 cursor-pointer rounded border border-[#2A2E3A] bg-transparent p-0.5"
                    />
                  ))}
                </div>
              </Field>
            </Fields>
          )}
          {tab === 'physics' && (
            <Fields>
              <Field label="Physics engine">
                <select className={fieldInput} value={m.physics.engine} onChange={(e) => save({ physics: { ...m.physics, engine: e.target.value as 'arcade' | 'matter' } }, 'Change physics')}>
                  <option value="arcade">Arcade (fast boxes, best for platformers)</option>
                  <option value="matter">Realistic (rotating shapes)</option>
                </select>
              </Field>
              <Field label="Gravity" hint="Pixels per second², down is positive">
                <div className="flex items-center gap-2">
                  <input type="number" className={fieldInput} defaultValue={m.physics.gravity.x} aria-label="Gravity x" onBlur={(e) => save({ physics: { ...m.physics, gravity: { ...m.physics.gravity, x: Number(e.target.value) } } }, 'Change gravity')} />
                  <input type="number" className={fieldInput} defaultValue={m.physics.gravity.y} aria-label="Gravity y" onBlur={(e) => save({ physics: { ...m.physics, gravity: { ...m.physics.gravity, y: Number(e.target.value) } } }, 'Change gravity')} />
                </div>
              </Field>
            </Fields>
          )}
          {tab === 'input' && <InputMap input={m.input} onChange={(input, label) => save({ input }, label)} />}
        </div>
      </div>
    </Dialog>
  );
}

function Fields({ children }: { children: ReactNode }) {
  return <div className="flex max-w-[520px] flex-col gap-4">{children}</div>;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-muted">{hint}</span>}
    </div>
  );
}

/** Actions (jump, shoot…) and the keys that trigger them. */
function InputMap({ input, onChange }: { input: Record<string, string[]>; onChange: (next: Record<string, string[]>, label: string) => void }) {
  const [listening, setListening] = useState<string | null>(null);
  const [name, setName] = useState('');
  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape') {
        const keys = input[listening] ?? [];
        if (!keys.includes(e.code)) onChange({ ...input, [listening]: [...keys, e.code] }, `Add key to ${listening}`);
      }
      setListening(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening, input, onChange]);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">
        Scripts ask for actions, not keys: <code className="text-ink-2">Input.isPressed('jump')</code>. Arrow keys and WASD always drive <code className="text-ink-2">Input.axis('horizontal')</code>.
      </p>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[11px] tracking-wide text-[#6E7587] uppercase">
            <th className="w-36 py-1 font-semibold">Action</th>
            <th className="py-1 font-semibold">Keys</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {Object.entries(input).map(([action, keys]) => (
            <tr key={action} className="border-t border-[#1F222B]">
              <td className="py-1.5 font-mono">{action}</td>
              <td className="py-1.5">
                <div className="flex flex-wrap items-center gap-1">
                  {keys.map((k) => (
                    <span key={k} className="inline-flex items-center gap-1 rounded border border-[#2E3342] bg-[#0F1015] py-0.5 pr-1 pl-1.5 text-[11.5px]">
                      <Keyboard size={11} className="text-muted" />
                      {prettyKey(k)}
                      <button type="button" aria-label={`Remove ${prettyKey(k)}`} onClick={() => onChange({ ...input, [action]: keys.filter((x) => x !== k) }, `Remove key from ${action}`)} className="text-muted hover:text-bad">
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setListening(action)}
                    className={`rounded px-1.5 py-0.5 text-[11.5px] ${listening === action ? 'animate-pulse bg-[#2B2550] text-white' : 'text-brand-soft hover:underline'}`}
                  >
                    {listening === action ? 'Press a key… (Esc cancels)' : '+ key'}
                  </button>
                </div>
              </td>
              <td>
                <button
                  type="button"
                  aria-label={`Delete action ${action}`}
                  onClick={() => {
                    const next = { ...input };
                    delete next[action];
                    onChange(next, `Delete action ${action}`);
                  }}
                  className="p-1 text-muted hover:text-bad"
                >
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const a = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
          if (a && !input[a]) onChange({ ...input, [a]: [] }, `Add action ${a}`);
          setName('');
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New action, e.g. shoot" aria-label="New action name" className={`${fieldInput} max-w-60`} />
        <Btn type="submit" disabled={!name.trim()}>
          <Plus size={13} /> Add action
        </Btn>
      </form>
    </div>
  );
}

/* ─── Command palette & shortcuts ─────────────────────────────────────── */

function CommandPalette({ onClose }: { onClose: () => void }) {
  const ed = useEd();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const commands = buildCommands(ed).filter((c) => c.id !== 'help.palette');
  const fileHits = q.length > 1 ? Object.keys(ed.files).filter((p) => p.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = commands.filter((c) => words.every((w) => `${c.group} ${c.label}`.toLowerCase().includes(w)));
  const items: { key: string; label: ReactNode; hint?: string; run: () => void; disabled?: boolean }[] = [
    ...hits.map((c) => ({ key: c.id, label: <><span className="text-[#6E7587]">{c.group}: </span>{c.label}</>, hint: c.shortcut, run: c.run, disabled: c.enabled === false })),
    ...fileHits.map((p) => ({ key: `file:${p}`, label: <><span className="text-[#6E7587]">Open file: </span><span className="font-mono">{p}</span></>, run: () => ed.openFile(p) })),
  ];
  const sel = Math.min(i, Math.max(0, items.length - 1));
  const go = (n: number) => {
    const it = items[n];
    if (!it || it.disabled) return;
    onClose();
    it.run();
  };
  return (
    <Dialog title="Command Palette" onClose={onClose} width={560}>
      <div className="p-2">
        <input
          data-autofocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setI(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), setI(Math.min(sel + 1, items.length - 1)));
            if (e.key === 'ArrowUp') (e.preventDefault(), setI(Math.max(sel - 1, 0)));
            if (e.key === 'Enter') go(sel);
          }}
          placeholder="Type a command or a file name…"
          aria-label="Command"
          className={`${fieldInput} h-8 text-[13px]`}
        />
      </div>
      <ul role="listbox" aria-label="Commands" className="max-h-[50vh] overflow-auto pb-2 text-[12.5px]">
        {items.map((it, n) => (
          <li key={it.key}>
            <button
              type="button"
              role="option"
              aria-selected={n === sel}
              disabled={it.disabled}
              onMouseMove={() => setI(n)}
              onClick={() => go(n)}
              className={`flex w-full items-center px-3 py-1.5 text-left disabled:opacity-40 ${n === sel ? 'bg-[#2B2550] text-white' : 'text-ink-2'}`}
            >
              <span className="flex-1 truncate">{it.label}</span>
              {it.hint && <kbd className="font-sans text-[11px] text-[#7D8496]">{keyLabel(it.hint)}</kbd>}
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="px-3 py-2 text-muted">No commands match.</li>}
      </ul>
    </Dialog>
  );
}

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const ed = useEd();
  const groups = new Map<string, Command[]>();
  for (const c of buildCommands(ed)) if (c.shortcut) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
  const extra = [
    ['Pan the view', 'Middle-drag or Space + drag'],
    ['Zoom', 'Mouse wheel or pinch'],
    ['Nudge selection', 'Arrow keys (Shift = one grid step)'],
    ['Pick the thing underneath', 'Alt + click'],
    ['Lock a drag to one direction', 'Shift while dragging'],
    ['Rename', 'F2 or double-click in the Hierarchy'],
  ];
  return (
    <Dialog title="Keyboard Shortcuts" onClose={onClose} width={680}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-4">
        {[...groups].map(([g, list]) => (
          <section key={g}>
            <h3 className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-[#6E7587] uppercase">{g}</h3>
            <ul className="flex flex-col gap-1">
              {list.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="text-ink-2">{c.label.replace(/…$/, '')}</span>
                  <Kbd>{keyLabel(c.shortcut!)}</Kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section>
          <h3 className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-[#6E7587] uppercase">Scene view</h3>
          <ul className="flex flex-col gap-1">
            {extra.map(([a, b]) => (
              <li key={a} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="text-ink-2">{a}</span>
                <span className="text-right text-[11.5px] text-muted">{b}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Dialog>
  );
}

/* ─── Small dialogs ───────────────────────────────────────────────────── */

function NameDialog({
  title,
  label,
  initial,
  action,
  note,
  mono,
  validate,
  onSubmit,
  onClose,
}: {
  title: string;
  label: string;
  initial: string;
  action: string;
  note?: string;
  mono?: boolean;
  validate?: (v: string) => string | null;
  onSubmit: (v: string) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState(initial);
  const problem = validate?.(v.trim()) ?? null;
  const submit = () => {
    if (!v.trim() || problem) return;
    onClose();
    onSubmit(v.trim());
  };
  return (
    <Dialog
      title={title}
      onClose={onClose}
      width={440}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn primary onClick={submit} disabled={!v.trim() || !!problem}>
            {action}
          </Btn>
        </>
      }
    >
      <form
        className="flex flex-col gap-1.5 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="text-[12.5px] font-medium" htmlFor="name-dialog-input">
          {label}
        </label>
        <input
          id="name-dialog-input"
          data-autofocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          onFocus={(e) => {
            const dot = e.currentTarget.value.lastIndexOf('/');
            e.currentTarget.setSelectionRange(dot + 1, e.currentTarget.value.indexOf('.', dot + 1) > 0 ? e.currentTarget.value.indexOf('.', dot + 1) : e.currentTarget.value.length);
          }}
          className={`${fieldInput} h-8 text-[13px] ${mono ? 'font-mono' : ''}`}
        />
        {problem && <span className="text-[12px] text-bad">{problem}</span>}
        {note && <span className="text-[11.5px] text-muted">{note}</span>}
      </form>
    </Dialog>
  );
}

function NewScriptDialog({ attachTo, onClose }: { attachTo?: string[]; onClose: () => void }) {
  const ed = useEd();
  const scripts = Object.keys(ed.files).filter((p) => /\.(js|py)$/.test(p));
  const [mode, setMode] = useState<'new' | 'existing'>(attachTo?.length && scripts.length ? 'existing' : 'new');
  const [name, setName] = useState(attachTo?.length === 1 && ed.scene ? (findName(ed.scene.entities, attachTo[0]!) ?? 'my-script') : 'my-script');
  const [existing, setExisting] = useState(scripts[0] ?? '');
  const go = () => {
    const path = mode === 'new' ? newScript(ed, name) : existing;
    if (attachTo?.length) attachScript(ed, attachTo, path);
    onClose();
    if (mode === 'new') ed.openFile(path);
  };
  return (
    <Dialog
      title={attachTo?.length ? 'Attach Script' : 'New Script'}
      onClose={onClose}
      width={460}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn primary onClick={go} disabled={mode === 'new' ? !name.trim() : !existing}>
            {mode === 'new' ? (attachTo?.length ? 'Create & attach' : 'Create') : 'Attach'}
          </Btn>
        </>
      }
    >
      <form
        className="flex flex-col gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        {attachTo?.length ? (
          <div role="radiogroup" className="flex gap-1 rounded bg-[#0F1015] p-0.5">
            {(['new', 'existing'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                disabled={m === 'existing' && !scripts.length}
                onClick={() => setMode(m)}
                className={`flex-1 rounded py-1 text-[12px] disabled:opacity-40 ${mode === m ? 'bg-[#2B2550] text-white' : 'text-ink-2'}`}
              >
                {m === 'new' ? 'New script' : 'Existing script'}
              </button>
            ))}
          </div>
        ) : null}
        {mode === 'new' ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium">Name</span>
            <input data-autofocus value={name} onChange={(e) => setName(e.target.value)} className={`${fieldInput} h-8 text-[13px]`} />
            <span className="text-[11.5px] text-muted">
              Creates <code className="text-ink-2">scripts/{name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'script'}.js</code> with onStart, onUpdate and onCollide ready to fill in.
            </span>
          </label>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium">Script</span>
            <select value={existing} onChange={(e) => setExisting(e.target.value)} className={`${fieldInput} h-8 font-mono`}>
              {scripts.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
      </form>
    </Dialog>
  );
}
