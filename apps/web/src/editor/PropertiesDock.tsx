import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Components, Entity, Scene } from '@degamed/shared';
import {
  ArrowDown,
  ArrowUp,
  Box,
  Camera,
  Clapperboard,
  Copy,
  ExternalLink,
  FileCode2,
  History,
  Image as ImageIcon,
  Layers,
  Move3d,
  Music,
  MoreHorizontal,
  Plus,
  Search,
  Shapes,
  SlidersHorizontal,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { useEd, type Ed } from './state';
import { getFrames } from './scene-render';
import { locate, setComponent, updateEntities, type ComponentName } from './scene-ops';
import { fileType, readScriptProps, type FileType } from './file-tree';
import { rename, setEnabled } from './actions';
import {
  ColorField,
  MenuButton,
  NumberField,
  PropRow,
  Section,
  SelectField,
  TabStrip,
  TextField,
  Toggle,
  fieldInput,
  type MenuItem,
} from './ui';

/* ─── Component catalogue ─────────────────────────────────────────────── */

interface ComponentMeta {
  label: string;
  icon: ReactNode;
  color: string;
  description: string;
  make: (ed: Ed) => NonNullable<Components[ComponentName]>;
}

const zeroT = { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } };

export const COMPONENTS: Record<ComponentName, ComponentMeta> = {
  Transform: { label: 'Transform', icon: <Move3d size={13} />, color: '#FF8A65', description: 'Position, rotation and size in the world.', make: () => zeroT },
  Sprite: {
    label: 'Sprite',
    icon: <ImageIcon size={13} />,
    color: '#34D399',
    description: 'Draws an image.',
    make: (ed) => ({ asset: Object.keys(ed.files).find((p) => fileType(p) === 'image') ?? '', tiled: false, flipX: false, depth: 0 }),
  },
  AnimatedSprite: {
    label: 'Animated Sprite',
    icon: <Clapperboard size={13} />,
    color: '#22D3EE',
    description: 'Plays frame animations from a .frames.json file.',
    make: (ed) => ({ frames: Object.keys(ed.files).find((p) => p.endsWith('.frames.json')) ?? 'assets/anims/new.frames.json', playing: true, auto: false, flipX: false, depth: 0 }),
  },
  Body: {
    label: 'Body',
    icon: <Shapes size={13} />,
    color: '#FBBF24',
    description: 'Physics: gravity, collisions and triggers.',
    make: () => ({ type: 'dynamic', gravity: true, bounce: 0, sensor: false }),
  },
  Script: {
    label: 'Script',
    icon: <FileCode2 size={13} />,
    color: '#FBBF24',
    description: 'Behaviour written in JavaScript (Python coming).',
    make: (ed) => ({ src: Object.keys(ed.files).find((p) => fileType(p) === 'script') ?? 'scripts/new.js', props: {} }),
  },
  Camera: { label: 'Camera', icon: <Camera size={13} />, color: '#C9BCFF', description: 'What the player sees.', make: () => ({ zoom: 1 }) },
  Text: { label: 'Text', icon: <Type size={13} />, color: '#7DD3FC', description: 'Words on screen.', make: () => ({ text: 'Text', size: 10, color: '#FFFFFF' }) },
  MusicPlayer: { label: 'Music Player', icon: <Music size={13} />, color: '#FF5CA8', description: 'Plays a song.', make: () => ({ song: 'audio/songs/theme.song.json', autoplay: true }) },
};

const ORDER: ComponentName[] = ['Transform', 'Sprite', 'AnimatedSprite', 'Body', 'Script', 'Camera', 'Text', 'MusicPlayer'];

/* ─── Filter context ──────────────────────────────────────────────────── */

const FilterCtx = createContext('');
function Row(props: Parameters<typeof PropRow>[0]) {
  const q = useContext(FilterCtx);
  if (q && !props.label.toLowerCase().includes(q)) return null;
  return <PropRow {...props} />;
}

/* ─── Dock ────────────────────────────────────────────────────────────── */

export function RightDock() {
  const ed = useEd();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TabStrip
        tabs={[
          { id: 'properties', label: <span className="flex items-center gap-1.5"><SlidersHorizontal size={12} /> Properties</span> },
          { id: 'history', label: <span className="flex items-center gap-1.5"><History size={12} /> History</span> },
        ]}
        active={ed.rightTab}
        onChange={ed.setRightTab}
      />
      {ed.rightTab === 'properties' ? <PropertiesPanel /> : <HistoryPanel />}
    </div>
  );
}

