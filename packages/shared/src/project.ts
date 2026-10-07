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
});
export type ProjectManifest = z.infer<typeof ProjectManifest>;

const Vec2 = z.object({ x: z.number(), y: z.number() });

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
    }),
    Body: z.object({
      type: z.enum(['dynamic', 'static', 'kinematic']),
      gravity: z.boolean().default(true),
      bounce: z.number().min(0).max(1).default(0),
      /** Overlap-only: reports collisions to scripts but doesn't push things apart (coins, triggers). */
      sensor: z.boolean().default(false),
    }),
    Script: z.object({
      src: z.string().regex(/\.(py|js)$/, 'Scripts must be .py or .js files'),
      props: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
    }),
    Camera: z.object({ follow: z.string().optional(), zoom: z.number().positive().default(1) }),
    Text: z.object({ text: z.string(), size: z.number().positive().default(24), color: HexColor }),
    MusicPlayer: z.object({ song: z.string(), autoplay: z.boolean().default(true) }),
  })
  .partial()
  .strict();
export type Components = z.infer<typeof Components>;

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
  /** Background layers drawn behind entities. factor 0 = fixed, 1 = moves with the world. */
  parallax: z
    .array(z.object({ asset: z.string(), factor: z.number().min(0).max(1), y: z.number().default(0), tiled: z.boolean().default(true) }))
    .default([]),
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
