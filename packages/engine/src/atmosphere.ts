/**
 * The atmosphere renderer: ambient darkness with soft lights, fog veils in the parallax, drifting
 * mist, weather and ambient particles, bloom, colour grade and vignette.
 *
 * Everything renders at the game's own resolution (480×270 for kits) and is scaled up with crisp
 * pixels, so it stays cheap: one lightmap render texture, a handful of particle emitters and three
 * camera filters.
 */
import * as Phaser from 'phaser';
import type { Environment, Light, ParticleType } from '@degamed/shared';
import {
  ambientColor,
  flickerAt,
  fogVeilAlphas,
  gradeMatrix,
  hexToRgb01,
  mixRgb,
  needsLightmap,
  rgb01ToInt,
  surfaceAt,
  type Rect,
} from './atmosphere-math';

export const TEX = {
  px: '__dg_px',
  light: '__dg_light',
  glow: '__dg_glow',
  streak: '__dg_streak',
  fog: '__dg_fog',
  veil: '__dg_veil',
  flake: '__dg_flake',
  spark: '__dg_spark',
} as const;

/** Something that emits light this frame. */
export interface LightSource {
  x: number;
  y: number;
  light: Light;
  /** 0..1 extra multiplier (fading flash lights). */
  fade?: number;
  seed: number;
  /** Scroll factor of the object it belongs to (decor drawn with parallax). */
  scrollFactor?: number;
}

