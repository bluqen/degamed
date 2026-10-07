import { useEffect, useState } from 'react';

const CHECKER =
  'repeating-conic-gradient(#1C1F27 0% 25%, #15171D 0% 50%) 50% / 20px 20px';

/** Shows an image blob on a checkerboard; pixel art is scaled up with hard edges. */
export function AssetPreview({ blob, label, pixel = false }: { blob: Blob; label: string; pixel?: boolean }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  return (
    <figure className="flex flex-col gap-2">
      <div className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-line p-4" style={{ background: CHECKER }}>
        {url && (
          <img
            src={url}
            alt={label}
            className="max-h-full max-w-full"
            style={pixel ? { imageRendering: 'pixelated', width: '70%', height: '70%', objectFit: 'contain' } : { objectFit: 'contain' }}
          />
        )}
      </div>
      <figcaption className="text-sm text-muted">{label}</figcaption>
    </figure>
  );
}
