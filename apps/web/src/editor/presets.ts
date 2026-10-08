import type { Components, ProjectFiles } from '@degamed/shared';
import { fileType } from './file-tree';

/** Ready-made entities for the "Add Entity" dialog. Built from what the project has. */
export interface Preset {
  id: string;
  name: string;
  category: 'Basics' | 'Physics' | 'Gameplay' | 'Interface' | 'Audio';
  description: string;
  tags?: string[];
  components: (ctx: PresetContext) => Components;
}

export interface PresetContext {
  files: ProjectFiles;
  at: { x: number; y: number };
  image: string | undefined;
  frames: (name: string) => string | undefined;
  script: (name: string) => string | undefined;
}

export function presetContext(files: ProjectFiles, at: { x: number; y: number }): PresetContext {
  const paths = Object.keys(files);
  const images = paths.filter((p) => fileType(p) === 'image' && !p.includes('backgrounds/') && !p.includes('-sheet'));
  return {
    files,
    at: { x: Math.round(at.x), y: Math.round(at.y) },
    image: images.find((p) => p.includes('sprites/')) ?? images[0],
    frames: (name) => paths.find((p) => p.endsWith(`${name}.frames.json`)) ?? paths.find((p) => p.endsWith('.frames.json')),
    script: (name) => paths.find((p) => p === `scripts/${name}.js` || p === `scripts/${name}.py`),
  };
}

const T = (ctx: PresetContext) => ({ position: { ...ctx.at }, rotation: 0, scale: { x: 1, y: 1 } });

function sprite(ctx: PresetContext, prefer?: string): Components['Sprite'] {
  const asset = (prefer && Object.keys(ctx.files).find((p) => p.endsWith(prefer))) ?? ctx.image ?? '';
  return { asset, tiled: false, flipX: false, depth: 0 };
}

function animated(ctx: PresetContext, name: string, auto = false): Components['AnimatedSprite'] | undefined {
  const frames = ctx.frames(name);
  return frames ? { frames, playing: true, auto, flipX: false, depth: 2 } : undefined;
}

