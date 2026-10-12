import * as Phaser from 'phaser';
import { Entity as EntitySchema, ProjectManifest, Scene, SpriteFrames, type Entity, type Light, type ProjectFiles } from '@degamed/shared';
import { animKey, pickAutoAnimation } from './animation';
import { Atmosphere, DEPTH, TEX, ensureTextures, type LightSource } from './atmosphere';
import { lookAheadStep, pixelZoom, type Rect } from './atmosphere-math';
import { autotile, TILE_ROLES, tileSurfaces, type TileRole } from './tilemap';
import { FONT_CELL, FONT_CHARS, FONT_KEY, FONT_LETTER_SPACING, drawFontSheet, fontSafe } from './font';
import { InputState, Key } from './input';
import { compileScripts, DEGAMED_MODULE_SOURCE, ScriptError } from './scripts';
import { Sfx } from './sfx';
import { DEFAULT_TOUCH, mountTouchControls } from './touch';

export interface RuntimeHooks {
  log(level: 'info' | 'warn' | 'error', message: string, source?: string): void;
  error(message: string, details?: { stack?: string; file?: string; line?: number }): void;
}

type ArcadeBody = Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
type Visual = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Transform &
  Phaser.GameObjects.Components.Visible &
  Partial<Phaser.GameObjects.Components.Flip> &
  Partial<Phaser.GameObjects.Components.Depth> &
  Partial<Phaser.GameObjects.Components.Alpha>;

const hexToInt = (hex: string) => parseInt(hex.replace('#', ''), 16);

const LIGHT_DEFAULTS: Light = { color: '#FFE7B0', radius: 64, intensity: 1, flicker: 0, offset: { x: 0, y: 0 } };

/** The object scripts see as `this.entity` and `other`. */
export class EntityHandle {
  readonly behaviours: Behaviour[] = [];
  destroyed = false;
  /** The entity's light (lamps, the hero, pickups). Change its fields to animate it. */
  light: Light | null = null;
  private readonly fallbackVelocity = new Phaser.Math.Vector2();
  /** Base scale, so squash and stretch return to the right size. */
  baseScaleX = 1;
  baseScaleY = 1;
  /** Entities created as this one's children (destroyed with it). */
  readonly children: EntityHandle[] = [];

  constructor(
    readonly id: string,
    readonly name: string,
    readonly tags: readonly string[],
    readonly go: Visual,
    private readonly world: World,
  ) {}

  get body(): ArcadeBody | null {
    return (this.go.body as ArcadeBody | null) ?? null;
  }
  get x() {
    return this.go.x;
  }
  set x(v: number) {
    this.setPosition(v, this.go.y);
  }
  get y() {
    return this.go.y;
  }
  set y(v: number) {
    this.setPosition(this.go.x, v);
  }
  setPosition(x: number, y: number) {
    const body = this.body;
    if (body instanceof Phaser.Physics.Arcade.Body) {
      // reset() places the body's top-left at the game object's origin-adjusted position.
      this.go.setPosition(x, y);
      body.reset(x, y);
    } else {
      this.go.setPosition(x, y);
      if (body) body.updateFromGameObject();
    }
  }
  get rotation() {
    return this.go.rotation;
  }
  set rotation(v: number) {
    this.go.rotation = v;
  }
  get scale() {
    return this.go.scaleX;
  }
  set scale(v: number) {
    this.go.setScale(v);
    this.baseScaleX = this.baseScaleY = v;
  }
  get alpha() {
    return this.go.alpha ?? 1;
  }
  set alpha(v: number) {
    this.go.setAlpha?.(v);
  }
  get visible() {
    return this.go.visible;
  }
  set visible(v: boolean) {
    this.go.setVisible(v);
  }
  get flipX() {
    return this.go.flipX ?? false;
  }
  set flipX(v: boolean) {
    this.go.setFlipX?.(v);
  }
  /** Multiplies the sprite's colours ('#FFFFFF' = none). */
  set tint(color: string | null) {
    const go = this.go as unknown as Partial<Phaser.GameObjects.Components.Tint>;
    if (!color) go.clearTint?.();
    else go.setTint?.(hexToInt(color));
  }
  get velocity(): Phaser.Math.Vector2 {
    const body = this.body;
    return body instanceof Phaser.Physics.Arcade.Body ? body.velocity : this.fallbackVelocity;
  }
  get onFloor(): boolean {
    const body = this.body;
    return body instanceof Phaser.Physics.Arcade.Body ? body.blocked.down || body.touching.down : false;
  }
  /** True when pressed against a wall on that side. */
  get onWall(): -1 | 0 | 1 {
    const body = this.body;
    if (!(body instanceof Phaser.Physics.Arcade.Body)) return 0;
    if (body.blocked.left || body.touching.left) return -1;
    if (body.blocked.right || body.touching.right) return 1;
    return 0;
  }
  get onCeiling(): boolean {
    const body = this.body;
    return body instanceof Phaser.Physics.Arcade.Body ? body.blocked.up || body.touching.up : false;
  }
  /** Turns gravity on or off (climbing, flying). */
  set gravity(v: boolean) {
    const body = this.body;
    if (body instanceof Phaser.Physics.Arcade.Body) body.setAllowGravity(v);
  }
  get gravity() {
    const body = this.body;
    return body instanceof Phaser.Physics.Arcade.Body ? body.allowGravity : false;
  }
  /** Turns physics on or off for this entity (e.g. while dead). */
  set solid(v: boolean) {
    const body = this.body;
    if (body) body.enable = v;
  }
  get solid() {
    return this.body?.enable ?? false;
  }
  /** Changes the hitbox (e.g. sliding makes the hero shorter). Keeps the feet where they are. */
  setHitbox(width: number, height: number) {
    const body = this.body;
    if (!(body instanceof Phaser.Physics.Arcade.Body)) return;
    const bottom = body.bottom;
    const go = this.go as unknown as { width?: number; height?: number };
    body.setSize(width, height, false);
    body.setOffset(((go.width ?? width) - width) / 2, (go.height ?? height) - height);
    body.y = bottom - height;
  }
  get text(): string {
    if (this.go instanceof Phaser.GameObjects.Text || this.go instanceof Phaser.GameObjects.BitmapText) return this.go.text;
    return '';
  }
  set text(v: string) {
    if (this.go instanceof Phaser.GameObjects.Text && this.go.text !== v) this.go.setText(v);
    else if (this.go instanceof Phaser.GameObjects.BitmapText) {
      const t = fontSafe(v);
      if (this.go.text !== t) this.go.setText(t);
    }
  }
  hasTag(tag: string) {
    return this.tags.includes(tag);
  }

  // ── Animation (entities with an AnimatedSprite) ──────────────────────────
  /** The .frames.json this entity animates from, if any. */
  framesPath: string | null = null;
  /** Animation names available to this entity. */
  animations: ReadonlySet<string> = new Set();
  /** When true, idle/run/jump/fall are chosen automatically from the body each frame. */
  autoAnimate = false;
  /** Set while a one-shot animation started by a script plays, so auto mode doesn't cut it off. */
  oneShotPlaying = false;
  private loops = new Map<string, boolean>();

