import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SpriteFrames } from '@degamed/shared';

interface Props {
  path: string;
  json: string;
  /** Data URLs of project images, so the sheet can be drawn. */
  images: Record<string, string>;
  onChange: (json: string) => void;
}

type Def = SpriteFrames;
type Anim = Def['animations'][string];

function useImage(src: string | undefined) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return setImg(null);
    const el = new Image();
    el.onload = () => setImg(el);
    el.src = src;
  }, [src]);
  return img;
}

/** Draws one frame of a sheet, scaled up with hard pixel edges. */
function FrameCanvas({ img, def, frame, scale }: { img: HTMLImageElement | null; def: Def; frame: number; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!img) return;
    const cols = Math.max(1, Math.floor(img.width / def.frameWidth));
    const sx = (frame % cols) * def.frameWidth;
    const sy = Math.floor(frame / cols) * def.frameHeight;
    ctx.drawImage(img, sx, sy, def.frameWidth, def.frameHeight, 0, 0, def.frameWidth * scale, def.frameHeight * scale);
  }, [img, def, frame, scale]);
  return <canvas ref={ref} width={def.frameWidth * scale} height={def.frameHeight * scale} className="block" aria-hidden="true" />;
}

/** Plays an animation in a loop (or once, then holds the last frame). */
function AnimPreview({ img, def, anim }: { img: HTMLImageElement | null; def: Def; anim: Anim }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    const id = window.setInterval(() => setI((n) => (anim.loop ? (n + 1) % anim.frames.length : Math.min(n + 1, anim.frames.length - 1))), 1000 / anim.fps);
    return () => window.clearInterval(id);
  }, [anim]);
  return <FrameCanvas img={img} def={def} frame={anim.frames[i % anim.frames.length] ?? 0} scale={4} />;
}

const CHECKER = 'repeating-conic-gradient(#1C1F27 0% 25%, #15171D 0% 50%) 50% / 12px 12px';

