/**
 * Cave explorer kit: a dark, many-screen cave made of hand-designed rooms joined by tunnels and
 * climbing ropes (a random maze, so every seed is a new cave). Find the glowing crystals to open
 * the way out; fight crawlers and bats with a sword swipe. The hero carries a lantern.
 */
import type { Environment, ProjectFiles } from '@degamed/shared';
import { mulberry32 } from '../pixel';
import { darken, decorate, hudEntity, KitBuilder, Level, manifestFor, titleEntity, TITLE_JS, type ParamValues } from './build';
import { cameraEntity, coinEntity, flyerEntity, goalEntity, heroEntity, ladderEntity, spikeEntity, walkerEntity } from './pieces';
import { FLYER_JS, GOAL_JS, HUD_JS, PICKUP_JS, PLAYER_JS, WALKER_JS } from './scripts';
import type { Encoder, GameSpec, Kit, KitTheme } from './types';

type Json = Record<string, unknown>;

export const ROOM_W = 30;
export const ROOM_H = 17;

/**
 * Room interiors: 12 rows × 26 columns placed inside a 2-tile rock border; the floor below is
 * added automatically. Columns 11–14 stay clear (that's where ropes hang between rooms).
 * Legend: # rock, = ledge, c crystal spot, e crawler, b bat, h heart, ^ spikes, L lamp.
 */
export const CAVE_ROOMS: string[][] = [
  [
    '..........................',
    '..........................',
    '...c......................',
    '..#####..........b........',
    '..#####..............c....',
    '....................####..',
    '....................####..',
    '..........................',
    '....###..........===......',
    '....###...................',
    '..........................',
    '..L......e.........h...L..',
  ],
  [
    '..........................',
    '....c................c....',
    '...====.............====..',
    '..........................',
    '..........b...............',
    '..........................',
    '.......===.........===....',
    '..........................',
    '..........................',
    '...##...............##....',
    '...##.......e.......##....',
    '..L##...............##.L..',
  ],
  [
    '..........................',
    '..........................',
    '...................c......',
    '..................====....',
    '..........................',
    '....c.....................',
    '...===........b...........',
    '..........................',
    '..........................',
    '........===.......===.....',
    '..........................',
    '..L.^^^^.....e.....^^^^.L.',
  ],
  [
    '..........................',
    '..........................',
    '......b..........b........',
    '..........................',
    '..........................',
    '..c...................c...',
    '####..................####',
    '####..................####',
    '..........................',
    '......##..........##......',
    '......##..........##......',
    '..L...##..e....h..##...L..',
  ],
  [
    '..........................',
    '......................c...',
    '.....................####.',
    '.....................####.',
    '....b.....................',
    '..................###.....',
    '..................###.....',
    '.###......................',
    '.###......................',
    '...............####.......',
    '...............####.......',
    '..L.....e......####..h..L.',
  ],
];

