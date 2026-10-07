import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Sparkles } from 'lucide-react';
import { getStyle } from '@degamed/art';
import { availableImageProviders, generateAsset, type GeneratedAsset } from '../lib/art';
import { AssetPreview } from './AssetPreview';

/** "See your hero in this style": generates one sample character for the chosen style. */
export function StylePreview({ style, idea }: { style: string; idea: string }) {
  const providers = useMemo(() => availableImageProviders(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ style: string; asset: GeneratedAsset } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const subject = `the main character of this game: ${idea.trim() || 'a brave adventurer'}`;

  const run = async () => {
    const provider = providers[0];
    if (!provider) return;
    abort.current?.abort();
    abort.current = new AbortController();
    setBusy(true);
    setError(null);
    try {
      const asset = await generateAsset({ provider, style, kind: 'sprite', subject, signal: abort.current.signal });
      setResult({ style, asset });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setBusy(false);
    }
  };

  if (!providers.length) {
    return (
      <p className="rounded-xl border border-line bg-panel p-4 text-sm text-muted">
        Want to see your hero in each style first? Add a free Gemini key in{' '}
        <Link to="/settings" className="text-brand-soft underline">
          Settings
        </Link>
        .
      </p>
    );
  }

  const shown = result?.style === style ? result.asset : null;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-panel p-4">
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2">
        <strong>Preview your hero in {getStyle(style).name}</strong>
        <span className="text-sm text-muted">Generates one sample sprite from your idea.</span>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-[10px] bg-brand px-4 font-semibold text-white hover:bg-[#5A3DF0] disabled:opacity-50"
        >
          <Sparkles size={16} aria-hidden="true" />
          {busy ? 'Drawing…' : shown ? 'Try again' : 'Preview'}
        </button>
        {error && (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        )}
      </div>
      {shown && (
        <div className="w-44">
          <AssetPreview blob={shown.processed} label={`${shown.width}×${shown.height}px`} pixel={getStyle(style).family === 'pixel'} />
        </div>
      )}
    </div>
  );
}
