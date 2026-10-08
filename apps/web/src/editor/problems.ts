import { findDuplicateEntityIds, type Entity } from '@degamed/shared';
import { parseScene } from './scene-ops';
import { fileType } from './file-tree';

/** Things in an entity that point at files that don't exist. */
export function entityProblems(e: Entity, files: Record<string, string>): string[] {
  const c = e.components;
  const out: string[] = [];
  if (c.Sprite && !files[c.Sprite.asset]) out.push(`Missing image ${c.Sprite.asset || '(none chosen)'}`);
  if (c.AnimatedSprite && !files[c.AnimatedSprite.frames]) out.push(`Missing animation file ${c.AnimatedSprite.frames}`);
  if (c.Script && !files[c.Script.src]) out.push(`Missing script ${c.Script.src}`);
  if (c.Body && !c.Sprite && !c.AnimatedSprite && !c.Text) out.push('Has a body but nothing to give it a size: add a Sprite');
  return out;
}

export interface Problem {
  level: 'error' | 'warn';
  message: string;
  file: string;
  entityId?: string;
}

/** Everything wrong with the project that can be found without running it. */
export function findProblems(files: Record<string, string>, startScene: string): Problem[] {
  const out: Problem[] = [];
  if (files['project.json'] === undefined) out.push({ level: 'error', message: 'project.json is missing', file: 'project.json' });
  if (files[startScene] === undefined) out.push({ level: 'error', message: `The start scene ${startScene} doesn't exist`, file: 'project.json' });
  for (const path of Object.keys(files).filter((p) => fileType(p) === 'scene')) {
    const { scene, error } = parseScene(files[path]);
    if (!scene) {
      out.push({ level: 'error', message: error ?? 'Invalid scene', file: path });
      continue;
    }
    for (const id of findDuplicateEntityIds(scene.entities)) out.push({ level: 'error', message: `Two entities share the id "${id}"`, file: path, entityId: id });
    const ids = new Set<string>();
    const visit = (list: Entity[]) =>
      list.forEach((e) => {
        ids.add(e.id);
        for (const m of entityProblems(e, files)) out.push({ level: m.startsWith('Has a body') ? 'warn' : 'error', message: `${e.name}: ${m}`, file: path, entityId: e.id });
        visit(e.children);
      });
    visit(scene.entities);
    const cameraFollow = (list: Entity[]): void =>
      list.forEach((e) => {
        const f = e.components.Camera?.follow;
        if (f && !ids.has(f)) out.push({ level: 'warn', message: `${e.name}: follows "${f}", which isn't in this scene`, file: path, entityId: e.id });
        cameraFollow(e.children);
      });
    cameraFollow(scene.entities);
    for (const l of scene.parallax) if (!files[l.asset]) out.push({ level: 'error', message: `Background layer image ${l.asset} is missing`, file: path });
  }
  for (const path of Object.keys(files).filter((p) => fileType(p) === 'frames')) {
    try {
      const def = JSON.parse(files[path]!) as { sheet?: string };
      if (def.sheet && !files[def.sheet]) out.push({ level: 'error', message: `Sprite sheet ${def.sheet} is missing`, file: path });
    } catch (e) {
      out.push({ level: 'error', message: `Not valid JSON: ${(e as Error).message}`, file: path });
    }
  }
  return out;
}

