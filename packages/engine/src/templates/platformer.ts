import type { ProjectFiles, ProjectManifest, Scene } from '@degamed/shared';
import { ditheredSky, rasterize, ridgeLayer, SPRITES, SWEETIE16 as P, type Raster } from '../pixel';

/** Turns raw pixels into a data URL (the browser uses a canvas; tests pass a fake). */
export type Encoder = (raster: Raster) => string;

const W = 480;
const H = 270;
const WORLD = 2240;
const GROUND_Y = 238; // top edge of the ground
const TILE = 16;

const PLAYER_JS = `import { Behaviour, Input, Game, kit } from 'degamed';

// Tight platformer controls: acceleration, coyote time, jump buffering and variable jump height.
export default class Player extends Behaviour {
  static props = { speed: 150, jump: 330, accel: 1400 };

  onStart() {
    this.spawn = { x: this.entity.x, y: this.entity.y };
    this.coyote = 0;
    this.buffer = 0;
  }

  onUpdate(dt) {
    const dir = Input.axis('horizontal');
    const target = dir * this.speed;
    const v = this.velocity;
    const step = this.accel * dt;
    v.x = Math.abs(target - v.x) <= step ? target : v.x + Math.sign(target - v.x) * step;
    if (dir !== 0) this.entity.flipX = dir < 0;

    this.coyote = this.onFloor ? 0.1 : Math.max(0, this.coyote - dt);
    this.buffer = Input.pressed('jump') ? 0.12 : Math.max(0, this.buffer - dt);
    if (this.buffer > 0 && this.coyote > 0) {
      v.y = -this.jump;
      this.buffer = 0;
      this.coyote = 0;
      kit.squash(this.entity, 0.75);
      Game.sound('jump');
    }
    if (!Input.down('jump') && v.y < -120) v.y = -120; // short hop when released early

    if (this.entity.y > Game.height + 120) this.respawn();
  }

  onCollide(other) {
    if (other.hasTag('coin')) {
      kit.burst(other.x, other.y, { color: '#FFCD75', count: 10 });
      kit.floatText(other.x, other.y - 8, '+1', '#FFCD75');
      other.destroy();
      Game.score += 1;
      Game.sound('coin');
    } else if (other.hasTag('enemy')) {
      const stomp = this.velocity.y > 0 && this.entity.y < other.y - 6;
      if (stomp) {
        kit.burst(other.x, other.y, { color: '#A7F070', count: 14 });
        other.destroy();
        this.velocity.y = -this.jump * 0.7;
        kit.shake(0.006, 120);
        Game.score += 5;
        Game.sound('stomp');
      } else {
        this.respawn();
      }
    } else if (other.hasTag('goal') && !this.won) {
      this.won = true;
      kit.burst(other.x, other.y - 20, { color: '#73EFF7', count: 40 });
      kit.floatText(other.x, other.y - 40, 'LEVEL CLEAR!', '#73EFF7');
      Game.sound('win');
    }
  }

  respawn() {
    kit.shake(0.012, 200);
    kit.flash('#B13E53', 150);
    Game.sound('hurt');
    this.entity.setPosition(this.spawn.x, this.spawn.y);
    this.velocity.x = 0;
    this.velocity.y = 0;
  }
}
`;

const SLIME_JS = `import { Behaviour } from 'degamed';

// Patrols back and forth, turning at the edges of its range.
export default class Slime extends Behaviour {
  static props = { speed: 30, range: 48 };

  onStart() {
    this.home = this.entity.x;
    this.dir = -1;
  }

  onUpdate() {
    if (this.entity.x < this.home - this.range) this.dir = 1;
    if (this.entity.x > this.home + this.range) this.dir = -1;
    this.velocity.x = this.dir * this.speed;
    this.entity.flipX = this.dir > 0;
  }
}
`;

