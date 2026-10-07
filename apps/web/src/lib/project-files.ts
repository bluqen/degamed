import { createPlatformerTemplate, type Raster } from '@degamed/engine/templates';
import type { ProjectFiles } from '@degamed/shared';

/** Encodes raw pixels as a PNG data URL using a canvas. */
export function rasterToDataUrl(raster: Raster): string {
  const canvas = document.createElement('canvas');
  canvas.width = raster.width;
  canvas.height = raster.height;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height), 0, 0);
  return canvas.toDataURL('image/png');
}

export function starterProject(title?: string): ProjectFiles {
  return createPlatformerTemplate(rasterToDataUrl, title);
}

const draftKey = (projectId: string) => `degamed.draft.${projectId}`;

/**
 * Local autosave of a project's files. Cloud saving (versions in R2) replaces this once
 * storage is connected; until then work survives reloads on this device.
 */
export function loadDraft(projectId: string): ProjectFiles | null {
  try {
    const raw = localStorage.getItem(draftKey(projectId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const entries = Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === 'string');
    return entries.length ? (Object.fromEntries(entries) as ProjectFiles) : null;
  } catch {
    return null;
  }
}

export function saveDraft(projectId: string, files: ProjectFiles): boolean {
  try {
    localStorage.setItem(draftKey(projectId), JSON.stringify(files));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(projectId: string) {
  try {
    localStorage.removeItem(draftKey(projectId));
  } catch {
    // Storage blocked: nothing to clear.
  }
}

/** Files a person edits as text in the editor (scripts, scenes, config), not binary assets. */
export function isTextFile(path: string) {
  return /\.(js|py|json|txt|md)$/i.test(path);
}
