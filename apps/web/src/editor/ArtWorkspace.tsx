import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Music, Pencil, PlusSquare, Search, Sparkles, Trash2, Upload } from 'lucide-react';
import { useEd } from './state';
import { fileType } from './file-tree';
import { deleteFile, importFiles, pickFiles } from './file-actions';
import { addFromFile } from './actions';
import { referencesTo } from './scene-ops';
import { Btn } from './ui';

/** Browse, preview and import the project's images and sounds. */
export function ArtWorkspace() {
  const ed = useEd();
  const [q, setQ] = useState('');
  const [zoom, setZoom] = useState<'fit' | 1 | 2 | 4 | 8>('fit');
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [notice, setNotice] = useState<string[]>([]);
  const assets = useMemo(
    () =>
      Object.keys(ed.files)
        .filter((p) => fileType(p) === 'image' || fileType(p) === 'audio')
        .filter((p) => !q || p.toLowerCase().includes(q.toLowerCase()))
        .sort(),
    [ed.files, q],
  );
  const selected = ed.selectedFile && assets.includes(ed.selectedFile) ? ed.selectedFile : assets[0];
  const src = selected ? ed.files[selected] : undefined;
  const isImage = selected ? fileType(selected) === 'image' : false;
  const users = selected ? referencesTo(ed.files, selected) : [];

  useEffect(() => {
    setDims(null);
    if (!src || !isImage) return;
    const img = new Image();
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src, isImage]);

  const doImport = () => pickFiles('image/png,image/jpeg,image/webp,image/gif,audio/*', async (l) => setNotice(await importFiles(ed, l)));

  const groups = new Map<string, string[]>();
  for (const p of assets) {
    const dir = p.slice(0, p.lastIndexOf('/')) || '(root)';
    groups.set(dir, [...(groups.get(dir) ?? []), p]);
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-[#1F222B] bg-[#13151B] px-2">
          <label className="flex h-6 w-56 items-center gap-1.5 rounded border border-[#2A2E3A] bg-[#0F1015] px-1.5 focus-within:border-[#6B4EFF]">
            <Search size={12} className="text-muted" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find art or sound" aria-label="Find art or sound" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none" />
          </label>
          <span className="ml-auto" />
          <Btn onClick={doImport}>
            <Upload size={13} /> Import
          </Btn>
          <Link to="/art" className="inline-flex h-7 items-center gap-1.5 rounded bg-[#6B4EFF] px-3 text-[12.5px] font-medium text-white hover:bg-[#7C61FF]">
            <Sparkles size={13} /> Generate with AI
          </Link>
        </div>
        {notice.length > 0 && (
          <div role="alert" className="border-b border-[#3A2A10] bg-[#241C0E] px-3 py-1.5 text-[12px] text-warn">
            {notice.join(' · ')}
          </div>
        )}
        <div
          className="min-h-0 flex-1 overflow-auto p-3"
          onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
          onDrop={async (e) => {
            if (!e.dataTransfer.files.length) return;
            e.preventDefault();
            setNotice(await importFiles(ed, e.dataTransfer.files));
          }}
        >
          {[...groups].map(([dir, list]) => (
            <section key={dir} className="mb-4">
              <h3 className="mb-2 font-mono text-[11px] text-[#6E7587]">{dir}/</h3>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
                {list.map((p) => (
                  <li key={p}>
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('application/x-degamed-file', p)}
                      onClick={() => ed.setSelectedFile(p)}
                      onDoubleClick={() => fileType(p) === 'image' && (addFromFile(ed, p, ed.viewCenter.current), ed.setWorkspace('scene'))}
                      className={`flex w-full flex-col items-center gap-1.5 rounded-md border p-2 ${p === selected ? 'border-[#6B4EFF] bg-[#1E1A3A]' : 'border-[#232734] bg-[#121419] hover:border-[#3A3F4E]'}`}
                    >
                      <span className="flex h-16 w-full items-center justify-center rounded" style={{ background: 'repeating-conic-gradient(#1C1F27 0% 25%, #15171D 0% 50%) 50% / 10px 10px' }}>
                        {fileType(p) === 'image' ? (
                          <img src={ed.files[p]} alt="" className="max-h-14 max-w-[88px] object-contain [image-rendering:pixelated]" />
                        ) : (
                          <Music size={22} className="text-pink" />
                        )}
                      </span>
                      <span className="w-full truncate text-center text-[11.5px] text-ink-2">{p.slice(p.lastIndexOf('/') + 1)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {assets.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted">
              <p>No art yet. Import pictures or sounds, or make some with AI.</p>
              <p className="text-[12px]">You can also drop files from your computer anywhere here.</p>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <aside className="flex w-[340px] shrink-0 flex-col border-l border-[#1F222B] bg-[#121419]">
          <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[#1F222B] px-2 text-[12px]">
            <strong className="min-w-0 flex-1 truncate font-mono text-[12px]">{selected.slice(selected.lastIndexOf('/') + 1)}</strong>
            {isImage &&
              (['fit', 1, 2, 4, 8] as const).map((z) => (
                <button
                  key={z}
                  type="button"
                  aria-pressed={zoom === z}
                  onClick={() => setZoom(z)}
                  className={`rounded px-1.5 py-0.5 text-[11px] ${zoom === z ? 'bg-[#2B2550] text-white' : 'text-muted hover:text-white'}`}
                >
                  {z === 'fit' ? 'Fit' : `${z}×`}
                </button>
              ))}
          </div>
          <div
            className="flex min-h-[220px] flex-1 items-center justify-center overflow-auto p-4"
            style={{ background: 'repeating-conic-gradient(#1C1F27 0% 25%, #15171D 0% 50%) 50% / 16px 16px' }}
          >
            {isImage && src ? (
              <img
                src={src}
                alt={selected}
                style={zoom === 'fit' || !dims ? undefined : { width: dims.w * zoom, height: dims.h * zoom, maxWidth: 'none' }}
                className={`${zoom === 'fit' ? 'max-h-full max-w-full min-w-[96px] object-contain' : ''} [image-rendering:pixelated]`}
              />
            ) : (
              src && <audio controls src={src} className="w-full" />
            )}
          </div>
          <div className="flex flex-col gap-3 border-t border-[#1F222B] p-3 text-[12px]">
            <dl className="grid grid-cols-[90px_1fr] gap-y-1">
              <dt className="text-muted">Path</dt>
              <dd className="truncate font-mono text-[11.5px]">{selected}</dd>
              {dims && (
                <>
                  <dt className="text-muted">Size</dt>
                  <dd className="tabular-nums">
                    {dims.w} × {dims.h} px
                  </dd>
                </>
              )}
              <dt className="text-muted">Used by</dt>
              <dd>{users.length ? users.map((u) => <div key={u} className="truncate font-mono text-[11.5px]">{u}</div>) : <span className="text-muted">nothing yet</span>}</dd>
            </dl>
            <div className="flex flex-wrap gap-1.5">
              {isImage && (
                <Btn
                  primary
                  onClick={() => {
                    addFromFile(ed, selected, ed.viewCenter.current);
                    ed.setWorkspace('scene');
                  }}
                >
                  <PlusSquare size={13} /> Place in scene
                </Btn>
              )}
              <Btn onClick={() => ed.setDialog({ type: 'rename-file', path: selected })}>
                <Pencil size={13} /> Rename
              </Btn>
              <Btn danger onClick={() => deleteFile(ed, selected)}>
                <Trash2 size={13} /> Delete
              </Btn>
            </div>
            <p className="text-[11.5px] text-muted">Tip: drag any picture onto the Scene view to place it, or onto an Image field in Properties.</p>
          </div>
        </aside>
      )}
    </div>
  );
}
