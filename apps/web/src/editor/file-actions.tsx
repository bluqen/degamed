import type { Ed } from './state';
import { referencesTo, replaceReferences } from './scene-ops';
import { baseName, dirName, fileType, uniquePath } from './file-tree';

/** File operations shared by the Files panel, the Art workspace and dialogs. */

export function renameFile(ed: Ed, from: string, to: string) {
  const clean = to.trim().replace(/^\/+/, '');
  if (!clean || clean === from || ed.files[clean] !== undefined) return false;
  if (from === 'project.json') return false;
  ed.commitWith((f) => {
    const next = replaceReferences(f, from, clean);
    next[clean] = next[from]!;
    delete next[from];
    return next;
  }, `Rename ${baseName(from)}`);
  if (ed.codeFile === from) ed.setCodeFile(clean);
  if (ed.selectedFile === from) ed.setSelectedFile(clean);
  if (ed.framesFile === from) ed.setFramesFile(clean);
  if (fileType(from) === 'scene') {
    if (ed.openScenes.includes(from)) ed.openScene(clean);
    ed.closeScene(from);
  }
  return true;
}

export function deleteFile(ed: Ed, path: string) {
  if (path === 'project.json') return;
  const refs = referencesTo(ed.files, path);
  const go = () => {
    ed.commitWith((f) => {
      const next = { ...f };
      delete next[path];
      return next;
    }, `Delete ${baseName(path)}`);
    if (ed.selectedFile === path) ed.setSelectedFile(null);
    if (fileType(path) === 'scene') ed.closeScene(path);
  };
  ed.setDialog({
    type: 'confirm',
    title: `Delete ${baseName(path)}?`,
    danger: true,
    confirm: 'Delete',
    body: refs.length ? (
      <>
        <p>These files still use it and will show a missing-file warning:</p>
        <ul className="mt-2 list-disc pl-5 font-mono text-[12px] text-warn">
          {refs.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="mt-2">You can undo this with Ctrl+Z.</p>
      </>
    ) : (
      <p>Nothing else uses this file. You can undo this with Ctrl+Z.</p>
    ),
    onConfirm: go,
  });
}

export function duplicateFile(ed: Ed, path: string) {
  const to = uniquePath(path, ed.files);
  ed.commitWith((f) => ({ ...f, [to]: f[path]! }), `Duplicate ${baseName(path)}`);
  ed.setSelectedFile(to);
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const MAX_BYTES = 4 * 1024 * 1024;

/** Imports images and audio from the computer into the project. Returns problems to show. */
export async function importFiles(ed: Ed, list: FileList | File[], folder?: string): Promise<string[]> {
  const problems: string[] = [];
  const added: Record<string, string> = {};
  for (const file of Array.from(list)) {
    const isImage = /^image\/(png|jpeg|webp|gif)$/.test(file.type);
    const isAudio = /^audio\//.test(file.type) || /\.(mp3|ogg|wav)$/i.test(file.name);
    if (!isImage && !isAudio) {
      problems.push(`${file.name}: only images (PNG, JPG, WebP, GIF) and audio (MP3, OGG, WAV) can be imported here`);
      continue;
    }
    if (file.size > MAX_BYTES) {
      problems.push(`${file.name} is over 4 MB. Make it smaller first (cloud storage for big files is coming).`);
      continue;
    }
    const name = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    const dir = folder ?? (isImage ? 'assets/sprites' : 'audio/uploads');
    const path = uniquePath(`${dir}/${name}`, { ...ed.files, ...added });
    added[path] = await readAsDataUrl(file);
  }
  const paths = Object.keys(added);
  if (paths.length) {
    ed.commitWith((f) => ({ ...f, ...added }), paths.length === 1 ? `Import ${baseName(paths[0]!)}` : `Import ${paths.length} files`);
    ed.setSelectedFile(paths[0]!);
  }
  return problems;
}

/** Opens the system file picker. */
export function pickFiles(accept: string, onPick: (files: FileList) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = true;
  input.onchange = () => input.files && onPick(input.files);
  input.click();
}

export function newScene(ed: Ed, name: string) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'level';
  const path = uniquePath(`scenes/${slug}.scene.json`, ed.files);
  const W = ed.manifest?.resolution.width ?? 480;
  const H = ed.manifest?.resolution.height ?? 270;
  const scene = {
    name: name.trim() || 'New Scene',
    background: '#1A1C2C',
    bounds: { width: W * 2, height: H },
    parallax: [],
    entities: [
      {
        id: 'camera',
        name: 'Camera',
        tags: [],
        active: true,
        components: { Transform: { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } }, Camera: { zoom: 1 } },
        children: [],
      },
    ],
  };
  ed.commitWith((f) => ({ ...f, [path]: JSON.stringify(scene, null, 2) }), `New scene ${scene.name}`);
  ed.openScene(path);
  return path;
}

export const SCRIPT_TEMPLATE = (className: string) => `import { Behaviour, Input, Game } from 'degamed';

// Runs on every entity this script is attached to.
export default class ${className} extends Behaviour {
  // Values here show up in Properties, where each entity can change them.
  static props = { speed: 100 };

  onStart() {
    // Called once, when the scene starts.
  }

  onUpdate(dt) {
    // Called every frame. dt is the time since the last frame, in seconds.
  }

  onCollide(other) {
    // Called when this entity touches another one.
  }
}
`;

export function newScript(ed: Ed, name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'script';
  const path = uniquePath(`scripts/${slug}.js`, ed.files);
  const className = slug.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase()).replace(/^\d/, 'S$&');
  ed.commitWith((f) => ({ ...f, [path]: SCRIPT_TEMPLATE(className) }), `New script ${baseName(path)}`);
  return path;
}

export { dirName };
