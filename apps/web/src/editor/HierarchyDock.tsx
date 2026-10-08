import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Entity } from '@degamed/shared';
import {
  AlertTriangle,
  Box,
  Camera,
  ChevronRight,
  Clapperboard,
  Eye,
  EyeOff,
  FileCode2,
  Image as ImageIcon,
  Layers,
  MoreHorizontal,
  Music,
  Plus,
  Search,
  Shapes,
  Type,
} from 'lucide-react';
import { useEd } from './state';
import { attachScript, entityMenu, rename, reparent, setEnabled } from './actions';
import { entityKind, locate } from './scene-ops';
import { fileType } from './file-tree';
import { entityProblems } from './problems';
import { IconButton, MenuButton, useContextMenu } from './ui';

export const KIND_ICON: Record<ReturnType<typeof entityKind>, { icon: ReactNode; color: string }> = {
  camera: { icon: <Camera size={13} />, color: '#C9BCFF' },
  text: { icon: <Type size={13} />, color: '#7DD3FC' },
  animated: { icon: <Clapperboard size={13} />, color: '#22D3EE' },
  sprite: { icon: <ImageIcon size={13} />, color: '#34D399' },
  music: { icon: <Music size={13} />, color: '#FF5CA8' },
  body: { icon: <Shapes size={13} />, color: '#FBBF24' },
  empty: { icon: <Box size={13} />, color: '#A3A9B8' },
};

interface Row {
  e: Entity;
  depth: number;
  parentId: string | null;
}

type DropAt = { id: string; where: 'before' | 'after' | 'inside' } | null;

