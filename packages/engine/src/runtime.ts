import * as Phaser from 'phaser';
import { ProjectManifest, Scene, SpriteFrames, type Entity, type ProjectFiles } from '@degamed/shared';
import { animKey, pickAutoAnimation } from './animation';
import { InputState, Key } from './input';
import { compileScripts, DEGAMED_MODULE_SOURCE, ScriptError } from './scripts';
import { Sfx } from './sfx';

export interface RuntimeHooks {
  log(level: 'info' | 'warn' | 'error', message: string, source?: string): void;
  error(message: string, details?: { stack?: string; file?: string; line?: number }): void;
}

type ArcadeBody = Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
type Visual = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Transform &
  Phaser.GameObjects.Components.Visible &
  Partial<Phaser.GameObjects.Components.Flip> &
  Partial<Phaser.GameObjects.Components.Depth>;

const hexToInt = (hex: string) => parseInt(hex.replace('#', ''), 16);

/** The object scripts see as `this.entity` and `other`. */
export class EntityHandle {
  readonly behaviours: Behaviour[] = [];
  destroyed = false;
  private readonly fallbackVelocity = new Phaser.Math.Vector2();

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
    if (body instanceof Phaser.Physics.Arcade.Body) body.reset(x, y);
    else {
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
  get velocity(): Phaser.Math.Vector2 {
    const body = this.body;
    return body instanceof Phaser.Physics.Arcade.Body ? body.velocity : this.fallbackVelocity;
  }
  get onFloor(): boolean {
    const body = this.body;
    return body instanceof Phaser.Physics.Arcade.Body ? body.blocked.down || body.touching.down : false;
  }
  get text(): string {
    return this.go instanceof Phaser.GameObjects.Text ? this.go.text : '';
  }
  set text(v: string) {
    if (this.go instanceof Phaser.GameObjects.Text && this.go.text !== v) this.go.setText(v);
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

function flatten(entities: Entity[], offsetX = 0, offsetY = 0, out: { e: Entity; x: number; y: number }[] = []) {
  for (const e of entities) {
    if (!e.active) continue;
    const p = e.components.Transform?.position ?? { x: 0, y: 0 };
    const x = offsetX + p.x;
    const y = offsetY + p.y;
    out.push({ e, x, y });
    flatten(e.children, x, y, out);
  }
  return out;
}

function parseProject(files: ProjectFiles): Omit<Loaded, 'behaviours'> & { scriptPaths: string[] } {
  const manifest = ProjectManifest.parse(parseJson(files, 'project.json'));
  const sceneResult = Scene.safeParse(parseJson(files, manifest.startScene));
  if (!sceneResult.success) {
    throw new ScriptError(`${manifest.startScene}: ${sceneResult.error.issues[0]?.message ?? 'invalid scene'}`, manifest.startScene);
  }
  const scene = sceneResult.data;

  const scriptPaths = [
    ...new Set(flatten(scene.entities).flatMap(({ e }) => (e.components.Script ? [e.components.Script.src] : []))),
  ];
  const pythonScripts = scriptPaths.filter((p) => p.endsWith('.py'));
  if (pythonScripts.length) {
    throw new ScriptError('Python scripts are coming in the next engine milestone. Use .js for now.', pythonScripts[0]!);
  }
  const frames = new Map<string, SpriteFrames>();
  for (const { e } of flatten(scene.entities)) {
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

const PARTICLE_KEY = '__degamed_px';

/** Starts a project inside `parent`. Rejects with a ScriptError if the project can't load. */
export async function startGame(parent: HTMLElement, files: ProjectFiles, hooks: RuntimeHooks): Promise<GameHandle> {
  const { manifest, scene, frames, scriptPaths } = parseProject(files);
  const input = new InputState(manifest.input);
  input.attach(window);
  const sfx = new Sfx();
  let world: World;
  let phaserScene: Phaser.Scene;
  let elapsed = 0;

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
      get time() {
        return elapsed;
      },
      width: manifest.resolution.width,
      height: manifest.resolution.height,
      find: (name: string) => world.find(name),
      findAll: (tag: string) => world.entities.filter((e) => e.hasTag(tag)),
      sound: (name: string) => sfx.play(name),
      log: (...args: unknown[]) => hooks.log('info', args.map(String).join(' ')),
      restart: () => handle.restart(),
    },
    kit: {
      shake: (intensity = 0.008, ms = 150) => phaserScene.cameras.main.shake(ms, intensity),
      flash: (color = '#FFFFFF', ms = 120) => {
        const c = hexToInt(color);
        phaserScene.cameras.main.flash(ms, (c >> 16) & 255, (c >> 8) & 255, c & 255);
      },
      squash: (entity: EntityHandle, amount = 0.8) => {
        phaserScene.tweens.add({
          targets: entity.go,
          scaleX: { from: 2 - amount, to: 1 },
          scaleY: { from: amount, to: 1 },
          duration: 180,
          ease: 'Back.Out',
        });
      },
      burst: (x: number, y: number, opts: { color?: string; count?: number } = {}) => {
        const emitter = phaserScene.add.particles(x, y, PARTICLE_KEY, {
          speed: { min: 40, max: 140 },
          angle: { min: 0, max: 360 },
          lifespan: { min: 250, max: 550 },
          scale: { start: 1, end: 0 },
          gravityY: 300,
          tint: hexToInt(opts.color ?? '#FFFFFF'),
          emitting: false,
        });
        emitter.setDepth(50);
        emitter.explode(opts.count ?? 12);
        phaserScene.time.delayedCall(700, () => emitter.destroy());
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
        phaserScene.tweens.add({
          targets: target instanceof EntityHandle ? target.go : target,
          ...props,
          duration: opts.duration ?? 300,
          ease: opts.ease ?? 'Sine.InOut',
          yoyo: opts.yoyo ?? false,
          repeat: opts.repeat ?? 0,
          delay: opts.delay ?? 0,
          onComplete: opts.onComplete,
        }),
      floatText: (x: number, y: number, text: string, color = '#FFFFFF') => {
        const t = phaserScene.add
          .text(x, y, text, { fontFamily: 'monospace', fontSize: '8px', color, stroke: '#1A1C2C', strokeThickness: 2 })
          .setOrigin(0.5)
          .setDepth(60)
          .setResolution(4);
        phaserScene.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 700, onComplete: () => t.destroy() });
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

  class DegamedScene extends Phaser.Scene {
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
      phaserScene = this;
      world = new World(hooks);
      elapsed = 0;
      api.Game.score = 0;
      const { width: W, height: H } = manifest.resolution;
      const bounds = scene.bounds ?? { width: W, height: H };

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

      if (!this.textures.exists(PARTICLE_KEY)) {
        const tex = this.textures.createCanvas(PARTICLE_KEY, 2, 2);
        if (tex) {
          tex.context.fillStyle = '#ffffff';
          tex.context.fillRect(0, 0, 2, 2);
          tex.refresh();
        }
      }

      if (scene.background) this.cameras.main.setBackgroundColor(scene.background);
      scene.parallax.forEach((layer, i) => {
        if (!this.textures.exists(layer.asset)) return hooks.error(`Missing parallax image ${layer.asset}`, { file: layer.asset });
        const src = this.textures.get(layer.asset).getSourceImage() as { width: number; height: number };
        const sprite = layer.tiled
          ? this.add.tileSprite(0, layer.y, W, src.height, layer.asset)
          : this.add.image(0, layer.y, layer.asset);
        sprite.setOrigin(0, 0).setScrollFactor(0).setDepth(-100 + i);
        if (layer.tiled && sprite instanceof Phaser.GameObjects.TileSprite) {
          const factor = layer.factor;
          this.events.on('update', () => {
            sprite.tilePositionX = this.cameras.main.scrollX * factor;
          });
        }
      });

      const pending: { e: Entity; handle: EntityHandle }[] = [];
      for (const { e, x, y } of flatten(scene.entities)) {
        const handle = this.spawnEntity(e, x, y);
        if (handle) pending.push({ e, handle });
      }

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
      this.physics.add.collider(world.actors, world.solids, report);
      this.physics.add.collider(world.actors, world.actors, report);
      this.physics.add.overlap(world.actors, world.sensors, report);

      const cameraEntity = flatten(scene.entities).find(({ e }) => e.components.Camera);
      const camera = cameraEntity?.e.components.Camera;
      this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
      if (camera?.zoom && camera.zoom !== 1) {
        this.cameras.main.setZoom(camera.zoom);
        // Like Godot's CanvasLayer: UI (entities tagged "ui") gets its own unzoomed camera.
        const uiCamera = this.cameras.add(0, 0, W, H, false, 'ui');
        const isUi = (go: Phaser.GameObjects.GameObject) => world.byObject.get(go)?.hasTag('ui') ?? false;
        const route = (go: Phaser.GameObjects.GameObject) => (isUi(go) ? this.cameras.main.ignore(go) : uiCamera.ignore(go));
        for (const go of this.children.list) route(go);
        this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, route);
      }
      if (camera?.follow) {
        const target = world.find(camera.follow);
        if (target) this.cameras.main.startFollow(target.go, true, 0.12, 0.12);
        else hooks.log('warn', `Camera can't find "${camera.follow}" to follow`);
      }

      for (const { e, handle } of pending) {
        const script = e.components.Script;
        if (!script) continue;
        const Cls = behaviours.get(script.src);
        if (!Cls) continue;
        let b: Behaviour;
        try {
          b = new Cls();
        } catch (err) {
          hooks.error(`${script.src}: ${(err as Error).message}`, { file: script.src, stack: (err as Error).stack });
          continue;
        }
        b.entity = handle;
        b.__file = script.src;
        b.props = { ...(Cls.props ?? {}), ...script.props };
        for (const [k, v] of Object.entries(b.props)) if (!(k in b)) (b as unknown as Record<string, unknown>)[k] = v;
        handle.behaviours.push(b);
      }
      for (const { handle } of pending) for (const b of handle.behaviours) world.call(b, 'onStart');
    }

    spawnEntity(e: Entity, x: number, y: number): EntityHandle | null {
      const c = e.components;
      let go: Visual;
      if (c.Sprite) {
        const s = c.Sprite;
        if (!this.textures.exists(s.asset)) hooks.error(`${e.name}: missing image ${s.asset}`, { file: s.asset });
        go = s.tiled
          ? this.add.tileSprite(x, y, s.width ?? 16, s.height ?? 16, s.asset)
          : this.add.image(x, y, s.asset);
        if (!s.tiled && (s.width || s.height)) {
          (go as Phaser.GameObjects.Image).setDisplaySize(s.width ?? (go as Phaser.GameObjects.Image).width, s.height ?? (go as Phaser.GameObjects.Image).height);
        }
        go.setFlipX?.(s.flipX);
        go.setDepth?.(s.depth);
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
        go = this.add
          .text(x, y, c.Text.text, { fontFamily: 'monospace', fontSize: `${c.Text.size}px`, color: c.Text.color })
          .setResolution(4)
          .setDepth(100);
      } else {
        go = this.add.zone(x, y, 1, 1);
      }
      if (e.tags.includes('ui')) (go as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(0);
      const t = c.Transform;
      if (t) {
        go.rotation = t.rotation;
        go.setScale(go.scaleX * t.scale.x, go.scaleY * t.scale.y);
      }

      const handle = new EntityHandle(e.id, e.name, e.tags, go, world);
      world.add(handle);
      if (c.AnimatedSprite && go instanceof Phaser.GameObjects.Sprite) {
        const def = frames.get(c.AnimatedSprite.frames)!;
        const loops = new Map(Object.entries(def.animations).map(([n, an]) => [n, an.loop]));
        handle.setupAnimation(c.AnimatedSprite.frames, loops, c.AnimatedSprite.auto);
        go.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
          handle.oneShotPlaying = false;
          const name = anim.key.slice(anim.key.indexOf('#') + 1);
          for (const b of handle.behaviours) world.call(b, 'onAnimationEnd', name);
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
        }
        if (b.sensor) world.sensors.push(go);
        else if (b.type === 'static') world.solids.push(go);
        else world.actors.push(go);
      }
      return handle;
    }

    override update(_time: number, delta: number) {
      const dt = Math.min(delta / 1000, 1 / 20);
      elapsed += dt;
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

  const pixelArt = manifest.artStyle.startsWith('pixel');
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    width: manifest.resolution.width,
    height: manifest.resolution.height,
    backgroundColor: scene.background ?? '#000000',
    pixelArt,
    roundPixels: pixelArt,
    physics: { default: 'arcade', arcade: { gravity: { x: manifest.physics.gravity.x, y: manifest.physics.gravity.y }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true },
    banner: false,
    scene: DegamedScene,
  });

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
      input.dispose();
      game.destroy(true);
    },
  };
  return handle;
}
