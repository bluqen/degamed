import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Grid3x3,
  Hand,
  Magnet,
  Maximize,
  Minus,
  MousePointer2,
  Move,
  Plus,
  RotateCw,
  Ruler,
  Scaling,
  Scan,
  ChevronDown,
} from 'lucide-react';
import { useEd, type Tool } from './state';
import { addFromFile, attachScript, entityMenu, paste } from './actions';
import { MenuButton, useContextMenu, type MenuItem } from './ui';
import { aabb, buildVisuals, C, drawRulers, drawScene, pick, pickRect, RULER, toScreen, toWorld, type ViewXf, type Visual } from './scene-render';
import { locate, setComponent, updateEntities } from './scene-ops';
import { fileType } from './file-tree';
import { keyLabel } from './commands';

type Drag =
  | { kind: 'pan'; sx: number; sy: number; panX: number; panY: number }
  | { kind: 'move'; sx: number; sy: number; axis: 'x' | 'y' | 'both' | 'free'; start: Map<string, { x: number; y: number }>; moved: boolean; key: string }
  | { kind: 'rotate'; cx: number; cy: number; a0: number; start: Map<string, number>; key: string }
  | { kind: 'scale'; sx: number; sy: number; axis: 'x' | 'y' | 'both'; start: Map<string, { x: number; y: number }>; key: string }
  | { kind: 'box'; sx: number; sy: number; x: number; y: number; additive: boolean; base: string[] }
  | { kind: 'ruler'; wx: number; wy: number; x: number; y: number };

const GIZMO = 56;
let dragSerial = 0;

const TOOLS: { id: Tool; label: string; key: string; icon: ReactNode }[] = [
  { id: 'select', label: 'Select', key: 'Q', icon: <MousePointer2 size={15} /> },
  { id: 'move', label: 'Move', key: 'W', icon: <Move size={15} /> },
  { id: 'rotate', label: 'Rotate', key: 'E', icon: <RotateCw size={15} /> },
  { id: 'scale', label: 'Scale', key: 'S', icon: <Scaling size={15} /> },
  { id: 'pan', label: 'Pan', key: 'H', icon: <Hand size={15} /> },
  { id: 'ruler', label: 'Measure', key: 'R', icon: <Ruler size={15} /> },
];

const ZOOMS = [0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];

