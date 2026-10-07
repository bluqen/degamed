import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Download, Sparkles } from 'lucide-react';
import { buildPrompt, getStyle, type AssetKind, type ViewAngle } from '@degamed/art';
import { AppShell } from '../components/AppShell';
import { StylePicker } from '../components/StylePicker';
import { AssetPreview } from '../components/AssetPreview';
import { availableImageProviders, generateAsset, type GeneratedAsset } from '../lib/art';

const KINDS: { id: AssetKind; label: string }[] = [
  { id: 'sprite', label: 'Character' },
  { id: 'item', label: 'Item' },
  { id: 'tile', label: 'Tile' },
  { id: 'background', label: 'Background' },
  { id: 'ui', label: 'UI element' },
];

const VIEWS: ViewAngle[] = ['side', 'top-down', 'isometric', 'front'];

/** Generate a single asset, see the raw output next to the game-ready version, and download it. */
export function ArtLab() {
  const providers = useMemo(() => availableImageProviders(), []);
  const [providerId, setProviderId] = useState(providers[0]?.id);
  const [style, setStyle] = useState('pixel-16');
  const [kind, setKind] = useState<AssetKind>('sprite');
  const [view, setView] = useState<ViewAngle>('side');
  const [subject, setSubject] = useState('a brave fox knight with a glowing lantern');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedAsset | null>(null);
  const abort = useRef<AbortController | null>(null);

  let promptPreview = '';
  try {
    promptPreview = buildPrompt({ style, kind, subject, view });
  } catch {
    promptPreview = '';
  }

  const generate = async (e: FormEvent) => {
    e.preventDefault();
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;
    abort.current?.abort();
    abort.current = new AbortController();
    setBusy(true);
    setError(null);
    try {
      setResult(await generateAsset({ provider, style, kind, subject, view, signal: abort.current.signal }));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(result.processed);
    a.download = `${subject.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'asset'}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const isPixel = getStyle(style).family === 'pixel';

  return (
    <AppShell>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-3xl tracking-tight">Art Lab</h1>
        <p className="text-muted">Generate game-ready sprites, tiles and backgrounds in any style.</p>
      </div>

      {providers.length === 0 && (
        <div className="rounded-xl border border-[#4D3A12] bg-[#241C0E] p-4 text-sm text-[#F5DFA8]">
          No image generator is connected. Add a free Google Gemini key in{' '}
          <Link to="/settings" className="underline">
            Settings
          </Link>
          , or connect Degamed’s hosted generator (docs/SETUP.md).
        </div>
      )}

      <form onSubmit={generate} className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">1. Style</h2>
          <StylePicker value={style} onChange={setStyle} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">2. What to draw</h2>
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-0 flex-[3_1_320px] flex-col gap-1.5">
              <span className="text-sm text-muted">Description</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={300}
                className="rounded-[10px] border border-line-strong bg-panel px-3.5 py-2.5 text-white outline-none"
              />
            </label>
            <label className="flex flex-[1_1_140px] flex-col gap-1.5">
              <span className="text-sm text-muted">Type</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as AssetKind)} className="rounded-[10px] border border-line-strong bg-panel px-3 py-2.5">
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-[1_1_140px] flex-col gap-1.5">
              <span className="text-sm text-muted">View</span>
              <select value={view} onChange={(e) => setView(e.target.value as ViewAngle)} className="rounded-[10px] border border-line-strong bg-panel px-3 py-2.5">
                {VIEWS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-[1_1_200px] flex-col gap-1.5">
              <span className="text-sm text-muted">Generator</span>
              <select
                value={providerId ?? ''}
                onChange={(e) => setProviderId(e.target.value as typeof providerId)}
                disabled={!providers.length}
                className="rounded-[10px] border border-line-strong bg-panel px-3 py-2.5"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <details className="text-sm text-muted">
            <summary className="cursor-pointer">Prompt sent to the model</summary>
            <p className="mt-2 rounded-lg bg-panel p-3 font-mono text-xs leading-relaxed">{promptPreview}</p>
          </details>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy || !providers.length || !subject.trim()}
              className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-brand px-5 font-semibold text-white hover:bg-[#5A3DF0] disabled:opacity-50"
            >
              <Sparkles size={18} aria-hidden="true" />
              {busy ? 'Generating…' : 'Generate'}
            </button>
            {error && (
              <p role="alert" className="text-bad">
                {error}
              </p>
            )}
          </div>
        </section>
      </form>

      {result && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Result</h2>
            <span className="text-sm text-muted">
              {result.width}×{result.height}px
            </span>
            <button type="button" onClick={download} className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-line-strong px-4 hover:bg-panel">
              <Download size={16} aria-hidden="true" />
              Download PNG
            </button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
            <AssetPreview blob={result.raw} label="Raw model output" />
            <AssetPreview blob={result.processed} label="Game-ready asset" pixel={isPixel} />
          </div>
        </section>
      )}
    </AppShell>
  );
}
