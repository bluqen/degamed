/**
 * Quick static checks on a project before the player sees it: JSON parses, the manifest and
 * scenes match the project schema, referenced files exist, and JavaScript has no syntax errors.
 * Runtime errors come back later from the player console through `repairFromErrors`.
 */
import { ProjectManifest, Scene, type ProjectFiles } from '@degamed/shared';

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
  return problems;
}
