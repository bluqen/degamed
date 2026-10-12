import { describe, expect, it } from 'vitest';
import { Entity, ProjectManifest, Scene, SpriteFrames, findDuplicateEntityIds } from '@degamed/shared';
import { listImports } from '../scripts';
import { autotile, tileSurfaces } from '../tilemap';
import { Level } from './build';
import { caveLayout, caveLevel, CAVE_ROOMS } from './cave';
import { buildGame, getKit, KITS, listThemes, normalizeSpec, readSpec, resolveParams, SPEC_PATH } from './index';
import { assemble, jumpReach, planPlatformer, PLATFORMER_CHUNKS } from './platformer';
import { mulberry32 } from '../pixel';
import { RUNNER_CHUNKS } from './runner';

const encode = () => 'data:image/png;base64,AAAA';

function walk(list: Entity[], fn: (e: Entity) => void) {
  for (const e of list) {
    fn(e);
    walk(e.children, fn);
  }
}

describe('kits build valid projects for every theme', () => {
  for (const kit of KITS) {
    for (const theme of listThemes()) {
      it(`${kit.id} × ${theme.id}`, () => {
        const files = buildGame({ kit: kit.id, title: 'Test Game', theme: theme.id, seed: 3 }, encode);
        const manifest = ProjectManifest.parse(JSON.parse(files['project.json']!));
        const scene = Scene.parse(JSON.parse(files[manifest.startScene]!));
        expect(findDuplicateEntityIds(scene.entities)).toEqual([]);
        const all: Entity[] = [];
        walk(scene.entities, (e) => all.push(e));
        expect(all.some((e) => e.id === 'player')).toBe(true);
        expect(all.some((e) => e.components.Tilemap)).toBe(true);
        // Every referenced file exists.
        const refs = new Set<string>(scene.parallax.map((l) => l.asset));
        for (const e of all) {
          const c = e.components;
          if (c.Sprite) refs.add(c.Sprite.asset);
          if (c.AnimatedSprite) refs.add(c.AnimatedSprite.frames);
          if (c.Script) refs.add(c.Script.src);
          if (c.Tilemap) for (const t of Object.values(c.Tilemap.tiles)) refs.add(t);
        }
        for (const ref of refs) expect(files[ref], ref).toBeDefined();
        for (const path of Object.keys(files).filter((p) => p.endsWith('.frames.json'))) {
          const def = SpriteFrames.parse(JSON.parse(files[path]!));
          expect(files[def.sheet], def.sheet).toBeDefined();
        }
        for (const [path, src] of Object.entries(files)) {
          if (path.endsWith('.js')) for (const imp of listImports(src)) expect(imp, path).toBe('degamed');
        }
        expect(scene.environment).toBeDefined();
        expect(manifest.touch?.buttons.length).toBeGreaterThan(0);
        expect(readSpec(files)?.kit).toBe(kit.id);
      });
    }
  }
});

describe('specs', () => {
  it('normalises anything into a buildable spec', () => {
    const spec = normalizeSpec({ kit: 'nope', title: '', theme: 'missing', seed: -5.7, params: { jumpHeight: 99, enemies: 'swarm', junk: 1 } as never });
    expect(spec.kit).toBe('platformer');
    expect(spec.title).toBe('Platformer');
    expect(listThemes().map((t) => t.id)).toContain(spec.theme);
    expect(spec.seed).toBe(5);
    expect(spec.params!.jumpHeight).toBe(7);
    expect(spec.params!.enemies).toBe('some');
    expect('junk' in spec.params!).toBe(false);
  });

  it('round-trips through the project', () => {
    const files = buildGame({ kit: 'runner', title: 'Dash', theme: 'starter', seed: 9, params: { speed: 200 } }, encode);
    const spec = readSpec(files)!;
    expect(spec).toMatchObject({ kit: 'runner', title: 'Dash', theme: 'starter', seed: 9 });
    expect(spec.params!.speed).toBe(200);
    expect(readSpec({})).toBeNull();
    expect(readSpec({ [SPEC_PATH]: '{bad json' })).toBeNull();
  });

  it('is deterministic per seed and different across seeds', () => {
    const a = buildGame({ kit: 'platformer', title: 'A', theme: 'starter', seed: 1 }, encode)['scenes/main.scene.json'];
    const b = buildGame({ kit: 'platformer', title: 'A', theme: 'starter', seed: 1 }, encode)['scenes/main.scene.json'];
    const c = buildGame({ kit: 'platformer', title: 'A', theme: 'starter', seed: 2 }, encode)['scenes/main.scene.json'];
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('every param has a plain-English label and a valid default', () => {
    for (const kit of KITS) {
      const defaults = resolveParams(kit, {});
      for (const p of kit.params) {
        expect(p.label.length).toBeGreaterThan(3);
        expect(defaults[p.key]).toEqual(p.default);
        if (p.type === 'choice') expect(p.choices).toContain(p.default);
      }
    }
    expect(getKit('cave').id).toBe('cave');
  });
});

/** Rough reachability: standing spots linked by walking and jumping (ignores ceilings). */
function reachable(level: Level, from: [number, number], to: [number, number], reach: { across: number; up: number }, climb: Set<string> = new Set()) {
  return reachSet(level, from, reach, climb).has(to.join(','));
}

function reachSet(level: Level, from: [number, number], reach: { across: number; up: number }, climb: Set<string> = new Set()): Set<string> {
  const ok = (x: number, y: number) => level.standable(x, y) && level.get(x, y) !== '^' && !level.solid(x, y - 1);
  const seen = new Set<string>([from.join(',')]);
  const queue: [number, number][] = [from];
  const up = Math.floor(reach.up - 0.3);
  const across = Math.floor(reach.across);
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (let dy = -up; dy <= 20; dy++)
      for (let dx = -across - Math.max(0, dy); dx <= across + Math.max(0, dy); dx++) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        if (seen.has(key) || !ok(nx, ny)) continue;
        seen.add(key);
        queue.push([nx, ny]);
      }
    // Ropes: anything along a rope column is reachable from anything else on it.
    for (const r of climb) {
      const [rx, top, bottom] = r.split(',').map(Number) as [number, number, number];
      if (Math.abs(x - rx) <= 3 && y >= top - 1 && y <= bottom) {
        for (let ny = top; ny <= bottom; ny++)
          for (let nx = rx - 4; nx <= rx + 4; nx++) {
            const key = `${nx},${ny}`;
            if (!seen.has(key) && ok(nx, ny)) {
              seen.add(key);
              queue.push([nx, ny]);
            }
          }
      }
    }
  }
  return seen;
}