/** Depth bands. Entities usually sit between -10 and 20. */
export const DEPTH = {
  farRain: -20,
  midMist: -8,
  nearRain: 25,
  mist: 30,
  burst: 50,
  lightmap: 1000,
  glow: 1001,
  overlay: 1100,
} as const;

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  draw(tex.context);
  tex.refresh();
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Builds the small procedural textures the renderer and juice effects share. */
export function ensureTextures(scene: Phaser.Scene, fogHeight = 0.6) {
  canvasTexture(scene, TEX.px, 2, 2, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 2, 2);
  });
  // A light: soft falloff quantised into bands with ordered dithering between them (pixel-art light).
  const L = 128;
  canvasTexture(scene, TEX.light, L, L, (ctx) => {
    const img = ctx.createImageData(L, L);
    const bands = 7;
    for (let y = 0; y < L; y++)
      for (let x = 0; x < L; x++) {
        const d = Math.hypot(x + 0.5 - L / 2, y + 0.5 - L / 2) / (L / 2);
        const f = d >= 1 ? 0 : Math.pow(1 - d, 1.6);
        const lvl = f * bands;
        const base = Math.floor(lvl);
        const frac = lvl - base;
        const q = (base + (frac * 16 > BAYER4[(y & 3) * 4 + (x & 3)]! ? 1 : 0)) / bands;
        const i = (y * L + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(Math.min(1, q) * 255);
      }
    ctx.putImageData(img, 0, 0);
  });
  // A smooth glow for halos and sparkles.
  canvasTexture(scene, TEX.glow, 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  canvasTexture(scene, TEX.streak, 1, 8, (ctx) => {
    for (let y = 0; y < 8; y++) {
      ctx.fillStyle = `rgba(255,255,255,${0.25 + (0.75 * y) / 7})`;
      ctx.fillRect(0, y, 1, 1);
    }
  });
  canvasTexture(scene, TEX.flake, 3, 3, (ctx) => {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(0, 1, 3, 1);
    ctx.fillRect(1, 0, 1, 3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(1, 1, 1, 1);
  });
  canvasTexture(scene, TEX.spark, 5, 5, (ctx) => {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(2, 0, 1, 5);
    ctx.fillRect(0, 2, 5, 1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(1, 1, 3, 3);
  });
  // Tileable wisps of mist: summed sine blobs, dithered to keep the pixel look.
  const FW = 256;
  const FH = 64;
  canvasTexture(scene, TEX.fog, FW, FH, (ctx) => {
    const img = ctx.createImageData(FW, FH);
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++) {
        const u = (x / FW) * Math.PI * 2;
        const v = y / FH;
        const wisp =
          0.5 +
          0.25 * Math.sin(u * 2 + v * 3) +
          0.15 * Math.sin(u * 5 + 1.3 + v * 6) +
          0.1 * Math.sin(u * 9 + 2.1 - v * 4);
        const vert = Math.sin(v * Math.PI); // fades at top and bottom
        const a = Math.max(0, Math.min(1, wisp * vert * 1.2 - 0.15));
        const q = Math.floor(a * 6 + BAYER4[(y & 3) * 4 + (x & 3)]! / 16) / 6;
        const i = (y * FW + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(Math.min(1, q) * 255);
      }
    ctx.putImageData(img, 0, 0);
  });
  // The fog veil: a light haze everywhere, thicker towards the bottom up to `fogHeight`.
  const VH = 135;
  canvasTexture(scene, TEX.veil, 4, VH, (ctx) => {
    const start = (1 - fogHeight) * VH;
    for (let y = 0; y < VH; y++) {
      const t = y < start ? 0 : (y - start) / Math.max(1, VH - start);
      const a = 0.35 + 0.65 * t * t * (3 - 2 * t);
      for (let x = 0; x < 4; x++) {
        const d = BAYER4[(y & 3) * 4 + x]! / 16 / 12;
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, a + d)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });
}

interface ParticleLayer {
  emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  /** World-space emitters follow the camera's view. */
  zone?: Phaser.Geom.Rectangle;
  /** Particles that also light up the darkness. */
  lightRadius?: number;
  color: number;
}

const PARTICLE_COLORS: Record<ParticleType, string> = {
  rain: '#9DB4D8',
  dust: '#E8D9B0',
  fireflies: '#E8FF8A',
  snow: '#F4F4FF',
  embers: '#FF9A3C',
  spores: '#8CF2C8',
};

export interface AtmosphereOptions {
  env: Environment | undefined;
  width: number;
  height: number;
  /** Parallax layer images, back to front. */
  parallax: Phaser.GameObjects.GameObject[];
  /** Surfaces rain can splash on, in world pixels. */
  surfaces: () => readonly Rect[];
  /** Lights in the world this frame. */
  lights: () => Iterable<LightSource>;
}

export class Atmosphere {
  private readonly cam: Phaser.Cameras.Scene2D.Camera;
  private lightmap: Phaser.GameObjects.RenderTexture | null = null;
  private readonly ambient: number;
  private readonly darkness: number;
  private readonly glows: Phaser.GameObjects.Image[] = [];
  private readonly mists: { sprite: Phaser.GameObjects.TileSprite; speed: number; factor: number }[] = [];
  private readonly layers: ParticleLayer[] = [];
  private splashes: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private splashRate = 0;
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: AtmosphereOptions,
  ) {
    const env = opts.env;
    this.cam = scene.cameras.main;
    ensureTextures(scene, env?.fog?.height ?? 0.6);
    const amb = ambientColor(env);
    this.ambient = rgb01ToInt(amb);
    this.darkness = 1 - Math.max(...amb);
    if (!env) return;
    this.buildFog(env);
    if (needsLightmap(env)) {
      this.lightmap = scene.add
        .renderTexture(0, 0, opts.width, opts.height)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH.lightmap)
        .setBlendMode(Phaser.BlendModes.MULTIPLY);
    }
    for (const p of env.particles ?? []) this.buildParticles(p.type, p.density, p.color);
    this.buildPost(env);
  }

  private buildFog(env: Environment) {
    const fog = env.fog;
    if (!fog || fog.density <= 0) return;
    const { width: W, height: H } = this.opts;
    const color = Phaser.Display.Color.HexStringToColor(fog.color).color;
    const alphas = fogVeilAlphas(this.opts.parallax.length, fog.density);
    this.opts.parallax.forEach((layer, i) => {
      const depth = (layer as unknown as Phaser.GameObjects.Components.Depth).depth + 0.5;
      this.scene.add
        .image(0, 0, TEX.veil)
        .setOrigin(0, 0)
        .setDisplaySize(W, H)
        .setScrollFactor(0)
        .setTint(color)
        .setAlpha(alphas[i]!)
        .setDepth(depth);
    });
    // Drifting mist: one band between the background and the world, one in front of everything.
    const band = (depth: number, alpha: number, speed: number, factor: number, y: number, h: number) => {
      const sprite = this.scene.add
        .tileSprite(0, y, W, h, TEX.fog)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setTint(color)
        .setAlpha(alpha)
        .setDepth(depth);
      sprite.tileScaleY = h / 64;
      this.mists.push({ sprite, speed, factor });
    };
    const top = H * (1 - (fog.height ?? 0.6));
    band(DEPTH.midMist, Math.min(0.7, fog.density * 0.9), 6, 0.6, Math.max(0, top - 10), H - top + 10);
    band(DEPTH.mist, Math.min(0.45, fog.density * 0.5), 14, 1.15, H - 64, 64);
  }

  private buildParticles(type: ParticleType, density: number, colorHex?: string) {
    if (density <= 0) return;
    const scene = this.scene;
    const color = Phaser.Display.Color.HexStringToColor(colorHex ?? PARTICLE_COLORS[type]).color;
    const { width: W, height: H } = this.opts;
    const view = () => new Phaser.Geom.Rectangle(0, 0, W, H);

    if (type === 'rain') {
      const slant = -0.22; // dx per dy
      const rain = (depth: number, alpha: number, speed: number, count: number, scale: number) => {
        const lifespan = ((H + 40) / speed) * 1000;
        const emitter = scene.add.particles(0, -16, TEX.streak, {
          x: { min: -40, max: W + 80 },
          speedY: { min: speed * 0.9, max: speed * 1.1 },
          speedX: speed * slant,
          rotate: Math.atan(-slant) * (180 / Math.PI),
          lifespan,
          scaleY: scale,
          scaleX: 1,
          alpha,
          tint: color,
          frequency: lifespan / count,
          quantity: 1,
        });
        emitter.setScrollFactor(0).setDepth(depth);
        this.layers.push({ emitter, color });
      };
      rain(DEPTH.farRain, 0.28, 300, 90 * density, 0.8);
      rain(DEPTH.nearRain, 0.55, 460, 70 * density, 1.4);
      this.splashes = scene.add.particles(0, 0, TEX.px, {
        speedX: { min: -35, max: 35 },
        speedY: { min: -70, max: -25 },
        gravityY: 500,
        lifespan: { min: 160, max: 300 },
        scale: 0.5,
        alpha: { start: 0.8, end: 0 },
        tint: color,
        emitting: false,
      });
      this.splashes.setDepth(DEPTH.nearRain - 1);
      this.splashRate = 70 * density; // per second
      return;
    }

    // Everything else lives in world space around the camera.
    const zone = view();
    const common = {
      emitZone: { type: 'random' as const, source: zone as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource },
      tint: color,
    };
    let emitter: Phaser.GameObjects.Particles.ParticleEmitter;
    let lightRadius: number | undefined;
    const twinkle = (base: number) => ({
      onEmit: () => 0,
      onUpdate: (p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) =>
        base * Math.sin(t * Math.PI) * (0.6 + 0.4 * Math.sin(p.lifeCurrent * 0.012 + p.x)),
    });
    switch (type) {
      case 'dust': {
        const n = 60 * density;
        const life = 6000;
        emitter = scene.add.particles(0, 0, TEX.px, {
          ...common,
          lifespan: { min: life * 0.6, max: life },
          speedX: { min: -8, max: 8 },
          speedY: { min: -5, max: 6 },
          scale: { min: 0.5, max: 0.5 },
          alpha: twinkle(0.55),
          blendMode: Phaser.BlendModes.ADD,
          frequency: life / n,
          maxAliveParticles: Math.ceil(n * 1.2),
        });
        emitter.setDepth(DEPTH.nearRain);
        break;
      }
      case 'fireflies': {
        const n = 26 * density;
        const life = 5000;
        emitter = scene.add.particles(0, 0, TEX.glow, {
          ...common,
          lifespan: { min: 3000, max: life },
          speed: { min: 4, max: 16 },
          angle: { min: 0, max: 360 },
          scale: { min: 0.09, max: 0.14 },
          alpha: twinkle(1),
          blendMode: Phaser.BlendModes.ADD,
          frequency: life / n,
          maxAliveParticles: Math.ceil(n * 1.3),
        });
        emitter.setDepth(DEPTH.glow);
        lightRadius = 18;
        break;
      }
      case 'snow': {
        const n = 140 * density;
        const life = 7000;
        emitter = scene.add.particles(0, 0, TEX.flake, {
          ...common,
          lifespan: life,
          speedY: { min: 14, max: 38 },
          speedX: { min: -12, max: 6 },
          scale: { min: 0.6, max: 1 },
          alpha: { min: 0.5, max: 0.95 },
          frequency: life / n,
          maxAliveParticles: Math.ceil(n * 1.2),
        });
        emitter.setDepth(DEPTH.nearRain);
        break;
      }
      case 'embers': {
        const n = 40 * density;
        const life = 3500;
        emitter = scene.add.particles(0, 0, TEX.px, {
          ...common,
          lifespan: { min: 1800, max: life },
          speedY: { min: -38, max: -12 },
          speedX: { min: -14, max: 14 },
          scale: { min: 0.5, max: 1 },
          alpha: twinkle(1),
          blendMode: Phaser.BlendModes.ADD,
          frequency: life / n,
          maxAliveParticles: Math.ceil(n * 1.3),
        });
        emitter.setDepth(DEPTH.glow);
        lightRadius = 10;
        break;
      }
      case 'spores': {
        const n = 34 * density;
        const life = 7000;
        emitter = scene.add.particles(0, 0, TEX.glow, {
          ...common,
          lifespan: { min: 4000, max: life },
          speedY: { min: -10, max: -2 },
          speedX: { min: -6, max: 6 },
          scale: { min: 0.05, max: 0.09 },
          alpha: twinkle(0.85),
          blendMode: Phaser.BlendModes.ADD,
          frequency: life / n,
          maxAliveParticles: Math.ceil(n * 1.3),
        });
        emitter.setDepth(DEPTH.glow);
        lightRadius = 12;
        break;
      }
      default:
        return;
    }
    // Start with a full screen of particles instead of fading in.
    emitter.fastForward(4000);
    this.layers.push({ emitter, zone, lightRadius, color });
  }

  private buildPost(env: Environment) {
    const filters = this.cam.filters.external;
    if (env.bloom && env.bloom.strength > 0) {
      Phaser.Actions.AddEffectBloom(this.cam, {
        threshold: env.bloom.threshold ?? 0.7,
        blurRadius: 2,
        blurSteps: 4,
        blurQuality: 0,
        blendAmount: env.bloom.strength,
      });
    }
    if (env.grade && (env.grade.contrast !== undefined || env.grade.saturation !== undefined || env.grade.tint)) {
      const cm = filters.addColorMatrix();
      cm.colorMatrix.set(gradeMatrix(env.grade));
    }
    if (env.vignette && env.vignette > 0) {
      filters.addVignette(0.5, 0.5, 0.95 - env.vignette * 0.35, 0.25 + env.vignette * 0.6, 0x000000);
    }
  }

  update(dt: number) {
    this.time += dt;
    const cam = this.cam;
    const view = cam.worldView;

    for (const m of this.mists) m.sprite.tilePositionX = cam.scrollX * m.factor + this.time * m.speed;

    for (const layer of this.layers) {
      if (!layer.zone) continue;
      layer.zone.setTo(view.x - 32, view.y - 32, view.width + 64, view.height + 64);
    }

    if (this.splashes && this.splashRate > 0) {
      const rects = this.opts.surfaces();
      let n = this.splashRate * dt;
      while (n > 0) {
        if (n < 1 && Math.random() > n) break;
        n -= 1;
        const x = view.x + Math.random() * view.width;
        const y = surfaceAt(rects, x, view.y, view.bottom);
        if (y !== null) this.splashes.emitParticleAt(x, y, 2 + Math.floor(Math.random() * 2));
      }
    }

    this.drawLights();
  }

  private drawLights() {
    const cam = this.cam;
    const view = cam.worldView;
    const sx = this.opts.width / view.width;
    const sy = this.opts.height / view.height;
    const rt = this.lightmap;
    if (rt) {
      rt.clear();
      rt.fill(this.ambient, 1);
    }
    let g = 0;
    const glowStrength = 0.1 + 0.22 * this.darkness;
    for (const src of this.opts.lights()) {
      const l = src.light;
      const f = (src.fade ?? 1) * flickerAt(this.time, l.flicker, src.seed);
      const intensity = l.intensity * f;
      if (intensity <= 0.01) continue;
      const sf = src.scrollFactor ?? 1;
      const wx = src.x + l.offset.x;
      const wy = src.y + l.offset.y;
      const px = (wx - cam.scrollX * sf - (view.x - cam.scrollX)) * sx;
      const py = (wy - cam.scrollY * sf - (view.y - cam.scrollY)) * sy;
      const r = l.radius * sx;
      if (px < -r || py < -r || px > this.opts.width + r || py > this.opts.height + r) continue;
      const tint = Phaser.Display.Color.HexStringToColor(l.color).color;
      if (rt) {
        const scale = (r * 2) / 128;
        rt.stamp(TEX.light, undefined, px, py, { scale, tint, alpha: Math.min(1, intensity), blendMode: Phaser.BlendModes.ADD });
        if (intensity > 1) {
          rt.stamp(TEX.light, undefined, px, py, { scale: scale * 0.7, tint, alpha: Math.min(1, intensity - 1), blendMode: Phaser.BlendModes.ADD });
        }
      }
      // A soft halo in the air around the light.
      let glow = this.glows[g];
      if (!glow) {
        glow = this.scene.add.image(0, 0, TEX.glow).setScrollFactor(0).setDepth(DEPTH.glow).setBlendMode(Phaser.BlendModes.ADD);
        this.glows.push(glow);
      }
      g++;
      glow
        .setVisible(true)
        .setPosition(px, py)
        .setScale((r * 1.3) / 64)
        .setTint(tint)
        .setAlpha(Math.min(0.6, glowStrength * intensity));
    }
    for (let i = g; i < this.glows.length; i++) this.glows[i]!.setVisible(false);

    if (rt) {
      // Glowing particles (fireflies, embers, spores) light their surroundings too.
      for (const layer of this.layers) {
        if (!layer.lightRadius) continue;
        const scale = (layer.lightRadius * 2 * sx) / 128;
        layer.emitter.forEachAlive((p) => {
          const px = (p.x - view.x) * sx;
          const py = (p.y - view.y) * sy;
          if (px < -20 || py < -20 || px > this.opts.width + 20 || py > this.opts.height + 20) return;
          rt.stamp(TEX.light, undefined, px, py, { scale, tint: layer.color, alpha: p.alpha * 0.6, blendMode: Phaser.BlendModes.ADD });
        }, this);
      }
      rt.render();
    }
  }

  /** Colour of fog, mixed for UI or decor that should sit "in" the haze. */
  static fogMix(env: Environment | undefined, color: string, t: number): number {
    if (!env?.fog) return Phaser.Display.Color.HexStringToColor(color).color;
    return rgb01ToInt(mixRgb(hexToRgb01(color), hexToRgb01(env.fog.color), t));
  }
}