export const CAVE_KIT: Kit = {
  id: 'cave',
  name: 'Cave explorer',
  description: 'Explore a dark cave with a lantern: climb ropes between caverns, find the glowing crystals to open the way out, and fight off crawlers and bats.',
  keywords: ['cave', 'explore', 'exploration', 'metroidvania', 'hollow', 'knight', 'dungeon', 'underground', 'mine', 'crystal', 'dark', 'sword', 'adventure', 'treasure'],
  params: [
    { key: 'size', label: 'Cave size', type: 'choice', choices: ['small', 'medium', 'large'], default: 'medium', group: 'Level' },
    { key: 'crystals', label: 'Crystals to find', type: 'number', min: 3, max: 12, step: 1, default: 6, group: 'Level' },
    { key: 'jumpHeight', label: 'Jump height (tiles)', type: 'number', min: 3, max: 6, step: 0.1, default: 4, group: 'Feel' },
    { key: 'speed', label: 'Running speed', type: 'number', min: 90, max: 200, step: 5, default: 130, group: 'Feel' },
    { key: 'gravity', label: 'Gravity', type: 'number', min: 600, max: 1400, step: 50, default: 900, group: 'Feel' },
    { key: 'health', label: 'Hearts', type: 'number', min: 1, max: 6, step: 1, default: 3, group: 'Challenge' },
    { key: 'lives', label: 'Lives', type: 'number', min: 1, max: 9, step: 1, default: 3, group: 'Challenge' },
    { key: 'difficulty', label: 'Difficulty', type: 'number', min: 1, max: 3, step: 1, default: 2, group: 'Challenge' },
    { key: 'enemies', label: 'Enemies', type: 'choice', choices: ['none', 'few', 'some', 'lots'], default: 'some', group: 'Challenge' },
    { key: 'darkness', label: 'Darkness', type: 'choice', choices: ['light', 'dim', 'dark'], default: 'dark', group: 'Look' },
    { key: 'weather', label: 'In the air', type: 'choice', choices: ['theme', 'clear', 'dust', 'spores', 'fireflies', 'embers'], default: 'theme', group: 'Look' },
    { key: 'decoration', label: 'Decoration', type: 'number', min: 0, max: 1, step: 0.1, default: 0.7, group: 'Look' },
  ],
};

const SIZES: Record<string, [number, number]> = { small: [3, 2], medium: [4, 3], large: [5, 3] };

interface Layout {
  cols: number;
  rows: number;
  /** Open sides per room: [right, down]. */
  right: boolean[][];
  down: boolean[][];
  start: [number, number];
  exit: [number, number];
}

