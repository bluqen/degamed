import type { Entity, Scene } from '@degamed/shared';
import {
  ArrowDown,
  ArrowUp,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Eye,
  FileCode2,
  Focus,
  CornerLeftUp,
  Pencil,
  Plus,
  Scissors,
  Trash2,
} from 'lucide-react';
import type { MenuItem } from './ui';
import type { Ed } from './state';
import { PRESETS, presetContext, type Preset } from './presets';
import {
  allIds,
  cloneWithNewIds,
  duplicateEntities,
  insertEntities,
  locate,
  moveEntity,
  nudgeOrder,
  removeEntities,
  setComponent,
  topLevelOnly,
  uniqueId,
  updateEntities,
  worldOffsetOfChildren,
} from './scene-ops';
import { fileType } from './file-tree';

/** Shared editing actions used by the hierarchy, the scene view, menus and shortcuts. */

export function nameOf(scene: Scene | null, id: string) {
  return (scene && locate(scene.entities, id)?.entity.name) ?? id;
}

function describe(ed: Ed, ids: string[]) {
  return ids.length === 1 ? nameOf(ed.scene, ids[0]!) : `${ids.length} entities`;
}

export function deleteEntities(ed: Ed, ids = ed.selection) {
  if (!ids.length) return;
  ed.editScene((s) => removeEntities(s, ids), `Delete ${describe(ed, ids)}`);
  ed.select([]);
}

export function duplicate(ed: Ed, ids = ed.selection) {
  if (!ids.length || !ed.scene) return;
  const { ids: created } = duplicateEntities(ed.scene, ids);
  ed.editScene((s) => duplicateEntities(s, ids).scene, `Duplicate ${describe(ed, ids)}`);
  ed.select(created);
}

export function copy(ed: Ed, ids = ed.selection) {
  if (!ed.scene || !ids.length) return;
  const items = topLevelOnly(ed.scene, ids)
    .map((id) => locate(ed.scene!.entities, id))
    .filter((l): l is NonNullable<typeof l> => !!l)
    .map((l) => {
      // Store world positions so pasting elsewhere keeps the layout.
      const t = l.entity.components.Transform;
      return t ? setComponent(l.entity, 'Transform', { ...t, position: { x: l.offset.x + t.position.x, y: l.offset.y + t.position.y } }) : l.entity;
    });
  ed.setClipboard(structuredClone(items));
}

export function cut(ed: Ed) {
  copy(ed);
  deleteEntities(ed);
}

/** Pastes after the selection (or at `at`, keeping the copied layout around that point). */
export function paste(ed: Ed, at?: { x: number; y: number }) {
  const clip = ed.clipboard;
  if (!clip?.length || !ed.scene) return;
  const taken = allIds(ed.scene.entities);
  const anchor = clip[0]!.components.Transform?.position;
  const shift = at && anchor ? { x: Math.round(at.x - anchor.x), y: Math.round(at.y - anchor.y) } : { x: 0, y: 0 };
  const after = ed.selection.length ? locate(ed.scene.entities, ed.selection[ed.selection.length - 1]!) : null;
  const parentId = after?.parent?.id ?? null;
  const offset = parentId ? worldOffsetOfChildren(ed.scene, parentId) : { x: 0, y: 0 };
  const items = clip.map((e) => {
    const c = cloneWithNewIds(e, taken);
    const t = c.components.Transform;
    return t ? setComponent(c, 'Transform', { ...t, position: { x: t.position.x + shift.x - offset.x, y: t.position.y + shift.y - offset.y } }) : c;
  });
  ed.editScene((s) => insertEntities(s, items, parentId, after ? after.index + 1 : undefined), `Paste ${items.length === 1 ? items[0]!.name : `${items.length} entities`}`);
  ed.select(items.map((e) => e.id));
}

export function rename(ed: Ed, id: string, name: string) {
  const clean = name.trim().slice(0, 60);
  if (!clean) return;
  ed.editScene((s) => updateEntities(s, [id], (e) => (e.name === clean ? e : { ...e, name: clean })), `Rename to ${clean}`);
}

export function setEnabled(ed: Ed, ids: string[], active: boolean) {
  ed.editScene((s) => updateEntities(s, ids, (e) => ({ ...e, active })), `${active ? 'Enable' : 'Disable'} ${describe(ed, ids)}`);
}

export function reorder(ed: Ed, id: string, dir: -1 | 1) {
  ed.editScene((s) => nudgeOrder(s, id, dir), `Move ${nameOf(ed.scene, id)} ${dir < 0 ? 'up' : 'down'}`);
}

export function unparent(ed: Ed, id: string) {
  if (!ed.scene) return;
  const l = locate(ed.scene.entities, id);
  if (!l?.parent) return;
  const parentLoc = locate(ed.scene.entities, l.parent.id)!;
  ed.editScene((s) => moveEntity(s, id, parentLoc.parent?.id ?? null, parentLoc.index + 1), `Unparent ${l.entity.name}`);
}

export function reparent(ed: Ed, ids: string[], parentId: string | null, index: number) {
  if (!ed.scene) return;
  const order = topLevelOnly(ed.scene, ids);
  ed.editScene(
    (s) => {
      let next = s;
      // Insert in reverse so they end up in their original order at `index`.
      for (const id of [...order].reverse()) next = moveEntity(next, id, parentId, index);
      return next;
    },
    `Move ${describe(ed, order)}`,
  );
}

