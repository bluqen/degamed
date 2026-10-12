import { useMemo, useState, type ReactNode } from 'react';
import {
  ChevronRight,
  Clapperboard,
  Copy,
  CopyPlus,
  FileAudio,
  FileCode2,
  FileJson,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  Layers,
  MoreHorizontal,
  Pencil,
  Play,
  Search,
  Settings2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEd } from './state';
import { buildTree, fileType, type FileType, type TreeFolder, type TreeNode } from './file-tree';
import { deleteFile, duplicateFile, importFiles, pickFiles } from './file-actions';
import { IconButton, MenuButton, useContextMenu, type MenuItem } from './ui';

export const FILE_ICON: Record<FileType, { icon: ReactNode; color: string }> = {
  scene: { icon: <Layers size={13} />, color: '#C9BCFF' },
  script: { icon: <FileCode2 size={13} />, color: '#FBBF24' },
  frames: { icon: <Clapperboard size={13} />, color: '#22D3EE' },
  image: { icon: <FileText size={13} />, color: '#34D399' },
  audio: { icon: <FileAudio size={13} />, color: '#FF5CA8' },
  config: { icon: <Settings2 size={13} />, color: '#A3A9B8' },
  json: { icon: <FileJson size={13} />, color: '#A3A9B8' },
  text: { icon: <FileText size={13} />, color: '#A3A9B8' },
  other: { icon: <FileText size={13} />, color: '#6E7587' },
};