export function HierarchyDock() {
  const ed = useEd();
  const { scene, selection, files } = ed;
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<DropAt>(null);
  const anchor = useRef<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const showMenu = useContextMenu();
  const selSet = useMemo(() => new Set(selection), [selection]);

  // Visible rows, depth-first; a filter shows matches plus their ancestors.
  const rows = useMemo(() => {
    if (!scene) return [];
    const q = filter.trim().toLowerCase();
    const out: Row[] = [];
    const matches = (e: Entity): boolean =>
      !q || e.name.toLowerCase().includes(q) || e.id.includes(q) || e.tags.some((t) => t.includes(q)) || e.children.some(matches);
    const visit = (list: Entity[], depth: number, parentId: string | null) => {
      for (const e of list) {
        if (!matches(e)) continue;
        out.push({ e, depth, parentId });
        if (q || !collapsed.has(e.id)) visit(e.children, depth + 1, e.id);
      }
    };
    visit(scene.entities, 0, null);
    return out;
  }, [scene, filter, collapsed]);

  // "Rename" from menus and F2.
  useEffect(() => {
    const onRename = (e: Event) => setRenaming((e as CustomEvent<string>).detail);
    window.addEventListener('degamed:rename', onRename);
    return () => window.removeEventListener('degamed:rename', onRename);
  }, []);

  // Keep the selected row in view.
  useEffect(() => {
    const id = selection[selection.length - 1];
    if (!id) return;
    list.current?.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selection]);

  // Expand ancestors of things selected elsewhere (e.g. clicking in the scene view).
  useEffect(() => {
    if (!scene) return;
    const open: string[] = [];
    for (const id of selection) {
      let l = locate(scene.entities, id);
      while (l?.parent) {
        if (collapsed.has(l.parent.id)) open.push(l.parent.id);
        l = locate(scene.entities, l.parent.id);
      }
    }
    if (open.length) setCollapsed((c) => new Set([...c].filter((x) => !open.includes(x))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, scene]);

  const click = (e: React.MouseEvent, id: string) => {
    if (e.shiftKey && anchor.current) {
      const ids = rows.map((r) => r.e.id);
      const a = ids.indexOf(anchor.current);
      const b = ids.indexOf(id);
      if (a >= 0 && b >= 0) {
        ed.select(ids.slice(Math.min(a, b), Math.max(a, b) + 1));
        return;
      }
    }
    if (e.ctrlKey || e.metaKey) {
      ed.select(selSet.has(id) ? selection.filter((s) => s !== id) : [...selection, id]);
    } else ed.select([id]);
    anchor.current = id;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (renaming) return;
    const ids = rows.map((r) => r.e.id);
    const cur = ids.indexOf(selection[selection.length - 1] ?? '');
    const go = (i: number) => {
      const id = ids[Math.max(0, Math.min(ids.length - 1, i))];
      if (id) {
        ed.select([id]);
        anchor.current = id;
      }
    };
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      go(cur + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      go(cur - 1);
    } else if (e.key === 'ArrowRight' && cur >= 0) {
      e.preventDefault();
      setCollapsed((c) => new Set([...c].filter((x) => x !== ids[cur])));
    } else if (e.key === 'ArrowLeft' && cur >= 0) {
      e.preventDefault();
      const row = rows[cur]!;
      if (row.e.children.length && !collapsed.has(row.e.id)) setCollapsed((c) => new Set(c).add(row.e.id));
      else if (row.parentId) go(ids.indexOf(row.parentId));
    } else if (e.key === 'F2' && selection.length === 1) {
      e.preventDefault();
      setRenaming(selection[0]!);
    }
  };

  const onDragStart = (e: React.DragEvent, id: string) => {
    const ids = selSet.has(id) ? selection : [id];
    if (!selSet.has(id)) ed.select([id]);
    e.dataTransfer.setData('application/x-degamed-entities', JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
  };

  const dropPosition = (e: React.DragEvent, row: Row): DropAt => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const f = (e.clientY - r.top) / r.height;
    return { id: row.e.id, where: f < 0.28 ? 'before' : f > 0.72 ? 'after' : 'inside' };
  };

  const onDrop = (e: React.DragEvent, row: Row | null) => {
    e.preventDefault();
    setDropAt(null);
    if (!scene) return;
    const file = e.dataTransfer.getData('application/x-degamed-file');
    if (file && row) {
      if (fileType(file) === 'script') {
        attachScript(ed, [row.e.id], file);
        ed.select([row.e.id]);
      }
      return;
    }
    const raw = e.dataTransfer.getData('application/x-degamed-entities');
    if (!raw) return;
    const ids = JSON.parse(raw) as string[];
    if (!row) return reparent(ed, ids, null, scene.entities.length);
    const pos = dropPosition(e, row);
    if (!pos || ids.includes(row.e.id)) return;
    if (pos.where === 'inside') return reparent(ed, ids, row.e.id, row.e.children.length);
    const l = locate(scene.entities, row.e.id)!;
    reparent(ed, ids, l.parent?.id ?? null, pos.where === 'before' ? l.index : l.index + 1);
  };

  const sceneName = scene?.name ?? ed.scenePath;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-[#1F222B] px-1.5">
        <IconButton label="Add entity" shortcut="Ctrl+A" onClick={() => ed.setDialog({ type: 'add-entity', parentId: null, afterId: selection[selection.length - 1] ?? null })}>
          <Plus size={15} />
        </IconButton>
        <label className="flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded border border-[#2A2E3A] bg-[#0F1015] px-1.5 focus-within:border-[#6B4EFF]">
          <Search size={12} className="shrink-0 text-muted" aria-hidden="true" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter entities" aria-label="Filter entities" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none" />
        </label>
        <IconButton
          label="Attach script"
          disabled={!selection.length}
          onClick={() => {
            const src = selection.length === 1 && scene ? locate(scene.entities, selection[0]!)?.entity.components.Script?.src : undefined;
            if (src) ed.openFile(src);
            else ed.setDialog({ type: 'new-script', attachTo: selection });
          }}
        >
          <FileCode2 size={14} />
        </IconButton>
        <MenuButton
          label="More"
          items={[
            { label: 'Expand All', onSelect: () => setCollapsed(new Set()) },
            {
              label: 'Collapse All',
              onSelect: () => setCollapsed(new Set(rows.filter((r) => r.e.children.length).map((r) => r.e.id))),
            },
            { type: 'separator' },
            { label: 'Scene Properties', onSelect: () => (ed.select([]), ed.setRightTab('properties')) },
          ]}
        >
          <MoreHorizontal size={14} />
        </MenuButton>
      </div>
      <div
        ref={list}
        role="tree"
        aria-label="Scene entities"
        aria-multiselectable="true"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="min-h-0 flex-1 overflow-auto py-1 text-[12.5px] outline-none"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDrop(e, null)}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            showMenu([{ label: 'Add Entity…', icon: <Plus size={13} />, shortcut: 'Ctrl+A', onSelect: () => ed.setDialog({ type: 'add-entity', parentId: null, afterId: null }) }], e);
          }
        }}
      >
        <button
          type="button"
          onClick={() => ed.select([])}
          className={`flex h-6 w-full items-center gap-1.5 px-2 text-left ${selection.length === 0 ? 'bg-[#2B2550]/70 text-white' : 'text-ink hover:bg-[#1C1F28]'}`}
        >
          <Layers size={13} className="text-[#C9BCFF]" aria-hidden="true" />
          <span className="truncate font-medium">{sceneName}</span>
          <span className="ml-auto text-[11px] text-[#6E7587]">{rows.length}</span>
        </button>
        {rows.map((row) => {
          const { e } = row;
          const kind = KIND_ICON[entityKind(e)];
          const selected = selSet.has(e.id);
          const problems = entityProblems(e, files);
          const d = dropAt?.id === e.id ? dropAt.where : null;
          return (
            <div
              key={e.id}
              data-id={e.id}
              role="treeitem"
              aria-selected={selected}
              aria-expanded={e.children.length ? !collapsed.has(e.id) : undefined}
              draggable={renaming !== e.id}
              onDragStart={(ev) => onDragStart(ev, e.id)}
              onDragOver={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                setDropAt(dropPosition(ev, row));
              }}
              onDragLeave={() => setDropAt(null)}
              onDrop={(ev) => {
                ev.stopPropagation();
                onDrop(ev, row);
              }}
              onClick={(ev) => click(ev, e.id)}
              onDoubleClick={() => setRenaming(e.id)}
              onContextMenu={(ev) => {
                ev.preventDefault();
                const ids = selSet.has(e.id) ? selection : [e.id];
                if (!selSet.has(e.id)) ed.select([e.id]);
                showMenu(entityMenu(ed, ids), ev);
              }}
              style={{ paddingLeft: 6 + (row.depth + 1) * 14 }}
              className={`group relative flex h-6 cursor-default items-center gap-1.5 pr-1.5 ${
                selected ? 'bg-[#2B2550] text-white' : 'text-ink-2 hover:bg-[#1C1F28]'
              } ${d === 'inside' ? 'ring-1 ring-[#7C5CFF] ring-inset' : ''}`}
            >
              {d === 'before' && <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[#7C5CFF]" />}
              {d === 'after' && <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[#7C5CFF]" />}
              <button
                type="button"
                aria-label={collapsed.has(e.id) ? 'Expand' : 'Collapse'}
                tabIndex={-1}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setCollapsed((c) => {
                    const n = new Set(c);
                    if (n.has(e.id)) n.delete(e.id);
                    else n.add(e.id);
                    return n;
                  });
                }}
                className={`-ml-4 flex size-3.5 items-center justify-center text-muted ${e.children.length ? '' : 'invisible'}`}
              >
                <ChevronRight size={12} className={collapsed.has(e.id) ? '' : 'rotate-90'} />
              </button>
              <span className="flex shrink-0" style={{ color: kind.color, opacity: e.active ? 1 : 0.45 }}>
                {kind.icon}
              </span>
              {renaming === e.id ? (
                <input
                  autoFocus
                  defaultValue={e.name}
                  aria-label="New name"
                  onFocus={(ev) => ev.currentTarget.select()}
                  onClick={(ev) => ev.stopPropagation()}
                  onBlur={(ev) => {
                    rename(ed, e.id, ev.currentTarget.value);
                    setRenaming(null);
                  }}
                  onKeyDown={(ev) => {
                    ev.stopPropagation();
                    if (ev.key === 'Enter') ev.currentTarget.blur();
                    if (ev.key === 'Escape') setRenaming(null);
                  }}
                  className="h-5 min-w-0 flex-1 rounded border border-[#6B4EFF] bg-[#0F1015] px-1 text-[12px] text-white outline-none"
                />
              ) : (
                <span className={`min-w-0 flex-1 truncate ${e.active ? '' : 'text-[#6E7587] line-through decoration-[#6E7587]/50'}`}>{e.name}</span>
              )}
              {problems.length > 0 && (
                <span title={problems.join('\n')} className="flex text-warn">
                  <AlertTriangle size={12} aria-label={problems.join('. ')} />
                </span>
              )}
              {e.components.Script && (
                <button
                  type="button"
                  tabIndex={-1}
                  title={`Open ${e.components.Script.src}`}
                  aria-label={`Open script ${e.components.Script.src}`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    ed.openFile(e.components.Script!.src);
                  }}
                  className="flex text-[#8C93A5] hover:text-white"
                >
                  <FileCode2 size={12} />
                </button>
              )}
              <button
                type="button"
                tabIndex={-1}
                aria-label={e.active ? `Disable ${e.name}` : `Enable ${e.name}`}
                title={e.active ? 'Enabled: click to switch off' : 'Disabled: click to switch on'}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setEnabled(ed, [e.id], !e.active);
                }}
                className={`flex ${e.active ? 'text-[#6E7587] opacity-0 group-hover:opacity-100 hover:text-white' : 'text-[#8C93A5]'}`}
              >
                {e.active ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
            </div>
          );
        })}
        {scene && rows.length === 0 && (
          <p className="px-3 py-3 text-[12px] text-muted">{filter ? 'No entities match.' : 'Empty scene. Press Ctrl+A to add an entity.'}</p>
        )}
      </div>
    </div>
  );
}
