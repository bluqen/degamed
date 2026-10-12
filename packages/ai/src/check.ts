/**
 * Quick static checks on a project before the player sees it: JSON parses, the manifest and
 * scenes match the project schema, referenced files exist, and JavaScript has no syntax errors.
 * Runtime errors come back later from the player console through `repairFromErrors`.
 */
import { ProjectManifest, Scene, SpriteFrames, type Entity, type ProjectFiles } from '@degamed/shared';

export interface Problem {
  path: string;
  message: string;
}

/** Strips ES module syntax so `new Function` can parse the rest. */
function asFunctionBody(code: string): string {
  return code
    .replace(/^\s*import\s[^;\n]*;?\s*$/gm, '')
    .replace(/^\s*export\s+default\s+/gm, '')
    .replace(/^\s*export\s+(?=(const|let|var|function|class|async)\b)/gm, '')
    .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '');
}

let canEval: boolean | undefined;

/** Syntax-checks JavaScript without running it. Returns null if fine (or if eval is blocked). */
export function jsSyntaxError(code: string): string | null {
  if (canEval === false) return null;
  try {
    // Constructing a Function parses the body but never runs it.
    new Function(asFunctionBody(code));
    canEval = true;
    return null;
  } catch (e) {
    if (e instanceof SyntaxError) return e.message;
    canEval = false; // EvalError under a strict CSP: skip the check
    return null;
  }
}

function collectRefs(value: unknown, out: Set<string>) {
  if (typeof value === 'string') {
    if (/^(assets|scripts|scenes)\/.+\.[a-z]+$/.test(value)) out.add(value);
  } else if (Array.isArray(value)) value.forEach((v) => collectRefs(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectRefs(v, out));
}

const IMPORT = /(?:\bimport\s+(?:[\s\S]*?\s+from\s+)?|\bexport\s+(?:\*|\{[\s\S]*?\})\s+from\s+)(['"])([^'"\n]+)\1/g;

function resolve(from: string, spec: string): string | null {
  const parts = from.split('/').slice(0, -1);
  for (const seg of spec.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(seg);
  }
  const path = parts.join('/');
  return path.endsWith('.js') ? path : `${path}.js`;
}

function walk(entities: Entity[], visit: (e: Entity) => void) {
  for (const e of entities) {
    visit(e);
    walk(e.children ?? [], visit);
  }
}

/**
 * The same checks the player runs before starting a game (engine runtime `parseProject` and
 * `compileScripts`), without Phaser: the manifest, the start scene, every AnimatedSprite's frames
 * file and sheet, and every script plus its imports.
 */
export function checkPlayable(files: ProjectFiles): Problem[] {
  const problems: Problem[] = [];
  const json = (path: string): unknown => {
    const text = files[path];
    if (text === undefined) throw { path, message: `Missing file ${path}` };
    try {
      return JSON.parse(text);
    } catch (e) {
      throw { path, message: `Invalid JSON: ${(e as Error).message}` };
    }
  };
  try {
    const manifest = ProjectManifest.safeParse(json('project.json'));
    if (!manifest.success) return [{ path: 'project.json', message: manifest.error.issues[0]?.message ?? 'Invalid manifest' }];
    const startScene = manifest.data.startScene;
    const scene = Scene.safeParse(json(startScene));
    if (!scene.success) {
      const issue = scene.error.issues[0];
      return [{ path: startScene, message: `${issue?.message ?? 'invalid scene'} (at ${issue?.path.join('.')})` }];
    }
    const scripts = new Set<string>();
    const frames = new Set<string>();
    walk(scene.data.entities, (e) => {
      if (e.components.Script) scripts.add(e.components.Script.src);
      if (e.components.AnimatedSprite) frames.add(e.components.AnimatedSprite.frames);
      if (e.components.Sprite && !files[e.components.Sprite.asset]?.startsWith('data:image/')) {
        problems.push({ path: e.components.Sprite.asset, message: `Image ${e.components.Sprite.asset} is missing` });
      }
    });
    for (const layer of scene.data.parallax) {
      if (!files[layer.asset]?.startsWith('data:image/')) problems.push({ path: layer.asset, message: `Background ${layer.asset} is missing` });
    }
    for (const path of frames) {
      try {
        const f = SpriteFrames.safeParse(json(path));
        if (!f.success) problems.push({ path, message: f.error.issues[0]?.message ?? 'invalid frames file' });
        else if (!files[f.data.sheet]?.startsWith('data:image/')) problems.push({ path, message: `sprite sheet ${f.data.sheet} is missing` });
      } catch (p) {
        problems.push(p as Problem);
      }
    }
    const seen = new Set<string>();
    const visit = (path: string, importer: string) => {
      if (seen.has(path)) return;
      seen.add(path);
      const code = files[path];
      if (code === undefined) return void problems.push({ path: importer, message: `Cannot find ${path}` });
      if (!path.endsWith('.js')) return void problems.push({ path, message: 'Only .js scripts can run' });
      const err = jsSyntaxError(code);
      if (err) problems.push({ path, message: `SyntaxError: ${err}` });
      for (const m of code.matchAll(IMPORT)) {
        const spec = m[2]!;
        if (spec === 'degamed') continue;
        const target = spec.startsWith('./') || spec.startsWith('../') ? resolve(path, spec) : null;
        if (!target) problems.push({ path, message: `Can't import "${spec}"` });
        else visit(target, path);
      }
    };
    for (const s of scripts) visit(s, startScene);
  } catch (p) {
    problems.push(p as Problem);
  }
  return problems;
}

export function checkProject(files: ProjectFiles): Problem[] {
  const problems: Problem[] = [];
  const manifestRaw = files['project.json'];
  if (!manifestRaw) return [{ path: 'project.json', message: 'The project has no project.json' }];
  const refs = new Set<string>();
  for (const [path, text] of Object.entries(files)) {
    if (path.endsWith('.json')) {
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch (e) {
        problems.push({ path, message: `Invalid JSON: ${(e as Error).message}` });
        continue;
      }
      if (path === 'project.json') {
        const r = ProjectManifest.safeParse(data);
        if (!r.success) problems.push({ path, message: r.error.issues[0]?.message ?? 'Invalid manifest' });
        else refs.add(r.data.startScene);
      } else if (path.endsWith('.scene.json')) {
        const r = Scene.safeParse(data);
        if (!r.success) problems.push({ path, message: `${r.error.issues[0]?.path.join('.')}: ${r.error.issues[0]?.message}` });
      }
      if (path.endsWith('.scene.json') || path.endsWith('.frames.json')) collectRefs(data, refs);
    } else if (path.endsWith('.js')) {
      const err = jsSyntaxError(text);
      if (err) problems.push({ path, message: err });
    }
  }
  for (const ref of refs) if (!(ref in files)) problems.push({ path: ref, message: `Missing file ${ref}` });
  if (problems.length) return problems;
  return checkPlayable(files);
}
