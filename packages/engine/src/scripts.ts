/**
 * Loads a project's JavaScript Behaviour files as real ES modules without a bundler:
 * each file becomes a blob: module, with `import … from 'degamed'` and relative imports
 * rewritten to the right blob URLs. (esbuild-wasm replaces this once TypeScript arrives.)
 */

export class ScriptError extends Error {
  constructor(
    message: string,
    readonly file: string,
  ) {
    super(message);
    this.name = 'ScriptError';
  }
}

const STATIC_IMPORT = /(\bimport\s+(?:[\s\S]*?\s+from\s+)?|\bexport\s+(?:\*|\{[\s\S]*?\})\s+from\s+)(['"])([^'"\n]+)\2/g;

/** Resolves `./x.js` / `../lib/y.js` against the importing file's path. */
export function resolvePath(from: string, specifier: string): string {
  const parts = from.split('/').slice(0, -1);
  for (const seg of specifier.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') {
      if (!parts.length) throw new Error(`Import "${specifier}" goes outside the project`);
      parts.pop();
    } else parts.push(seg);
  }
  return parts.join('/');
}

/** Lists the specifiers a module imports (static imports and re-exports only). */
export function listImports(source: string): string[] {
  return [...source.matchAll(STATIC_IMPORT)].map((m) => m[3]!);
}

export function rewriteImports(source: string, file: string, resolve: (specifier: string) => string): string {
  return source.replace(STATIC_IMPORT, (_all, head: string, quote: string, spec: string) => `${head}${quote}${resolve(spec)}${quote}`);
}

/**
 * Compiles every script reachable from `entries` and returns path → module URL.
 * `degamedUrl` is the module that exposes the engine API. `makeUrl` is injectable for tests.
 */
export function compileScripts(
  files: Record<string, string>,
  entries: string[],
  degamedUrl: string,
  makeUrl: (code: string) => string = (code) => URL.createObjectURL(new Blob([code], { type: 'text/javascript' })),
): Map<string, string> {
  const urls = new Map<string, string>();
  const visiting = new Set<string>();

  const visit = (path: string, importer?: string): string => {
    const done = urls.get(path);
    if (done) return done;
    if (visiting.has(path)) throw new ScriptError(`Circular import involving ${path}`, importer ?? path);
    const source = files[path];
    if (source === undefined) throw new ScriptError(`Cannot find ${path}`, importer ?? path);
    if (!path.endsWith('.js')) throw new ScriptError(`Only .js scripts can run here (got ${path})`, importer ?? path);
    visiting.add(path);
    const code = rewriteImports(source, path, (spec) => {
      if (spec === 'degamed') return degamedUrl;
      if (spec.startsWith('./') || spec.startsWith('../')) {
        let target: string;
        try {
          target = resolvePath(path, spec);
        } catch (e) {
          throw new ScriptError((e as Error).message, path);
        }
        return visit(target.endsWith('.js') ? target : `${target}.js`, path);
      }
      throw new ScriptError(`Can't import "${spec}". Use 'degamed' or a relative path like './enemy.js'.`, path);
    });
    visiting.delete(path);
    const url = makeUrl(`${code}\n//# sourceURL=degamed://${path}`);
    urls.set(path, url);
    return url;
  };

  for (const entry of entries) visit(entry);
  return urls;
}

/** Source of the `degamed` module: re-exports the API the runtime puts on globalThis. */
export const DEGAMED_MODULE_SOURCE = `const d = globalThis.__degamed;
export const { Behaviour, Input, Key, Game, kit } = d;
export default d;
`;
