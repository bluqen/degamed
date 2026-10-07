import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Play } from 'lucide-react';
import { usePlayFrame } from '../lib/play';
import { starterProject } from '../lib/project-files';

/** A real, playable Degamed game. The engine only loads once someone presses Play. */
export function LiveDemo() {
  const [started, setStarted] = useState(false);
  const files = useMemo(() => (started ? starterProject() : null), [started]);
  const play = usePlayFrame(files);

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-[#0B0C10]">
      {started ? (
        <iframe
          ref={play.frameRef}
          src={play.src}
          title="Playable demo game"
          sandbox="allow-scripts"
          allow="autoplay; fullscreen; gamepad"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_50%_40%,#29366F,#0B0C10_70%)] text-center">
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 text-lg font-semibold text-white hover:bg-[#5A3DF0]"
          >
            <Play size={20} aria-hidden="true" /> Play the demo
          </button>
          <span className="text-sm text-ink-2">A pixel art platformer running on the Degamed engine</span>
        </div>
      )}
      {started && (
        <Link to="/editor/demo" className="absolute right-3 bottom-3 rounded-lg bg-bg/80 px-3 py-1.5 text-sm text-ink backdrop-blur hover:text-white">
          Open in editor
        </Link>
      )}
    </div>
  );
}
