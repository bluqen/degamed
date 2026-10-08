import type { Ed, Tool, Workspace } from './state';
import { copy, cut, deleteEntities, duplicate, paste, reorder } from './actions';

/**
 * Every editor command in one list: the menus, the command palette and keyboard
 * shortcuts all read from it, so they can't drift apart.
 */
export interface Command {
  id: string;
  label: string;
  group: 'Game' | 'Edit' | 'View' | 'Run' | 'Help' | 'Scene' | 'Tools';
  shortcut?: string;
  /** Extra key combos that do the same thing. */
  alt?: string[];
  run: () => void;
  enabled?: boolean;
  checked?: boolean;
  /** Works even while typing in a text field. */
  global?: boolean;
  /** Only when the scene workspace is showing. */
  sceneOnly?: boolean;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
/** Shows Ctrl as ⌘ on Macs. */
export const keyLabel = (s: string) => (isMac ? s.replace(/Ctrl\+/g, '⌘').replace(/Alt\+/g, '⌥').replace(/Shift\+/g, '⇧') : s);

export function matches(e: KeyboardEvent, combo: string) {
  const parts = combo.split('+');
  const key = parts.pop()!;
  const want = new Set(parts);
  const ctrl = e.ctrlKey || e.metaKey;
  if (want.has('Ctrl') !== ctrl || want.has('Shift') !== e.shiftKey || want.has('Alt') !== e.altKey) return false;
  const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  const map: Record<string, string> = { Del: 'Delete', '↑': 'ArrowUp', '↓': 'ArrowDown', Esc: 'Escape', Space: ' ' };
  return k === (map[key] ?? key) || e.code === `Key${key}` || e.code === key;
}

export function buildCommands(ed: Ed): Command[] {
  const hasSel = ed.selection.length > 0;
  const ws = (w: Workspace, label: string, shortcut: string): Command => ({
    id: `workspace.${w}`,
    label: `Go to ${label}`,
    group: 'View',
    shortcut,
    checked: ed.workspace === w,
    global: true,
    run: () => ed.setWorkspace(w),
  });
  const tool = (t: Tool, label: string, shortcut: string): Command => ({
    id: `tool.${t}`,
    label: `${label} Tool`,
    group: 'Tools',
    shortcut,
    checked: ed.tool === t,
    sceneOnly: true,
    run: () => {
      ed.setTool(t);
      ed.setWorkspace('scene');
    },
  });
  return [
    { id: 'scene.new', label: 'New Scene…', group: 'Game', shortcut: 'Ctrl+N', run: () => ed.setDialog({ type: 'new-scene' }) },
    { id: 'script.new', label: 'New Script…', group: 'Game', run: () => ed.setDialog({ type: 'new-script' }) },
    { id: 'game.save', label: 'Save', group: 'Game', shortcut: 'Ctrl+S', global: true, run: () => ed.commit(ed.files, 'Save') },
    { id: 'game.settings', label: 'Game Settings…', group: 'Game', shortcut: 'Ctrl+,', global: true, run: () => ed.setDialog({ type: 'settings' }) },
    { id: 'game.input', label: 'Controls (Input Map)…', group: 'Game', run: () => ed.setDialog({ type: 'settings', section: 'input' }) },

    { id: 'edit.undo', label: 'Undo', group: 'Edit', shortcut: 'Ctrl+Z', enabled: ed.canUndo, run: ed.undo },
    { id: 'edit.redo', label: 'Redo', group: 'Edit', shortcut: 'Ctrl+Shift+Z', alt: ['Ctrl+Y'], enabled: ed.canRedo, run: ed.redo },
    { id: 'edit.cut', label: 'Cut', group: 'Edit', shortcut: 'Ctrl+X', enabled: hasSel, sceneOnly: true, run: () => cut(ed) },
    { id: 'edit.copy', label: 'Copy', group: 'Edit', shortcut: 'Ctrl+C', enabled: hasSel, sceneOnly: true, run: () => copy(ed) },
    { id: 'edit.paste', label: 'Paste', group: 'Edit', shortcut: 'Ctrl+V', enabled: !!ed.clipboard?.length, sceneOnly: true, run: () => paste(ed) },
    { id: 'edit.duplicate', label: 'Duplicate', group: 'Edit', shortcut: 'Ctrl+D', enabled: hasSel, sceneOnly: true, run: () => duplicate(ed) },
    { id: 'edit.delete', label: 'Delete', group: 'Edit', shortcut: 'Del', alt: ['Backspace'], enabled: hasSel, sceneOnly: true, run: () => deleteEntities(ed) },
    {
      id: 'edit.selectAll',
      label: 'Select All',
      group: 'Edit',
      shortcut: 'Ctrl+Shift+A',
      sceneOnly: true,
      run: () => ed.scene && ed.select(ed.scene.entities.map((e) => e.id)),
    },
    { id: 'edit.deselect', label: 'Select None', group: 'Edit', shortcut: 'Esc', sceneOnly: true, enabled: hasSel, run: () => ed.select([]) },
    {
      id: 'scene.add',
      label: 'Add Entity…',
      group: 'Scene',
      shortcut: 'Ctrl+A',
      run: () => {
        const last = ed.selection[ed.selection.length - 1] ?? null;
        ed.setDialog({ type: 'add-entity', parentId: null, afterId: last });
      },
    },
    {
      id: 'scene.moveUp',
      label: 'Move Up in List',
      group: 'Scene',
      shortcut: 'Ctrl+↑',
      enabled: ed.selection.length === 1,
      sceneOnly: true,
      run: () => ed.selection[0] && reorder(ed, ed.selection[0], -1),
    },
    {
      id: 'scene.moveDown',
      label: 'Move Down in List',
      group: 'Scene',
      shortcut: 'Ctrl+↓',
      enabled: ed.selection.length === 1,
      sceneOnly: true,
      run: () => ed.selection[0] && reorder(ed, ed.selection[0], 1),
    },

    ws('scene', 'Scene', 'Ctrl+1'),
    ws('game', 'Game', 'Ctrl+2'),
    ws('code', 'Code', 'Ctrl+3'),
    ws('art', 'Art', 'Ctrl+4'),
    tool('select', 'Select', 'Q'),
    tool('move', 'Move', 'W'),
    tool('rotate', 'Rotate', 'E'),
    tool('scale', 'Scale', 'S'),
    tool('pan', 'Pan', 'H'),
    tool('ruler', 'Measure', 'R'),
    { id: 'view.frameSel', label: 'Focus Selection', group: 'View', shortcut: 'F', sceneOnly: true, run: () => ed.requestFrame('selection') },
    { id: 'view.frameAll', label: 'Show Whole Level', group: 'View', shortcut: 'Shift+F', sceneOnly: true, run: () => ed.requestFrame('all') },
    { id: 'view.grid', label: 'Show Grid', group: 'View', shortcut: 'G', sceneOnly: true, checked: ed.view.grid, run: () => ed.setView({ grid: !ed.view.grid }) },
    { id: 'view.snap', label: 'Snap to Grid', group: 'View', shortcut: 'Shift+G', sceneOnly: true, checked: ed.view.snap, run: () => ed.setView({ snap: !ed.view.snap }) },
    { id: 'view.rulers', label: 'Show Rulers', group: 'View', checked: ed.view.rulers, run: () => ed.setView({ rulers: !ed.view.rulers }) },
    { id: 'view.left', label: 'Show Left Panels', group: 'View', checked: ed.layout.showLeft, run: () => ed.setLayout({ showLeft: !ed.layout.showLeft }) },
    { id: 'view.right', label: 'Show Properties Panel', group: 'View', checked: ed.layout.showRight, run: () => ed.setLayout({ showRight: !ed.layout.showRight }) },
    { id: 'view.bottom', label: 'Show Bottom Panel', group: 'View', shortcut: 'Ctrl+J', global: true, checked: ed.layout.showBottom, run: () => ed.setLayout({ showBottom: !ed.layout.showBottom }) },
    { id: 'view.focus', label: 'Focus Mode', group: 'View', shortcut: 'Ctrl+Shift+F', global: true, checked: ed.focusMode, run: () => ed.setFocusMode(!ed.focusMode) },
    {
      id: 'view.reset',
      label: 'Reset Panel Layout',
      group: 'View',
      run: () => ed.setLayout({ left: 264, right: 300, bottom: 200, leftSplit: 0.55, showLeft: true, showRight: true, showBottom: true }),
    },

    { id: 'run.project', label: 'Run Game', group: 'Run', shortcut: 'F5', global: true, enabled: ed.play.ready, run: () => ed.run('project') },
    { id: 'run.scene', label: 'Run This Scene', group: 'Run', shortcut: 'F6', global: true, enabled: ed.play.ready, run: () => ed.run('scene') },
    { id: 'run.pause', label: ed.running === 'paused' ? 'Resume' : 'Pause', group: 'Run', shortcut: 'F7', global: true, enabled: ed.running !== 'stopped', run: ed.togglePause },
    { id: 'run.stop', label: 'Stop', group: 'Run', shortcut: 'F8', global: true, enabled: ed.running !== 'stopped', run: ed.stop },
    { id: 'run.restart', label: 'Restart', group: 'Run', shortcut: 'Ctrl+R', global: true, enabled: ed.running !== 'stopped', run: ed.play.restart },

    { id: 'help.palette', label: 'Command Palette…', group: 'Help', shortcut: 'Ctrl+Shift+P', alt: ['Ctrl+K'], global: true, run: () => ed.setDialog({ type: 'palette' }) },
    { id: 'help.shortcuts', label: 'Keyboard Shortcuts', group: 'Help', shortcut: 'Ctrl+/', global: true, run: () => ed.setDialog({ type: 'shortcuts' }) },
  ];
}

/** Handles a keydown against the command list. Returns true if a command ran. */
export function handleShortcut(e: KeyboardEvent, commands: Command[], ed: Ed): boolean {
  const target = e.target as HTMLElement | null;
  const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || !!target.closest('.cm-editor'));
  for (const c of commands) {
    if (!c.shortcut) continue;
    if (![c.shortcut, ...(c.alt ?? [])].some((k) => matches(e, k))) continue;
    if (typing && !c.global) continue;
    if (c.sceneOnly && ed.workspace !== 'scene') continue;
    if (c.enabled === false) return false;
    e.preventDefault();
    c.run();
    return true;
  }
  return false;
}
