import { Scene, type Components, type Entity } from '@degamed/shared';

/**
 * Pure helpers for editing a scene's entity tree. Every function returns a new scene and
 * never mutates its input, so the undo history can keep old versions for free.
 */

export type ComponentName = keyof Components;

export function parseScene(text: string | undefined): { scene: Scene | null; error: string | null } {
  if (text === undefined) return { scene: null, error: 'File not found' };
  try {
    const r = Scene.safeParse(JSON.parse(text));
    if (r.success) return { scene: r.data, error: null };
    const issue = r.error.issues[0];
    return { scene: null, error: issue ? `${issue.path.join('.') || 'scene'}: ${issue.message}` : 'Invalid scene' };
  } catch (e) {
    return { scene: null, error: (e as Error).message };
  }
}

export const serializeScene = (scene: Scene) => JSON.stringify(scene, null, 2);

export interface Located {
  entity: Entity;
  parent: Entity | null;
  index: number;
  /** Sum of the ancestors' positions (the runtime adds parent positions to children). */
  offset: { x: number; y: number };
}

export function locate(entities: Entity[], id: string, parent: Entity | null = null, offset = { x: 0, y: 0 }): Located | null {
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i]!;
    if (e.id === id) return { entity: e, parent, index: i, offset };
    const p = e.components.Transform?.position ?? { x: 0, y: 0 };
    const found = locate(e.children, id, e, { x: offset.x + p.x, y: offset.y + p.y });
    if (found) return found;
  }
  return null;
}

export function walk(entities: Entity[], fn: (e: Entity, depth: number, parent: Entity | null) => void, depth = 0, parent: Entity | null = null) {
  for (const e of entities) {
    fn(e, depth, parent);
    walk(e.children, fn, depth + 1, e);
  }
}

export function allIds(entities: Entity[]): Set<string> {
  const ids = new Set<string>();
  walk(entities, (e) => ids.add(e.id));
  return ids;
}

/** `coin` → `coin`, or `coin-2`, `coin-3`… if taken. */
export function uniqueId(base: string, taken: Set<string>): string {
  const clean = base.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'entity';
  if (!taken.has(clean)) return clean;
  const stem = clean.replace(/-\d+$/, '');
  for (let n = 2; ; n++) if (!taken.has(`${stem}-${n}`)) return `${stem}-${n}`;
}

function mapTree(entities: Entity[], fn: (e: Entity) => Entity): Entity[] {
  return entities.map((e) => {
    const next = fn(e);
    const children = mapTree(next.children, fn);
    return children.every((c, i) => c === next.children[i]) ? next : { ...next, children };
  });
}

export function updateEntities(scene: Scene, ids: Iterable<string>, fn: (e: Entity) => Entity): Scene {
  const set = new Set(ids);
  return { ...scene, entities: mapTree(scene.entities, (e) => (set.has(e.id) ? fn(e) : e)) };
}

export function setComponent<K extends ComponentName>(e: Entity, name: K, value: Components[K] | undefined): Entity {
  const components = { ...e.components };
  if (value === undefined) delete components[name];
  else components[name] = value;
  return { ...e, components };
}

/** Removes entities (and their children). Ids inside removed subtrees are ignored. */
export function removeEntities(scene: Scene, ids: Iterable<string>): Scene {
  const set = new Set(ids);
  const prune = (list: Entity[]): Entity[] =>
    list.filter((e) => !set.has(e.id)).map((e) => {
      const children = prune(e.children);
      return children.length === e.children.length && children.every((c, i) => c === e.children[i]) ? e : { ...e, children };
    });
  return { ...scene, entities: prune(scene.entities) };
}

/** Inserts at `index` among `parentId`'s children (null = top level). Index defaults to the end. */
export function insertEntities(scene: Scene, items: Entity[], parentId: string | null, index?: number): Scene {
  const put = (list: Entity[]) => {
    const at = index === undefined ? list.length : Math.max(0, Math.min(index, list.length));
    return [...list.slice(0, at), ...items, ...list.slice(at)];
  };
  if (parentId === null) return { ...scene, entities: put(scene.entities) };
  return { ...scene, entities: mapTree(scene.entities, (e) => (e.id === parentId ? { ...e, children: put(e.children) } : e)) };
}

export function isDescendant(scene: Scene, ancestorId: string, id: string): boolean {
  const a = locate(scene.entities, ancestorId);
  return a ? locate(a.entity.children, id) !== null : false;
}

/**
 * Moves an entity under a new parent (null = top level) at `index`, keeping it in the
 * same place in the world. Refuses to move an entity into itself or its own children.
 */