const COIN_JS = `import { Behaviour, Game } from 'degamed';

// Gently bobs up and down.
export default class Coin extends Behaviour {
  onStart() {
    this.baseY = this.entity.y;
    this.offset = this.entity.x * 0.05;
  }

  onUpdate() {
    this.entity.y = this.baseY + Math.sin(Game.time * 4 + this.offset) * 2;
  }
}
`;

const HUD_JS = `import { Behaviour, Game } from 'degamed';

export default class Hud extends Behaviour {
  onUpdate() {
    this.entity.text = 'COINS ' + String(Game.score).padStart(3, '0');
  }
}
`;

let nextId = 0;
const id = (prefix: string) => `${prefix}-${++nextId}`;

/** A complete starter platformer: art, level, and scripts. */
export function createPlatformerTemplate(encode: Encoder, title = 'Starter Platformer'): ProjectFiles {
  nextId = 0;
  const assets: Record<string, Raster> = {
    'assets/sprites/knight.png': rasterize(SPRITES.knight),
    'assets/sprites/slime.png': rasterize(SPRITES.slime),
    'assets/sprites/coin.png': rasterize(SPRITES.coin),
    'assets/sprites/flag.png': rasterize(SPRITES.flag),
    'assets/sprites/cloud.png': rasterize(SPRITES.cloud),
    'assets/tiles/grass.png': rasterize(SPRITES.grass),
    'assets/tiles/dirt.png': rasterize(SPRITES.dirt),
    'assets/backgrounds/sky.png': ditheredSky(64, H, [P.navy, P.blue, P.sky, P.cyan]),
    'assets/backgrounds/mountains.png': ridgeLayer(320, H, { base: 120, amplitude: 34, color: P.slate, rim: P.silver, seed: 7 }),
    'assets/backgrounds/hills.png': ridgeLayer(240, H, { base: 56, amplitude: 18, color: P.teal, rim: P.green, seed: 21, roughness: 1.6 }),
  };

  const manifest: ProjectManifest = {
    engine: 'degamed',
    engineVersion: '0.1.0',
    title,
    resolution: { width: W, height: H },
    artStyle: 'pixel-16',
    palette: Object.values(P),
    defaultLanguage: 'javascript',
    physics: { engine: 'arcade', gravity: { x: 0, y: 900 } },
    startScene: 'scenes/main.scene.json',
    input: {
      left: ['ArrowLeft', 'KeyA'],
      right: ['ArrowRight', 'KeyD'],
      up: ['ArrowUp', 'KeyW'],
      down: ['ArrowDown', 'KeyS'],
      jump: ['Space', 'ArrowUp', 'KeyW', 'KeyZ'],
    },
  };

  const ground = (x: number, width: number, y = GROUND_Y) => [
    {
      id: id('ground'),
      name: 'Ground',
      tags: ['ground'],
      components: {
        Transform: { position: { x: x + width / 2, y: y + TILE / 2 } },
        Sprite: { asset: 'assets/tiles/grass.png', tiled: true, width, height: TILE },
        Body: { type: 'static' as const },
      },
    },
    {
      id: id('dirt'),
      name: 'Dirt',
      tags: [],
      components: {
        Transform: { position: { x: x + width / 2, y: y + TILE + (H - y) / 2 } },
        Sprite: { asset: 'assets/tiles/dirt.png', tiled: true, width, height: H - y },
      },
    },
  ];

  const platform = (x: number, y: number, tiles: number) => ({
    id: id('platform'),
    name: 'Platform',
    tags: ['ground'],
    components: {
      Transform: { position: { x: x + (tiles * TILE) / 2, y } },
      Sprite: { asset: 'assets/tiles/grass.png', tiled: true, width: tiles * TILE, height: TILE },
      Body: { type: 'static' as const },
    },
  });

  const coin = (x: number, y: number) => ({
    id: id('coin'),
    name: 'Coin',
    tags: ['coin'],
    components: {
      Transform: { position: { x, y } },
      Sprite: { asset: 'assets/sprites/coin.png', depth: 2 },
      Body: { type: 'static' as const, sensor: true },
      Script: { src: 'scripts/coin.js' },
    },
  });

  const slime = (x: number) => ({
    id: id('slime'),
    name: 'Slime',
    tags: ['enemy'],
    components: {
      Transform: { position: { x, y: GROUND_Y - 8 } },
      Sprite: { asset: 'assets/sprites/slime.png', depth: 3 },
      Body: { type: 'dynamic' as const },
      Script: { src: 'scripts/slime.js', props: { range: 40 } },
    },
  });

  const cloud = (x: number, y: number) => ({
    id: id('cloud'),
    name: 'Cloud',
    tags: [],
    components: { Transform: { position: { x, y } }, Sprite: { asset: 'assets/sprites/cloud.png', depth: -5 } },
  });

  const scene = {
    name: 'Level 1',
    background: P.navy,
    bounds: { width: WORLD, height: H },
    parallax: [
      { asset: 'assets/backgrounds/sky.png', factor: 0 },
      { asset: 'assets/backgrounds/mountains.png', factor: 0.2 },
      { asset: 'assets/backgrounds/hills.png', factor: 0.45 },
    ],
    entities: [
      ...[cloud(120, 50), cloud(420, 34), cloud(760, 62), cloud(1180, 40), cloud(1600, 56), cloud(2000, 36)],
      ...ground(0, 640),
      ...ground(720, 480),
      ...ground(1280, 400),
      ...ground(1760, 480),
      platform(300, 180, 5),
      platform(560, 140, 4),
      platform(880, 170, 6),
      platform(1210, 150, 3),
      platform(1450, 120, 5),
      platform(1700, 175, 4),
      ...[
        [200, 210], [340, 160], [372, 160], [404, 160], [588, 120], [620, 120], [690, 200],
        [920, 150], [952, 150], [984, 150], [1232, 130], [1480, 100], [1512, 100], [1544, 100],
        [1730, 155], [1762, 155], [1900, 210], [1940, 210],
      ].map(([x, y]) => coin(x!, y!)),
      slime(470),
      slime(980),
      slime(1400),
      slime(1880),
      {
        id: 'goal',
        name: 'Goal',
        tags: ['goal'],
        components: {
          Transform: { position: { x: 2160, y: GROUND_Y - 8 } },
          Sprite: { asset: 'assets/sprites/flag.png', depth: 1 },
          Body: { type: 'static' as const, sensor: true },
        },
      },
      {
        id: 'player',
        name: 'Player',
        tags: ['player'],
        components: {
          Transform: { position: { x: 60, y: GROUND_Y - 40 } },
          Sprite: { asset: 'assets/sprites/knight.png', depth: 5 },
          Body: { type: 'dynamic' as const },
          Script: { src: 'scripts/player.js' },
        },
      },
      {
        id: 'camera',
        name: 'Camera',
        tags: [],
        components: { Transform: { position: { x: 0, y: 0 } }, Camera: { follow: 'player' } },
      },
      {
        id: 'hud',
        name: 'Score',
        tags: ['ui'],
        components: {
          Transform: { position: { x: 10, y: 8 } },
          Text: { text: 'COINS 000', size: 10, color: P.white },
          Script: { src: 'scripts/hud.js' },
        },
      },
    ],
  } satisfies Omit<Scene, 'entities' | 'parallax'> & { entities: unknown[]; parallax: unknown[] };

  const files: ProjectFiles = {
    'project.json': JSON.stringify(manifest, null, 2),
    'scenes/main.scene.json': JSON.stringify(scene, null, 2),
    'scripts/player.js': PLAYER_JS,
    'scripts/slime.js': SLIME_JS,
    'scripts/coin.js': COIN_JS,
    'scripts/hud.js': HUD_JS,
  };
  for (const [path, raster] of Object.entries(assets)) files[path] = encode(raster);
  return files;
}