  setupAnimation(framesPath: string, loops: Map<string, boolean>, auto: boolean) {
    this.framesPath = framesPath;
    this.loops = loops;
    this.animations = new Set(loops.keys());
    this.autoAnimate = auto;
  }

  /** Name of the animation playing now, or null. */
  get animation(): string | null {
    const key = this.go instanceof Phaser.GameObjects.Sprite ? this.go.anims.currentAnim?.key : undefined;
    return key ? key.slice(key.indexOf('#') + 1) : null;
  }

  /**
   * Plays an animation by name. Keeps playing (no restart) if it is already running, unless
   * `restart` is true. A non-looping animation started here pauses auto mode until it finishes.
   */
  play(name: string, opts: { restart?: boolean } = {}): boolean {
    if (!(this.go instanceof Phaser.GameObjects.Sprite) || !this.framesPath) {
      this.world.warnOnce(`${this.name} has no AnimatedSprite, so it can't play "${name}"`);
      return false;
    }
    if (!this.animations.has(name)) {
      this.world.warnOnce(`${this.name} has no animation called "${name}" (has: ${[...this.animations].join(', ')})`);
      return false;
    }
    this.go.play(animKey(this.framesPath, name), !opts.restart);
    return true;
  }

  /** True if this entity has an animation with that name. */
  hasAnimation(name: string) {
    return this.animations.has(name);
  }

  /** Plays a one-shot animation (e.g. "attack") on top of auto mode. */
  playOnce(name: string): boolean {
    const ok = this.play(name, { restart: true });
    if (ok && this.loops.get(name) === false) this.oneShotPlaying = true;
    return ok;
  }

  stop() {
    if (this.go instanceof Phaser.GameObjects.Sprite) this.go.stop();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const child of this.children) child.destroy();
    for (const b of this.behaviours) this.world.call(b, 'onDestroy');
    this.world.remove(this);
    this.go.destroy();
  }
}

/** Base class for scripts. Scripts extend it and override the `on…` hooks they need. */
export class Behaviour {
  static props: Record<string, unknown> = {};
  entity!: EntityHandle;
  props: Record<string, unknown> = {};
  /** Set by the runtime: which file this behaviour came from (for error messages). */
  __file = '';

  get velocity() {
    return this.entity.velocity;
  }
  get onFloor() {
    return this.entity.onFloor;
  }
  /** Shortcut for this.entity.play(name). */
  play(name: string, opts?: { restart?: boolean }) {
    return this.entity.play(name, opts);
  }
  /** Plays a non-looping animation once (attack, hurt…) even in auto mode. */
  playOnce(name: string) {
    return this.entity.playOnce(name);
  }

  onStart?(): void;
  onUpdate?(dt: number): void;
  onCollide?(other: EntityHandle): void;
  onDestroy?(): void;
  /** Called when a non-looping animation on this entity finishes. */
  onAnimationEnd?(name: string): void;
}

/** Live state of one running scene: entities, behaviours and collision groups. */
class World {
  readonly entities: EntityHandle[] = [];
  readonly solids: Phaser.GameObjects.GameObject[] = [];
  readonly actors: Phaser.GameObjects.GameObject[] = [];
  readonly sensors: Phaser.GameObjects.GameObject[] = [];
  readonly byObject = new Map<Phaser.GameObjects.GameObject, EntityHandle>();
  /** Tilemap layers, their colliders and their top surfaces. */
  readonly tilemaps = new Map<Phaser.GameObjects.GameObject, { collider: Phaser.Physics.Arcade.Collider | null; surfaces: Rect[] }>();
  /** Short-lived lights from effects (pickup flashes, explosions). */
  readonly flashes: { x: number; y: number; light: Light; age: number; life: number; seed: number }[] = [];
  private readonly broken = new Set<Behaviour>();
  private readonly warned = new Set<string>();

  constructor(private readonly hooks: RuntimeHooks) {}

  warnOnce(message: string) {
    if (this.warned.has(message)) return;
    this.warned.add(message);
    this.hooks.log('warn', message);
  }

  add(e: EntityHandle) {
    this.entities.push(e);
    this.byObject.set(e.go, e);
  }

  remove(e: EntityHandle) {
    const tm = this.tilemaps.get(e.go);
    if (tm) {
      tm.collider?.destroy();
      this.tilemaps.delete(e.go);
    }
    for (const list of [this.entities, this.solids, this.actors, this.sensors] as unknown[][]) {
      const i = list.indexOf(list === this.entities ? e : e.go);
      if (i >= 0) list.splice(i, 1);
    }
    this.byObject.delete(e.go);
  }

  /** Runs a behaviour hook; a script that throws is reported once and then switched off. */
  call<K extends 'onStart' | 'onUpdate' | 'onCollide' | 'onDestroy' | 'onAnimationEnd'>(b: Behaviour, hook: K, ...args: unknown[]) {
    const fn = b[hook] as ((...a: unknown[]) => void) | undefined;
    if (!fn || this.broken.has(b)) return;
    try {
      fn.apply(b, args);
    } catch (err) {
      this.broken.add(b);
      const e = err as Error;
      this.hooks.error(`${b.__file}: ${e.message} (in ${hook}; this script is paused until you restart)`, {
        stack: e.stack,
        file: b.__file,
      });
    }
  }

  find(nameOrId: string) {
    return this.entities.find((e) => e.id === nameOrId || e.name === nameOrId) ?? null;
  }

  /** Surfaces rain can splash on: static bodies plus tilemap tops. */
  surfaces(): Rect[] {
    const out: Rect[] = [];
    for (const go of this.solids) {
      const b = (go as unknown as { body?: ArcadeBody }).body;
      if (b) out.push({ x: b.x, y: b.y, width: b.width, height: b.height });
    }
    for (const tm of this.tilemaps.values()) for (const r of tm.surfaces) out.push(r);
    return out;
  }

  *lightSources(): Iterable<LightSource> {
    let seed = 0;
    for (const e of this.entities) {
      seed++;
      if (!e.light || e.destroyed || !e.go.visible) continue;
      const sf = (e.go as unknown as { scrollFactorX?: number }).scrollFactorX ?? 1;
      yield { x: e.go.x, y: e.go.y, light: e.light, seed, scrollFactor: sf, fade: e.go.alpha ?? 1 };
    }
    for (const f of this.flashes) {
      const t = f.age / f.life;
      yield { x: f.x, y: f.y, light: f.light, seed: f.seed, fade: 1 - t * t };
    }
  }
}

export interface GameHandle {
  restart(): void;
  pause(): void;
  resume(): void;
  step(): void;
  screenshot(): Promise<string>;
  input: InputState;
  destroy(): void;
}

