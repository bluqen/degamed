/**
 * Runner kit: the hero runs on their own and keeps speeding up. Jump gaps and enemies, slide
 * under barriers. The track is endless: hand-made chunks are stored as inactive "prefab"
 * entities and a spawner script copies them in ahead of the camera.
 */
import type { ProjectFiles } from '@degamed/shared';
import { decorate, hudEntity, KitBuilder, Level, manifestFor, moodEnvironment, titleEntity, TITLE_JS, type ParamValues } from './build';
import { cameraEntity, coinEntity, flyerEntity, heroEntity, spikeEntity, walkerEntity } from './pieces';
import { ROWS } from './platformer';
import { FLYER_JS, HUD_JS, PICKUP_JS, RUNNER_JS, SPAWNER_JS, WALKER_JS } from './scripts';
import type { Encoder, GameSpec, Kit, KitTheme } from './types';

type Json = Record<string, unknown>;

interface RunChunk {
  id: string;
  difficulty: number;
  gap: number;
  rows: string[];
}

const G3 = (w: number, holes: [number, number][] = []) => {
  const row = [...'#'.repeat(w)];
  for (const [a, b] of holes) for (let i = a; i <= b; i++) row[i] = '.';
  const s = row.join('');
  return [s, s, s];
};
const E = (w: number) => '.'.repeat(w);

/** Legend as the platformer, plus B = a barrier to slide under. */
export const RUNNER_CHUNKS: RunChunk[] = [
  { id: 'start', difficulty: 0, gap: 0, rows: [E(34), E(34), E(34), E(34), E(34), E(34), '...P.....L..............L.........', ...G3(34)] },
  { id: 'coins', difficulty: 1, gap: 0, rows: [E(18), E(18), E(18), '....o.o.o.o.o.....', E(18), E(18), '.............L....', ...G3(18)] },
  { id: 'gap', difficulty: 1, gap: 3, rows: [E(16), E(16), '......o.o.o.....', E(16), E(16), E(16), '..L.............', ...G3(16, [[6, 8]])] },
  { id: 'walker', difficulty: 1, gap: 0, rows: [E(20), E(20), E(20), '........o.o.o.......', E(20), E(20), '...........e........', ...G3(20)] },
  {
    id: 'step', difficulty: 1, gap: 0,
    rows: [E(22), E(22), '..........o.o.o.......', E(22), E(22), '.......########.......', '..L....########.......', ...G3(22)],
  },
  { id: 'barrier', difficulty: 2, gap: 0, rows: [E(16), E(16), E(16), E(16), E(16), '.......o.o......', '........B.....L.', ...G3(16)] },
  { id: 'spikes', difficulty: 2, gap: 0, rows: [E(16), E(16), '.......o.o......', E(16), E(16), E(16), '..L....^^^......', ...G3(16)] },
  {
    id: 'islands', difficulty: 2, gap: 3,
    rows: [E(26), E(26), '.........o.o.......o.o....', E(26), '........====......====....', E(26), '..........................', ...G3(26, [[5, 21]])],
  },
  { id: 'leap', difficulty: 3, gap: 5, rows: [E(16), '.......o........', '......o.o.......', '.....o...o......', E(16), E(16), E(16), ...G3(16, [[5, 9]])] },
  { id: 'combo', difficulty: 3, gap: 0, rows: [E(26), E(26), '......o.o.o...............', E(26), E(26), E(26), '..L...^^^^.........B......', ...G3(26)] },
  { id: 'bats', difficulty: 3, gap: 3, rows: [E(22), E(22), '..........f...........', E(22), '.....o.o.o.o..........', E(22), '...................L..', ...G3(22, [[8, 10]])] },
];