export const PRESETS: Preset[] = [
  {
    id: 'empty',
    name: 'Empty',
    category: 'Basics',
    description: 'A position in the world with nothing attached. Use it to group other entities or as a spawn point.',
    components: (ctx) => ({ Transform: T(ctx) }),
  },
  {
    id: 'sprite',
    name: 'Sprite',
    category: 'Basics',
    description: 'Draws one image. Swap the image in Properties, or drag a picture from Files onto the scene.',
    components: (ctx) => ({ Transform: T(ctx), Sprite: sprite(ctx) }),
  },
  {
    id: 'animated-sprite',
    name: 'Animated Sprite',
    category: 'Basics',
    description: 'Plays animations from a .frames.json file. Edit its frames in the Animation panel.',
    components: (ctx) => {
      const a = animated(ctx, 'knight');
      return a ? { Transform: T(ctx), AnimatedSprite: a } : { Transform: T(ctx), Sprite: sprite(ctx) };
    },
  },
  {
    id: 'camera',
    name: 'Camera',
    category: 'Basics',
    description: 'Decides what the player sees. Make it follow an entity and set its zoom.',
    components: (ctx) => ({ Transform: T(ctx), Camera: { follow: 'player', zoom: 1 } }),
  },
  {
    id: 'solid',
    name: 'Solid Block',
    category: 'Physics',
    description: 'A wall or floor that nothing passes through. The image repeats to fill its width and height.',
    tags: ['ground'],
    components: (ctx) => ({
      Transform: T(ctx),
      Sprite: { asset: Object.keys(ctx.files).find((p) => p.includes('tiles/')) ?? ctx.image ?? '', tiled: true, width: 64, height: 16, flipX: false, depth: 0 },
      Body: { type: 'static', gravity: false, bounce: 0, sensor: false },
    }),
  },
  {
    id: 'moving-platform',
    name: 'Moving Platform',
    category: 'Physics',
    description: 'A solid platform that scripts can move. Characters ride on top of it.',
    tags: ['ground'],
    components: (ctx) => ({
      Transform: T(ctx),
      Sprite: { asset: Object.keys(ctx.files).find((p) => p.includes('tiles/')) ?? ctx.image ?? '', tiled: true, width: 48, height: 16, flipX: false, depth: 0 },
      Body: { type: 'kinematic', gravity: false, bounce: 0, sensor: false },
    }),
  },
  {
    id: 'physics-object',
    name: 'Physics Object',
    category: 'Physics',
    description: 'Falls, bounces and gets pushed around. Good for crates, balls and rocks.',
    components: (ctx) => ({ Transform: T(ctx), Sprite: sprite(ctx), Body: { type: 'dynamic', gravity: true, bounce: 0.3, sensor: false } }),
  },
  {
    id: 'trigger',
    name: 'Trigger Zone',
    category: 'Physics',
    description: 'Detects things entering it without blocking them. Scripts get onCollide.',
    tags: ['trigger'],
    components: (ctx) => ({ Transform: T(ctx), Sprite: sprite(ctx, 'flag.png'), Body: { type: 'static', gravity: false, bounce: 0, sensor: true } }),
  },
  {
    id: 'player',
    name: 'Player Character',
    category: 'Gameplay',
    description: 'A platformer hero: runs, jumps and switches idle/run/jump animations by itself.',
    tags: ['player'],
    components: (ctx) => {
      const a = animated(ctx, 'knight', true);
      const src = ctx.script('player');
      return {
        Transform: T(ctx),
        ...(a ? { AnimatedSprite: { ...a, depth: 5 } } : { Sprite: sprite(ctx) }),
        Body: { type: 'dynamic', gravity: true, bounce: 0, sensor: false },
        ...(src ? { Script: { src, props: {} } } : {}),
      };
    },
  },
  {
    id: 'enemy',
    name: 'Enemy',
    category: 'Gameplay',
    description: 'Walks back and forth. Hurts the player, and can be stomped from above.',
    tags: ['enemy'],
    components: (ctx) => {
      const a = animated(ctx, 'slime');
      const src = ctx.script('slime');
      return {
        Transform: T(ctx),
        ...(a ? { AnimatedSprite: { ...a, depth: 3 } } : { Sprite: sprite(ctx) }),
        Body: { type: 'dynamic', gravity: true, bounce: 0, sensor: false },
        ...(src ? { Script: { src, props: { range: 40 } } } : {}),
      };
    },
  },
  {
    id: 'collectible',
    name: 'Collectible',
    category: 'Gameplay',
    description: 'A coin or pickup. Disappears with a sparkle and adds to the score when touched.',
    tags: ['coin'],
    components: (ctx) => {
      const a = animated(ctx, 'coin');
      const src = ctx.script('coin');
      return {
        Transform: T(ctx),
        ...(a ? { AnimatedSprite: a } : { Sprite: sprite(ctx, 'coin.png') }),
        Body: { type: 'static', gravity: false, bounce: 0, sensor: true },
        ...(src ? { Script: { src, props: {} } } : {}),
      };
    },
  },
  {
    id: 'goal',
    name: 'Level Goal',
    category: 'Gameplay',
    description: 'Finishes the level when the player reaches it.',
    tags: ['goal'],
    components: (ctx) => ({ Transform: T(ctx), Sprite: sprite(ctx, 'flag.png'), Body: { type: 'static', gravity: false, bounce: 0, sensor: true } }),
  },
  {
    id: 'label',
    name: 'Text Label',
    category: 'Interface',
    description: 'Text on screen: scores, timers, hints. Tagged “ui” so it stays put when the camera moves.',
    tags: ['ui'],
    components: (ctx) => ({ Transform: T(ctx), Text: { text: 'Hello', size: 10, color: '#FFFFFF' } }),
  },
  {
    id: 'world-text',
    name: 'World Text',
    category: 'Interface',
    description: 'Text that sits in the level and scrolls with it, like a sign.',
    components: (ctx) => ({ Transform: T(ctx), Text: { text: 'Sign', size: 8, color: '#FFFFFF' } }),
  },
  {
    id: 'music',
    name: 'Music Player',
    category: 'Audio',
    description: 'Plays a song from the Composer when the scene starts.',
    components: (ctx) => ({ Transform: T(ctx), MusicPlayer: { song: 'audio/songs/theme.song.json', autoplay: true } }),
  },
];

export const PRESET_CATEGORIES = ['Basics', 'Physics', 'Gameplay', 'Interface', 'Audio'] as const;