interface Loaded {
  manifest: ProjectManifest;
  scene: Scene;
  frames: Map<string, SpriteFrames>;
  behaviours: Map<string, typeof Behaviour>;
}

function parseJson(files: ProjectFiles, path: string): unknown {
  const text = files[path];
  if (text === undefined) throw new ScriptError(`Missing ${path}`, path);
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new ScriptError(`${path} is not valid JSON: ${(e as Error).message}`, path);
  }
}

function flatten(entities: Entity[], offsetX = 0, offsetY = 0, out: { e: Entity; x: number; y: number }[] = [], all = false) {
  for (const e of entities) {
    if (!e.active && !all) continue;
    const p = e.components.Transform?.position ?? { x: 0, y: 0 };
    const x = offsetX + p.x;
    const y = offsetY + p.y;
    out.push({ e, x, y });
    flatten(e.children, x, y, out, all);
  }
  return out;
}

function parseProject(files: ProjectFiles): Omit<Loaded, 'behaviours'> & { scriptPaths: string[] } {
  const manifest = ProjectManifest.parse(parseJson(files, 'project.json'));
  const sceneResult = Scene.safeParse(parseJson(files, manifest.startScene));
  if (!sceneResult.success) {
    const issue = sceneResult.error.issues[0];
    const where = issue?.path.length ? ` (at ${issue.path.join('.')})` : '';
    throw new ScriptError(`${manifest.startScene}: ${issue?.message ?? 'invalid scene'}${where}`, manifest.startScene);
  }
  const scene = sceneResult.data;
  // Inactive entities count too: scripts can spawn copies of them (prefabs).
  const everything = flatten(scene.entities, 0, 0, [], true);

  const scriptPaths = [...new Set(everything.flatMap(({ e }) => (e.components.Script ? [e.components.Script.src] : [])))];
  const pythonScripts = scriptPaths.filter((p) => p.endsWith('.py'));
  if (pythonScripts.length) {
    throw new ScriptError('Python scripts are coming in the next engine milestone. Use .js for now.', pythonScripts[0]!);
  }
  const frames = new Map<string, SpriteFrames>();
  for (const { e } of everything) {
    const path = e.components.AnimatedSprite?.frames;
    if (!path || frames.has(path)) continue;
    const parsed = SpriteFrames.safeParse(parseJson(files, path));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ScriptError(`${path}: ${issue?.path.join('.') ?? ''} ${issue?.message ?? 'invalid frames file'}`.trim(), path);
    }
    if (!files[parsed.data.sheet]?.startsWith('data:image/')) {
      throw new ScriptError(`${path}: sprite sheet ${parsed.data.sheet} is missing`, path);
    }
    frames.set(path, parsed.data);
  }
  return { manifest, scene, frames, scriptPaths };
}

/** Imports every Behaviour script. The engine API must already be on globalThis.__degamed. */
async function importBehaviours(files: ProjectFiles, scriptPaths: string[]): Promise<Map<string, typeof Behaviour>> {
  const degamedUrl = URL.createObjectURL(new Blob([DEGAMED_MODULE_SOURCE], { type: 'text/javascript' }));
  const urls = compileScripts(files, scriptPaths, degamedUrl);
  const behaviours = new Map<string, typeof Behaviour>();
  for (const path of scriptPaths) {
    let mod: { default?: unknown };
    try {
      mod = (await import(/* @vite-ignore */ urls.get(path)!)) as { default?: unknown };
    } catch (e) {
      throw new ScriptError(`${(e as Error).message}`, path);
    }
    const cls = mod.default;
    if (typeof cls !== 'function' || !(cls.prototype instanceof Behaviour)) {
      throw new ScriptError('must `export default class … extends Behaviour`', path);
    }
    behaviours.set(path, cls as typeof Behaviour);
  }
  return behaviours;
}

/** Things a running scene exposes to the kit API. */
interface SceneControls {
  scene: Phaser.Scene;
  world: World;
  ui(go: Phaser.GameObjects.GameObject): void;
  hitStop(ms: number): void;
  slowMo(scale: number, ms: number): void;
  spawn(name: string, x: number, y: number, overrides?: SpawnOverrides): EntityHandle | null;
  snapCamera(): void;
}

export interface SpawnOverrides {
  width?: number;
  height?: number;
  props?: Record<string, number | string | boolean>;
}

