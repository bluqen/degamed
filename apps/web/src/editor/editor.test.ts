import { describe, expect, it } from 'vitest';
import type { Entity, Scene } from '@degamed/shared';
import {
  duplicateEntities,
  insertEntities,
  locate,
  moveEntity,
  nudgeOrder,
  parseScene,
  referencesTo,
  removeEntities,
  replaceReferences,
  topLevelOnly,
  uniqueId,
  worldPosition,
} from './scene-ops';
import * as H from './history';
import { buildTree, displayName, fileType, readScriptProps, uniquePath } from './file-tree';
import { matches } from './commands';
import { findProblems } from './problems';

const ent = (id: string, x = 0, y = 0, children: Entity[] = []): Entity => ({
  id,
  name: id.toUpperCase(),
  tags: [],
  active: true,
  components: { Transform: { position: { x, y }, rotation: 0, scale: { x: 1, y: 1 } } },
  children,
});

const scene = (): Scene => ({
  name: 'Test',
  parallax: [],
  entities: [ent('a', 10, 10, [ent('a1', 5, 0), ent('a2', 0, 5)]), ent('b', 100, 0), ent('c', 0, 100)],
});

describe('scene operations', () => {
  it('locates nested entities with their parent offset', () => {
    const l = locate(scene().entities, 'a2')!;
    expect(l.parent?.id).toBe('a');
    expect(l.index).toBe(1);
    expect(l.offset).toEqual({ x: 10, y: 10 });
    expect(worldPosition(scene(), 'a2')).toEqual({ x: 10, y: 15 });
  });

  it('moves an entity under a new parent without moving it in the world', () => {
    const s = moveEntity(scene(), 'b', 'a', 0);
    expect(locate(s.entities, 'b')?.parent?.id).toBe('a');
    expect(worldPosition(s, 'b')).toEqual({ x: 100, y: 0 });
    expect(s.entities.map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('refuses to move an entity into its own child', () => {
    const s0 = scene();
    expect(moveEntity(s0, 'a', 'a1', 0)).toBe(s0);
    expect(moveEntity(s0, 'a', 'a', 0)).toBe(s0);
  });

  it('reorders siblings, accounting for the removed slot', () => {
    expect(moveEntity(scene(), 'a', null, 2).entities.map((e) => e.id)).toEqual(['b', 'a', 'c']);
    expect(moveEntity(scene(), 'c', null, 0).entities.map((e) => e.id)).toEqual(['c', 'a', 'b']);
    expect(nudgeOrder(scene(), 'b', -1).entities.map((e) => e.id)).toEqual(['b', 'a', 'c']);
    expect(nudgeOrder(scene(), 'b', 1).entities.map((e) => e.id)).toEqual(['a', 'c', 'b']);
    const top = scene();
    expect(nudgeOrder(top, 'a', -1)).toBe(top);
  });

  it('duplicates with fresh ids, children included, right after the original', () => {
    const { scene: s, ids } = duplicateEntities(scene(), ['a']);
    expect(ids).toEqual(['a-2']);
    expect(s.entities.map((e) => e.id)).toEqual(['a', 'a-2', 'b', 'c']);
    expect(s.entities[1]!.children.map((e) => e.id)).toEqual(['a1-2', 'a2-2']);
  });

  it('removes subtrees and leaves untouched branches shared', () => {
    const s0 = scene();
    const s = removeEntities(s0, ['a1', 'c']);
    expect(s.entities.map((e) => e.id)).toEqual(['a', 'b']);
    expect(s.entities[0]!.children.map((e) => e.id)).toEqual(['a2']);
    expect(s.entities[1]).toBe(s0.entities[1]);
  });

  it('inserts at an index under a parent', () => {
    const s = insertEntities(scene(), [ent('z')], 'a', 1);
    expect(locate(s.entities, 'a')!.entity.children.map((e) => e.id)).toEqual(['a1', 'z', 'a2']);
  });

  it('makes unique ids and keeps only top-level picks', () => {
    expect(uniqueId('Coin', new Set(['coin', 'coin-2']))).toBe('coin-3');
    expect(uniqueId('My Hero!', new Set())).toBe('my-hero');
    expect(topLevelOnly(scene(), ['a', 'a1', 'b'])).toEqual(['a', 'b']);
  });

  it('parses scenes and reports where they are broken', () => {
    expect(parseScene(JSON.stringify(scene())).scene?.name).toBe('Test');
    expect(parseScene('{').error).toBeTruthy();
    expect(parseScene(JSON.stringify({ name: 'x', entities: [{ id: 'a' }] })).error).toMatch(/entities\.0/);
  });

  it('renames file references in JSON files only', () => {
    const files = { 'a.scene.json': '{"asset":"img/x.png"}', 'b.js': '"img/x.png"', 'img/x.png': 'data:' };
    const out = replaceReferences(files, 'img/x.png', 'img/y.png');
    expect(out['a.scene.json']).toBe('{"asset":"img/y.png"}');
    expect(out['b.js']).toBe('"img/x.png"');
    expect(referencesTo(files, 'img/x.png')).toEqual(['a.scene.json']);
  });
});

describe('history', () => {
  const f = (n: number) => ({ 'a.txt': String(n) });

  it('undoes and redoes', () => {
    let h = H.startHistory(f(0));
    h = H.commit(h, f(1), 'one');
    h = H.commit(h, f(2), 'two');
    h = H.undo(h);
    expect(H.current(h)).toEqual(f(1));
    h = H.redo(h);
    expect(H.current(h)).toEqual(f(2));
    h = H.undo(H.undo(H.undo(h)));
    expect(H.current(h)).toEqual(f(0));
  });

  it('merges edits with the same key until sealed', () => {
    let h = H.startHistory(f(0));
    h = H.commit(h, f(1), 'drag', 'k', 1000);
    h = H.commit(h, f(2), 'drag', 'k', 1100);
    expect(h.past).toHaveLength(2);
    h = H.seal(h);
    h = H.commit(h, f(3), 'drag', 'k', 1200);
    expect(h.past).toHaveLength(3);
  });

  it('jumps to a step and drops redo on a new edit', () => {
    let h = H.startHistory(f(0));
    for (let i = 1; i <= 4; i++) h = H.commit(h, f(i), `s${i}`);
    h = H.jumpTo(h, 1);
    expect(H.current(h)).toEqual(f(1));
    expect(h.future).toHaveLength(3);
    h = H.jumpTo(h, 3);
    expect(H.current(h)).toEqual(f(3));
    h = H.commit(h, f(9), 'new');
    expect(h.future).toHaveLength(0);
  });
});

describe('files', () => {
  it('builds a sorted folder tree', () => {
    const t = buildTree(['scripts/b.js', 'project.json', 'scripts/a.js', 'assets/sprites/k.png']);
    expect(t.children.map((c) => c.name)).toEqual(['assets', 'scripts', 'project.json']);
  });

  it('knows file types and nice names', () => {
    expect(fileType('scenes/main.scene.json')).toBe('scene');
    expect(fileType('assets/anims/k.frames.json')).toBe('frames');
    expect(fileType('a/b.PNG')).toBe('image');
    expect(displayName('scenes/level-2.scene.json')).toBe('Level-2');
    expect(uniquePath('a/b.frames.json', { 'a/b.frames.json': '' })).toBe('a/b-2.frames.json');
  });

  it('reads script defaults without running the script', () => {
    expect(readScriptProps(`class P { static props = { speed: 150, name: 'hi', on: true, n: -2.5 }; }`)).toEqual({ speed: 150, name: 'hi', on: true, n: -2.5 });
    expect(readScriptProps('no props here')).toEqual({});
  });
});

describe('shortcuts', () => {
  const key = (init: Partial<KeyboardEvent>) => ({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, code: '', ...init }) as KeyboardEvent;
  it('matches combos, treating Cmd as Ctrl', () => {
    expect(matches(key({ key: 'z', ctrlKey: true }), 'Ctrl+Z')).toBe(true);
    expect(matches(key({ key: 'z', metaKey: true }), 'Ctrl+Z')).toBe(true);
    expect(matches(key({ key: 'Z', ctrlKey: true, shiftKey: true }), 'Ctrl+Z')).toBe(false);
    expect(matches(key({ key: 'Z', ctrlKey: true, shiftKey: true }), 'Ctrl+Shift+Z')).toBe(true);
    expect(matches(key({ key: 'Delete' }), 'Del')).toBe(true);
    expect(matches(key({ key: 'F5' }), 'F5')).toBe(true);
    expect(matches(key({ key: 'w' }), 'W')).toBe(true);
    expect(matches(key({ key: 'w', ctrlKey: true }), 'W')).toBe(false);
  });
});

describe('problems', () => {
  it('finds missing files and duplicate ids', () => {
    const s = {
      name: 'L',
      parallax: [{ asset: 'bg.png', factor: 0 }],
      entities: [
        { ...ent('p'), components: { Sprite: { asset: 'nope.png' }, Script: { src: 'scripts/x.js' } } },
        ent('p'),
        { ...ent('cam'), components: { Camera: { follow: 'ghost' } } },
      ],
    };
    const problems = findProblems({ 'project.json': '{}', 'scenes/main.scene.json': JSON.stringify(s) }, 'scenes/main.scene.json');
    const text = problems.map((p) => p.message).join('\n');
    expect(text).toContain('share the id "p"');
    expect(text).toContain('Missing image nope.png');
    expect(text).toContain('Missing script scripts/x.js');
    expect(text).toContain('follows "ghost"');
    expect(text).toContain('bg.png is missing');
  });
});