/** Creates an entity from a preset as a child of `parentId` (null = top level) after `afterId`. */
export function addFromPreset(ed: Ed, preset: Preset, opts: { parentId: string | null; afterId: string | null; at?: { x: number; y: number } }) {
  if (!ed.scene) return;
  const scene = ed.scene;
  const offset = opts.parentId ? worldOffsetOfChildren(scene, opts.parentId) : { x: 0, y: 0 };
  const at = opts.at ?? ed.viewCenter.current;
  const ctx = presetContext(ed.files, { x: at.x - offset.x, y: at.y - offset.y });
  const id = uniqueId(preset.tags?.[0] ?? preset.id, allIds(scene.entities));
  const entity: Entity = { id, name: preset.name, tags: preset.tags ?? [], active: true, components: preset.components(ctx), children: [] };
  let index: number | undefined;
  if (opts.afterId) {
    const l = locate(scene.entities, opts.afterId);
    if (l && (l.parent?.id ?? null) === opts.parentId) index = l.index + 1;
  }
  ed.editScene((s) => insertEntities(s, [entity], opts.parentId, index), `Add ${preset.name}`);
  ed.select([id]);
  rememberPreset(preset.id);
}

/** Makes a Sprite or Animated Sprite entity from a dragged-in file. */
export function addFromFile(ed: Ed, path: string, at: { x: number; y: number }) {
  if (!ed.scene) return;
  const type = fileType(path);
  const base = path.slice(path.lastIndexOf('/') + 1).replace(/(\.frames)?\.\w+$/, '').replace(/-sheet$/, '');
  const id = uniqueId(base, allIds(ed.scene.entities));
  const name = base.charAt(0).toUpperCase() + base.slice(1);
  const position = { x: Math.round(at.x), y: Math.round(at.y) };
  const Transform = { position, rotation: 0, scale: { x: 1, y: 1 } };
  let entity: Entity | null = null;
  if (type === 'image') entity = { id, name, tags: [], active: true, children: [], components: { Transform, Sprite: { asset: path, tiled: false, flipX: false, depth: 0 } } };
  if (type === 'frames')
    entity = { id, name, tags: [], active: true, children: [], components: { Transform, AnimatedSprite: { frames: path, playing: true, auto: false, flipX: false, depth: 2 } } };
  if (!entity) return;
  const e = entity;
  ed.editScene((s) => insertEntities(s, [e], null), `Add ${name}`);
  ed.select([id]);
}

export function attachScript(ed: Ed, ids: string[], src: string) {
  ed.editScene(
    (s) => updateEntities(s, ids, (e) => setComponent(e, 'Script', { src, props: e.components.Script?.props ?? {} })),
    `Attach ${src.slice(src.lastIndexOf('/') + 1)}`,
  );
}

const RECENT_KEY = 'degamed.editor.recentPresets';
export function recentPresets(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && PRESETS.some((p) => p.id === x)) : [];
  } catch {
    return [];
  }
}
function rememberPreset(id: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recentPresets().filter((x) => x !== id)].slice(0, 6)));
  } catch {
    // Storage blocked.
  }
}

/** Right-click menu for entities (hierarchy rows and the scene view). */
export function entityMenu(ed: Ed, ids: string[], at?: { x: number; y: number }): MenuItem[] {
  const one = ids.length === 1 ? ids[0]! : null;
  const loc = one && ed.scene ? locate(ed.scene.entities, one) : null;
  const script = loc?.entity.components.Script?.src;
  const allEnabled = ids.every((id) => (ed.scene ? locate(ed.scene.entities, id)?.entity.active : true));
  return [
    { label: 'Add Child Entity…', icon: <Plus size={13} />, shortcut: 'Ctrl+A', disabled: !one, onSelect: () => ed.setDialog({ type: 'add-entity', parentId: one, afterId: null }) },
    { label: 'Rename', icon: <Pencil size={13} />, shortcut: 'F2', disabled: !one, onSelect: () => window.dispatchEvent(new CustomEvent('degamed:rename', { detail: one })) },
    { type: 'separator' },
    { label: 'Cut', icon: <Scissors size={13} />, shortcut: 'Ctrl+X', onSelect: () => cut(ed) },
    { label: 'Copy', icon: <Copy size={13} />, shortcut: 'Ctrl+C', onSelect: () => copy(ed, ids) },
    { label: 'Paste', icon: <ClipboardPaste size={13} />, shortcut: 'Ctrl+V', disabled: !ed.clipboard?.length, onSelect: () => paste(ed, at) },
    { label: 'Duplicate', icon: <CopyPlus size={13} />, shortcut: 'Ctrl+D', onSelect: () => duplicate(ed, ids) },
    { type: 'separator' },
    { label: 'Move Up', icon: <ArrowUp size={13} />, shortcut: 'Ctrl+↑', disabled: !one, onSelect: () => one && reorder(ed, one, -1) },
    { label: 'Move Down', icon: <ArrowDown size={13} />, shortcut: 'Ctrl+↓', disabled: !one, onSelect: () => one && reorder(ed, one, 1) },
    { label: 'Move Out of Parent', icon: <CornerLeftUp size={13} />, disabled: !loc?.parent, onSelect: () => one && unparent(ed, one) },
    { type: 'separator' },
    { label: script ? 'Open Script' : 'Attach Script…', icon: <FileCode2 size={13} />, onSelect: () => (script ? ed.openFile(script) : ed.setDialog({ type: 'new-script', attachTo: ids })) },
    { label: allEnabled ? 'Disable' : 'Enable', icon: <Eye size={13} />, onSelect: () => setEnabled(ed, ids, !allEnabled) },
    { label: 'Focus in View', icon: <Focus size={13} />, shortcut: 'F', onSelect: () => ed.requestFrame('selection') },
    { type: 'separator' },
    { label: 'Delete', icon: <Trash2 size={13} />, shortcut: 'Del', danger: true, onSelect: () => deleteEntities(ed, ids) },
  ];
}