/** Starts a project inside `parent`. Rejects with a ScriptError if the project can't load. */
export async function startGame(parent: HTMLElement, files: ProjectFiles, hooks: RuntimeHooks): Promise<GameHandle> {
  const { manifest, scene, frames, scriptPaths } = parseProject(files);
  const input = new InputState(manifest.input);
  input.attach(window);
  const sfx = new Sfx();
  let ctl: SceneControls;
  let elapsed = 0;
  let timeScale = 1;
  const state: Record<string, unknown> = {};
  const { width: W, height: H } = manifest.resolution;
  const pixelArt = manifest.artStyle.startsWith('pixel');

  const api = {
    Behaviour,
    Key,
    Input: {
      down: (name: string) => input.isDown(name),
      pressed: (name: string) => input.isPressed(name),
      axis: (which: 'horizontal' | 'vertical') => input.axis(which),
    },
    Game: {
      score: 0,
      /** Data that survives restarts (lives, best score, checkpoints). */
      state,
      get time() {
        return elapsed;
      },
      /** 1 = normal speed; kit.slowMo changes it briefly. */
      get timeScale() {
        return timeScale;
      },
      width: W,
      height: H,
      find: (name: string) => ctl.world.find(name),
      findAll: (tag: string) => ctl.world.entities.filter((e) => e.hasTag(tag)),
      /** Creates a copy of an entity from the scene (often an inactive "prefab") at x, y. */
      spawn: (name: string, x: number, y: number, overrides?: SpawnOverrides) => ctl.spawn(name, x, y, overrides),
      get camera() {
        const v = ctl.scene.cameras.main.worldView;
        return { x: v.x, y: v.y, width: v.width, height: v.height };
      },
      sound: (name: string) => sfx.play(name),
      log: (...args: unknown[]) => hooks.log('info', args.map(String).join(' ')),
      restart: () => handle.restart(),
    },
    kit: {
      shake: (intensity = 0.008, ms = 150) => ctl.scene.cameras.main.shake(ms, intensity),
      flash: (color = '#FFFFFF', ms = 120) => {
        const c = hexToInt(color);
        ctl.scene.cameras.main.flash(ms, (c >> 16) & 255, (c >> 8) & 255, c & 255);
      },
      /** Freezes the action for a few milliseconds so hits feel heavy. */
      hitStop: (ms = 70) => ctl.hitStop(ms),
      /** Slows time (scale 0.3 = 30% speed) for `ms` real milliseconds. */
      slowMo: (scale = 0.35, ms = 600) => ctl.slowMo(scale, ms),
      squash: (entity: EntityHandle, amount = 0.8, ms = 180) => {
        ctl.scene.tweens.killTweensOf(entity.go);
        const sx = entity.baseScaleX;
        const sy = entity.baseScaleY;
        ctl.scene.tweens.add({
          targets: entity.go,
          scaleX: { from: sx * (2 - amount), to: sx },
          scaleY: { from: sy * amount, to: sy },
          duration: ms,
          ease: 'Back.Out',
        });
      },
      burst: (x: number, y: number, opts: { color?: string; count?: number; glow?: boolean; speed?: number } = {}) => {
        const glow = opts.glow ?? false;
        const speed = opts.speed ?? 140;
        const emitter = ctl.scene.add.particles(x, y, glow ? TEX.spark : TEX.px, {
          speed: { min: speed * 0.3, max: speed },
          angle: { min: 0, max: 360 },
          lifespan: { min: 250, max: 600 },
          scale: glow ? { start: 1, end: 0.2 } : { start: 1, end: 0 },
          alpha: { start: 1, end: 0 },
          gravityY: glow ? 120 : 300,
          tint: hexToInt(opts.color ?? '#FFFFFF'),
          blendMode: glow ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL,
          emitting: false,
        });
        emitter.setDepth(glow ? DEPTH.glow : DEPTH.burst);
        emitter.explode(opts.count ?? 12);
        ctl.scene.time.delayedCall(800, () => emitter.destroy());
      },
      /** Little puffs of dust (landing, skidding, running). dir -1/1 pushes them sideways. */
      dust: (x: number, y: number, opts: { color?: string; count?: number; dir?: number } = {}) => {
        const dir = opts.dir ?? 0;
        const emitter = ctl.scene.add.particles(x, y, TEX.px, {
          speedX: dir ? { min: dir * 10, max: dir * 50 } : { min: -55, max: 55 },
          speedY: { min: -30, max: -6 },
          lifespan: { min: 240, max: 460 },
          scale: { start: 1.2, end: 0.3 },
          alpha: { start: 0.75, end: 0 },
          gravityY: -20,
          tint: hexToInt(opts.color ?? '#C8C0B0'),
          emitting: false,
        });
        emitter.setDepth(DEPTH.burst);
        emitter.explode(opts.count ?? 6);
        ctl.scene.time.delayedCall(600, () => emitter.destroy());
      },
      /** A glittering pickup sparkle with a quick flash of light. */
      sparkle: (x: number, y: number, color = '#FFE38A') => {
        api.kit.burst(x, y, { color, count: 10, glow: true, speed: 90 });
        api.kit.flashLight(x, y, { color, radius: 46, ms: 380, intensity: 1.2 });
      },
      /** A short-lived light (explosions, pickups, sword hits). */
      flashLight: (x: number, y: number, opts: { color?: string; radius?: number; ms?: number; intensity?: number } = {}) => {
        ctl.world.flashes.push({
          x,
          y,
          light: { ...LIGHT_DEFAULTS, color: opts.color ?? '#FFFFFF', radius: opts.radius ?? 60, intensity: opts.intensity ?? 1 },
          age: 0,
          life: (opts.ms ?? 300) / 1000,
          seed: Math.random() * 1000,
        });
      },
      /** Gives an entity a light, or changes it: kit.light(entity, { color: '#FFD08A', radius: 80 }). */
      light: (entity: EntityHandle, light: Partial<Light> | null) => {
        entity.light = light ? { ...LIGHT_DEFAULTS, ...(entity.light ?? {}), ...light } : null;
      },
      /** Big centred text (level complete, game over). Returns an object with destroy(). */
      banner: (title: string, subtitle = '', opts: { color?: string; ms?: number; hint?: string } = {}) => {
        const s = ctl.scene;
        const objects: Phaser.GameObjects.GameObject[] = [];
        const band = s.add.rectangle(W / 2, H / 2, W, subtitle ? 74 : 54, 0x07080d, 0.62).setDepth(DEPTH.overlay);
        const t = s.add
          .bitmapText(W / 2, H / 2 - (subtitle ? 10 : 0), FONT_KEY, fontSafe(title))
          .setLetterSpacing(FONT_LETTER_SPACING)
          .setOrigin(0.5)
          .setScale(fontScaleFor(title))
          .setTint(hexToInt(opts.color ?? '#FFFFFF'))
          .setDepth(DEPTH.overlay + 1);
        objects.push(band, t);
        if (subtitle) {
          const sub = s.add
            .bitmapText(W / 2, H / 2 + 20, FONT_KEY, fontSafe(subtitle))
            .setLetterSpacing(FONT_LETTER_SPACING)
            .setOrigin(0.5)
            .setTint(0xd8dbe6)
            .setDepth(DEPTH.overlay + 1);
          objects.push(sub);
          s.tweens.add({ targets: sub, alpha: { from: 0, to: 1 }, delay: 250, duration: 300 });
        }
        if (opts.hint) {
          const hint = s.add
            .bitmapText(W / 2, H / 2 + (subtitle ? 52 : 40), FONT_KEY, fontSafe(opts.hint))
            .setLetterSpacing(FONT_LETTER_SPACING)
            .setOrigin(0.5)
            .setTint(0xffffff)
            .setAlpha(0)
            .setDepth(DEPTH.overlay + 1);
          objects.push(hint);
          s.tweens.add({ targets: hint, alpha: { from: 0, to: 1 }, delay: 900, duration: 400, yoyo: true, hold: 700, repeat: -1 });
        }
        for (const o of objects) ctl.ui(o);
        s.tweens.add({ targets: band, scaleY: { from: 0, to: 1 }, duration: 220, ease: 'Cubic.Out' });
        s.tweens.add({ targets: t, scale: { from: t.scale * 1.8, to: t.scale }, alpha: { from: 0, to: 1 }, duration: 320, ease: 'Back.Out' });
        const destroy = () => {
          for (const o of objects) o.destroy();
        };
        if (opts.ms) s.time.delayedCall(opts.ms, destroy);
        return { destroy };
      },
      /** Fades the world to a colour, runs `then`, and fades back in (death, respawn, doors). */
      transition: (then: () => void, opts: { color?: string; ms?: number } = {}) => {
        const cam = ctl.scene.cameras.main;
        const c = hexToInt(opts.color ?? '#05060A');
        const ms = opts.ms ?? 260;
        cam.fadeOut(ms, (c >> 16) & 255, (c >> 8) & 255, c & 255);
        cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          try {
            then();
          } finally {
            ctl.snapCamera();
            cam.fadeIn(ms, (c >> 16) & 255, (c >> 8) & 255, c & 255);
          }
        });
      },
      /**
       * Animates properties over time, like Godot's Tween:
       * kit.tween(this.entity, { y: 40, alpha: 0 }, { duration: 400, ease: 'Sine.InOut', yoyo: true, repeat: -1 })
       */
      tween: (
        target: EntityHandle | object,
        props: Record<string, number>,
        opts: { duration?: number; ease?: string; yoyo?: boolean; repeat?: number; delay?: number; onComplete?: () => void } = {},
      ) =>
        ctl.scene.tweens.add({
          targets: target instanceof EntityHandle ? target.go : target,
          ...props,
          duration: opts.duration ?? 300,
          ease: opts.ease ?? 'Sine.InOut',
          yoyo: opts.yoyo ?? false,
          repeat: opts.repeat ?? 0,
          delay: opts.delay ?? 0,
          onComplete: opts.onComplete,
        }),
      /** Runs `fn` after `ms` milliseconds of game time. */
      after: (ms: number, fn: () => void) => ctl.scene.time.delayedCall(ms, fn),
      floatText: (x: number, y: number, text: string, color = '#FFFFFF') => {
        const t = ctl.scene.add
          .bitmapText(x, y, FONT_KEY, fontSafe(text))
          .setLetterSpacing(FONT_LETTER_SPACING)
          .setOrigin(0.5)
          .setTint(hexToInt(color))
          .setDepth(DEPTH.glow + 1);
        ctl.scene.tweens.add({ targets: t, y: y - 18, alpha: { from: 1, to: 0 }, duration: 750, ease: 'Cubic.Out', onComplete: () => t.destroy() });
      },
    },
  };
  (globalThis as { __degamed?: unknown }).__degamed = api;
  let behaviours: Map<string, typeof Behaviour>;
  try {
    behaviours = await importBehaviours(files, scriptPaths);
  } catch (e) {
    input.dispose();
    throw e;
  }

  const allDefs = flatten(scene.entities, 0, 0, [], true);
  let spawnCount = 0;

  class DegamedScene extends Phaser.Scene {
    world!: World;
    atmosphere: Atmosphere | null = null;
    uiCamera!: Phaser.Cameras.Scene2D.Camera;
    followTarget: EntityHandle | null = null;
    lookX = 0;
    lookY = 0;
    camX = 0;
    camY = 0;
    hitStopLeft = 0;
    slowLeft = 0;
    private readonly uiObjects = new WeakSet<Phaser.GameObjects.GameObject>();
    private parallaxSprites: { sprite: Phaser.GameObjects.TileSprite; factor: number }[] = [];

    constructor() {
      super('main');
    }

    preload() {
      for (const [path, content] of Object.entries(files)) {
        if (/\.(png|jpe?g|webp|gif)$/i.test(path) && content.startsWith('data:image/')) this.load.image(path, content);
      }
      for (const [path, def] of frames) {
        this.load.spritesheet(path, files[def.sheet]!, { frameWidth: def.frameWidth, frameHeight: def.frameHeight });
      }
      this.load.on('loaderror', (file: { key: string }) => hooks.error(`Could not load image ${file.key}`, { file: file.key }));
    }

    create() {
      const world = (this.world = new World(hooks));
      elapsed = 0;
      timeScale = 1;
      this.hitStopLeft = 0;
      this.slowLeft = 0;
      this.lookX = 0;
      this.lookY = 0;
      this.followTarget = null;
      api.Game.score = 0;
      const bounds = scene.bounds ?? { width: W, height: H };
      ctl = {
        scene: this,
        world,
        ui: (go) => this.toUi(go),
        hitStop: (ms) => {
          this.hitStopLeft = Math.max(this.hitStopLeft, ms / 1000);
        },
        slowMo: (scale, ms) => {
          timeScale = Math.max(0.05, Math.min(1, scale));
          this.slowLeft = ms / 1000;
          this.applyTimeScale();
        },
        spawn: (name, x, y, o) => this.spawnPrefab(name, x, y, o),
        snapCamera: () => this.snapCamera(),
      };

      for (const [path, def] of frames) {
        // Frames 0…n-1; Phaser also counts a hidden "__BASE" frame.
        const available = this.textures.exists(path) ? this.textures.get(path).frameTotal - 1 : 0;
        for (const [name, anim] of Object.entries(def.animations)) {
          const key = animKey(path, name);
          if (this.anims.exists(key)) continue;
          const valid = anim.frames.filter((f) => f < available);
          if (valid.length < anim.frames.length) {
            hooks.log('warn', `${path}: "${name}" uses frames that don't exist in the sheet (it has ${available})`, path);
          }
          if (!valid.length) continue;
          this.anims.create({
            key,
            frames: this.anims.generateFrameNumbers(path, { frames: valid }),
            frameRate: anim.fps,
            repeat: anim.loop ? -1 : 0,
          });
        }
      }

      ensureTextures(this, scene.environment?.fog?.height ?? 0.6);
      if (!this.textures.exists(FONT_KEY)) {
        const sheet = this.textures.createCanvas(FONT_KEY, FONT_CHARS.length * FONT_CELL.width, FONT_CELL.height);
        if (sheet) {
          drawFontSheet(sheet.context);
          sheet.refresh();
        }
        const entry = Phaser.GameObjects.RetroFont.Parse(this, {
          image: FONT_KEY,
          width: FONT_CELL.width,
          height: FONT_CELL.height,
          chars: FONT_CHARS,
          charsPerRow: FONT_CHARS.length,
          'offset.x': 0,
          'offset.y': 0,
          'spacing.x': 0,
          'spacing.y': 0,
          lineSpacing: 1,
        } as unknown as Phaser.Types.GameObjects.BitmapText.RetroFontConfig);
        // Parse returns the whole cache entry ({ data, texture, frame }).
        this.cache.bitmapFont.add(FONT_KEY, entry);
      }

      if (scene.background) this.cameras.main.setBackgroundColor(scene.background);
      const parallaxObjects: Phaser.GameObjects.GameObject[] = [];
      this.parallaxSprites = [];
      scene.parallax.forEach((layer, i) => {
        if (!this.textures.exists(layer.asset)) return hooks.error(`Missing parallax image ${layer.asset}`, { file: layer.asset });
        const src = this.textures.get(layer.asset).getSourceImage() as { width: number; height: number };
        const sprite = layer.tiled
          ? this.add.tileSprite(0, layer.y, W, src.height, layer.asset)
          : this.add.image(0, layer.y, layer.asset);
        sprite.setOrigin(0, 0).setScrollFactor(0).setDepth(-100 + i);
        parallaxObjects.push(sprite);
        if (layer.tiled && sprite instanceof Phaser.GameObjects.TileSprite) this.parallaxSprites.push({ sprite, factor: layer.factor });
      });

      const pending: { e: Entity; handle: EntityHandle }[] = [];
      for (const e of scene.entities) this.spawnTree(e, 0, 0, null, pending);

      this.physics.world.setBounds(0, 0, bounds.width, bounds.height + 400);
      this.physics.world.checkCollision.down = false;
      const toObject = (o: unknown) =>
        (o instanceof Phaser.GameObjects.GameObject ? o : (o as { gameObject?: Phaser.GameObjects.GameObject }).gameObject) ?? null;
      const report = (a: unknown, b: unknown) => {
        const ea = world.byObject.get(toObject(a)!);
        const eb = world.byObject.get(toObject(b)!);
        if (!ea || !eb || ea.destroyed || eb.destroyed) return;
        for (const beh of ea.behaviours) world.call(beh, 'onCollide', eb);
        for (const beh of eb.behaviours) world.call(beh, 'onCollide', ea);
      };
      this.reportCollision = report;
      for (const [layer, tm] of world.tilemaps) tm.collider = this.physics.add.collider(world.actors, layer);
      this.physics.add.collider(world.actors, world.solids, report);
      this.physics.add.collider(world.actors, world.actors, report);
      this.physics.add.overlap(world.actors, world.sensors, report);

      const cameraEntity = flatten(scene.entities).find(({ e }) => e.components.Camera);
      const camera = cameraEntity?.e.components.Camera;
      const main = this.cameras.main;
      main.setBounds(0, 0, bounds.width, bounds.height);
      main.setRoundPixels(pixelArt);
      if (camera?.zoom && camera.zoom !== 1) main.setZoom(camera.zoom);
      // Like Godot's CanvasLayer: UI (entities tagged "ui", banners) gets its own camera, so it's
      // never zoomed, darkened, fogged or graded.
      this.uiCamera = this.cameras.add(0, 0, W, H, false, 'ui');
      this.uiCamera.setRoundPixels(pixelArt);
      for (const go of this.children.list) this.route(go);
      const onAdded = (go: Phaser.GameObjects.GameObject) => this.route(go);
      this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded));

      if (camera?.follow) {
        const target = world.find(camera.follow);
        if (target) this.followTarget = target;
        else hooks.log('warn', `Camera can't find "${camera.follow}" to follow`);
      }
      this.cameraConfig = {
        smoothing: camera?.smoothing ?? 0.12,
        lookAhead: camera?.lookAhead ?? 0,
        deadZone: camera?.deadZone ?? { width: 0, height: 0 },
      };
      this.snapCamera();

      for (const { e, handle } of pending) this.attachScript(e, handle);
      for (const { handle } of pending) for (const b of handle.behaviours) world.call(b, 'onStart');

      this.atmosphere = scene.environment
        ? new Atmosphere(this, {
            env: scene.environment,
            width: W,
            height: H,
            parallax: parallaxObjects,
            surfaces: () => world.surfaces(),
            lights: () => world.lightSources(),
          })
        : null;
      // Lights without an environment still glow (no darkness).
      if (!this.atmosphere && world.entities.some((e) => e.light)) {
        this.atmosphere = new Atmosphere(this, {
          env: {},
          width: W,
          height: H,
          parallax: parallaxObjects,
          surfaces: () => world.surfaces(),
          lights: () => world.lightSources(),
        });
      }

      // Runs after physics has moved everything, so the camera and lights match what's drawn.
      const post = () => this.afterPhysics();
      this.events.on(Phaser.Scenes.Events.POST_UPDATE, post);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.POST_UPDATE, post));
    }

    cameraConfig = { smoothing: 0.12, lookAhead: 0, deadZone: { width: 0, height: 0 } };
    reportCollision: ((a: unknown, b: unknown) => void) | null = null;

    /** Creates an entity and its active children; positions are relative to the parent. */
    spawnTree(e: Entity, px: number, py: number, parent: EntityHandle | null, out: { e: Entity; handle: EntityHandle }[]) {
      if (!e.active) return;
      const p = e.components.Transform?.position ?? { x: 0, y: 0 };
      const x = px + p.x;
      const y = py + p.y;
      const handle = this.spawnEntity(e, x, y);
      if (handle) {
        out.push({ e, handle });
        parent?.children.push(handle);
      }
      for (const child of e.children) this.spawnTree(child, x, y, handle ?? parent, out);
    }

    /** Builds an auto-tiled Phaser tilemap layer for a Tilemap component. */
    buildTilemap(tm: NonNullable<Entity['components']['Tilemap']>, x: number, y: number): Visual {
      const T = tm.tileSize;
      const texOf = (role: string) => {
        const path = tm.tiles[role];
        return path && this.textures.exists(path) ? path : null;
      };
      const has = (role: TileRole) => role === 'back' || !!texOf(role);
      const key = `__dg_ts:${T}:${JSON.stringify(tm.tiles)}`;
      if (!this.textures.exists(key)) {
        const tex = this.textures.createCanvas(key, T * TILE_ROLES.length, T);
        if (tex) {
          const ctx = tex.context;
          ctx.imageSmoothingEnabled = false;
          TILE_ROLES.forEach((role, i) => {
            const fallback: Record<string, string> = {
              ground2: 'ground', ground3: 'ground', groundLeft: 'ground', groundRight: 'ground', fill2: 'fill', fillLeft: 'fill',
              fillRight: 'fill', ceiling: 'fill', platform: 'ground', platformLeft: 'platform', platformRight: 'platform', back: 'fill',
            };
            let src = texOf(role);
            for (let r = role as string; !src && fallback[r]; r = fallback[r]!) src = texOf(fallback[r]!);
            if (!src) return;
            const img = this.textures.get(src).getSourceImage() as CanvasImageSource;
            ctx.drawImage(img, 0, 0, T, T, i * T, 0, T, T);
            if (role === 'back' && !texOf('back')) {
              // A background wall: the fill tile pushed back into the dark.
              ctx.save();
              ctx.globalCompositeOperation = 'source-atop';
              ctx.fillStyle = 'rgba(6,8,14,0.62)';
              ctx.fillRect(i * T, 0, T, T);
              ctx.restore();
            }
          });
          tex.refresh();
        }
      }
      const roles = autotile(tm.rows, has);
      const index = new Map(TILE_ROLES.map((r, i) => [r, i]));
      const width = Math.max(...tm.rows.map((r) => r.length));
      const data = roles.map((row) => Array.from({ length: width }, (_, i) => (row[i] ? index.get(row[i]!)! : -1)));
      const map = this.make.tilemap({ data, tileWidth: T, tileHeight: T });
      const tileset = map.addTilesetImage(key, key, T, T, 0, 0)!;
      const layer = map.createLayer(0, tileset, x, y)!;
      layer.setDepth(tm.depth);
      const back = index.get('back')!;
      const platforms = new Set([index.get('platform'), index.get('platformLeft'), index.get('platformRight')]);
      layer.forEachTile((tile: Phaser.Tilemaps.Tile) => {
        if (tile.index < 0 || tile.index === back) return;
        const ch = tm.rows[tile.y]?.[tile.x];
        if (ch === '=' || (platforms.has(tile.index) && ch !== '#')) tile.setCollision(false, false, true, false, false);
        else tile.setCollision(true, true, true, true, false);
      });
      layer.calculateFacesWithin(0, 0, width, tm.rows.length);
      this.world.tilemaps.set(layer, { collider: null, surfaces: tileSurfaces(tm.rows, T, x, y) });
      return layer as unknown as Visual;
    }


    private route(go: Phaser.GameObjects.GameObject) {
      const isUi = this.uiObjects.has(go) || (this.world.byObject.get(go)?.hasTag('ui') ?? false);
      if (isUi) {
        this.cameras.main.ignore(go);
      } else this.uiCamera.ignore(go);
    }

    /** Moves an object onto the UI layer (fixed on screen, unaffected by lighting and filters). */
    toUi(go: Phaser.GameObjects.GameObject) {
      this.uiObjects.add(go);
      (go as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor?.(0);
      go.cameraFilter = this.cameras.main.id;
    }

    applyTimeScale() {
      this.physics.world.timeScale = 1 / timeScale;
      this.tweens.timeScale = timeScale;
      this.anims.globalTimeScale = timeScale;
      this.time.timeScale = timeScale;
    }

    snapCamera() {
      const t = this.followTarget;
      if (!t || t.destroyed) return;
      this.lookX = 0;
      this.lookY = 0;
      this.camX = t.go.x;
      this.camY = t.go.y;
      this.cameras.main.centerOn(Math.round(this.camX), Math.round(this.camY));
    }

    private updateCamera(dt: number) {
      const t = this.followTarget;
      if (!t || t.destroyed) return;
      const cfg = this.cameraConfig;
      const v = t.velocity;
      this.lookX = lookAheadStep(this.lookX, v.x, cfg.lookAhead, dt);
      // Peek down when falling fast, so you can see where you'll land.
      const wantY = v.y > 260 ? Math.min(48, (v.y - 260) * 0.25) : 0;
      this.lookY += (wantY - this.lookY) * Math.min(1, dt * 4);
      const gx = t.go.x + this.lookX;
      const gy = t.go.y + this.lookY - 8;
      if (Math.abs(gx - this.camX) > W * 1.5 || Math.abs(gy - this.camY) > H * 1.5) return this.snapCamera();
      const dz = cfg.deadZone;
      const tx = Math.abs(gx - this.camX) > dz.width / 2 ? gx - Math.sign(gx - this.camX) * (dz.width / 2) : this.camX;
      const ty = Math.abs(gy - this.camY) > dz.height / 2 ? gy - Math.sign(gy - this.camY) * (dz.height / 2) : this.camY;
      const k = 1 - Math.pow(1 - cfg.smoothing, dt * 60);
      this.camX += (tx - this.camX) * k;
      this.camY += (ty - this.camY) * k;
      this.cameras.main.centerOn(this.camX, this.camY);
    }

    private afterPhysics() {
      const dtReal = Math.min(this.game.loop.delta / 1000, 1 / 20);
      this.updateCamera(dtReal);
      // Keep the camera inside the world now (Phaser would clamp later, after lights are drawn).
      const cam = this.cameras.main;
      const bounds = scene.bounds ?? { width: W, height: H };
      cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, Math.max(0, bounds.width - W));
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, Math.max(0, bounds.height - H));
      for (const p of this.parallaxSprites) p.sprite.tilePositionX = cam.scrollX * p.factor;
      const flashes = this.world.flashes;
      for (let i = flashes.length - 1; i >= 0; i--) {
        flashes[i]!.age += dtReal;
        if (flashes[i]!.age >= flashes[i]!.life) flashes.splice(i, 1);
      }
      this.atmosphere?.update(dtReal);
    }

    private attachScript(e: Entity, handle: EntityHandle, extraProps?: Record<string, unknown>) {
      const script = e.components.Script;
      if (!script) return;
      const Cls = behaviours.get(script.src);
      if (!Cls) return;
      let b: Behaviour;
      try {
        b = new Cls();
      } catch (err) {
        hooks.error(`${script.src}: ${(err as Error).message}`, { file: script.src, stack: (err as Error).stack });
        return;
      }
      b.entity = handle;
      b.__file = script.src;
      b.props = { ...(Cls.props ?? {}), ...script.props, ...(extraProps ?? {}) };
      for (const [k, v] of Object.entries(b.props)) if (!(k in b)) (b as unknown as Record<string, unknown>)[k] = v;
      handle.behaviours.push(b);
    }

    spawnPrefab(name: string, x: number, y: number, o: SpawnOverrides = {}): EntityHandle | null {
      const found = allDefs.find(({ e }) => e.id === name || e.name === name);
      if (!found) {
        this.world.warnOnce(`Game.spawn: there's no entity called "${name}" in the scene to copy`);
        return null;
      }
      const copy = EntitySchema.parse(JSON.parse(JSON.stringify(found.e))) as Entity;
      copy.id = `${copy.id}#${++spawnCount}`;
      copy.active = true;
      const c = copy.components;
      if (o.width || o.height) {
        if (c.Sprite) {
          if (o.width) c.Sprite.width = o.width;
          if (o.height) c.Sprite.height = o.height;
        }
        if (c.Body && (c.Body.width || c.Body.height || !c.Sprite)) {
          if (o.width) c.Body.width = o.width;
          if (o.height) c.Body.height = o.height;
        }
      }
      const made: { e: Entity; handle: EntityHandle }[] = [];
      // The copy itself sits at x, y; children keep their offsets.
      copy.components.Transform = { position: { x: 0, y: 0 }, rotation: c.Transform?.rotation ?? 0, scale: c.Transform?.scale ?? { x: 1, y: 1 } };
      this.spawnTree(copy, x, y, null, made);
      for (const { e, handle } of made) {
        this.attachScript(e, handle, e === copy ? o.props : undefined);
        const tm = this.world.tilemaps.get(handle.go);
        if (tm && !tm.collider) tm.collider = this.physics.add.collider(this.world.actors, handle.go);
      }
      for (const { handle } of made) for (const b of handle.behaviours) this.world.call(b, 'onStart');
      return made[0]?.handle ?? null;
    }

    spawnEntity(e: Entity, x: number, y: number): EntityHandle | null {
      const c = e.components;
      let go: Visual;
      if (c.Sprite) {
        const s = c.Sprite;
        if (!this.textures.exists(s.asset)) hooks.error(`${e.name}: missing image ${s.asset}`, { file: s.asset });
        go = s.tiled ? this.add.tileSprite(x, y, s.width ?? 16, s.height ?? 16, s.asset) : this.add.image(x, y, s.asset);
        if (!s.tiled && (s.width || s.height)) {
          (go as Phaser.GameObjects.Image).setDisplaySize(s.width ?? (go as Phaser.GameObjects.Image).width, s.height ?? (go as Phaser.GameObjects.Image).height);
        }
        go.setFlipX?.(s.flipX);
        go.setDepth?.(s.depth);
        if (s.alpha !== undefined) go.setAlpha?.(s.alpha);
        if (s.scrollFactor !== undefined) (go as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(s.scrollFactor);
        if (s.tint) (go as Phaser.GameObjects.Image).setTint(hexToInt(s.tint));
      } else if (c.AnimatedSprite) {
        const a = c.AnimatedSprite;
        const def = frames.get(a.frames)!;
        const names = Object.keys(def.animations);
        const start = a.animation && def.animations[a.animation] ? a.animation : names[0]!;
        const sprite = this.add.sprite(x, y, a.frames, def.animations[start]!.frames[0]);
        sprite.setFlipX(a.flipX).setDepth(a.depth);
        if (a.playing && this.anims.exists(animKey(a.frames, start))) sprite.play(animKey(a.frames, start));
        go = sprite;
      } else if (c.Text) {
        const t = c.Text;
        const origin = t.align === 'center' ? 0.5 : t.align === 'right' ? 1 : 0;
        if (pixelArt) {
          go = this.add
            .bitmapText(x, y, FONT_KEY, fontSafe(t.text))
            .setLetterSpacing(FONT_LETTER_SPACING)
            .setScale(Math.max(1, Math.round(t.size / 10)))
            .setTint(hexToInt(t.color))
            .setOrigin(origin, 0)
            .setDepth(100);
        } else {
          go = this.add
            .text(x, y, t.text, { fontFamily: 'monospace', fontSize: `${t.size}px`, color: t.color })
            .setOrigin(origin, 0)
            .setResolution(4)
            .setDepth(100);
        }
      } else if (c.Tilemap) {
        go = this.buildTilemap(c.Tilemap, x, y);
      } else {
        go = this.add.zone(x, y, c.Body?.width ?? 1, c.Body?.height ?? 1);
      }
      if (e.tags.includes('ui')) {
        (go as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(0);
        this.uiObjects.add(go);
      }
      const t = c.Transform;
      if (t) {
        go.rotation = t.rotation;
        go.setScale(go.scaleX * t.scale.x, go.scaleY * t.scale.y);
      }

      const handle = new EntityHandle(e.id, e.name, e.tags, go, this.world);
      handle.baseScaleX = go.scaleX;
      handle.baseScaleY = go.scaleY;
      if (c.Light) handle.light = { ...c.Light, offset: { ...c.Light.offset } };
      this.world.add(handle);
      if (c.AnimatedSprite && go instanceof Phaser.GameObjects.Sprite) {
        const def = frames.get(c.AnimatedSprite.frames)!;
        const loops = new Map(Object.entries(def.animations).map(([n, an]) => [n, an.loop]));
        handle.setupAnimation(c.AnimatedSprite.frames, loops, c.AnimatedSprite.auto);
        go.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
          handle.oneShotPlaying = false;
          const name = anim.key.slice(anim.key.indexOf('#') + 1);
          for (const b of handle.behaviours) this.world.call(b, 'onAnimationEnd', name);
        });
      }

      if (c.Body) {
        const b = c.Body;
        this.physics.add.existing(go, b.type === 'static');
        const body = go.body as ArcadeBody;
        if (body instanceof Phaser.Physics.Arcade.Body) {
          body.setAllowGravity(b.gravity && b.type === 'dynamic');
          body.setBounce(b.bounce);
          body.setCollideWorldBounds(b.type === 'dynamic');
          if (b.type === 'kinematic') body.setImmovable(true);
          if (b.width || b.height) {
            const w = b.width ?? body.width;
            const h = b.height ?? body.height;
            body.setSize(w, h, true);
            // `offset` is the hitbox's top-left inside the sprite; by default it's centred
            // horizontally with its feet at the bottom of the sprite.
            const go2 = go as unknown as { width?: number; height?: number };
            if (b.offset) body.setOffset(b.offset.x, b.offset.y);
            else body.setOffset(body.offset.x, (go2.height ?? h) - h);
          }
        } else if (b.width || b.height) {
          body.setSize(b.width ?? body.width, b.height ?? body.height, true);
          if (b.offset) body.setOffset(body.offset.x + b.offset.x, body.offset.y + b.offset.y);
        }
        if (b.sensor) this.world.sensors.push(go);
        else if (b.type === 'static') this.world.solids.push(go);
        else this.world.actors.push(go);
      }
      return handle;
    }

    override update(_time: number, delta: number) {
      const real = Math.min(delta / 1000, 1 / 20);
      if (this.slowLeft > 0) {
        this.slowLeft -= real;
        if (this.slowLeft <= 0) {
          timeScale = 1;
          this.applyTimeScale();
        }
      }
      if (this.hitStopLeft > 0) {
        this.hitStopLeft -= real;
        if (!this.physics.world.isPaused) this.physics.world.pause();
        this.anims.pauseAll();
        input.endFrame();
        return;
      }
      if (this.physics.world.isPaused) {
        this.physics.world.resume();
        this.anims.resumeAll();
      }
      const dt = real * timeScale;
      elapsed += dt;
      const world = this.world;
      for (const e of [...world.entities]) {
        if (e.destroyed) continue;
        for (const b of e.behaviours) world.call(b, 'onUpdate', dt);
        if (e.autoAnimate && !e.oneShotPlaying && !e.destroyed) {
          const name = pickAutoAnimation({ onFloor: e.onFloor, vx: e.velocity.x, vy: e.velocity.y }, e.animations);
          if (name) e.play(name);
        }
      }
      input.endFrame();
    }
  }

  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    width: W,
    height: H,
    backgroundColor: scene.background ?? '#000000',
    pixelArt,
    roundPixels: pixelArt,
    physics: { default: 'arcade', arcade: { gravity: { x: manifest.physics.gravity.x, y: manifest.physics.gravity.y }, debug: false } },
    scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.CENTER_BOTH, zoom: 1 },
    audio: { noAudio: true },
    banner: false,
    scene: DegamedScene,
  });

  // Crisp pixels: scale by whole numbers when that wastes little space, otherwise fit exactly.
  const fit = () => {
    const rect = parent.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const zoom = pixelArt ? pixelZoom(rect.width, rect.height, W, H) : Math.min(rect.width / W, rect.height / H);
    if (Math.abs(game.scale.zoom - zoom) > 1e-3) game.scale.setZoom(zoom);
    else game.scale.refresh();
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  observer?.observe(parent);
  game.events.once(Phaser.Core.Events.READY, fit);
  fit();

  const unmountTouch = mountTouchControls(parent, input, manifest.touch ?? DEFAULT_TOUCH);

  const handle: GameHandle = {
    input,
    restart: () => game.scene.getScene('main')?.scene.restart(),
    pause: () => game.scene.pause('main'),
    resume: () => game.scene.resume('main'),
    step: () => {
      const s = game.scene.getScene('main');
      if (!s) return;
      game.scene.resume('main');
      s.events.once('postupdate', () => game.scene.pause('main'));
    },
    screenshot: () =>
      new Promise((resolve) => {
        game.renderer.snapshot((img) => resolve(img instanceof HTMLImageElement ? img.src : ''));
      }),
    destroy: () => {
      observer?.disconnect();
      unmountTouch();
      input.dispose();
      game.destroy(true);
    },
  };
  return handle;
}

/** Banner titles: big when short, smaller when long, always whole-pixel scales. */
function fontScaleFor(text: string): number {
  const n = text.length;
  return n <= 10 ? 3 : n <= 18 ? 2 : 1;
}