/** A random maze over the room grid (every room reachable), plus a few extra loops. */
export function caveLayout(cols: number, rows: number, rand: () => number): Layout {
  const right = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const down = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const seen = new Set<string>();
  const start: [number, number] = [Math.floor(rand() * cols), 0];
  const stack: [number, number][] = [start];
  seen.add(start.join(','));
  while (stack.length) {
    const [x, y] = stack[stack.length - 1]!;
    const next = (
      [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as [number, number][]
    ).filter(([a, b]) => a >= 0 && b >= 0 && a < cols && b < rows && !seen.has(`${a},${b}`));
    if (!next.length) {
      stack.pop();
      continue;
    }
    // Prefer sideways tunnels: they read better than lots of ropes.
    const weights = next.map(([a]) => (a !== x ? 2 : 1));
    let r = rand() * weights.reduce((s, w) => s + w, 0);
    let pick = next[0]!;
    for (let i = 0; i < next.length; i++) {
      r -= weights[i]!;
      if (r <= 0) {
        pick = next[i]!;
        break;
      }
    }
    const [a, b] = pick;
    if (a !== x) right[y]![Math.min(a, x)] = true;
    else down[Math.min(b, y)]![x] = true;
    seen.add(`${a},${b}`);
    stack.push(pick);
  }
  // A few loops so it isn't a single corridor.
  for (let i = 0; i < Math.floor((cols * rows) / 4); i++) {
    const x = Math.floor(rand() * (cols - 1));
    const y = Math.floor(rand() * rows);
    right[y]![x] = true;
  }
  // The exit is the room furthest from the start.
  const dist = new Map<string, number>([[start.join(','), 0]]);
  const queue: [number, number][] = [start];
  let exit = start;
  while (queue.length) {
    const [x, y] = queue.shift()!;
    const d = dist.get(`${x},${y}`)!;
    const links: [number, number][] = [];
    if (x + 1 < cols && right[y]![x]) links.push([x + 1, y]);
    if (x > 0 && right[y]![x - 1]) links.push([x - 1, y]);
    if (y + 1 < rows && down[y]![x]) links.push([x, y + 1]);
    if (y > 0 && down[y - 1]![x]) links.push([x, y - 1]);
    for (const [a, b] of links) {
      if (dist.has(`${a},${b}`)) continue;
      dist.set(`${a},${b}`, d + 1);
      queue.push([a, b]);
      if (d + 1 > dist.get(exit.join(','))!) exit = [a, b];
    }
  }
  return { cols, rows, right, down, start, exit };
}

/** Builds the whole cave as one Level grid. */
export function caveLevel(layout: Layout, rand: () => number): { level: Level; ropes: { x: number; top: number; bottom: number }[] } {
  const W = layout.cols * ROOM_W;
  const H = layout.rows * ROOM_H;
  const level = new Level(W, H, '#');
  const ropes: { x: number; top: number; bottom: number }[] = [];
  for (let ry = 0; ry < layout.rows; ry++)
    for (let rx = 0; rx < layout.cols; rx++) {
      const x0 = rx * ROOM_W;
      const y0 = ry * ROOM_H;
      const isStart = rx === layout.start[0] && ry === layout.start[1];
      const isExit = rx === layout.exit[0] && ry === layout.exit[1];
      const room = CAVE_ROOMS[Math.floor(rand() * CAVE_ROOMS.length)]!;
      room.forEach((row, j) => {
        const r = (row + '.'.repeat(26)).slice(0, 26);
        [...r].forEach((ch, i) => {
          let c = ch;
          // The start and exit rooms stay calm.
          if ((isStart || isExit) && 'eb^'.includes(c)) c = '.';
          if (isStart && c === 'c') c = '.';
          level.set(x0 + 2 + i, y0 + 2 + j, c);
        });
      });
      if (isStart) level.set(x0 + 4, y0 + 13, 'P');
      if (isExit) {
        for (let i = 18; i < 24; i++) level.set(x0 + i, y0 + 13, '.');
        level.set(x0 + 21, y0 + 13, 'G');
      }
      // Tunnels to the right.
      if (rx + 1 < layout.cols && layout.right[ry]![rx]) {
        for (let y = y0 + 10; y <= y0 + 13; y++) for (let x = x0 + ROOM_W - 3; x <= x0 + ROOM_W + 2; x++) level.set(x, y, '.');
      }
      // Shafts down, with a rope.
      if (ry + 1 < layout.rows && layout.down[ry]![rx]) {
        for (let y = y0 + 11; y <= y0 + ROOM_H + 13; y++) for (let x = x0 + 13; x <= x0 + 16; x++) level.set(x, y, '.');
        ropes.push({ x: x0 + 15, top: y0 + 11, bottom: y0 + ROOM_H + 14 });
      }
    }
  return { level, ropes };
}

const ENEMY_CHANCE: Record<string, number> = { none: 0, few: 0.35, some: 0.7, lots: 1 };

function caveEnvironment(theme: KitTheme, darkness: string, weather: string): Environment {
  const env: Environment = JSON.parse(JSON.stringify(theme.environment ?? {}));
  const amb = theme.environment.ambient?.color ?? '#506070';
  const level = darkness === 'light' ? 0.9 : darkness === 'dim' ? 0.62 : 0.42;
  env.ambient = { color: amb, intensity: Math.min(level, theme.environment.ambient?.intensity ?? 1) };
  env.bloom = { strength: Math.max(0.55, env.bloom?.strength ?? 0), threshold: Math.min(0.7, env.bloom?.threshold ?? 0.7) };
  env.vignette = Math.max(0.55, env.vignette ?? 0);
  // No rain or snow underground.
  const inside = (env.particles ?? []).filter((p) => p.type !== 'rain' && p.type !== 'snow');
  if (weather === 'theme') env.particles = [...inside.filter((p) => p.type !== 'dust'), { type: 'dust', density: 0.35 }, { type: 'spores', density: 0.4 }];
  else if (weather === 'clear') env.particles = [];
  else env.particles = [{ type: 'dust', density: 0.3 }, { type: weather as 'dust', density: 0.55 }];
  if (env.fog) env.fog = { ...env.fog, density: Math.min(0.4, env.fog.density), height: 0.45 };
  return env;
}

export function buildCave(spec: GameSpec, theme: KitTheme, p: ParamValues, encode: Encoder): ProjectFiles {
  const b = new KitBuilder(theme, spec.seed ?? 1);
  const T = b.T;
  const [cols, rows] = SIZES[String(p.size)] ?? SIZES.medium!;
  const layoutRand = mulberry32((spec.seed ?? 1) * 7 + 3);
  const layout = caveLayout(cols, rows, layoutRand);
  const { level, ropes } = caveLevel(layout, layoutRand);
  const tiles = b.tiles();
  const gravity = Number(p.gravity);
  const jump = Math.sqrt(2 * gravity * Number(p.jumpHeight) * T) * 1.08;
  const enemyChance = ENEMY_CHANCE[String(p.enemies)] ?? 0.7;
  const difficulty = Number(p.difficulty);
  const worldW = level.width * T;
  const worldH = level.height * T;

  // Crystals: spread over the rooms, never in the start room.
  const spots = level.markers().filter((m) => m.ch === 'c');
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(b.rand() * (i + 1));
    [spots[i], spots[j]] = [spots[j]!, spots[i]!];
  }
  const wanted = Math.min(Number(p.crystals), spots.length);
  const crystals = new Set(spots.slice(0, wanted).map((m) => `${m.x},${m.y}`));
  const need = Math.max(1, Math.ceil(wanted * 0.75));

  // Background rock: patches of darker wall behind open space, for depth.
  const noise = mulberry32((spec.seed ?? 1) + 99);
  const blobs = Array.from({ length: Math.ceil((level.width * level.height) / 90) }, () => ({
    x: noise() * level.width,
    y: noise() * level.height,
    r: 2 + noise() * 5,
  }));
  for (let y = 0; y < level.height; y++)
    for (let x = 0; x < level.width; x++) {
      if (level.get(x, y) !== '.') continue;
      // Walls hug the rock: within 1 tile of solid, or inside a blob.
      const nearRock = level.solid(x - 1, y) || level.solid(x + 1, y) || level.solid(x, y - 1) || level.solid(x, y + 1);
      const inBlob = blobs.some((bl) => (x - bl.x) ** 2 + (y - bl.y) ** 2 < bl.r * bl.r);
      if ((nearRock && noise() < 0.55) || inBlob) level.set(x, y, '+');
    }

  b.entities.push({
    id: 'terrain',
    name: 'Cave',
    tags: ['ground'],
    components: { Transform: { position: { x: 0, y: 0 } }, Tilemap: { tileSize: T, tiles, rows: level.terrainRows(), depth: 0 } },
  });

  for (const r of ropes) b.entities.push(ladderEntity(b, r.x * T, r.top * T, r.bottom * T));

  const avoid = new Set<string>();
  let start = { x: 4 * T, y: 14 * T };
  const accent = b.accent();
  for (const m of level.markers()) {
    const cx = m.x * T + T / 2;
    const surface = (m.y + 1) * T;
    avoid.add(`${m.x},${m.y}`);
    switch (m.ch) {
      case 'P':
        start = { x: cx, y: surface };
        break;
      case 'c':
        if (crystals.has(`${m.x},${m.y}`)) b.entities.push(coinEntity(b, cx, m.y * T + T / 2));
        break;
      case 'e':
        if (level.standable(m.x, m.y) && b.rand() < enemyChance) b.entities.push(walkerEntity(b, level, m.x, m.y, { speed: 22 + difficulty * 8, hp: difficulty >= 2 ? 2 : 1 }));
        break;
      case 'b':
        if (b.rand() < enemyChance) b.entities.push(flyerEntity(b, cx, m.y * T + T / 2, { speed: 34 + difficulty * 8, range: 60, chase: 80 + difficulty * 20 }));
        break;
      case 'h':
        if (b.rand() < 0.5) b.entities.push(heartEntity(b, cx, m.y * T + T / 2));
        break;
      case '^': {
        if (level.get(m.x - 1, m.y) === '^' || !level.standable(m.x, m.y)) break;
        let n = 1;
        while (level.get(m.x + n, m.y) === '^') n++;
        b.entities.push(spikeEntity(b, m.x * T, surface, n));
        break;
      }
      case 'G':
        b.entities.push(goalEntity(b, cx, surface, need));
        break;
    }
  }
  for (let dx = -1; dx <= 3; dx++) avoid.add(`${Math.floor(start.x / T) + dx},${Math.floor(start.y / T) - 1}`);
  decorate(b, level, { density: Number(p.decoration), avoid });

  b.entities.push(
    heroEntity(b, {
      x: start.x,
      y: start.y,
      script: 'scripts/player.js',
      props: {
        speed: Number(p.speed),
        jump: Math.round(jump),
        gravity,
        lives: Number(p.lives),
        health: Number(p.health),
        doubleJump: true,
        attack: true,
        climb: true,
        killY: worldH + 48,
        dust: b.dustColor(),
        accent,
        goalText: 'YOU ESCAPED!',
      },
    }),
    cameraEntity({ lookAhead: 36, deadZone: { width: 24, height: 36 }, smoothing: 0.1 }),
    hudEntity('health,lives,coins'),
    titleEntity(spec.title),
  );
  // The hero carries a lantern in the dark.
  const hero = b.entities[b.entities.length - 4] as { components: { Light: Json } };
  hero.components.Light = { ...hero.components.Light, radius: 96, intensity: 0.95, flicker: 0.06 };

  const scene = {
    name: spec.title || 'The Cave',
    background: darken(theme.background, 0.6),
    bounds: { width: worldW, height: worldH },
    parallax: b.parallax(),
    environment: caveEnvironment(theme, String(p.darkness), String(p.weather)),
    entities: b.entities,
  };
  const files = b.files;
  files['project.json'] = JSON.stringify(
    manifestFor(spec, theme, {
      gravity,
      touch: { move: 'stick', buttons: [{ action: 'jump', label: 'A' }, { action: 'attack', label: 'B' }] },
      input: {
        left: ['ArrowLeft', 'KeyA'],
        right: ['ArrowRight', 'KeyD'],
        up: ['ArrowUp', 'KeyW'],
        down: ['ArrowDown', 'KeyS'],
        jump: ['Space', 'KeyZ', 'KeyK'],
        attack: ['KeyX', 'KeyJ'],
        action: ['Enter', 'KeyE'],
      },
    }),
    null,
    2,
  );
  files['scenes/main.scene.json'] = JSON.stringify(scene, null, 2);
  files['scripts/player.js'] = PLAYER_JS;
  files['scripts/walker.js'] = WALKER_JS;
  files['scripts/flyer.js'] = FLYER_JS;
  files['scripts/pickup.js'] = PICKUP_JS;
  files['scripts/goal.js'] = GOAL_JS;
  files['scripts/hud.js'] = HUD_JS;
  files['scripts/title.js'] = TITLE_JS;
  return b.finish(encode);
}

function heartEntity(b: KitBuilder, x: number, y: number): Json {
  const own = b.theme.sprites.heart;
  const frames = own ? b.sheet('heart') : null;
  const r = {
    width: 7,
    height: 6,
    data: new Uint8ClampedArray(7 * 6 * 4),
  };
  const rows = ['.xx.xx.', 'xwxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'];
  rows.forEach((row, yy) =>
    [...row].forEach((ch, xx) => {
      if (ch === '.') return;
      r.data.set(ch === 'w' ? [255, 255, 255, 255] : [232, 64, 80, 255], (yy * 7 + xx) * 4);
    }),
  );
  return {
    id: b.id('heart'),
    name: 'Heart',
    tags: ['heart'],
    components: {
      Transform: { position: { x, y } },
      ...(frames ? { AnimatedSprite: { frames, depth: 6 } } : { Sprite: { asset: b.asset('assets/sprites/heart.png', r), depth: 6 } }),
      Body: { type: 'static', sensor: true, width: 12, height: 12 },
      Script: { src: 'scripts/pickup.js' },
      Light: { color: '#FF6A7A', radius: 24, intensity: 0.5, flicker: 0, offset: { x: 0, y: 0 } },
    },
  };
}
