/** Builds a folder tree from flat project paths, folders first, then files, alphabetically. */
export interface TreeFolder {
  kind: 'folder';
  name: string;
  path: string;
  children: TreeNode[];
}
export interface TreeFile {
  kind: 'file';
  name: string;
  path: string;
}
export type TreeNode = TreeFolder | TreeFile;

export function buildTree(paths: string[]): TreeFolder {
  const root: TreeFolder = { kind: 'folder', name: '', path: '', children: [] };
  for (const path of paths) {
    const parts = path.split('/');
    let folder = root;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        folder.children.push({ kind: 'file', name: part, path });
        return;
      }
      const sub = parts.slice(0, i + 1).join('/');
      let next = folder.children.find((c): c is TreeFolder => c.kind === 'folder' && c.name === part);
      if (!next) {
        next = { kind: 'folder', name: part, path: sub, children: [] };
        folder.children.push(next);
      }
      folder = next;
    });
  }
  const sort = (f: TreeFolder) => {
    f.children.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1));
    f.children.forEach((c) => c.kind === 'folder' && sort(c));
  };
  sort(root);
  return root;
}

export type FileType = 'scene' | 'script' | 'frames' | 'image' | 'audio' | 'config' | 'json' | 'text' | 'other';

export function fileType(path: string): FileType {
  if (path.endsWith('.scene.json')) return 'scene';
  if (path.endsWith('.frames.json')) return 'frames';
  if (path === 'project.json') return 'config';
  if (/\.(js|py)$/.test(path)) return 'script';
  if (/\.(png|jpe?g|webp|gif)$/i.test(path)) return 'image';
  if (/\.(mp3|ogg|wav)$/i.test(path)) return 'audio';
  if (path.endsWith('.json')) return 'json';
  if (/\.(txt|md)$/.test(path)) return 'text';
  return 'other';
}

export const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
export const dirName = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

/** `scenes/level.scene.json` → `Level`, `scripts/player.js` → `player.js`. */
export function displayName(path: string) {
  const b = baseName(path);
  if (b.endsWith('.scene.json')) {
    const s = b.slice(0, -'.scene.json'.length);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return b;
}

export function uniquePath(path: string, taken: Record<string, unknown>): string {
  if (!(path in taken)) return path;
  const dot = path.indexOf('.', path.lastIndexOf('/') + 1);
  const stem = dot < 0 ? path : path.slice(0, dot);
  const ext = dot < 0 ? '' : path.slice(dot);
  for (let n = 2; ; n++) if (!(`${stem}-${n}${ext}` in taken)) return `${stem}-${n}${ext}`;
}

/** Reads `static props = { speed: 150, label: 'hi', on: true }` from a script without running it. */
export function readScriptProps(source: string): Record<string, number | string | boolean> {
  const m = /static\s+props\s*=\s*\{([^}]*)\}/.exec(source);
  if (!m) return {};
  const out: Record<string, number | string | boolean> = {};
  const re = /([A-Za-z_$][\w$]*)\s*:\s*(-?\d+(?:\.\d+)?|true|false|'[^']*'|"[^"]*")/g;
  for (let r = re.exec(m[1]!); r; r = re.exec(m[1]!)) {
    const raw = r[2]!;
    out[r[1]!] = raw === 'true' ? true : raw === 'false' ? false : /^['"]/.test(raw) ? raw.slice(1, -1) : Number(raw);
  }
  return out;
}
