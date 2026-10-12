/**
 * Platformer kit: a side-scrolling level stitched together from hand-designed chunks, picked by
 * seed and difficulty, then decorated from the theme. Coins, enemies, spikes, checkpoints, a goal.
 */
import type { ProjectFiles } from '@degamed/shared';
import { decorate, hudEntity, KitBuilder, Level, manifestFor, moodEnvironment, titleEntity, TITLE_JS, type ParamValues } from './build';
import { cameraEntity, checkpointEntity, coinEntity, flyerEntity, goalEntity, heroEntity, spikeEntity, walkerEntity } from './pieces';
import { CHECKPOINT_JS, FLYER_JS, GOAL_JS, HUD_JS, PICKUP_JS, PLAYER_JS, WALKER_JS } from './scripts';
import type { Encoder, GameSpec, Kit, KitTheme } from './types';

export const ROWS = 17;
/** Chunks are 10 rows tall and sit on the bottom of the level; their row 6 is the ground line. */
const GROUND_ROW = 14;

export interface Chunk {
  id: string;
  /** 0 = special (start, checkpoint, goal). */
  difficulty: number;
  /** Widest gap in tiles you must jump. */
  gap: number;
  /** Highest step up in tiles. */
  rise: number;
  rows: string[];
}

const G3 = (w: number, holes: [number, number][] = []) => {
  const row = [...'#'.repeat(w)];
  for (const [a, b] of holes) for (let i = a; i <= b; i++) row[i] = '.';
  const s = row.join('');
  return [s, s, s];
};
const E = (w: number) => '.'.repeat(w);

/**
 * Legend: # ground, = one-way platform, o coin, e walker slot, f flyer slot, ^ spikes,
 * L lamp, C checkpoint, G goal, P player start.
 */
export const PLATFORMER_CHUNKS: Chunk[] = [
  { id: 'start', difficulty: 0, gap: 0, rise: 0, rows: [E(16), E(16), E(16), E(16), E(16), E(16), '..P......L......', ...G3(16)] },
  { id: 'checkpoint', difficulty: 0, gap: 0, rise: 0, rows: [E(14), E(14), E(14), E(14), E(14), E(14), '..L....C......', ...G3(14)] },
  { id: 'goal', difficulty: 0, gap: 0, rise: 0, rows: [E(22), E(22), E(22), E(22), E(22), E(22), '..L........G.......L..', ...G3(22)] },
  {
    id: 'meadow', difficulty: 1, gap: 0, rise: 0,
    rows: [E(20), E(20), E(20), '......o.o.o.........', E(20), E(20), '...............e....', ...G3(20)],
  },
  {
    id: 'hop', difficulty: 1, gap: 2, rise: 0,
    rows: [E(16), E(16), E(16), '......o.o.......', E(16), E(16), '..L.............', ...G3(16, [[6, 7]])],
  },
  {
    id: 'steps', difficulty: 1, gap: 1, rise: 2,
    rows: [
      E(22), E(22),
      '..............o.o.o...',
      E(22),
      '.........#########....',
      '......o..#########....',
      '......##.#########..L.',
      ...G3(22),
    ],
  },
  {
    id: 'ledges', difficulty: 2, gap: 2, rise: 3,
    rows: [
      E(22),
      '...........o.o........',
      '..........=====.......',
      E(22), E(22),
      '....====.........o....',
      '............e......L..',
      ...G3(22),
    ],
  },
  {
    id: 'pit', difficulty: 2, gap: 3, rise: 3,
    rows: [E(20), E(20), '........o.o.........', E(20), '.......=====........', E(20), '..L..............e..', ...G3(20, [[5, 14]])],
  },
  {
    id: 'run', difficulty: 2, gap: 0, rise: 0,
    rows: [E(24), E(24), E(24), '.....o.o.o.......o.o.o..', E(24), E(24), '..L....e...........e....', ...G3(24)],
  },
  {
    id: 'spikes', difficulty: 2, gap: 2, rise: 3,
    rows: [E(18), E(18), '.......o.o.o......', E(18), '......=====.......', E(18), '..L....^^^^.......', ...G3(18)],
  },
  {
    id: 'islands', difficulty: 3, gap: 3, rise: 3,
    rows: [
      E(27),
      '..............o............',
      '.............===...........',
      E(27),
      '........===........===.....',
      E(27),
      '..L....................e...',
      ...G3(27, [[5, 22]]),
    ],
  },
  {
    id: 'bats', difficulty: 3, gap: 2, rise: 0,
    rows: [E(20), E(20), '..........f.........', E(20), '......o......o......', E(20), '..L..............e..', ...G3(20, [[5, 6], [13, 14]])],
  },
  {
    id: 'climb', difficulty: 2, gap: 3, rise: 3,
    rows: [
      '..............o.o.o.....',
      '...............e........',
      '...........##########...',
      '...........##########...',
      '......##...##########...',
      '......##...##########...',
      '..L...##...##########...',
      ...G3(24),
    ],
  },
  {
    id: 'gauntlet', difficulty: 3, gap: 3, rise: 2,
    rows: [
      E(26),
      '...........f..............',
      E(26),
      '....o.o..........o.o......',
      '...=====........=====.....',
      E(26),
      '..L.....^^^^^^.........e..',
      ...G3(26),
    ],
  },
];

