import { z } from 'zod';
import { ART_STYLE_IDS } from '@degamed/art';

/** Languages a Behaviour script can be written in. */
export const ScriptLanguage = z.enum(['python', 'javascript']);
export type ScriptLanguage = z.infer<typeof ScriptLanguage>;

export const ArtStyle = z.enum(ART_STYLE_IDS);
export type ArtStyle = z.infer<typeof ArtStyle>;

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #RRGGBB color');

/** `project.json`: the root of every Degamed project. */
export const ProjectManifest = z.object({
  engine: z.literal('degamed'),
  engineVersion: z.string(),
  title: z.string().min(1).max(80),
  resolution: z.object({
    width: z.number().int().min(64).max(4096),
    height: z.number().int().min(64).max(4096),
  }),
  artStyle: ArtStyle,
  palette: z.array(HexColor).min(2).max(16),
  defaultLanguage: ScriptLanguage,
  physics: z.object({
    engine: z.enum(['arcade', 'matter']),
    gravity: z.object({ x: z.number(), y: z.number() }),
  }),
  startScene: z.string(),
  input: z.record(z.string(), z.array(z.string())),
  /**
   * On-screen controls for phones and tablets (shown only on touch devices).
   * `move`: 'horizontal' = left/right buttons, 'stick' = a thumb stick for 4/8-way movement, 'none'.
   * `buttons`: action buttons on the right, e.g. [{ action: 'jump', label: 'A' }].
   */
  touch: z
    .object({
      move: z.enum(['horizontal', 'stick', 'none']).default('horizontal'),
      buttons: z.array(z.object({ action: z.string(), label: z.string().max(6) })).max(4).default([{ action: 'jump', label: 'A' }]),
    })
    .optional(),
});
export type ProjectManifest = z.infer<typeof ProjectManifest>;

const Vec2 = z.object({ x: z.number(), y: z.number() });

/**
 * A soft light attached to an entity (lamps, the hero, pickups). Lights cut through the scene's
 * ambient darkness and glow in the air. `flicker` 0..1 makes it waver like a flame.
 */
export const Light = z.object({
  color: HexColor.default('#FFE7B0'),
  /** Radius in pixels. */
  radius: z.number().positive().max(2000).default(64),
  /** 0..4; 1 is a normal lamp. */
  intensity: z.number().min(0).max(4).default(1),
  flicker: z.number().min(0).max(1).default(0),
  /** Offset from the entity's position (a lamp's flame sits above its base). */
  offset: Vec2.default({ x: 0, y: 0 }),
});
export type Light = z.infer<typeof Light>;

export const PARTICLE_TYPES = ['rain', 'dust', 'fireflies', 'snow', 'embers', 'spores'] as const;
export const ParticleType = z.enum(PARTICLE_TYPES);
export type ParticleType = z.infer<typeof ParticleType>;

/**
 * Scene atmosphere, rendered by the engine on top of everything else:
 * - `ambient`: the light in unlit areas. `color` is the hue of the shadows (only its hue counts,
 *   not its brightness) and `intensity` how bright they are: 1 = fully lit, 0 = pitch black.
 *   `{ color: '#3A4466', intensity: 0.5 }` is a blue night at half brightness. Light components
 *   brighten it back up.
 * - `fog`: haze tinted into the parallax layers (far layers get more) plus a low drifting mist.
 *   `density` 0..1; `height` 0..1 is how far up the screen the fog reaches (default 0.6).
 * - `bloom`: bright pixels glow. `strength` 0..2, `threshold` 0..1 (default 0.7).
 * - `vignette`: darkened screen edges, 0..1.
 * - `grade`: colour grade. `contrast` and `saturation` are multipliers (1 = unchanged); `tint`
 *   shifts the final image towards a hue without darkening it (white = unchanged).
 * - `particles`: weather and ambient life. `density` 0..1.
 */
export const Environment = z.object({
  ambient: z
    .object({
      color: HexColor,
      intensity: z.number().min(0).max(1).default(1),
      /**
       * Brightness of the parallax background, 0..1 (default 1). Backgrounds are pre-lit art, so
       * the lightmap leaves them alone; this dims them (in the ambient hue) for night scenes.
       */
      background: z.number().min(0).max(1).optional(),
    })
    .optional(),
  fog: z
    .object({ color: HexColor, density: z.number().min(0).max(1).default(0.3), height: z.number().min(0).max(1).optional() })
    .optional(),
  bloom: z.object({ strength: z.number().min(0).max(2).default(0.6), threshold: z.number().min(0).max(1).optional() }).optional(),
  vignette: z.number().min(0).max(1).optional(),
  grade: z
    .object({
      contrast: z.number().min(0).max(3).optional(),
      saturation: z.number().min(0).max(3).optional(),
      tint: HexColor.optional(),
    })
    .optional(),
  particles: z
    .array(z.object({ type: ParticleType, density: z.number().min(0).max(1).default(0.5), color: HexColor.optional() }))
    .max(6)
    .optional(),
});
export type Environment = z.infer<typeof Environment>;