export function moveEntity(scene: Scene, id: string, parentId: string | null, index: number): Scene {
  if (parentId === id || (parentId && isDescendant(scene, id, parentId))) return scene;
  const from = locate(scene.entities, id);
  if (!from) return scene;
  const sameParent = (from.parent?.id ?? null) === parentId;
  // Removing first shifts later siblings up by one.
  const target = sameParent && index > from.index ? index - 1 : index;
  let next = removeEntities(scene, [id]);
  const newOffset = parentId ? worldOffsetOfChildren(next, parentId) : { x: 0, y: 0 };
  let moved = from.entity;
  const t = moved.components.Transform;
  if (t) {
    const world = { x: from.offset.x + t.position.x, y: from.offset.y + t.position.y };
    moved = setComponent(moved, 'Transform', { ...t, position: { x: world.x - newOffset.x, y: world.y - newOffset.y } });
  }
  next = insertEntities(next, [moved], parentId, target);
  return next;
}

/** Where a parent's children are measured from (its own world position). */
export function worldOffsetOfChildren(scene: Scene, parentId: string) {
  const p = locate(scene.entities, parentId);
  if (!p) return { x: 0, y: 0 };
  const pos = p.entity.components.Transform?.position ?? { x: 0, y: 0 };
  return { x: p.offset.x + pos.x, y: p.offset.y + pos.y };
}

export function worldPosition(scene: Scene, id: string) {
  const l = locate(scene.entities, id);
  if (!l) return null;
  const p = l.entity.components.Transform?.position ?? { x: 0, y: 0 };
  return { x: l.offset.x + p.x, y: l.offset.y + p.y };
}

/** Deep copy with fresh ids for the entity and all of its children. */
export function cloneWithNewIds(e: Entity, taken: Set<string>): Entity {
  const id = uniqueId(e.id, taken);
  taken.add(id);
  return { ...structuredClone(e), id, children: e.children.map((c) => cloneWithNewIds(c, taken)) };
}

/** Duplicates each entity right after itself. Returns the new scene and the copies' ids. */
export function duplicateEntities(scene: Scene, ids: string[]): { scene: Scene; ids: string[] } {
  const taken = allIds(scene.entities);
  let next = scene;
  const created: string[] = [];
  for (const id of topLevelOnly(scene, ids)) {
    const l = locate(next.entities, id);
    if (!l) continue;
    const copy = cloneWithNewIds(l.entity, taken);
    created.push(copy.id);
    next = insertEntities(next, [copy], l.parent?.id ?? null, l.index + 1);
  }
  return { scene: next, ids: created };
}

/** Drops ids whose ancestor is also in the list (so a parent and its child aren't copied twice). */
export function topLevelOnly(scene: Scene, ids: string[]): string[] {
  return ids.filter((id) => !ids.some((other) => other !== id && isDescendant(scene, other, id)));
}

/** Moves an entity one step up or down among its siblings. */
export function nudgeOrder(scene: Scene, id: string, dir: -1 | 1): Scene {
  const l = locate(scene.entities, id);
  if (!l) return scene;
  const siblings = l.parent ? l.parent.children : scene.entities;
  const to = l.index + dir;
  if (to < 0 || to >= siblings.length) return scene;
  return moveEntity(scene, id, l.parent?.id ?? null, dir > 0 ? to + 1 : to);
}

/** Renames a file path everywhere it's referenced as a JSON string value in text files. */
export function replaceReferences(files: Record<string, string>, from: string, to: string): Record<string, string> {
  const needle = JSON.stringify(from);
  const out: Record<string, string> = {};
  for (const [path, text] of Object.entries(files)) {
    out[path] = path.endsWith('.json') && text.includes(needle) ? text.split(needle).join(JSON.stringify(to)) : text;
  }
  return out;
}

/** Files whose JSON mentions `path` (for "this file is used by…" warnings). */
export function referencesTo(files: Record<string, string>, path: string): string[] {
  const needle = JSON.stringify(path);
  return Object.entries(files)
    .filter(([p, text]) => p !== path && p.endsWith('.json') && text.includes(needle))
    .map(([p]) => p);
}

/** What kind of thing an entity is, from its components, for icons and labels. */
export function entityKind(e: Entity): 'camera' | 'text' | 'animated' | 'sprite' | 'music' | 'body' | 'empty' {
  const c = e.components;
  if (c.Camera) return 'camera';
  if (c.Text) return 'text';
  if (c.AnimatedSprite) return 'animated';
  if (c.Sprite) return 'sprite';
  if (c.MusicPlayer) return 'music';
  if (c.Body) return 'body';
  return 'empty';
}
