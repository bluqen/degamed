import { useState } from 'react';
import { ART_STYLES, type StyleFamily } from '@degamed/art';

const FAMILIES: { id: StyleFamily | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pixel', label: 'Pixel art' },
  { id: 'painted', label: 'Painted' },
  { id: 'illustrated', label: 'Illustrated' },
  { id: 'graphic', label: 'Graphic' },
];

/** Grid of art styles. Shows a generated sample image for a style when one exists in /styles. */
export function StylePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [family, setFamily] = useState<StyleFamily | 'all'>('all');
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const styles = ART_STYLES.filter((s) => family === 'all' || s.family === family);

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Style family" className="flex flex-wrap gap-2">
        {FAMILIES.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={family === f.id}
            onClick={() => setFamily(f.id)}
            className={`min-h-10 rounded-full px-4 text-sm ${family === f.id ? 'bg-brand font-semibold text-white' : 'border border-line-strong text-ink-2 hover:text-white'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
        {styles.map((s) => {
          const selected = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(s.id)}
              className={`flex flex-col overflow-hidden rounded-[14px] border-2 bg-panel text-left transition-colors ${selected ? 'border-cyan' : 'border-line hover:border-line-strong'}`}
            >
              <span className="relative block aspect-[4/3] overflow-hidden">
                {!missing[s.id] ? (
                  <img
                    src={`/styles/${s.id}.webp`}
                    alt=""
                    loading="lazy"
                    onError={() => setMissing((m) => ({ ...m, [s.id]: true }))}
                    className="h-full w-full object-cover"
                    style={{ imageRendering: s.family === 'pixel' ? 'pixelated' : 'auto' }}
                  />
                ) : (
                  <span className="grid h-full grid-cols-4">
                    {s.swatch.map((c) => (
                      <span key={c} style={{ background: c }} />
                    ))}
                  </span>
                )}
              </span>
              <span className="flex flex-col gap-1 px-3 py-2.5">
                <span className="font-semibold">{s.name}</span>
                <span className="text-[13px] leading-snug text-muted">{s.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