export const PLATFORMER_KIT: Kit = {
  id: 'platformer',
  name: 'Platformer',
  description: 'Run and jump through a side-scrolling level: collect coins, stomp enemies, dodge spikes and reach the exit.',
  keywords: ['platformer', 'platform', 'jump', 'mario', 'celeste', 'side-scroller', 'sidescroller', 'level', 'coins', 'adventure', 'hero'],
  params: [
    { key: 'jumpHeight', label: 'Jump height (tiles)', type: 'number', min: 3, max: 7, step: 0.1, default: 4.2, group: 'Feel', hint: 'How high a full jump goes' },
    { key: 'speed', label: 'Running speed', type: 'number', min: 90, max: 240, step: 5, default: 150, group: 'Feel' },
    { key: 'gravity', label: 'Gravity', type: 'number', min: 500, max: 1600, step: 50, default: 900, group: 'Feel', hint: 'Lower feels floaty, higher feels heavy' },
    { key: 'doubleJump', label: 'Double jump', type: 'boolean', default: false, group: 'Feel' },
    { key: 'length', label: 'Level length (screens)', type: 'number', min: 3, max: 20, step: 1, default: 8, group: 'Level' },
    { key: 'difficulty', label: 'Difficulty', type: 'number', min: 1, max: 3, step: 1, default: 2, group: 'Challenge', hint: '1 is relaxed, 3 is tricky' },
    { key: 'enemies', label: 'Enemies', type: 'choice', choices: ['none', 'few', 'some', 'lots'], default: 'some', group: 'Challenge' },
    { key: 'lives', label: 'Lives', type: 'number', min: 1, max: 9, step: 1, default: 3, group: 'Challenge' },
    { key: 'checkpoints', label: 'Checkpoints', type: 'boolean', default: true, group: 'Challenge' },
    { key: 'coins', label: 'Coins to collect', type: 'boolean', default: true, group: 'Level' },
    { key: 'time', label: 'Time of day', type: 'choice', choices: ['theme', 'day', 'dusk', 'night'], default: 'theme', group: 'Look' },
    { key: 'weather', label: 'Weather', type: 'choice', choices: ['theme', 'clear', 'rain', 'snow', 'fireflies', 'embers', 'spores', 'dust'], default: 'theme', group: 'Look' },
    { key: 'decoration', label: 'Decoration', type: 'number', min: 0, max: 1, step: 0.1, default: 0.6, group: 'Look', hint: 'How much greenery and clutter' },
  ],
};

/** How far (in tiles) the hero can jump across and up with these settings. */
export function jumpReach(p: { jumpHeight: number; speed: number; gravity: number; doubleJump?: boolean }, T = 16) {
  const h = p.jumpHeight * T;
  const tAir = 2 * Math.sqrt((2 * h) / p.gravity) * 0.9;
  const across = (p.speed * tAir) / T;
  return { across: p.doubleJump ? across * 1.6 : across, up: p.doubleJump ? p.jumpHeight * 1.7 : p.jumpHeight };
}

/** Picks the chunk sequence: always start → … → goal, only chunks the hero can clear. */
export function planPlatformer(p: ParamValues, rand: () => number): Chunk[] {
  const reach = jumpReach({ jumpHeight: Number(p.jumpHeight), speed: Number(p.speed), gravity: Number(p.gravity), doubleJump: !!p.doubleJump });
  const difficulty = Number(p.difficulty);
  const ok = (c: Chunk) => c.difficulty > 0 && c.difficulty <= difficulty && c.gap <= reach.across - 1 && c.rise <= reach.up - 0.7;
  let pool = PLATFORMER_CHUNKS.filter(ok);
  if (!pool.length) pool = PLATFORMER_CHUNKS.filter((c) => c.id === 'meadow');
  const byId = (id: string) => PLATFORMER_CHUNKS.find((c) => c.id === id)!;
  const target = Number(p.length) * 30;
  const plan: Chunk[] = [byId('start')];
  let width = plan[0]!.rows[0]!.length;
  let since = 0;
  while (width < target) {
    // Weight towards the chosen difficulty, never the same chunk twice in a row.
    const choices = pool.filter((c) => c !== plan[plan.length - 1]);
    const from = choices.length ? choices : pool;
    const weights = from.map((c) => 1 + (c.difficulty === difficulty ? 1.5 : 0));
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    let chosen = from[0]!;
    for (let i = 0; i < from.length; i++) {
      r -= weights[i]!;
      if (r <= 0) {
        chosen = from[i]!;
        break;
      }
    }
    plan.push(chosen);
    width += chosen.rows[0]!.length;
    since++;
    if (p.checkpoints && since >= 4 && width < target - 40) {
      plan.push(byId('checkpoint'));
      width += byId('checkpoint').rows[0]!.length;
      since = 0;
    }
  }
  plan.push(byId('goal'));
  return plan;
}