export function SceneView() {
  const ed = useEd();
  const { scene, files, manifest, selection, tool, view: opts } = ed;
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [view, setView] = useState<ViewXf>({ zoom: 2, panX: 40, panY: 40 });
  const [imgTick, setImgTick] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ sx: number; sy: number; wx: number; wy: number } | null>(null);
  const [dragState, setDragState] = useState<Drag | null>(null);
  const drag = useRef<Drag | null>(null);
  const space = useRef(false);
  const showMenu = useContextMenu();
  const onImage = useCallback(() => setImgTick((n) => n + 1), []);
  const selSet = useMemo(() => new Set(selection), [selection]);

  const visuals = useMemo(() => (scene ? buildVisuals(scene, files, onImage) : []), [scene, files, onImage, imgTick]);
  const byId = useMemo(() => new Map(visuals.map((v) => [v.e.id, v])), [visuals]);

  const W = manifest?.resolution.width ?? 480;
  const H = manifest?.resolution.height ?? 270;
  const bounds = scene?.bounds ?? { width: W, height: H };
  const top = opts.rulers ? RULER : 0;

  // Keep the canvas sized to its box.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(
    (r: { x0: number; y0: number; x1: number; y1: number }, maxZoom = 4) => {
      const pad = 48;
      const w = Math.max(r.x1 - r.x0, 1);
      const h = Math.max(r.y1 - r.y0, 1);
      const zoom = Math.min(maxZoom, (size.w - top - pad * 2) / w, (size.h - top - pad * 2) / h);
      setView({ zoom, panX: top + (size.w - top) / 2 - ((r.x0 + r.x1) / 2) * zoom, panY: top + (size.h - top) / 2 - ((r.y0 + r.y1) / 2) * zoom });
    },
    [size, top],
  );

  // First look: the game screen, a little zoomed in, like opening a level.
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current || size.w < 50) return;
    framed.current = true;
    fit({ x0: 0, y0: 0, x1: W, y1: H }, 3);
  }, [size, fit, W, H]);

  // "Focus selection" / "Show whole level" requests.
  const lastFrame = useRef(ed.frameRequest.n);
  useEffect(() => {
    if (ed.frameRequest.n === lastFrame.current) return;
    lastFrame.current = ed.frameRequest.n;
    if (ed.frameRequest.what === 'all' || !selection.length) return fit({ x0: 0, y0: 0, x1: bounds.width, y1: bounds.height });
    const boxes = selection.map((id) => byId.get(id)).filter((v): v is Visual => !!v).map((v) => aabb(v, 16));
    if (!boxes.length) return;
    fit({ x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)), x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)) }, 6);
  }, [ed.frameRequest, selection, byId, fit, bounds.width, bounds.height]);

  // Tell the rest of the editor where the middle of the view is (new entities go there).
  useEffect(() => {
    const c = toWorld(view, top + (size.w - top) / 2, top + (size.h - top) / 2);
    ed.viewCenter.current = { x: Math.round(c.x), y: Math.round(c.y) };
  }, [view, size, top, ed.viewCenter]);

  // The primary selection drives the gizmo.
  const primary = selection.length ? byId.get(selection[selection.length - 1]!) : undefined;

  // Draw.
  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !scene) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(size.w * dpr);
    cv.height = Math.round(size.h * dpr);
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(ctx, { view, width: size.w, height: size.h, scene, files, manifest, visuals, selection: selSet, hover, grid: opts.grid, step: opts.step, onImage });
    if (primary && (tool === 'move' || tool === 'rotate' || tool === 'scale')) drawGizmo(ctx, view, primary, tool);
    const d = dragState;
    if (d?.kind === 'box') {
      ctx.fillStyle = 'rgba(34,211,238,0.08)';
      ctx.strokeStyle = C.select;
      ctx.lineWidth = 1;
      const x = Math.min(d.sx, d.x);
      const y = Math.min(d.sy, d.y);
      ctx.fillRect(x, y, Math.abs(d.x - d.sx), Math.abs(d.y - d.sy));
      ctx.strokeRect(x + 0.5, y + 0.5, Math.abs(d.x - d.sx), Math.abs(d.y - d.sy));
    }
    if (d?.kind === 'ruler') drawMeasure(ctx, view, d);
    if (opts.rulers) drawRulers(ctx, view, size.w, size.h, cursor ? { x: cursor.sx, y: cursor.sy } : null);
  }, [scene, files, manifest, visuals, selSet, hover, view, size, opts, tool, primary, dragState, cursor, onImage]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const snapPos = (v: number) => (opts.snap ? Math.round(v / opts.step) * opts.step : Math.round(v));

  /** Which gizmo handle (if any) is under a screen point. */
  const gizmoHit = (sx: number, sy: number): 'x' | 'y' | 'both' | 'ring' | null => {
    if (!primary) return null;
    const p = toScreen(view, primary.x, primary.y);
    const dx = sx - p.x;
    const dy = sy - p.y;
    if (tool === 'rotate') {
      const d = Math.hypot(dx, dy);
      return Math.abs(d - GIZMO * 0.75) < 8 ? 'ring' : null;
    }
    if (tool !== 'move' && tool !== 'scale') return null;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return 'both';
    if (dx > 8 && dx < GIZMO + 8 && Math.abs(dy) < 7) return 'x';
    if (dy > 8 && dy < GIZMO + 8 && Math.abs(dx) < 7) return 'y';
    return null;
  };

  const startMove = (sx: number, sy: number, axis: 'x' | 'y' | 'both' | 'free', ids: string[]) => {
    const start = new Map<string, { x: number; y: number }>();
    for (const id of ids) {
      const p = scene && locate(scene.entities, id)?.entity.components.Transform?.position;
      if (p) start.set(id, { ...p });
    }
    return { kind: 'move' as const, sx, sy, axis, start, moved: false, key: `drag-${++dragSerial}` };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!scene) return;
    canvas.current!.focus();
    const { x, y } = local(e);
    const w = toWorld(view, x, y);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (e.button === 1 || e.button === 2 || space.current || tool === 'pan') {
      if (e.button === 2) return; // context menu handles it
      drag.current = { kind: 'pan', sx: x, sy: y, panX: view.panX, panY: view.panY };
      setDragState(drag.current);
      return;
    }
    if (e.button !== 0) return;
    if (tool === 'ruler') {
      drag.current = { kind: 'ruler', wx: w.x, wy: w.y, x: w.x, y: w.y };
      setDragState(drag.current);
      return;
    }
    const handle = gizmoHit(x, y);
    if (handle && primary) {
      if (tool === 'move' && handle !== 'ring') drag.current = startMove(x, y, handle, selection);
      if (tool === 'scale' && handle !== 'ring') {
        const start = new Map<string, { x: number; y: number }>();
        for (const id of selection) {
          const s = locate(scene.entities, id)?.entity.components.Transform?.scale;
          start.set(id, s ? { ...s } : { x: 1, y: 1 });
        }
        drag.current = { kind: 'scale', sx: x, sy: y, axis: handle, start, key: `drag-${++dragSerial}` };
      }
      if (tool === 'rotate') drag.current = rotateDrag(x, y);
      setDragState(drag.current);
      return;
    }
    const hits = pick(visuals, w.x, w.y, view.zoom);
    let id = hits[0];
    // Alt-click picks the next thing underneath the current selection.
    if (e.altKey && hits.length > 1) {
      const cur = hits.findIndex((h) => selSet.has(h));
      id = hits[(cur + 1) % hits.length];
    }
    if (id) {
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      let next = selection;
      if (additive) next = selSet.has(id) ? selection.filter((s) => s !== id) : [...selection, id];
      else if (!selSet.has(id)) next = [id];
      ed.select(next);
      if (!additive || next.includes(id)) {
        if (tool === 'rotate' && next.length) drag.current = rotateDrag(x, y, next);
        else if (tool === 'scale') drag.current = null;
        else drag.current = startMove(x, y, 'free', next);
        setDragState(drag.current);
      }
      return;
    }
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    if (!additive) ed.select([]);
    drag.current = { kind: 'box', sx: x, sy: y, x, y, additive, base: additive ? selection : [] };
    setDragState(drag.current);
  };

  const rotateDrag = (x: number, y: number, ids = selection): Drag => {
    const p = primary ?? byId.get(ids[ids.length - 1]!)!;
    const c = toScreen(view, p.x, p.y);
    const start = new Map<string, number>();
    for (const id of ids) start.set(id, locate(scene!.entities, id)?.entity.components.Transform?.rotation ?? 0);
    return { kind: 'rotate', cx: c.x, cy: c.y, a0: Math.atan2(y - c.y, x - c.x), start, key: `drag-${++dragSerial}` };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const { x, y } = local(e);
    const w = toWorld(view, x, y);
    setCursor({ sx: x, sy: y, wx: w.x, wy: w.y });
    const d = drag.current;
    if (!d) {
      if (scene) setHover(pick(visuals, w.x, w.y, view.zoom)[0] ?? null);
      return;
    }
    if (d.kind === 'pan') {
      setView((v) => ({ ...v, panX: d.panX + x - d.sx, panY: d.panY + y - d.sy }));
    } else if (d.kind === 'box') {
      drag.current = { ...d, x, y };
      setDragState(drag.current);
      const a = toWorld(view, Math.min(d.sx, x), Math.min(d.sy, y));
      const b = toWorld(view, Math.max(d.sx, x), Math.max(d.sy, y));
      const hit = pickRect(visuals, { x0: a.x, y0: a.y, x1: b.x, y1: b.y }, view.zoom);
      ed.select([...new Set([...d.base, ...hit])]);
    } else if (d.kind === 'ruler') {
      drag.current = { ...d, x: w.x, y: w.y };
      setDragState(drag.current);
    } else if (d.kind === 'move') {
      let dx = (x - d.sx) / view.zoom;
      let dy = (y - d.sy) / view.zoom;
      if (!d.moved && Math.hypot(x - d.sx, y - d.sy) < 3) return;
      d.moved = true;
      // Shift locks to the main direction of the drag.
      const axis = d.axis === 'free' && e.shiftKey ? (Math.abs(dx) > Math.abs(dy) ? 'x' : 'y') : d.axis;
      if (axis === 'x') dy = 0;
      if (axis === 'y') dx = 0;
      const start = d.start;
      ed.editScene(
        (s) =>
          updateEntities(s, start.keys(), (ent) => {
            const p0 = start.get(ent.id)!;
            const t = ent.components.Transform ?? { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } };
            return setComponent(ent, 'Transform', { ...t, position: { x: snapPos(p0.x + dx), y: snapPos(p0.y + dy) } });
          }),
        `Move ${start.size === 1 ? nameFor([...start.keys()][0]!) : `${start.size} entities`}`,
        d.key,
      );
    } else if (d.kind === 'rotate') {
      const delta = Math.atan2(y - d.cy, x - d.cx) - d.a0;
      const start = d.start;
      ed.editScene(
        (s) =>
          updateEntities(s, start.keys(), (ent) => {
            const t = ent.components.Transform ?? { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } };
            let r = start.get(ent.id)! + delta;
            if (opts.rotateSnap && !e.altKey) r = Math.round(r / (Math.PI / 12)) * (Math.PI / 12);
            return setComponent(ent, 'Transform', { ...t, rotation: Number(r.toFixed(4)) });
          }),
        'Rotate',
        d.key,
      );
    } else if (d.kind === 'scale') {
      const f = (v: number) => Math.max(0.05, 1 + v / GIZMO);
      const fx = d.axis === 'y' ? 1 : f(x - d.sx);
      const fy = d.axis === 'x' ? 1 : d.axis === 'both' ? fx : f(y - d.sy);
      const start = d.start;
      ed.editScene(
        (s) =>
          updateEntities(s, start.keys(), (ent) => {
            const t = ent.components.Transform ?? { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } };
            const s0 = start.get(ent.id)!;
            const round = (v: number) => Number((e.shiftKey ? v : Math.round(v * 8) / 8).toFixed(3));
            return setComponent(ent, 'Transform', { ...t, scale: { x: round(s0.x * fx), y: round(s0.y * fy) } });
          }),
        'Scale',
        d.key,
      );
    }
  };

  const nameFor = (id: string) => byId.get(id)?.e.name ?? id;

  const endDrag = () => {
    if (drag.current && drag.current.kind !== 'pan' && drag.current.kind !== 'box' && drag.current.kind !== 'ruler') ed.seal();
    // The measure line stays on screen until the next click.
    if (drag.current?.kind !== 'ruler') setDragState(null);
    drag.current = null;
  };

  const zoomAt = (sx: number, sy: number, zoom: number) => {
    const z = Math.min(32, Math.max(0.05, zoom));
    setView((v) => {
      const w = toWorld(v, sx, sy);
      return { zoom: z, panX: sx - w.x * z, panY: sy - w.y * z };
    });
  };

  // Wheel: native listener so we can preventDefault (React's is passive).
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      const mouseWheel = e.deltaMode === 1 || (Math.abs(e.deltaY) >= 40 && e.deltaX === 0 && Number.isInteger(e.deltaY));
      if (e.ctrlKey || e.metaKey || mouseWheel) {
        setView((v) => {
          const z = Math.min(32, Math.max(0.05, v.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))));
          const w = toWorld(v, sx, sy);
          return { zoom: z, panX: sx - w.x * z, panY: sy - w.y * z };
        });
      } else {
        setView((v) => ({ ...v, panX: v.panX - e.deltaX, panY: v.panY - e.deltaY }));
      }
    };
    cv.addEventListener('wheel', onWheel, { passive: false });
    return () => cv.removeEventListener('wheel', onWheel);
  }, []);

  // Space held = pan; arrows nudge the selection.
  useEffect(() => {
    // Only when the scene view (or nothing in particular) has focus, so arrows in lists and Space on buttons keep working.
    const forView = (t: EventTarget | null) => t === document.body || t === canvas.current;
    const down = (e: KeyboardEvent) => {
      if (ed.workspace !== 'scene' || !forView(e.target) || ed.dialog) return;
      if (e.key === ' ') {
        space.current = true;
        e.preventDefault();
      }
      const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const dir = dirs[e.key];
      if (dir && selection.length && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const step = e.shiftKey ? opts.step : 1;
        ed.editScene(
          (s) =>
            updateEntities(s, selection, (ent) => {
              const t = ent.components.Transform ?? { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } };
              return setComponent(ent, 'Transform', { ...t, position: { x: t.position.x + dir[0] * step, y: t.position.y + dir[1] * step } });
            }),
          'Nudge',
          'nudge',
        );
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ') space.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [ed, selection, opts.step]);

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!scene) return;
    const { x, y } = local(e);
    const w = toWorld(view, x, y);
    const id = pick(visuals, w.x, w.y, view.zoom)[0];
    const at = { x: snapPos(w.x), y: snapPos(w.y) };
    if (id) {
      const ids = selSet.has(id) ? selection : [id];
      if (!selSet.has(id)) ed.select([id]);
      showMenu(entityMenu(ed, ids, at), e);
      return;
    }
    const items: MenuItem[] = [
      { label: 'Add Entity Here…', icon: <Plus size={13} />, onSelect: () => ed.setDialog({ type: 'add-entity', parentId: null, afterId: null, at }) },
      { label: 'Paste Here', disabled: !ed.clipboard?.length, onSelect: () => paste(ed, at) },
      { type: 'separator' },
      { label: 'Show Whole Level', shortcut: 'Shift+F', onSelect: () => ed.requestFrame('all') },
      { label: 'Show Grid', checked: opts.grid, onSelect: () => ed.setView({ grid: !opts.grid }) },
      { label: 'Snap to Grid', checked: opts.snap, onSelect: () => ed.setView({ snap: !opts.snap }) },
    ];
    showMenu(items, e);
  };

  const onDrop = (e: React.DragEvent) => {
    const path = e.dataTransfer.getData('application/x-degamed-file');
    if (!path || !scene) return;
    e.preventDefault();
    const { x, y } = local(e);
    const w = toWorld(view, x, y);
    const type = fileType(path);
    if (type === 'script') {
      const id = pick(visuals, w.x, w.y, view.zoom)[0];
      if (id) {
        attachScript(ed, [id], path);
        ed.select([id]);
      }
      return;
    }
    addFromFile(ed, path, { x: snapPos(w.x), y: snapPos(w.y) });
  };

  const zoomBy = (dir: 1 | -1) => {
    const z = dir > 0 ? (ZOOMS.find((v) => v > view.zoom + 1e-6) ?? 32) : ([...ZOOMS].reverse().find((v) => v < view.zoom - 1e-6) ?? 0.05);
    zoomAt(top + (size.w - top) / 2, top + (size.h - top) / 2, z);
  };

  const snapItems: MenuItem[] = [
    { type: 'heading', label: 'Grid step' },
    ...[4, 8, 16, 32, 64].map((s) => ({ label: `${s} px`, checked: opts.step === s, onSelect: () => ed.setView({ step: s }) })),
    { type: 'separator' },
    { label: 'Snap rotation to 15°', checked: opts.rotateSnap, onSelect: () => ed.setView({ rotateSnap: !opts.rotateSnap }) },
  ];

  const cursorStyle =
    dragState?.kind === 'pan' || tool === 'pan'
      ? 'grabbing'
      : tool === 'ruler'
        ? 'crosshair'
        : hover && (tool === 'select' || tool === 'move')
          ? 'move'
          : 'default';

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0B0C10]">
      {/* Toolbar */}
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[#1F222B] bg-[#13151B] px-2">
        <div role="toolbar" aria-label="Tools" className="flex items-center gap-0.5 rounded-md bg-[#0F1015] p-0.5">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-label={t.label}
              aria-pressed={tool === t.id}
              title={`${t.label} (${t.key})`}
              onClick={() => ed.setTool(t.id)}
              className={`flex size-7 items-center justify-center rounded ${tool === t.id ? 'bg-[#6B4EFF] text-white' : 'text-[#A3A9B8] hover:bg-[#232734] hover:text-white'}`}
            >
              {t.icon}
            </button>
          ))}
        </div>
        <span className="mx-1 h-5 w-px bg-[#262A35]" />
        <div className="flex items-center rounded-md bg-[#0F1015] p-0.5">
          <button
            type="button"
            aria-pressed={opts.snap}
            title={`Snap to grid (${keyLabel('Shift+G')})`}
            onClick={() => ed.setView({ snap: !opts.snap })}
            className={`flex h-7 items-center gap-1 rounded px-1.5 text-[12px] ${opts.snap ? 'bg-[#2B2550] text-white' : 'text-[#A3A9B8] hover:text-white'}`}
          >
            <Magnet size={14} aria-hidden="true" /> Snap
          </button>
          <MenuButton items={snapItems} label="Snapping options" className="flex h-7 w-5 items-center justify-center rounded text-muted hover:text-white">
            <ChevronDown size={12} />
          </MenuButton>
        </div>
        <button
          type="button"
          aria-pressed={opts.grid}
          title="Show grid (G)"
          onClick={() => ed.setView({ grid: !opts.grid })}
          className={`flex size-7 items-center justify-center rounded ${opts.grid ? 'text-cyan' : 'text-[#A3A9B8] hover:text-white'}`}
        >
          <Grid3x3 size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-pressed={opts.rulers}
          title="Show rulers"
          onClick={() => ed.setView({ rulers: !opts.rulers })}
          className={`flex size-7 items-center justify-center rounded ${opts.rulers ? 'text-cyan' : 'text-[#A3A9B8] hover:text-white'}`}
        >
          <Ruler size={15} aria-hidden="true" />
        </button>
        <span className="mx-1 h-5 w-px bg-[#262A35]" />
        <button type="button" onClick={() => ed.requestFrame('selection')} disabled={!selection.length} title="Focus selection (F)" className="flex size-7 items-center justify-center rounded text-[#A3A9B8] hover:text-white disabled:opacity-35">
          <Scan size={15} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => ed.requestFrame('all')} title="Show whole level (Shift+F)" className="flex size-7 items-center justify-center rounded text-[#A3A9B8] hover:text-white">
          <Maximize size={15} aria-hidden="true" />
        </button>
        <div className="ml-auto flex items-center gap-0.5 rounded-md bg-[#0F1015] p-0.5 text-[12px]">
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(-1)} className="flex size-6 items-center justify-center rounded text-[#A3A9B8] hover:text-white">
            <Minus size={13} />
          </button>
          <button type="button" title="Reset zoom to 100%" onClick={() => zoomAt(top + (size.w - top) / 2, top + (size.h - top) / 2, 1)} className="w-12 text-center text-ink-2 tabular-nums hover:text-white">
            {Math.round(view.zoom * 100)}%
          </button>
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1)} className="flex size-6 items-center justify-center rounded text-[#A3A9B8] hover:text-white">
            <Plus size={13} />
          </button>
        </div>
      </div>

      <div ref={wrap} className="relative min-h-0 flex-1 overflow-hidden" onDragOver={(e) => e.dataTransfer.types.includes('application/x-degamed-file') && e.preventDefault()} onDrop={onDrop}>
        <canvas
          ref={canvas}
          tabIndex={0}
          aria-label="Scene view. Click to select, drag to move, right-click for more."
          style={{ width: size.w, height: size.h, cursor: cursorStyle }}
          className="block outline-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={() => {
            setHover(null);
            setCursor(null);
          }}
          onContextMenu={onContextMenu}
          onDoubleClick={() => selection.length && ed.requestFrame('selection')}
        />
        {!scene && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[13px] text-bad">
            This scene can’t be shown: {ed.sceneError}. Fix it in the Code tab.
          </div>
        )}
        {cursor && (
          <div className="pointer-events-none absolute right-2 bottom-2 rounded bg-black/60 px-2 py-0.5 font-mono text-[11px] text-ink-2 tabular-nums">
            x {Math.round(cursor.wx)} · y {Math.round(cursor.wy)}
          </div>
        )}
        {selection.length > 0 && (
          <div className="pointer-events-none absolute bottom-2 left-6 rounded bg-black/60 px-2 py-0.5 text-[11px] text-ink-2">
            {selection.length === 1 ? nameFor(selection[0]!) : `${selection.length} selected`} · {tool === 'select' ? 'drag to move' : `${tool} tool`}
          </div>
        )}
      </div>
    </div>
  );
}