/** Godot-style SpriteFrames editor: sheet strip, animations with live previews, FPS and looping. */
export function AnimationEditor({ path, json, images, onChange }: Props) {
  const parsed = useMemo(() => {
    try {
      const r = SpriteFrames.safeParse(JSON.parse(json));
      return r.success ? { def: r.data, error: null } : { def: null, error: r.error.issues[0]?.message ?? 'Invalid file' };
    } catch (e) {
      return { def: null, error: (e as Error).message };
    }
  }, [json]);
  const def = parsed.def;
  const img = useImage(def ? images[def.sheet] : undefined);
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  if (!def) {
    return <p className="p-4 text-bad">This animation file has a problem: {parsed.error}. Switch to JSON to fix it.</p>;
  }

  const names = Object.keys(def.animations);
  const active = selected && def.animations[selected] ? selected : names[0]!;
  const total = img ? Math.floor(img.width / def.frameWidth) * Math.floor(img.height / def.frameHeight) : 0;

  const save = (next: Def) => onChange(JSON.stringify(next, null, 2));
  const setAnim = (name: string, patch: Partial<Anim>) =>
    save({ ...def, animations: { ...def.animations, [name]: { ...def.animations[name]!, ...patch } } });

  const addAnimation = () => {
    const name = newName.trim().replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 40);
    if (!name || def.animations[name]) return;
    save({ ...def, animations: { ...def.animations, [name]: { frames: [0], fps: 8, loop: true } } });
    setSelected(name);
    setNewName('');
  };

  const removeAnimation = (name: string) => {
    if (names.length <= 1) return;
    const { [name]: _removed, ...rest } = def.animations;
    save({ ...def, animations: rest });
    setSelected(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto bg-[#0B0C10] p-4 text-[13px]">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <strong className="text-[15px]">Animations</strong>
        <span className="font-mono text-muted">
          {def.sheet} · {def.frameWidth}×{def.frameHeight}px frames · {total} in sheet
        </span>
      </div>

      <section aria-label="Sprite sheet frames" className="flex flex-col gap-2">
        <span className="text-muted">Click a frame to add it to “{active}”.</span>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: total }, (_, f) => (
            <button
              key={f}
              type="button"
              onClick={() => setAnim(active, { frames: [...def.animations[active]!.frames, f] })}
              className="flex flex-col items-center gap-1 rounded-lg border border-line p-1.5 hover:border-cyan"
              aria-label={`Add frame ${f} to ${active}`}
            >
              <span className="rounded" style={{ background: CHECKER }}>
                <FrameCanvas img={img} def={def} frame={f} scale={3} />
              </span>
              <span className="font-mono text-[11px] text-muted">{f}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Animation list" className="flex flex-col gap-2">
        {names.map((name) => {
          const anim = def.animations[name]!;
          const bad = anim.frames.filter((f) => f >= total && total > 0);
          return (
            <div
              key={name}
              className={`flex flex-wrap items-center gap-4 rounded-xl border p-3 ${name === active ? 'border-[#3A2F80] bg-[#17142A]' : 'border-line bg-panel'}`}
            >
              <button type="button" onClick={() => setSelected(name)} className="flex items-center gap-3 text-left">
                <span className="rounded-md p-1" style={{ background: CHECKER }}>
                  <AnimPreview img={img} def={def} anim={anim} />
                </span>
                <span className="flex flex-col">
                  <strong className="text-[14px]">{name}</strong>
                  <span className="text-muted">
                    {anim.frames.length} frame{anim.frames.length > 1 ? 's' : ''}
                  </span>
                </span>
              </button>
              <label className="flex min-w-0 flex-[1_1_180px] flex-col gap-1">
                <span className="text-muted">Frames (in order)</span>
                <input
                  value={anim.frames.join(', ')}
                  onChange={(e) => {
                    const frames = e.target.value
                      .split(/[\s,]+/)
                      .filter(Boolean)
                      .map(Number)
                      .filter((n) => Number.isInteger(n) && n >= 0);
                    if (frames.length) setAnim(name, { frames });
                  }}
                  className="rounded-md border border-line-strong bg-bg px-2 py-1.5 font-mono"
                />
                {bad.length > 0 && <span className="text-warn">Frame {bad.join(', ')} isn’t in the sheet</span>}
              </label>
              <label className="flex w-20 flex-col gap-1">
                <span className="text-muted">FPS</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={anim.fps}
                  onChange={(e) => {
                    const fps = Number(e.target.value);
                    if (fps >= 1 && fps <= 60) setAnim(name, { fps });
                  }}
                  className="rounded-md border border-line-strong bg-bg px-2 py-1.5 font-mono"
                />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={anim.loop} onChange={(e) => setAnim(name, { loop: e.target.checked })} />
                Loop
              </label>
              <button
                type="button"
                onClick={() => removeAnimation(name)}
                disabled={names.length <= 1}
                aria-label={`Delete ${name}`}
                className="ml-auto rounded-md p-2 text-muted hover:text-bad disabled:opacity-30"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          );
        })}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addAnimation();
          }}
        >
          <label htmlFor={`new-anim-${path}`} className="sr-only">
            New animation name
          </label>
          <input
            id={`new-anim-${path}`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New animation, e.g. attack"
            className="min-w-0 flex-1 rounded-md border border-line-strong bg-bg px-2 py-1.5"
          />
          <button type="submit" disabled={!newName.trim()} className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 disabled:opacity-40">
            <Plus size={14} aria-hidden="true" /> Add
          </button>
        </form>
      </section>
      <p className="text-muted">
        Scripts can call <code className="font-mono text-ink-2">this.play('run')</code> or{' '}
        <code className="font-mono text-ink-2">this.playOnce('attack')</code>. With <code className="font-mono text-ink-2">auto</code> on, idle,
        run, jump and fall switch by themselves.
      </p>
    </div>
  );
}
