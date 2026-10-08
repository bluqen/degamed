import { SpriteFrames, type Entity, type ProjectFiles, type ProjectManifest, type Scene } from '@degamed/shared';

/**
 * Draws a scene in the editor the way the runtime places it (Phaser rules: images and
 * sprites are centred on their position, text hangs from its top-left corner, children
 * add their parents' positions), plus picking and selection geometry.
 */

export interface ViewXf {
  zoom: number;
  panX: number;
  panY: number;
}

export const toScreen = (v: ViewXf, x: number, y: number) => ({ x: x * v.zoom + v.panX, y: y * v.zoom + v.panY });
export const toWorld = (v: ViewXf, x: number, y: number) => ({ x: (x - v.panX) / v.zoom, y: (y - v.panY) / v.zoom });

const images = new Map<string, HTMLImageElement>();
/** Returns a decoded image for a data URL, or null while it loads (`onLoad` fires once ready). */
export function getImage(src: string | undefined, onLoad: () => void): HTMLImageElement | null {
  if (!src) return null;
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.onload = onLoad;
    img.src = src;
    images.set(src, img);
    if (images.size > 400) images.delete(images.keys().next().value!);
  }
  return img.complete && img.naturalWidth ? img : null;
}

const framesCache = new Map<string, SpriteFrames | null>();
export function getFrames(text: string | undefined): SpriteFrames | null {
  if (!text) return null;
  if (!framesCache.has(text)) {
    try {
      const r = SpriteFrames.safeParse(JSON.parse(text));
      framesCache.set(text, r.success ? r.data : null);
    } catch {
      framesCache.set(text, null);
    }
  }
  return framesCache.get(text) ?? null;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measureText(text: string, size: number) {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return { w: text.length * size * 0.6, h: size * 1.2 };
  measureCtx.font = `${size}px monospace`;
  const lines = text.split('\n');
  return { w: Math.max(...lines.map((l) => measureCtx!.measureText(l).width), 1), h: size * 1.25 * lines.length };
}

export interface Visual {
  e: Entity;
  /** World position. */
  x: number;
  y: number;
  /** Unscaled size and where the position sits inside it (0.5 = centre). */
  w: number;
  h: number;
  ox: number;
  oy: number;
  rot: number;
  sx: number;
  sy: number;
  depth: number;
  enabled: boolean;
  kind: 'image' | 'tiled' | 'frame' | 'text' | 'marker';
  img?: HTMLImageElement | null;
  /** Source rect for a sheet frame. */
  src?: { x: number; y: number; w: number; h: number };
  flipX?: boolean;
  tint?: string;
  text?: { text: string; size: number; color: string };
  order: number;
}

export function buildVisuals(scene: Scene, files: ProjectFiles, onImage: () => void): Visual[] {
  const out: Visual[] = [];
  let order = 0;
  const visit = (list: Entity[], ox: number, oy: number, parentEnabled: boolean) => {
    for (const e of list) {
      const c = e.components;
      const p = c.Transform?.position ?? { x: 0, y: 0 };
      const x = ox + p.x;
      const y = oy + p.y;
      const enabled = parentEnabled && e.active;
      const base = {
        e,
        x,
        y,
        rot: c.Transform?.rotation ?? 0,
        sx: c.Transform?.scale.x ?? 1,
        sy: c.Transform?.scale.y ?? 1,
        enabled,
        order: order++,
      };
      if (c.Sprite) {
        const s = c.Sprite;
        const img = getImage(files[s.asset], onImage);
        const w = s.tiled ? (s.width ?? 16) : (s.width ?? img?.naturalWidth ?? 16);
        const h = s.tiled ? (s.height ?? 16) : (s.height ?? img?.naturalHeight ?? 16);
        out.push({ ...base, w, h, ox: 0.5, oy: 0.5, depth: s.depth, kind: s.tiled ? 'tiled' : 'image', img, flipX: s.flipX, tint: s.tint });
      } else if (c.AnimatedSprite) {
        const a = c.AnimatedSprite;
        const def = getFrames(files[a.frames]);
        const img = def ? getImage(files[def.sheet], onImage) : null;
        const fw = def?.frameWidth ?? 16;
        const fh = def?.frameHeight ?? 16;
        const anim = def ? (def.animations[a.animation ?? ''] ?? Object.values(def.animations)[0]) : undefined;
        const frame = anim?.frames[0] ?? 0;
        const cols = img ? Math.max(1, Math.floor(img.naturalWidth / fw)) : 1;
        out.push({
          ...base,
          w: fw,
          h: fh,
          ox: 0.5,
          oy: 0.5,
          depth: a.depth,
          kind: 'frame',
          img,
          src: { x: (frame % cols) * fw, y: Math.floor(frame / cols) * fh, w: fw, h: fh },
          flipX: a.flipX,
        });
      } else if (c.Text) {
        const m = measureText(c.Text.text, c.Text.size);
        out.push({ ...base, w: m.w, h: m.h, ox: 0, oy: 0, depth: 100, kind: 'text', text: c.Text });
      } else {
        out.push({ ...base, w: 0, h: 0, ox: 0.5, oy: 0.5, depth: 0, kind: 'marker' });
      }
      visit(e.children, x, y, enabled);
    }
  };
  visit(scene.entities, 0, 0, true);
  return out.sort((a, b) => a.depth - b.depth || a.order - b.order);
}

/** The four corners of a visual's box in world space (clockwise from top-left). */
export function corners(v: Visual, markerSize = 0) {
  const w = v.kind === 'marker' ? markerSize : v.w;
  const h = v.kind === 'marker' ? markerSize : v.h;
  const ox = v.kind === 'marker' ? 0.5 : v.ox;
  const oy = v.kind === 'marker' ? 0.5 : v.oy;
  const cos = Math.cos(v.rot);
  const sin = Math.sin(v.rot);
  return [
    [-ox * w, -oy * h],
    [(1 - ox) * w, -oy * h],
    [(1 - ox) * w, (1 - oy) * h],
    [-ox * w, (1 - oy) * h],
  ].map(([lx, ly]) => {
    const px = lx! * v.sx;
    const py = ly! * v.sy;
    return { x: v.x + px * cos - py * sin, y: v.y + px * sin + py * cos };
  });
}

export function aabb(v: Visual, markerSize = 0) {
  const c = corners(v, markerSize);
  const xs = c.map((p) => p.x);
  const ys = c.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function inside(v: Visual, wx: number, wy: number, markerSize: number) {
  const dx = wx - v.x;
  const dy = wy - v.y;
  const cos = Math.cos(-v.rot);
  const sin = Math.sin(-v.rot);
  const lx = (dx * cos - dy * sin) / (v.sx || 1);
  const ly = (dx * sin + dy * cos) / (v.sy || 1);
  const w = v.kind === 'marker' ? markerSize : v.w;
  const h = v.kind === 'marker' ? markerSize : v.h;
  const ox = v.kind === 'marker' ? 0.5 : v.ox;
  const oy = v.kind === 'marker' ? 0.5 : v.oy;
  const [a, b] = [-ox * w, (1 - ox) * w].sort((p, q) => p - q) as [number, number];
  const [c, d] = [-oy * h, (1 - oy) * h].sort((p, q) => p - q) as [number, number];
  return lx >= a && lx <= b && ly >= c && ly <= d;
}

/** Entity ids under a world point, topmost first. */
export function pick(visuals: Visual[], wx: number, wy: number, zoom: number): string[] {
  const marker = 14 / zoom;
  const hits: string[] = [];
  for (let i = visuals.length - 1; i >= 0; i--) {
    const v = visuals[i]!;
    if (inside(v, wx, wy, marker)) hits.push(v.e.id);
  }
  return hits;
}

export function pickRect(visuals: Visual[], r: { x0: number; y0: number; x1: number; y1: number }, zoom: number): string[] {
  const marker = 14 / zoom;
  return visuals
    .filter((v) => {
      const b = aabb(v, marker);
      return b.x0 < r.x1 && b.x1 > r.x0 && b.y0 < r.y1 && b.y1 > r.y0;
    })
    .map((v) => v.e.id);
}

/* ─── Drawing ─────────────────────────────────────────────────────────── */

export const C = {
  bg: '#0B0C10',
  gridMinor: 'rgba(255,255,255,0.05)',
  gridMajor: 'rgba(255,255,255,0.11)',
  axisX: 'rgba(255,92,122,0.75)',
  axisY: 'rgba(74,222,128,0.7)',
  screen: '#8B6CFF',
  bounds: 'rgba(34,211,238,0.55)',
  select: '#22D3EE',
  hover: 'rgba(34,211,238,0.45)',
  gizmoX: '#FF5C7A',
  gizmoY: '#4ADE80',
  gizmoBoth: '#FBBF24',
  ruler: '#13151B',
  rulerText: '#7D8496',
};

const tintCache = new Map<string, HTMLCanvasElement>();
function tinted(img: HTMLImageElement, tint: string) {
  const key = `${img.src.length}:${img.src.slice(-32)}:${tint}`;
  let c = tintCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const x = c.getContext('2d')!;
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = tint;
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(img, 0, 0);
    tintCache.set(key, c);
  }
  return c;
}

export interface DrawOptions {
  view: ViewXf;
  width: number;
  height: number;
  scene: Scene;
  files: ProjectFiles;
  manifest: ProjectManifest | null;
  visuals: Visual[];
  selection: Set<string>;
  hover: string | null;
  grid: boolean;
  step: number;
  onImage: () => void;
}

export function drawScene(ctx: CanvasRenderingContext2D, o: DrawOptions) {
  const { view, width, height, scene, manifest } = o;
  const W = manifest?.resolution.width ?? 480;
  const H = manifest?.resolution.height ?? 270;
  const bounds = scene.bounds ?? { width: W, height: H };

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;

  // World: background colour and parallax layers, as they look with the camera at the start.
  ctx.save();
  ctx.translate(view.panX, view.panY);
  ctx.scale(view.zoom, view.zoom);
  ctx.fillStyle = scene.background ?? '#000000';
  ctx.fillRect(0, 0, bounds.width, bounds.height);
  ctx.beginPath();
  ctx.rect(0, 0, bounds.width, bounds.height);
  ctx.clip();
  for (const layer of scene.parallax) {
    const img = getImage(o.files[layer.asset], o.onImage);
    if (!img) continue;
    if (layer.tiled) {
      for (let x = 0; x < bounds.width; x += img.naturalWidth) ctx.drawImage(img, x, layer.y);
    } else ctx.drawImage(img, 0, layer.y);
  }
  ctx.restore();

  if (o.grid) drawGrid(ctx, view, width, height, o.step);

  // Entities.
  ctx.save();
  ctx.translate(view.panX, view.panY);
  ctx.scale(view.zoom, view.zoom);
  for (const v of o.visuals) {
    if (v.kind === 'marker') continue;
    ctx.save();
    ctx.globalAlpha = v.enabled ? 1 : 0.28;
    ctx.translate(v.x, v.y);
    ctx.rotate(v.rot);
    ctx.scale(v.sx * (v.flipX ? -1 : 1), v.sy);
    const left = -v.ox * v.w;
    const top = -v.oy * v.h;
    if (v.kind === 'text' && v.text) {
      ctx.fillStyle = v.text.color;
      ctx.font = `${v.text.size}px monospace`;
      ctx.textBaseline = 'top';
      v.text.text.split('\n').forEach((line, i) => ctx.fillText(line, left, top + i * v.text!.size * 1.25));
    } else if (v.img) {
      const src = v.tint && v.kind !== 'frame' ? tinted(v.img, v.tint) : v.img;
      if (v.kind === 'tiled') {
        const pattern = ctx.createPattern(src, 'repeat');
        if (pattern) {
          // Tiles start at the box's top-left corner, like a TileSprite.
          pattern.setTransform(new DOMMatrix().translate(left, top));
          ctx.fillStyle = pattern;
          ctx.fillRect(left, top, v.w, v.h);
        }
      } else if (v.kind === 'frame' && v.src) {
        ctx.drawImage(src, v.src.x, v.src.y, v.src.w, v.src.h, left, top, v.w, v.h);
      } else {
        ctx.drawImage(src, left, top, v.w, v.h);
      }
    } else {
      // Image missing or still loading: a hatched placeholder.
      ctx.fillStyle = 'rgba(248,113,113,0.25)';
      ctx.fillRect(left, top, v.w, v.h);
      ctx.strokeStyle = 'rgba(248,113,113,0.8)';
      ctx.lineWidth = 1 / view.zoom;
      ctx.strokeRect(left, top, v.w, v.h);
    }
    ctx.restore();
  }
  ctx.restore();

  // The game screen at the start (resolution) and the world's edges.
  const s0 = toScreen(view, 0, 0);
  ctx.save();
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = C.bounds;
  ctx.strokeRect(Math.round(s0.x) + 0.5, Math.round(s0.y) + 0.5, Math.round(bounds.width * view.zoom), Math.round(bounds.height * view.zoom));
  ctx.setLineDash([]);
  ctx.strokeStyle = C.screen;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(Math.round(s0.x) + 0.5, Math.round(s0.y) + 0.5, Math.round(W * view.zoom), Math.round(H * view.zoom));
  ctx.restore();

  // Markers for entities with nothing to draw (cameras, empty groups, music).
  for (const v of o.visuals) if (v.kind === 'marker') drawMarker(ctx, view, v);

  // Hover and selection outlines.
  for (const v of o.visuals) {
    const sel = o.selection.has(v.e.id);
    if (!sel && o.hover !== v.e.id) continue;
    const pts = corners(v, 14 / view.zoom).map((p) => toScreen(view, p.x, p.y));
    ctx.save();
    ctx.strokeStyle = sel ? C.select : C.hover;
    ctx.lineWidth = sel ? 1.5 : 1;
    if (!sel) ctx.setLineDash([4, 3]);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    if (sel) {
      ctx.fillStyle = C.select;
      for (const p of pts) ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
    }
    ctx.restore();
  }
}

function drawMarker(ctx: CanvasRenderingContext2D, view: ViewXf, v: Visual) {
  const p = toScreen(view, v.x, v.y);
  ctx.save();
  ctx.globalAlpha = v.enabled ? 1 : 0.35;
  const c = v.e.components;
  if (c.Camera) {
    ctx.strokeStyle = '#C9BCFF';
    ctx.fillStyle = 'rgba(124,92,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(p.x - 8, p.y - 6, 12, 12, 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x + 4, p.y - 1);
    ctx.lineTo(p.x + 9, p.y - 4);
    ctx.lineTo(p.x + 9, p.y + 4);
    ctx.lineTo(p.x + 4, p.y + 1);
    ctx.stroke();
  } else {
    ctx.strokeStyle = c.MusicPlayer ? '#FF5CA8' : '#A3A9B8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.moveTo(p.x - 9, p.y);
    ctx.lineTo(p.x + 9, p.y);
    ctx.moveTo(p.x, p.y - 9);
    ctx.lineTo(p.x, p.y + 9);
    ctx.stroke();
  }
  ctx.restore();
}

function niceStep(base: number, zoom: number) {
  let step = base;
  while (step * zoom < 8) step *= 2;
  return step;
}

function drawGrid(ctx: CanvasRenderingContext2D, view: ViewXf, width: number, height: number, base: number) {
  const step = niceStep(base, view.zoom);
  const a = toWorld(view, 0, 0);
  const b = toWorld(view, width, height);
  ctx.save();
  ctx.lineWidth = 1;
  for (const major of [false, true]) {
    ctx.strokeStyle = major ? C.gridMajor : C.gridMinor;
    ctx.beginPath();
    const s = major ? step * 8 : step;
    for (let x = Math.floor(a.x / s) * s; x <= b.x; x += s) {
      if (!major && Math.round(x / step) % 8 === 0) continue;
      const sx = Math.round(x * view.zoom + view.panX) + 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
    }
    for (let y = Math.floor(a.y / s) * s; y <= b.y; y += s) {
      if (!major && Math.round(y / step) % 8 === 0) continue;
      const sy = Math.round(y * view.zoom + view.panY) + 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
    }
    ctx.stroke();
  }
  // Axes through the origin.
  ctx.strokeStyle = C.axisX;
  ctx.beginPath();
  ctx.moveTo(0, Math.round(view.panY) + 0.5);
  ctx.lineTo(width, Math.round(view.panY) + 0.5);
  ctx.stroke();
  ctx.strokeStyle = C.axisY;
  ctx.beginPath();
  ctx.moveTo(Math.round(view.panX) + 0.5, 0);
  ctx.lineTo(Math.round(view.panX) + 0.5, height);
  ctx.stroke();
  ctx.restore();
}

export const RULER = 18;

export function drawRulers(ctx: CanvasRenderingContext2D, view: ViewXf, width: number, height: number, cursor: { x: number; y: number } | null) {
  ctx.save();
  ctx.fillStyle = C.ruler;
  ctx.fillRect(0, 0, width, RULER);
  ctx.fillRect(0, 0, RULER, height);
  ctx.strokeStyle = '#262A35';
  ctx.beginPath();
  ctx.moveTo(0, RULER + 0.5);
  ctx.lineTo(width, RULER + 0.5);
  ctx.moveTo(RULER + 0.5, 0);
  ctx.lineTo(RULER + 0.5, height);
  ctx.stroke();

  let step = 1;
  for (const s of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]) {
    step = s;
    if (s * view.zoom >= 60) break;
  }
  const minor = step / 5;
  ctx.font = '10px "IBM Plex Sans", sans-serif';
  ctx.fillStyle = C.rulerText;
  ctx.strokeStyle = '#3A3F4E';
  ctx.textBaseline = 'top';
  const a = toWorld(view, 0, 0);
  const b = toWorld(view, width, height);
  ctx.beginPath();
  for (let x = Math.floor(a.x / minor) * minor; x <= b.x; x += minor) {
    const sx = Math.round(x * view.zoom + view.panX) + 0.5;
    if (sx < RULER) continue;
    const isMajor = Math.abs(x / step - Math.round(x / step)) < 1e-6;
    ctx.moveTo(sx, isMajor ? 2 : RULER - 5);
    ctx.lineTo(sx, RULER);
    if (isMajor) ctx.fillText(String(Math.round(x)), sx + 3, 2);
  }
  for (let y = Math.floor(a.y / minor) * minor; y <= b.y; y += minor) {
    const sy = Math.round(y * view.zoom + view.panY) + 0.5;
    if (sy < RULER) continue;
    const isMajor = Math.abs(y / step - Math.round(y / step)) < 1e-6;
    ctx.moveTo(isMajor ? 2 : RULER - 5, sy);
    ctx.lineTo(RULER, sy);
    if (isMajor) {
      ctx.save();
      ctx.translate(3, sy + 3);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(String(Math.round(y)), 0, -12);
      ctx.restore();
    }
  }
  ctx.stroke();
  if (cursor) {
    ctx.strokeStyle = C.select;
    ctx.beginPath();
    ctx.moveTo(cursor.x + 0.5, 0);
    ctx.lineTo(cursor.x + 0.5, RULER);
    ctx.moveTo(0, cursor.y + 0.5);
    ctx.lineTo(RULER, cursor.y + 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = '#191B23';
  ctx.fillRect(0, 0, RULER, RULER);
  ctx.restore();
}