export function FilesDock() {
  const ed = useEd();
  const { files, selectedFile } = ed;
  const [filter, setFilter] = useState('');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string[]>([]);
  const showMenu = useContextMenu();

  const tree = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return buildTree(Object.keys(files).filter((p) => !q || p.toLowerCase().includes(q)));
  }, [files, filter]);

  const doImport = (folder?: string) =>
    pickFiles('image/png,image/jpeg,image/webp,image/gif,audio/*', async (list) => {
      setNotice(await importFiles(ed, list, folder));
    });

  const fileMenu = (path: string): MenuItem[] => {
    const type = fileType(path);
    return [
      { label: type === 'scene' ? 'Open Scene' : 'Open', onSelect: () => ed.openFile(path) },
      ...(type === 'scene'
        ? [
            { label: 'Run This Scene', icon: <Play size={13} />, onSelect: () => ed.run('scene', path) },
            {
              label: 'Make It the Start Scene',
              disabled: path === ed.startScene || !ed.manifest,
              onSelect: () =>
                ed.manifest && ed.commit({ ...files, 'project.json': JSON.stringify({ ...ed.manifest, startScene: path }, null, 2) }, 'Set start scene'),
            },
          ]
        : []),
      { type: 'separator' as const },
      { label: 'Rename…', icon: <Pencil size={13} />, shortcut: 'F2', disabled: path === 'project.json', onSelect: () => ed.setDialog({ type: 'rename-file', path }) },
      { label: 'Duplicate', icon: <CopyPlus size={13} />, disabled: path === 'project.json', onSelect: () => duplicateFile(ed, path) },
      { label: 'Copy Path', icon: <Copy size={13} />, onSelect: () => void navigator.clipboard?.writeText(path) },
      { type: 'separator' as const },
      { label: 'Delete', icon: <Trash2 size={13} />, danger: true, shortcut: 'Del', disabled: path === 'project.json', onSelect: () => deleteFile(ed, path) },
    ];
  };

  const folderMenu = (path: string): MenuItem[] => [
    { label: 'New Script…', icon: <FileCode2 size={13} />, onSelect: () => ed.setDialog({ type: 'new-script' }) },
    { label: 'New Scene…', icon: <Layers size={13} />, onSelect: () => ed.setDialog({ type: 'new-scene' }) },
    { label: 'Import Files Here…', icon: <Upload size={13} />, onSelect: () => doImport(path || undefined) },
    { type: 'separator' },
    { label: 'Collapse All', onSelect: () => setClosed(new Set(allFolders(tree))) },
    { label: 'Expand All', onSelect: () => setClosed(new Set()) },
  ];

  const render = (node: TreeNode, depth: number): ReactNode => {
    if (node.kind === 'folder') {
      const open = filter.trim() !== '' || !closed.has(node.path);
      return (
        <div key={node.path} role="group">
          <div
            role="treeitem"
            aria-expanded={open}
            tabIndex={-1}
            onClick={() =>
              setClosed((c) => {
                const n = new Set(c);
                if (n.has(node.path)) n.delete(node.path);
                else n.add(node.path);
                return n;
              })
            }
            onContextMenu={(e) => {
              e.preventDefault();
              showMenu(folderMenu(node.path), e);
            }}
            onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
            onDrop={async (e) => {
              if (!e.dataTransfer.files.length) return;
              e.preventDefault();
              e.stopPropagation();
              setNotice(await importFiles(ed, e.dataTransfer.files, node.path));
            }}
            style={{ paddingLeft: 6 + depth * 14 }}
            className="flex h-6 cursor-default items-center gap-1.5 pr-2 text-ink-2 hover:bg-surface-2"
          >
            <ChevronRight size={12} className={`text-muted ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
            <span className="flex text-muted">{open ? <FolderOpen size={13} /> : <Folder size={13} />}</span>
            <span className="truncate">{node.name}</span>
          </div>
          {open && node.children.map((c) => render(c, depth + 1))}
        </div>
      );
    }
    const type = fileType(node.path);
    const icon = FILE_ICON[type];
    const selected = selectedFile === node.path;
    const isImage = type === 'image' && files[node.path]?.startsWith('data:image/');
    const isStart = node.path === ed.startScene;
    return (
      <div
        key={node.path}
        role="treeitem"
        aria-selected={selected}
        tabIndex={selected ? 0 : -1}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-degamed-file', node.path);
          e.dataTransfer.effectAllowed = 'copy';
        }}
        onClick={() => ed.setSelectedFile(node.path)}
        onDoubleClick={() => ed.openFile(node.path)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') ed.openFile(node.path);
          if (e.key === 'F2') ed.setDialog({ type: 'rename-file', path: node.path });
          if (e.key === 'Delete') deleteFile(ed, node.path);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          ed.setSelectedFile(node.path);
          showMenu(fileMenu(node.path), e);
        }}
        title={`${node.path}${type === 'image' || type === 'frames' ? ' · drag onto the scene to place it' : type === 'script' ? ' · drag onto an entity to attach it' : ''}`}
        style={{ paddingLeft: 6 + depth * 14 + 14 }}
        className={`flex h-6 cursor-default items-center gap-1.5 pr-2 outline-none ${selected ? 'bg-brand-tint text-ink' : 'text-ink-2 hover:bg-surface-2'}`}
      >
        {isImage ? (
          <img src={files[node.path]} alt="" className="size-4 shrink-0 rounded-[2px] bg-sunken object-contain [image-rendering:pixelated]" />
        ) : (
          <span className="flex shrink-0" style={{ color: icon.color }}>
            {icon.icon}
          </span>
        )}
        <span className="truncate">{node.name}</span>
        {isStart && <span className="ml-auto shrink-0 rounded bg-brand-tint px-1 text-[10px] text-brand-ink">start</span>}
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-line px-1.5">
        <MenuButton
          label="New"
          className="flex size-7 items-center justify-center rounded text-muted hover:bg-surface-3 hover:text-ink"
          items={[
            { label: 'New Script…', icon: <FileCode2 size={13} />, onSelect: () => ed.setDialog({ type: 'new-script' }) },
            { label: 'New Scene…', icon: <Layers size={13} />, shortcut: 'Ctrl+N', onSelect: () => ed.setDialog({ type: 'new-scene' }) },
            { type: 'separator' },
            { label: 'Import Images or Audio…', icon: <Upload size={13} />, onSelect: () => doImport() },
          ]}
        >
          <FilePlus2 size={14} />
        </MenuButton>
        <label className="flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded border border-line bg-sunken px-1.5 focus-within:border-brand">
          <Search size={12} className="shrink-0 text-muted" aria-hidden="true" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter files" aria-label="Filter files" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none" />
        </label>
        <IconButton label="Import images or audio" onClick={() => doImport()}>
          <Upload size={14} />
        </IconButton>
        <MenuButton label="More" items={folderMenu('')}>
          <MoreHorizontal size={14} />
        </MenuButton>
      </div>
      {notice.length > 0 && (
        <div role="alert" className="border-b border-warn/40 bg-warn-tint px-2 py-1.5 text-[11.5px] text-warn">
          {notice.map((n) => (
            <p key={n}>{n}</p>
          ))}
          <button type="button" onClick={() => setNotice([])} className="mt-1 underline">
            Dismiss
          </button>
        </div>
      )}
      <div
        role="tree"
        aria-label="Project files"
        className="min-h-0 flex-1 overflow-auto py-1 text-[12.5px]"
        onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
        onDrop={async (e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setNotice(await importFiles(ed, e.dataTransfer.files));
        }}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            showMenu(folderMenu(''), e);
          }
        }}
      >
        {tree.children.map((c) => render(c, 0))}
        {tree.children.length === 0 && <p className="px-3 py-2 text-[12px] text-muted">No files match.</p>}
      </div>
    </div>
  );
}

function allFolders(f: TreeFolder): string[] {
  return f.children.flatMap((c) => (c.kind === 'folder' ? [c.path, ...allFolders(c)] : []));
}