function drawGizmo(ctx: CanvasRenderingContext2D, view: ViewXf, v: Visual, tool: Tool) {
  const p = toScreen(view, v.x, v.y);
  ctx.save();
  ctx.lineWidth = 2;
  if (tool === 'rotate') {
    ctx.strokeStyle = C.gizmoBoth;
    ctx.beginPath();
    ctx.arc(p.x, p.y, GIZMO * 0.75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(v.rot) * GIZMO * 0.75, p.y + Math.sin(v.rot) * GIZMO * 0.75);
    ctx.stroke();
    ctx.font = '11px "IBM Plex Sans", sans-serif';
    ctx.fillStyle = C.gizmoBoth;
    ctx.fillText(`${Math.round((v.rot * 180) / Math.PI)}°`, p.x + GIZMO * 0.8, p.y - GIZMO * 0.6);
  } else {
    const head = (x: number, y: number, color: string, dir: 'x' | 'y') => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      if (tool === 'scale') ctx.fillRect(x - 4, y - 4, 8, 8);
      else {
        ctx.beginPath();
        if (dir === 'x') {
          ctx.moveTo(x + 8, y);
          ctx.lineTo(x - 2, y - 5);
          ctx.lineTo(x - 2, y + 5);
        } else {
          ctx.moveTo(x, y + 8);
          ctx.lineTo(x - 5, y - 2);
          ctx.lineTo(x + 5, y - 2);
        }
        ctx.fill();
      }
    };
    head(p.x + GIZMO, p.y, C.gizmoX, 'x');
    head(p.x, p.y + GIZMO, C.gizmoY, 'y');
    ctx.fillStyle = C.gizmoBoth;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
  }
  ctx.restore();
}

function drawMeasure(ctx: CanvasRenderingContext2D, view: ViewXf, d: Extract<Drag, { kind: 'ruler' }>) {
  const a = toScreen(view, d.wx, d.wy);
  const b = toScreen(view, d.x, d.y);
  const dx = d.x - d.wx;
  const dy = d.y - d.wy;
  ctx.save();
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = C.gizmoBoth;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.font = '12px "IBM Plex Sans", sans-serif';
  const label = `${Math.round(Math.hypot(dx, dy))} px  (${Math.round(dx)}, ${Math.round(dy)})  ${Math.round((Math.atan2(dy, dx) * 180) / Math.PI)}°`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect((a.x + b.x) / 2 - tw / 2 - 6, (a.y + b.y) / 2 - 22, tw + 12, 18);
  ctx.fillStyle = C.gizmoBoth;
  ctx.fillText(label, (a.x + b.x) / 2 - tw / 2, (a.y + b.y) / 2 - 9);
  ctx.restore();
}