export const RUNNER_KIT: Kit = {
  id: 'runner',
  name: 'Endless runner',
  description: 'The hero runs by themselves and keeps getting faster: jump over gaps and enemies, slide under barriers, and see how far you get.',
  keywords: ['runner', 'endless', 'run', 'running', 'dash', 'auto', 'infinite', 'subway', 'temple', 'chase', 'escape', 'distance'],
  params: [
    { key: 'speed', label: 'Starting speed', type: 'number', min: 120, max: 260, step: 5, default: 170, group: 'Feel' },
    { key: 'maxSpeed', label: 'Top speed', type: 'number', min: 180, max: 420, step: 10, default: 300, group: 'Feel' },
    { key: 'rampUp', label: 'How fast it speeds up', type: 'number', min: 0, max: 10, step: 0.5, default: 3, group: 'Feel' },
    { key: 'jumpHeight', label: 'Jump height (tiles)', type: 'number', min: 2.5, max: 6, step: 0.1, default: 3.6, group: 'Feel' },
    { key: 'gravity', label: 'Gravity', type: 'number', min: 700, max: 1800, step: 50, default: 1000, group: 'Feel' },
    { key: 'difficulty', label: 'Difficulty', type: 'number', min: 1, max: 3, step: 1, default: 2, group: 'Challenge', hint: 'Harder obstacles appear the further you run' },
    { key: 'enemies', label: 'Enemies', type: 'choice', choices: ['none', 'few', 'some', 'lots'], default: 'some', group: 'Challenge' },
    { key: 'coins', label: 'Coins to collect', type: 'boolean', default: true, group: 'Level' },
    { key: 'time', label: 'Time of day', type: 'choice', choices: ['theme', 'day', 'dusk', 'night'], default: 'theme', group: 'Look' },
    { key: 'weather', label: 'Weather', type: 'choice', choices: ['theme', 'clear', 'rain', 'snow', 'fireflies', 'embers', 'spores', 'dust'], default: 'theme', group: 'Look' },
    { key: 'decoration', label: 'Decoration', type: 'number', min: 0, max: 1, step: 0.1, default: 0.6, group: 'Look' },
  ],
};

const ENEMY_CHANCE: Record<string, number> = { none: 0, few: 0.35, some: 0.75, lots: 1 };