function PropertiesPanel() {
  const ed = useEd();
  const [filter, setFilter] = useState('');
  const { scene, selection } = ed;
  const entities = useMemo(
    () => (scene ? selection.map((id) => locate(scene.entities, id)?.entity).filter((e): e is Entity => !!e) : []),
    [scene, selection],
  );

  if (ed.workspace === 'code' || ed.workspace === 'art') {
    return <FileInfo />;
  }
  if (!scene) return <p className="p-3 text-[12px] text-bad">The scene file has a problem: {ed.sceneError}</p>;

  return (
    <FilterCtx.Provider value={filter.trim().toLowerCase()}>
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-[#1F222B] px-1.5">
        <label className="flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded border border-[#2A2E3A] bg-[#0F1015] px-1.5 focus-within:border-[#6B4EFF]">
          <Search size={12} className="shrink-0 text-muted" aria-hidden="true" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter properties" aria-label="Filter properties" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none" />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-auto pb-6">{entities.length ? <EntityInspector entities={entities} /> : <SceneInspector scene={scene} />}</div>
    </FilterCtx.Provider>
  );
}

/* ─── Entity inspector ────────────────────────────────────────────────── */

function EntityInspector({ entities }: { entities: Entity[] }) {
  const ed = useEd();
  const first = entities[0]!;
  const ids = entities.map((e) => e.id);
  const multi = entities.length > 1;
  const shared = ORDER.filter((name) => entities.every((e) => e.components[name] !== undefined));
  const missing = ORDER.filter((name) => entities.every((e) => e.components[name] === undefined));

  const write = <K extends ComponentName>(name: K, patch: (c: NonNullable<Components[K]>) => Components[K] | undefined, label: string, merge?: string) =>
    ed.editScene(
      (s) =>
        updateEntities(s, ids, (e) => {
          const c = e.components[name];
          return c === undefined ? e : setComponent(e, name, patch(c as NonNullable<Components[K]>));
        }),
      label,
      merge,
    );

  const addMenu: MenuItem[] = missing.map((name) => ({
    label: COMPONENTS[name].label,
    icon: <span style={{ color: COMPONENTS[name].color }}>{COMPONENTS[name].icon}</span>,
    onSelect: () =>
      ed.editScene((s) => updateEntities(s, ids, (e) => setComponent(e, name, COMPONENTS[name].make(ed) as never)), `Add ${COMPONENTS[name].label}`),
  }));

  return (
    <>
      <div className="flex flex-col gap-1.5 border-b border-[#1F222B] px-3 py-2.5">
        {multi ? (
          <div className="flex items-center gap-2 text-[12.5px]">
            <strong>{entities.length} entities</strong>
            <span className="text-muted">· editing what they share</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label="Enabled"
              title="Enabled"
              checked={first.active}
              onChange={(e) => setEnabled(ed, ids, e.target.checked)}
              className="size-3.5 accent-[#7C5CFF]"
            />
            <div className="min-w-0 flex-1">
              <TextField value={first.name} label="Name" onCommit={(v) => rename(ed, first.id, v)} />
            </div>
          </div>
        )}
        {!multi && (
          <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <span>id</span>
            <code className="truncate font-mono text-ink-2">{first.id}</code>
            <button type="button" aria-label="Copy id" title="Copy id (scripts find entities by it)" onClick={() => void navigator.clipboard?.writeText(first.id)} className="hover:text-white">
              <Copy size={11} />
            </button>
          </div>
        )}
        <TagEditor entities={entities} />
      </div>

      {shared.map((name) => {
        const meta = COMPONENTS[name];
        return (
          <Section
            key={name}
            title={meta.label}
            icon={meta.icon}
            accent={meta.color}
            menu={
              <MenuButton
                label={`${meta.label} options`}
                items={[
                  { label: 'Reset to Defaults', onSelect: () => write(name, () => meta.make(ed) as never, `Reset ${meta.label}`) },
                  { type: 'separator' },
                  { label: 'Remove Component', icon: <Trash2 size={13} />, danger: true, onSelect: () => write(name, () => undefined, `Remove ${meta.label}`) },
                ]}
              >
                <MoreHorizontal size={13} />
              </MenuButton>
            }
          >
            <ComponentFields name={name} entities={entities} write={write} />
          </Section>
        );
      })}

      <div className="p-3">
        {missing.length > 0 && (
          <MenuButton
            label="Add component"
            items={addMenu}
            className="flex h-7 w-full items-center justify-center gap-1.5 rounded border border-dashed border-[#3A3F4E] text-[12px] text-ink-2 hover:border-[#6B4EFF] hover:text-white"
          >
            <Plus size={13} /> Add Component
          </MenuButton>
        )}
      </div>
    </>
  );
}

const COMMON_TAGS = ['player', 'enemy', 'ground', 'coin', 'goal', 'ui'];

function TagEditor({ entities }: { entities: Entity[] }) {
  const ed = useEd();
  const [text, setText] = useState('');
  const ids = entities.map((e) => e.id);
  const tags = entities[0]!.tags.filter((t) => entities.every((e) => e.tags.includes(t)));
  const setTags = (fn: (tags: string[]) => string[], label: string) => ed.editScene((s) => updateEntities(s, ids, (e) => ({ ...e, tags: fn(e.tags) })), label);
  const add = (t: string) => {
    const tag = t.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (tag && !tags.includes(tag)) setTags((list) => (list.includes(tag) ? list : [...list, tag]), `Add tag ${tag}`);
    setText('');
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <span key={t} className="inline-flex h-5 items-center gap-1 rounded bg-[#232734] pr-1 pl-1.5 text-[11px] text-ink-2">
          {t}
          <button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags((l) => l.filter((x) => x !== t), `Remove tag ${t}`)} className="text-muted hover:text-white">
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        list="degamed-tags"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add(text)}
        onBlur={() => text && add(text)}
        placeholder="+ tag"
        aria-label="Add a tag"
        className="h-5 w-16 rounded bg-transparent px-1 text-[11px] outline-none placeholder:text-[#6E7587] focus:w-24 focus:bg-[#0F1015]"
      />
      <datalist id="degamed-tags">
        {COMMON_TAGS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
}

type Write = <K extends ComponentName>(name: K, patch: (c: NonNullable<Components[K]>) => Components[K] | undefined, label: string, merge?: string) => void;

function ComponentFields({ name, entities, write }: { name: ComponentName; entities: Entity[]; write: Write }) {
  const ed = useEd();
  const key = entities.map((e) => e.id).join(',');
  const m = (field: string) => `prop:${key}:${name}.${field}`;

  switch (name) {
    case 'Transform': {
      const t = entities[0]!.components.Transform!;
      const set = (patch: Partial<typeof t>, field: string, merge = true) => write('Transform', (c) => ({ ...c, ...patch }), `Change ${field}`, merge ? m(field) : undefined);
      const deg = Math.round(((t.rotation * 180) / Math.PI) * 100) / 100;
      return (
        <>
          <Row label="Position">
            <NumberField label="Position x" prefix="x" prefixColor="#FF5C7A" value={t.position.x} onChange={(x) => set({ position: { ...t.position, x } }, 'position')} onCommit={ed.seal} />
            <NumberField label="Position y" prefix="y" prefixColor="#4ADE80" value={t.position.y} onChange={(y) => set({ position: { ...t.position, y } }, 'position')} onCommit={ed.seal} />
          </Row>
          <Row label="Rotation" onRevert={t.rotation ? () => set({ rotation: 0 }, 'rotation', false) : undefined}>
            <NumberField label="Rotation in degrees" prefix="°" value={deg} onChange={(d) => set({ rotation: Number(((d * Math.PI) / 180).toFixed(5)) }, 'rotation')} onCommit={ed.seal} />
          </Row>
          <Row label="Scale" onRevert={t.scale.x !== 1 || t.scale.y !== 1 ? () => set({ scale: { x: 1, y: 1 } }, 'scale', false) : undefined}>
            <NumberField label="Scale x" prefix="x" prefixColor="#FF5C7A" step={0.05} value={t.scale.x} onChange={(x) => set({ scale: { ...t.scale, x } }, 'scale')} onCommit={ed.seal} />
            <NumberField label="Scale y" prefix="y" prefixColor="#4ADE80" step={0.05} value={t.scale.y} onChange={(y) => set({ scale: { ...t.scale, y } }, 'scale')} onCommit={ed.seal} />
          </Row>
        </>
      );
    }
    case 'Sprite': {
      const s = entities[0]!.components.Sprite!;
      const set = (patch: Partial<typeof s>, field: string, merge = false) => write('Sprite', (c) => ({ ...c, ...patch }), `Change Sprite ${field}`, merge ? m(field) : undefined);
      const img = ed.files[s.asset];
      return (
        <>
          <Row label="Image">
            <AssetField value={s.asset} types={['image']} onChange={(asset) => set({ asset }, 'image')} />
          </Row>
          <Row label="Repeat to fill" hint="Tile the image across the width and height (floors, walls)">
            <Toggle label="Repeat to fill" checked={s.tiled} onChange={(tiled) => set({ tiled }, 'repeat')} />
          </Row>
          <OptionalNumber label="Width" value={s.width} auto={img ? 'image width' : '16'} onChange={(width) => set({ width }, 'width', true)} onCommit={ed.seal} />
          <OptionalNumber label="Height" value={s.height} auto={img ? 'image height' : '16'} onChange={(height) => set({ height }, 'height', true)} onCommit={ed.seal} />
          <Row label="Tint" onRevert={s.tint ? () => set({ tint: undefined }, 'tint') : undefined}>
            <ColorField label="Tint" value={s.tint} onChange={(tint) => set({ tint }, 'tint', true)} />
          </Row>
          <Row label="Flip horizontally" onRevert={s.flipX ? () => set({ flipX: false }, 'flip') : undefined}>
            <Toggle label="Flip horizontally" checked={s.flipX} onChange={(flipX) => set({ flipX }, 'flip')} />
          </Row>
          <Row label="Draw order" hint="Higher numbers are drawn in front" onRevert={s.depth ? () => set({ depth: 0 }, 'draw order') : undefined}>
            <NumberField label="Draw order" value={s.depth} onChange={(depth) => set({ depth }, 'draw order', true)} onCommit={ed.seal} decimals={0} />
          </Row>
        </>
      );
    }
    case 'AnimatedSprite': {
      const a = entities[0]!.components.AnimatedSprite!;
      const set = (patch: Partial<typeof a>, field: string, merge = false) => write('AnimatedSprite', (c) => ({ ...c, ...patch }), `Change animation ${field}`, merge ? m(field) : undefined);
      const def = getFrames(ed.files[a.frames]);
      const names = def ? Object.keys(def.animations) : [];
      return (
        <>
          <Row label="Animations">
            <AssetField value={a.frames} types={['frames']} onChange={(frames) => set({ frames, animation: undefined }, 'file')} />
            <button
              type="button"
              title="Edit frames in the Animation panel"
              aria-label="Edit animations"
              onClick={() => ed.openFile(a.frames)}
              className="flex size-6 shrink-0 items-center justify-center rounded text-muted hover:bg-[#232734] hover:text-white"
            >
              <ExternalLink size={12} />
            </button>
          </Row>
          <Row label="Start with" onRevert={a.animation ? () => set({ animation: undefined }, 'start') : undefined}>
            <SelectField
              label="Start with"
              value={a.animation ?? ''}
              options={[{ value: '', label: names[0] ? `${names[0]} (first)` : '(none)' }, ...names.map((n) => ({ value: n, label: n }))]}
              onChange={(v) => set({ animation: v || undefined }, 'start')}
            />
          </Row>
          <Row label="Playing">
            <Toggle label="Playing" checked={a.playing} onChange={(playing) => set({ playing }, 'playing')} />
          </Row>
          <Row label="Auto states" hint="Picks idle / run / jump / fall from movement">
            <Toggle label="Auto states" checked={a.auto} onChange={(auto) => set({ auto }, 'auto')} />
          </Row>
          <Row label="Flip horizontally" onRevert={a.flipX ? () => set({ flipX: false }, 'flip') : undefined}>
            <Toggle label="Flip horizontally" checked={a.flipX} onChange={(flipX) => set({ flipX }, 'flip')} />
          </Row>
          <Row label="Draw order" hint="Higher numbers are drawn in front">
            <NumberField label="Draw order" value={a.depth} onChange={(depth) => set({ depth }, 'draw order', true)} onCommit={ed.seal} decimals={0} />
          </Row>
        </>
      );
    }
    case 'Body': {
      const b = entities[0]!.components.Body!;
      const set = (patch: Partial<typeof b>, field: string, merge = false) => write('Body', (c) => ({ ...c, ...patch }), `Change Body ${field}`, merge ? m(field) : undefined);
      return (
        <>
          <Row label="Type" hint="Dynamic moves and falls; static never moves; kinematic is moved by scripts">
            <SelectField
              label="Body type"
              value={b.type}
              options={[
                { value: 'dynamic', label: 'Dynamic (moves, falls)' },
                { value: 'static', label: 'Static (walls, floors)' },
                { value: 'kinematic', label: 'Kinematic (script-moved)' },
              ]}
              onChange={(type) => set({ type }, 'type')}
            />
          </Row>
          <Row label="Gravity">
            <Toggle label="Gravity" checked={b.gravity} onChange={(gravity) => set({ gravity }, 'gravity')} />
          </Row>
          <Row label="Bounce" onRevert={b.bounce ? () => set({ bounce: 0 }, 'bounce') : undefined}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={b.bounce}
              aria-label="Bounce"
              onChange={(e) => set({ bounce: Number(e.target.value) }, 'bounce', true)}
              onPointerUp={ed.seal}
              className="min-w-0 flex-1 accent-[#7C5CFF]"
            />
            <span className="w-8 text-right text-[11.5px] text-ink-2 tabular-nums">{b.bounce.toFixed(2)}</span>
          </Row>
          <Row label="Trigger only" hint="Detects touches without blocking (coins, goals)">
            <Toggle label="Trigger only" checked={b.sensor} onChange={(sensor) => set({ sensor }, 'trigger')} />
          </Row>
        </>
      );
    }
    case 'Script':
      return <ScriptFields entities={entities} write={write} />;
    case 'Camera': {
      const c = entities[0]!.components.Camera!;
      const set = (patch: Partial<typeof c>, field: string, merge = false) => write('Camera', (x) => ({ ...x, ...patch }), `Change Camera ${field}`, merge ? m(field) : undefined);
      const all: { value: string; label: string }[] = [];
      const visit = (list: Entity[]) => list.forEach((e) => (all.push({ value: e.id, label: `${e.name} (${e.id})` }), visit(e.children)));
      if (ed.scene) visit(ed.scene.entities);
      return (
        <>
          <Row label="Follow">
            <SelectField label="Follow" value={c.follow ?? ''} options={[{ value: '', label: '(stay still)' }, ...all]} onChange={(v) => set({ follow: v || undefined }, 'follow')} />
          </Row>
          <Row label="Zoom" onRevert={c.zoom !== 1 ? () => set({ zoom: 1 }, 'zoom') : undefined}>
            <NumberField label="Zoom" step={0.1} min={0.1} max={10} value={c.zoom} onChange={(zoom) => set({ zoom }, 'zoom', true)} onCommit={ed.seal} />
          </Row>
        </>
      );
    }
    case 'Text': {
      const t = entities[0]!.components.Text!;
      const set = (patch: Partial<typeof t>, field: string, merge = false) => write('Text', (x) => ({ ...x, ...patch }), `Change Text ${field}`, merge ? m(field) : undefined);
      return (
        <>
          <Row label="Text">
            <textarea
              aria-label="Text"
              defaultValue={t.text}
              key={t.text}
              rows={Math.min(4, t.text.split('\n').length)}
              onBlur={(e) => e.target.value !== t.text && set({ text: e.target.value }, 'text')}
              className={`${fieldInput} h-auto resize-y py-1`}
            />
          </Row>
          <Row label="Size">
            <NumberField label="Size" min={1} value={t.size} onChange={(size) => set({ size }, 'size', true)} onCommit={ed.seal} decimals={0} />
          </Row>
          <Row label="Colour">
            <ColorField label="Colour" value={t.color} onChange={(color) => set({ color }, 'colour', true)} />
          </Row>
        </>
      );
    }
    case 'MusicPlayer': {
      const mp = entities[0]!.components.MusicPlayer!;
      const set = (patch: Partial<typeof mp>, field: string) => write('MusicPlayer', (x) => ({ ...x, ...patch }), `Change Music ${field}`);
      return (
        <>
          <Row label="Song">
            <TextField label="Song" mono value={mp.song} onCommit={(song) => set({ song }, 'song')} />
          </Row>
          <Row label="Play on start">
            <Toggle label="Play on start" checked={mp.autoplay} onChange={(autoplay) => set({ autoplay }, 'autoplay')} />
          </Row>
          <p className="px-3 text-[11.5px] text-muted">Songs come from the Composer, which is on its way.</p>
        </>
      );
    }
  }
}

function OptionalNumber({ label, value, auto, onChange, onCommit }: { label: string; value: number | undefined; auto: string; onChange: (v: number | undefined) => void; onCommit: () => void }) {
  return (
    <Row label={label} onRevert={value !== undefined ? () => onChange(undefined) : undefined}>
      {value === undefined ? (
        <button type="button" onClick={() => onChange(16)} className={`${fieldInput} text-left text-[#7D8496] hover:text-white`}>
          Auto ({auto})
        </button>
      ) : (
        <NumberField label={label} min={1} value={value} onChange={onChange} onCommit={onCommit} />
      )}
    </Row>
  );
}

function ScriptFields({ entities, write }: { entities: Entity[]; write: Write }) {
  const ed = useEd();
  const s = entities[0]!.components.Script!;
  const defaults = useMemo(() => readScriptProps(ed.files[s.src] ?? ''), [ed.files, s.src]);
  const keys = [...new Set([...Object.keys(defaults), ...Object.keys(s.props)])];
  const [newKey, setNewKey] = useState('');
  const setProp = (k: string, v: number | string | boolean | undefined, merge = false) =>
    write(
      'Script',
      (c) => {
        const props = { ...c.props };
        if (v === undefined) delete props[k];
        else props[k] = v;
        return { ...c, props };
      },
      v === undefined ? `Reset ${k}` : `Set ${k}`,
      merge ? `prop:${entities.map((e) => e.id).join(',')}:Script.${k}` : undefined,
    );
  return (
    <>
      <Row label="Script file">
        <AssetField value={s.src} types={['script']} onChange={(src) => write('Script', (c) => ({ ...c, src }), 'Change script')} />
        <button
          type="button"
          title="Open in the code editor"
          aria-label="Open script"
          onClick={() => ed.openFile(s.src)}
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted hover:bg-[#232734] hover:text-white"
        >
          <ExternalLink size={12} />
        </button>
      </Row>
      {keys.length > 0 && <div className="mt-1 px-3 text-[11px] font-semibold tracking-wide text-[#6E7587] uppercase">Script values</div>}
      {keys.map((k) => {
        const own = s.props[k];
        const value = own ?? defaults[k];
        const revert = own !== undefined && defaults[k] !== undefined && own !== defaults[k] ? () => setProp(k, undefined) : own !== undefined && defaults[k] === undefined ? () => setProp(k, undefined) : undefined;
        return (
          <Row key={k} label={k} onRevert={revert} hint={defaults[k] !== undefined ? `Script default: ${String(defaults[k])}` : 'Only set on this entity'}>
            {typeof value === 'boolean' ? (
              <Toggle label={k} checked={value} onChange={(v) => setProp(k, v)} />
            ) : typeof value === 'string' ? (
              <TextField label={k} value={value} onCommit={(v) => setProp(k, v)} />
            ) : (
              <NumberField label={k} value={value ?? 0} onChange={(v) => setProp(k, v, true)} onCommit={ed.seal} />
            )}
          </Row>
        );
      })}
      <form
        className="mt-1 flex gap-1 px-3"
        onSubmit={(e) => {
          e.preventDefault();
          const k = newKey.trim().replace(/[^A-Za-z0-9_]/g, '');
          if (k && !keys.includes(k)) setProp(k, 0);
          setNewKey('');
        }}
      >
        <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Add a value (name)" aria-label="New script value name" className={fieldInput} />
        <button type="submit" disabled={!newKey.trim()} className="h-6 rounded border border-[#2E3342] px-2 text-[11.5px] text-ink-2 hover:text-white disabled:opacity-40">
          Add
        </button>
      </form>
    </>
  );
}

/** Picks a project file of the given types. Also accepts files dragged from the Files panel. */
export function AssetField({ value, types, onChange }: { value: string; types: FileType[]; onChange: (path: string) => void }) {
  const ed = useEd();
  const [over, setOver] = useState(false);
  const options = Object.keys(ed.files)
    .filter((p) => types.includes(fileType(p)))
    .sort();
  const thumb = types.includes('image') && ed.files[value]?.startsWith('data:image/') ? ed.files[value] : null;
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-1 rounded ${over ? 'ring-1 ring-[#7C5CFF]' : ''}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('application/x-degamed-file')) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const p = e.dataTransfer.getData('application/x-degamed-file');
        if (p && types.includes(fileType(p))) {
          e.preventDefault();
          onChange(p);
        }
      }}
    >
      {thumb && <img src={thumb} alt="" className="size-6 shrink-0 rounded-[3px] border border-[#2A2E3A] bg-[#0F1015] object-contain [image-rendering:pixelated]" />}
      <select aria-label="File" value={value} onChange={(e) => onChange(e.target.value)} className={`${fieldInput} font-mono text-[11.5px] ${ed.files[value] === undefined ? 'text-bad' : ''}`}>
        {!options.includes(value) && <option value={value}>{value || '(choose a file)'} — missing</option>}
        {options.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ─── Scene inspector ─────────────────────────────────────────────────── */

function SceneInspector({ scene }: { scene: Scene }) {
  const ed = useEd();
  const W = ed.manifest?.resolution.width ?? 480;
  const H = ed.manifest?.resolution.height ?? 270;
  const bounds = scene.bounds ?? { width: W, height: H };
  const set = (fn: (s: Scene) => Scene, label: string, merge?: string) => ed.editScene(fn, label, merge);
  const isStart = ed.scenePath === ed.startScene;
  return (
    <>
      <div className="flex items-center gap-2 border-b border-[#1F222B] px-3 py-2.5">
        <Layers size={14} className="text-[#C9BCFF]" aria-hidden="true" />
        <strong className="text-[12.5px]">Scene</strong>
        <code className="truncate font-mono text-[11px] text-muted">{ed.scenePath}</code>
        {isStart && <span className="ml-auto rounded bg-[#2B2550] px-1.5 text-[10.5px] text-[#C9BCFF]">start scene</span>}
      </div>
      <Section title="Scene" icon={<Box size={13} />} accent="#C9BCFF">
        <Row label="Name">
          <TextField label="Scene name" value={scene.name} onCommit={(name) => name.trim() && set((s) => ({ ...s, name: name.trim() }), 'Rename scene')} />
        </Row>
        <Row label="Background">
          <ColorField label="Background colour" value={scene.background} onChange={(background) => set((s) => ({ ...s, background }), 'Change background', 'scene-bg')} />
        </Row>
        <Row label="World size" hint="How far the camera can go">
          <NumberField label="World width" prefix="w" min={64} value={bounds.width} onChange={(width) => set((s) => ({ ...s, bounds: { ...bounds, width } }), 'Change world size', 'scene-bounds')} onCommit={ed.seal} decimals={0} />
          <NumberField label="World height" prefix="h" min={64} value={bounds.height} onChange={(height) => set((s) => ({ ...s, bounds: { ...bounds, height } }), 'Change world size', 'scene-bounds')} onCommit={ed.seal} decimals={0} />
        </Row>
        <Row label="Game screen">
          <span className="text-[12px] text-ink-2 tabular-nums">
            {W} × {H}
          </span>
          <button type="button" onClick={() => ed.setDialog({ type: 'settings' })} className="ml-auto text-[11.5px] text-brand-soft hover:underline">
            Change
          </button>
        </Row>
        {!isStart && ed.manifest && (
          <div className="px-3 pt-1">
            <button
              type="button"
              onClick={() => ed.commit({ ...ed.files, 'project.json': JSON.stringify({ ...ed.manifest!, startScene: ed.scenePath }, null, 2) }, 'Set start scene')}
              className="text-[11.5px] text-brand-soft hover:underline"
            >
              Make this the start scene
            </button>
          </div>
        )}
      </Section>
      <Section title="Background Layers" icon={<ImageIcon size={13} />} accent="#34D399">
        {scene.parallax.length === 0 && <p className="px-3 text-[11.5px] text-muted">No layers. Layers scroll slower than the world for depth.</p>}
        {scene.parallax.map((layer, i) => {
          const patch = (p: Partial<typeof layer>, label: string, merge?: string) =>
            set((s) => ({ ...s, parallax: s.parallax.map((l, j) => (j === i ? { ...l, ...p } : l)) }), label, merge);
          const move = (d: -1 | 1) =>
            set((s) => {
              const list = [...s.parallax];
              const [item] = list.splice(i, 1);
              list.splice(i + d, 0, item!);
              return { ...s, parallax: list };
            }, 'Reorder layers');
          return (
            <div key={i} className="mx-2 mb-1.5 rounded border border-[#232734] bg-[#121419] py-1">
              <div className="flex items-center gap-1 px-2 pb-1 text-[11px] text-muted">
                Layer {i + 1}
                <span className="ml-auto flex gap-0.5">
                  <button type="button" aria-label="Move layer back" disabled={i === 0} onClick={() => move(-1)} className="p-0.5 hover:text-white disabled:opacity-30">
                    <ArrowUp size={11} />
                  </button>
                  <button type="button" aria-label="Move layer forward" disabled={i === scene.parallax.length - 1} onClick={() => move(1)} className="p-0.5 hover:text-white disabled:opacity-30">
                    <ArrowDown size={11} />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove layer"
                    onClick={() => set((s) => ({ ...s, parallax: s.parallax.filter((_, j) => j !== i) }), 'Remove layer')}
                    className="p-0.5 hover:text-bad"
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              </div>
              <Row label="Image">
                <AssetField value={layer.asset} types={['image']} onChange={(asset) => patch({ asset }, 'Change layer image')} />
              </Row>
              <Row label="Scroll speed" hint="0 stays fixed, 1 moves with the world">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={layer.factor}
                  aria-label="Scroll speed"
                  onChange={(e) => patch({ factor: Number(e.target.value) }, 'Change scroll speed', `layer-${i}-factor`)}
                  className="min-w-0 flex-1 accent-[#7C5CFF]"
                />
                <span className="w-8 text-right text-[11.5px] tabular-nums">{layer.factor.toFixed(2)}</span>
              </Row>
              <Row label="Height offset">
                <NumberField label="Height offset" value={layer.y} onChange={(y) => patch({ y }, 'Move layer', `layer-${i}-y`)} onCommit={ed.seal} decimals={0} />
              </Row>
              <Row label="Repeat across">
                <Toggle label="Repeat across" checked={layer.tiled} onChange={(tiled) => patch({ tiled }, 'Change layer repeat')} />
              </Row>
            </div>
          );
        })}
        <div className="px-2">
          <button
            type="button"
            onClick={() => {
              const asset = Object.keys(ed.files).find((p) => fileType(p) === 'image') ?? '';
              set((s) => ({ ...s, parallax: [...s.parallax, { asset, factor: 0.5, y: 0, tiled: true }] }), 'Add layer');
            }}
            className="flex h-6 w-full items-center justify-center gap-1 rounded border border-dashed border-[#3A3F4E] text-[11.5px] text-ink-2 hover:border-[#6B4EFF] hover:text-white"
          >
            <Plus size={12} /> Add Layer
          </button>
        </div>
      </Section>
      <p className="px-3 pt-3 text-[11.5px] leading-relaxed text-muted">Select an entity in the scene or the Hierarchy to edit it. Ctrl+A adds one.</p>
    </>
  );
}

/* ─── File info (code & art workspaces) ───────────────────────────────── */

function FileInfo() {
  const ed = useEd();
  const path = ed.workspace === 'code' ? ed.codeFile : ed.selectedFile;
  if (!path || ed.files[path] === undefined) return <p className="p-3 text-[12px] text-muted">Select a file to see its details.</p>;
  const users: string[] = [];
  for (const [p, text] of Object.entries(ed.files)) if (p !== path && p.endsWith('.json') && text.includes(JSON.stringify(path))) users.push(p);
  const size = ed.files[path]!.length;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 text-[12px]">
      <div>
        <div className="text-[11px] font-semibold tracking-wide text-[#6E7587] uppercase">File</div>
        <code className="font-mono break-all text-ink">{path}</code>
      </div>
      <div className="text-muted">
        {fileType(path)} · {size > 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`}
      </div>
      <div>
        <div className="text-[11px] font-semibold tracking-wide text-[#6E7587] uppercase">Used by</div>
        {users.length ? (
          <ul className="mt-1 flex flex-col gap-0.5">
            {users.map((u) => (
              <li key={u}>
                <button type="button" onClick={() => ed.openFile(u)} className="font-mono text-[11.5px] text-brand-soft hover:underline">
                  {u}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-muted">Nothing references this file{fileType(path) === 'script' ? ' yet. Drag it onto an entity to attach it.' : '.'}</p>
        )}
      </div>
    </div>
  );
}

/* ─── History ─────────────────────────────────────────────────────────── */

function HistoryPanel() {
  const ed = useEd();
  const { past, future } = ed.history;
  const entries = [...past, ...future];
  const current = past.length - 1;
  return (
    <ol className="min-h-0 flex-1 overflow-auto py-1 text-[12px]" aria-label="Edit history">
      {entries.map((h, i) => (
        <li key={`${i}-${h.at}`}>
          <button
            type="button"
            onClick={() => ed.jumpTo(i)}
            aria-current={i === current ? 'step' : undefined}
            className={`flex w-full items-center gap-2 px-3 py-1 text-left ${
              i === current ? 'bg-[#2B2550] text-white' : i > current ? 'text-[#6E7587] hover:bg-[#1C1F28]' : 'text-ink-2 hover:bg-[#1C1F28]'
            }`}
          >
            <span className="w-5 text-right text-[10.5px] text-[#6E7587] tabular-nums">{i}</span>
            <span className="flex-1 truncate">{h.label}</span>
            <span className="text-[10.5px] text-[#6E7587] tabular-nums">{new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </button>
        </li>
      ))}
      <li className="px-3 pt-2 text-[11px] text-muted">Click a step to go back to it. Ctrl+Z / Ctrl+Shift+Z step one at a time.</li>
    </ol>
  );
}