/** Built-in components. Unknown component names are rejected so typos surface early. */
export const Components = z
  .object({
    Transform: z.object({
      position: Vec2,
      rotation: z.number().default(0),
      scale: Vec2.default({ x: 1, y: 1 }),
    }),
    Sprite: z.object({
      asset: z.string(),
      tint: HexColor.optional(),
      /** Repeat the texture to fill width × height (platforms, ground, walls). */
      tiled: z.boolean().default(false),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      flipX: z.boolean().default(false),
      /** Draw order; higher is in front. */
      depth: z.number().default(0),
      /** 0..1 */
      alpha: z.number().min(0).max(1).optional(),
      /** Parallax for decoration: below 1 drifts behind the world, above 1 rushes past in front. */
      scrollFactor: z.number().min(0).max(3).optional(),
    }),
    /** A sprite that plays animations from a `.frames.json` file (like Godot's AnimatedSprite2D). */
    AnimatedSprite: z.object({
      frames: z.string().regex(/\.frames\.json$/, 'Point to a .frames.json file'),
      /** Animation to start with. Defaults to the first one in the file. */
      animation: z.string().optional(),
      playing: z.boolean().default(true),
      /**
       * Pick idle / run / jump / fall automatically from the physics body each frame
       * (like a simple AnimationTree). Scripts can still call entity.play().
       */
      auto: z.boolean().default(false),
      flipX: z.boolean().default(false),
      depth: z.number().default(0),
    }),
    Body: z.object({
      type: z.enum(['dynamic', 'static', 'kinematic']),
      gravity: z.boolean().default(true),
      bounce: z.number().min(0).max(1).default(0),
      /** Overlap-only: reports collisions to scripts but doesn't push things apart (coins, triggers). */
      sensor: z.boolean().default(false),
      /** Hitbox size in pixels (defaults to the sprite's size). Centred with its bottom at the sprite's feet, unless `offset` (the hitbox's top-left inside the sprite) is given. */
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      offset: Vec2.optional(),
    }),
    Script: z.object({
      src: z.string().regex(/\.(py|js)$/, 'Scripts must be .py or .js files'),
      props: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
    }),
    Camera: z.object({
      follow: z.string().optional(),
      zoom: z.number().positive().default(1),
      /** How quickly the camera catches up, 0..1 (1 = locked on). */
      smoothing: z.number().min(0.01).max(1).default(0.12),
      /** Pixels the camera looks ahead in the direction the target moves. */
      lookAhead: z.number().min(0).max(400).default(0),
      /** A box in the middle of the screen the target can move in without the camera moving. */
      deadZone: z.object({ width: z.number().min(0), height: z.number().min(0) }).optional(),
    }),
    Text: z.object({
      text: z.string(),
      size: z.number().positive().default(24),
      color: HexColor,
      align: z.enum(['left', 'center', 'right']).default('left'),
    }),
    MusicPlayer: z.object({ song: z.string(), autoplay: z.boolean().default(true) }),
    Light,
    /**
     * A grid of auto-tiled terrain. Each row is a string: '#' solid ground (picks ground, edge,
     * fill and ceiling tiles by its neighbours), '=' a one-way platform you can jump up through,
     * '+' a background wall (no collision, drawn darker), anything else is empty.
     * The entity's position is the map's top-left corner.
     */
    Tilemap: z.object({
      tileSize: z.number().int().min(4).max(128).default(16),
      /**
       * Tile images by role. `ground` and `fill` are required; optional: ground2, ground3,
       * groundLeft, groundRight, fill2, fillLeft, fillRight, ceiling, platform, platformLeft,
       * platformRight, back.
       */
      tiles: z.record(z.string(), z.string()).refine((t) => !!t.ground && !!t.fill, 'Tilemap needs at least ground and fill tiles'),
      rows: z.array(z.string()).min(1).max(1024),
      depth: z.number().default(0),
    }),
  })
  .partial()
  .strict();
export type Components = z.infer<typeof Components>;

const AnimationName = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, 'Use letters, numbers, - and _');

/**
 * `*.frames.json`: a sprite sheet cut into equal frames plus named animations
 * (Godot's SpriteFrames). Frame numbers count left to right, top to bottom, from 0.
 */
export const SpriteFrames = z
  .object({
    sheet: z.string(),
    frameWidth: z.number().int().positive(),
    frameHeight: z.number().int().positive(),
    animations: z
      .record(
        AnimationName,
        z.object({
          frames: z.array(z.number().int().min(0)).min(1),
          fps: z.number().positive().max(60).default(8),
          loop: z.boolean().default(true),
        }),
      )
      .refine((a) => Object.keys(a).length > 0, 'Add at least one animation'),
  })
  .strict();
export type SpriteFrames = z.infer<typeof SpriteFrames>;

export interface Entity {
  id: string;
  name: string;
  tags: string[];
  active: boolean;
  components: Components;
  children: Entity[];
}

export const Entity: z.ZodType<Entity> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tags: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  components: Components,
  get children() {
    return z.array(Entity).default([]);
  },
}) as z.ZodType<Entity>;

/** `scenes/*.scene.json` */
export const Scene = z.object({
  name: z.string().min(1),
  background: HexColor.optional(),
  /** World size; the camera is kept inside it. Defaults to the game resolution. */
  bounds: z.object({ width: z.number().positive(), height: z.number().positive() }).optional(),
  /**
   * Parallax layers. factor 0 = fixed, 1 = moves with the world; layers above 1 are foreground
   * layers drawn in front of the world, rushing past faster than it.
   */
  parallax: z
    .array(z.object({ asset: z.string(), factor: z.number().min(0).max(3), y: z.number().default(0), tiled: z.boolean().default(true) }))
    .default([]),
  /** Lighting, fog, bloom, vignette, colour grade and weather (see Environment). */
  environment: Environment.optional(),
  entities: z.array(Entity),
});
export type Scene = z.infer<typeof Scene>;

/** A project is a virtual file system: path → file contents. */
export const ProjectFiles = z.record(z.string(), z.string());
export type ProjectFiles = z.infer<typeof ProjectFiles>;

/** Walks an entity tree depth-first and returns every id that appears more than once. */
export function findDuplicateEntityIds(entities: Entity[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  const visit = (list: Entity[]) => {
    for (const e of list) {
      if (seen.has(e.id)) dupes.add(e.id);
      seen.add(e.id);
      visit(e.children);
    }
  };
  visit(entities);
  return [...dupes];
}