export function buildRunner(spec: GameSpec, theme: KitTheme, p: ParamValues, encode: Encoder): ProjectFiles {
  const b = new KitBuilder(theme, spec.seed ?? 1);
  const T = b.T;
  const tiles = b.tiles();
  const gravity = Number(p.gravity);
  const jump = Math.sqrt(2 * gravity * Number(p.jumpHeight) * T) * 1.08;
  const enemyChance = ENEMY_CHANCE[String(p.enemies)] ?? 0.75;
  const difficulty = Number(p.difficulty);
  const hero = theme.sprites.hero;
  const heroW = hero.hitbox?.w ?? Math.round(hero.frameWidth * 0.6);
  const heroH = hero.hitbox?.h ?? Math.round(hero.frameHeight * 0.9);
  const slideH = Math.round(heroH * 0.5);
  const clearance = Math.round((heroH + slideH) / 2);
  const worldH = ROWS * T;
  // Every chunk the hero can clear at the starting speed.
  const air = 2 * Math.sqrt((2 * Number(p.jumpHeight) * T) / gravity) * 0.9;
  const across = (Number(p.speed) * air) / T;
  const usable = RUNNER_CHUNKS.filter((c) => c.difficulty === 0 || (c.difficulty <= difficulty && c.gap <= across - 1));

  let start = { x: 3 * T, y: 14 * T };
  const chunkEntity = (c: RunChunk, prefab: boolean): Json => {
    const level = new Level(c.rows[0]!.length, ROWS);
    level.stamp(c.rows, 0, ROWS - 1);
    const children: Json[] = [];
    const avoid = new Set<string>();
    for (const m of level.markers()) {
      const cx = m.x * T + T / 2;
      const surface = (m.y + 1) * T;
      avoid.add(`${m.x},${m.y}`);
      if (m.ch === 'P') start = { x: cx, y: surface };
      else if (m.ch === 'o' && p.coins) children.push(coinEntity(b, cx, m.y * T + T / 2));
      else if (m.ch === 'e' && level.standable(m.x, m.y) && b.rand() < enemyChance)
        children.push(walkerEntity(b, level, m.x, m.y, { speed: 20 + difficulty * 6 }));
      else if (m.ch === 'f' && b.rand() < enemyChance) children.push(flyerEntity(b, cx, m.y * T + T / 2, { speed: 30, range: 24, chase: 0 }));
      else if (m.ch === '^' && level.get(m.x - 1, m.y) !== '^') {
        let n = 1;
        while (level.get(m.x + n, m.y) === '^') n++;
        children.push(spikeEntity(b, m.x * T, surface, n));
      } else if (m.ch === 'B') children.push(...barrier(b, m.x * T, surface - clearance));
    }
    decorate(b, level, { density: Number(p.decoration) * 0.8, avoid, into: children });
    return {
      id: `chunk-${c.id}`,
      name: `Chunk ${c.id}`,
      tags: ['ground'],
      active: !prefab,
      components: { Transform: { position: { x: 0, y: 0 } }, Tilemap: { tileSize: T, tiles, rows: level.terrainRows(), depth: 0 } },
      children,
    };
  };

  const first = RUNNER_CHUNKS.find((c) => c.id === 'start')!;
  b.entities.push(chunkEntity(first, false));
  const prefabs = usable.filter((c) => c.difficulty > 0);
  for (const c of prefabs) b.entities.push(chunkEntity(c, true));

  b.entities.push(
    {
      id: 'spawner',
      name: 'Track spawner',
      tags: [],
      components: {
        Transform: { position: { x: 0, y: 0 } },
        Script: {
          src: 'scripts/spawner.js',
          props: {
            chunks: prefabs.map((c) => `chunk-${c.id}:${c.rows[0]!.length}:${c.difficulty}`).join(';'),
            start: first.rows[0]!.length * T,
            tile: T,
            difficulty,
            seed: spec.seed ?? 1,
          },
        },
      },
    },
    heroEntity(b, {
      x: start.x,
      y: start.y,
      script: 'scripts/runner.js',
      props: {
        speed: Number(p.speed),
        maxSpeed: Math.max(Number(p.speed), Number(p.maxSpeed)),
        rampUp: Number(p.rampUp),
        jump: Math.round(jump),
        gravity,
        killY: worldH + 48,
        dust: b.dustColor(),
        accent: b.accent(),
        width: heroW,
        height: heroH,
      },
    }),
    cameraEntity({ lookAhead: 150, deadZone: { width: 0, height: 48 }, smoothing: 0.2 }),
    hudEntity(p.coins ? 'distance,coins' : 'distance'),
    titleEntity(spec.title),
  );

  const scene = {
    name: spec.title || 'Run',
    background: theme.background,
    bounds: { width: 400000, height: worldH },
    parallax: b.parallax(),
    environment: moodEnvironment(theme.environment, String(p.time), String(p.weather)),
    entities: b.entities,
  };
  const files = b.files;
  files['project.json'] = JSON.stringify(
    manifestFor(spec, theme, {
      gravity,
      touch: { move: 'none', buttons: [{ action: 'jump', label: 'JUMP' }, { action: 'down', label: 'SLIDE' }] },
    }),
    null,
    2,
  );
  files['scenes/main.scene.json'] = JSON.stringify(scene, null, 2);
  files['scripts/runner.js'] = RUNNER_JS;
  files['scripts/spawner.js'] = SPAWNER_JS;
  files['scripts/walker.js'] = WALKER_JS;
  files['scripts/flyer.js'] = FLYER_JS;
  files['scripts/pickup.js'] = PICKUP_JS;
  files['scripts/hud.js'] = HUD_JS;
  files['scripts/title.js'] = TITLE_JS;
  return b.finish(encode);
}

/** A wall hanging down from the top of the screen that you must slide under. */
function barrier(b: KitBuilder, x: number, bottom: number): Json[] {
  const T = b.T;
  const w = 2 * T;
  const fill = b.asset('assets/tiles/fill.png', b.theme.tiles.fill);
  const capRaster = b.theme.tiles.ceiling ?? b.theme.tiles.fill;
  const cap = b.asset(`assets/tiles/${b.theme.tiles.ceiling ? 'ceiling' : 'fill'}.png`, capRaster);
  const top = -T * 2;
  const colH = bottom - T - top;
  return [
    {
      id: b.id('barrier'),
      name: 'Barrier',
      tags: ['hazard'],
      components: {
        Transform: { position: { x: x + w / 2, y: top + colH / 2 } },
        Sprite: { asset: fill, tiled: true, width: w, height: colH, depth: 1 },
        Body: { type: 'static', sensor: true, width: w - 4, height: colH },
      },
    },
    {
      id: b.id('barrier-cap'),
      name: 'Barrier edge',
      tags: ['hazard'],
      components: {
        Transform: { position: { x: x + w / 2, y: bottom - T / 2 } },
        Sprite: { asset: cap, tiled: true, width: w, height: T, depth: 1 },
        Body: { type: 'static', sensor: true, width: w - 4, height: T - 2 },
      },
    },
  ];
}