const find = (level: Level, ch: string) => {
  const m = level.markers().find((mm) => mm.ch === ch)!;
  return [m.x, m.y] as [number, number];
};

describe('platformer levels', () => {
  it('chunks are rectangular, 10 rows tall, and sit on solid ground at both ends', () => {
    for (const c of PLATFORMER_CHUNKS) {
      expect(c.rows.length, c.id).toBe(10);
      expect(new Set(c.rows.map((r) => r.length)).size, c.id).toBe(1);
      expect(c.rows[7]![0], c.id).toBe('#');
      expect(c.rows[7]![c.rows[7]!.length - 1], c.id).toBe('#');
    }
    for (const c of RUNNER_CHUNKS) {
      expect(c.rows.length, c.id).toBe(10);
      expect(new Set(c.rows.map((r) => r.length)).size, c.id).toBe(1);
    }
  });

  it('the goal is reachable for many seeds, including the weakest settings', () => {
    const kit = getKit('platformer');
    const settings = [
      {},
      { jumpHeight: 3, speed: 90, gravity: 1600 },
      { jumpHeight: 7, speed: 240, gravity: 500, difficulty: 3 },
      { difficulty: 3, length: 20 },
    ];
    for (const s of settings) {
      const p = resolveParams(kit, s);
      const reach = jumpReach({ jumpHeight: Number(p.jumpHeight), speed: Number(p.speed), gravity: Number(p.gravity) });
      for (let seed = 1; seed <= 12; seed++) {
        const level = assemble(planPlatformer(p, mulberry32(seed)));
        expect(reachable(level, find(level, 'P'), find(level, 'G'), reach), `seed ${seed} ${JSON.stringify(s)}`).toBe(true);
      }
    }
  });
});

describe('cave levels', () => {
  it('room interiors keep the rope column clear', () => {
    for (const room of CAVE_ROOMS) {
      expect(room.length).toBe(12);
      for (const row of room) expect(row.slice(11, 15)).not.toMatch(/[#=]/);
    }
  });

  it('every crystal spot and the exit are reachable with double jump and ropes', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const rand = mulberry32(seed);
      const layout = caveLayout(4, 3, rand);
      const { level, ropes } = caveLevel(layout, rand);
      const climb = new Set(ropes.map((r) => `${r.x},${r.top},${r.bottom}`));
      const start = find(level, 'P');
      const seen = reachSet(level, start, { across: 9, up: 6.5 }, climb);
      expect(seen.has(find(level, 'G').join(',')), `exit, seed ${seed}`).toBe(true);
      for (const c of level.markers().filter((m) => m.ch === 'c')) {
        // Crystals float above a standing spot.
        let y = c.y;
        while (!level.standable(c.x, y) && y < level.height) y++;
        expect(seen.has(`${c.x},${y}`), `crystal ${c.x},${c.y} seed ${seed}`).toBe(true);
      }
    }
  });
});

describe('autotile', () => {
  const has = () => true;
  it('picks ground on top, fill inside, edges and one-way platforms', () => {
    const roles = autotile(['......', '.####.', '.####.', '......', '.===..'], has);
    expect(roles[1]![1]).toBe('groundLeft');
    expect(roles[1]![4]).toBe('groundRight');
    expect(['ground', 'ground2', 'ground3']).toContain(roles[1]![2]);
    expect(roles[2]![1]).toBe('ceiling');
    expect(roles[4]![1]).toBe('platformLeft');
    expect(roles[4]![2]).toBe('platform');
    expect(roles[4]![3]).toBe('platformRight');
    expect(roles[0]![0]).toBeNull();
  });

  it('falls back when a theme lacks edge tiles', () => {
    const roles = autotile(['....', '####', '####', '####'], (r) => r === 'ground' || r === 'fill');
    expect(roles[1]![0]).toBe('ground');
    expect(roles[2]![0]).toBe('fill');
  });

  it('finds the surfaces rain lands on', () => {
    expect(tileSurfaces(['....', '.##.', '.##.', '=...'], 16, 100, 0)).toEqual([
      { x: 116, y: 16, width: 32, height: 16 },
      { x: 100, y: 48, width: 16, height: 16 },
    ]);
  });
});