export function assemble(plan: Chunk[]): Level {
  const width = plan.reduce((s, c) => s + c.rows[0]!.length, 0);
  const level = new Level(width, ROWS);
  let x = 0;
  for (const c of plan) {
    level.stamp(c.rows, x, ROWS - 1);
    x += c.rows[0]!.length;
  }
  return level;
}

const ENEMY_CHANCE: Record<string, number> = { none: 0, few: 0.35, some: 0.75, lots: 1 };

export function buildPlatformer(spec: GameSpec, theme: KitTheme, p: ParamValues, encode: Encoder): ProjectFiles {
  const b = new KitBuilder(theme, spec.seed ?? 1);
  const T = b.T;
  const level = assemble(planPlatformer(p, b.rand));
  const tiles = b.tiles();
  const gravity = Number(p.gravity);
  const jump = Math.sqrt(2 * gravity * Number(p.jumpHeight) * T) * 1.08;
  const enemyChance = ENEMY_CHANCE[String(p.enemies)] ?? 0.75;
  const difficulty = Number(p.difficulty);
  const avoid = new Set<string>();
  const worldH = ROWS * T;

  b.entities.push({
    id: 'terrain',
    name: 'Terrain',
    tags: ['ground'],
    components: { Transform: { position: { x: 0, y: 0 } }, Tilemap: { tileSize: T, tiles, rows: level.terrainRows(), depth: 0 } },
  });

  let start = { x: 2 * T, y: GROUND_ROW * T };
  for (const m of level.markers()) {
    const cx = m.x * T + T / 2;
    const surface = (m.y + 1) * T;
    avoid.add(`${m.x},${m.y}`);
    switch (m.ch) {
      case 'P':
        start = { x: cx, y: surface };
        break;
      case 'o':
        if (p.coins) b.entities.push(coinEntity(b, cx, m.y * T + T / 2));
        break;
      case 'e':
        if (level.standable(m.x, m.y) && b.rand() < enemyChance) b.entities.push(walkerEntity(b, level, m.x, m.y, { speed: 26 + difficulty * 8 }));
        break;
      case 'f':
        if (b.rand() < enemyChance) b.entities.push(flyerEntity(b, cx, m.y * T + T / 2, { speed: 36 + difficulty * 8, range: 56, chase: 70 + difficulty * 15 }));
        break;
      case '^': {
        // One entity per run of spikes.
        if (level.get(m.x - 1, m.y) === '^') break;
        let n = 1;
        while (level.get(m.x + n, m.y) === '^') n++;
        b.entities.push(spikeEntity(b, m.x * T, surface, n));
        break;
      }
      case 'C':
        b.entities.push(checkpointEntity(b, cx, surface));
        break;
      case 'G':
        b.entities.push(goalEntity(b, cx, surface));
        break;
    }
  }
  if (enemyChance >= 1) {
    // "Lots": a few extra walkers on long flat stretches.
    for (let x = 20; x < level.width - 20; x += 9) {
      if (level.standable(x, GROUND_ROW - 1) && !avoid.has(`${x},${GROUND_ROW - 1}`) && b.rand() < 0.25) {
        const [a, z] = level.ledge(x, GROUND_ROW - 1);
        if (z - a >= 5) b.entities.push(walkerEntity(b, level, x, GROUND_ROW - 1, { speed: 28 + difficulty * 8 }));
      }
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
        doubleJump: !!p.doubleJump,
        killY: worldH + 48,
        dust: b.dustColor(),
        accent: b.accent(),
      },
    }),
    cameraEntity({ lookAhead: 44, deadZone: { width: 16, height: 40 } }),
    hudEntity(p.coins ? 'lives,coins' : 'lives'),
    titleEntity(spec.title),
  );

  const scene = {
    name: spec.title || 'Level 1',
    background: theme.background,
    bounds: { width: level.width * T, height: worldH },
    parallax: b.parallax(),
    environment: moodEnvironment(theme.environment, String(p.time), String(p.weather)),
    entities: b.entities,
  };
  const files = b.files;
  files['project.json'] = JSON.stringify(
    manifestFor(spec, theme, { gravity, touch: { move: 'horizontal', buttons: [{ action: 'jump', label: 'A' }] } }),
    null,
    2,
  );
  files['scenes/main.scene.json'] = JSON.stringify(scene, null, 2);
  files['scripts/player.js'] = PLAYER_JS;
  files['scripts/walker.js'] = WALKER_JS;
  files['scripts/flyer.js'] = FLYER_JS;
  files['scripts/pickup.js'] = PICKUP_JS;
  files['scripts/checkpoint.js'] = CHECKPOINT_JS;
  files['scripts/goal.js'] = GOAL_JS;
  files['scripts/hud.js'] = HUD_JS;
  files['scripts/title.js'] = TITLE_JS;
  return b.finish(encode);
}
