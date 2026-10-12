import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Maximize2, MousePointerClick, Play, RotateCcw, TriangleAlert } from 'lucide-react';
import type { ProjectFiles } from '@degamed/shared';
import { usePlayFrame } from '../lib/play';
import { cx, IconButton } from '../ui';

export interface StageHandle {
  restart: () => void;
  fullscreen: () => void;
  focus: () => void;
}

/**
 * The game, front and centre: a 16:9 frame that runs the sandboxed player.
 * Shows real art (poster) while the engine loads, a gentle "click to play" hint,
 * and a calm message if the game crashes.
 */
/** Full screen, and on phones turn to landscape where the browser allows it. */
export async function goFullscreen(el: HTMLElement | null) {
  if (!el) return;
  try {
    await el.requestFullscreen?.({ navigationUI: 'hide' });
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (window.matchMedia('(pointer: coarse)').matches) await o.lock?.('landscape').catch(() => {});
  } catch {
    // Full screen isn't allowed here (e.g. iOS Safari on an element); the game still plays inline.
  }
}

export const Stage = forwardRef<
  StageHandle,
  {
    /** The game. A function is only called once the game starts (keeps the landing page light). */
    files: ProjectFiles | null | (() => ProjectFiles | Promise<ProjectFiles>);
    title: string;
    /** Image shown before the game starts and while it loads. */
    poster?: string;
    /** Start right away (Studio) or wait for a click (landing page). */
    autoStart?: boolean;
    className?: string;
    /** Hide the hover controls (restart, full screen). */
    bare?: boolean;
    /** Show the overlay controls only on phones (the page has its own buttons on bigger screens). */
    overlayOnPhoneOnly?: boolean;
    startLabel?: string;
    startHint?: ReactNode;
    rounded?: boolean;
  }
>(function Stage(
  {
    files: filesProp,
    title,
    poster,
    autoStart = true,
    className,
    bare = false,
    overlayOnPhoneOnly = false,
    startLabel = 'Play',
    startHint,
    rounded = true,
  },
  ref,
) {
  const [started, setStarted] = useState(autoStart);
  const [loaded, setLoaded] = useState<ProjectFiles | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    if (typeof filesProp !== 'function' || !started) return;
    let live = true;
    Promise.resolve()
      .then(filesProp)
      .then((f) => live && setLoaded(f))
      .catch(() => live && setLoadFailed(true));
    return () => {
      live = false;
    };
  }, [filesProp, started]);
  const files = typeof filesProp === 'function' ? loaded : filesProp;
  const [focused, setFocused] = useState(false);
  const [hinted, setHinted] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const play = usePlayFrame(started ? files : null);
  const first = useRef(true);
  const { frameRef } = play;
  // Must be stable: a new callback each render would detach and re-attach the frame (and reset "ready").
  const setFrame = useCallback(
    (el: HTMLIFrameElement | null) => {
      frame.current = el;
      frameRef(el);
    },
    [frameRef],
  );

  // Re-run when the game changes (the player keeps the latest run if it isn't ready yet).
  useEffect(() => {
    if (!started || !files) return;
    if (first.current) {
      first.current = false;
      // The player sends the first game itself once it's ready, unless it was ready first.
      if (!play.ready) return;
    }
    play.run(files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, started]);

  // The iframe takes keyboard focus when clicked; the window blurs when that happens.
  useEffect(() => {
    const check = () =>
      window.setTimeout(() => {
        const inside = document.activeElement === frame.current;
        setFocused(inside);
        if (inside) setHinted(true);
      }, 0);
    window.addEventListener('blur', check);
    window.addEventListener('focus', check);
    return () => {
      window.removeEventListener('blur', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    restart: () => (play.ready ? play.restart() : undefined),
    fullscreen: () => void goFullscreen(box.current),
    focus: () => frame.current?.focus(),
  }));

  const error = loadFailed
    ? { message: 'it couldn’t be loaded. Check your connection and try again.' }
    : play.lines.find((l) => l.level === 'error');
  const loading = started && (!play.ready || !files) && !loadFailed;

  return (
    <div
      ref={box}
      className={cx(
        'group relative isolate aspect-video w-full overflow-hidden bg-stage',
        rounded && 'rounded-xl',
        className,
      )}
    >
      {poster && (
        <img
          src={poster}
          alt=""
          aria-hidden="true"
          className={cx(
            'pixelated absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
            started && play.ready ? 'opacity-0' : 'opacity-100',
          )}
        />
      )}

      {started && (
        <iframe
          ref={setFrame}
          src={play.src}
          title={`${title} (game)`}
          sandbox="allow-scripts"
          allow="autoplay; fullscreen; gamepad"
          className={cx(
            'absolute inset-0 h-full w-full border-0 transition-opacity duration-300',
            play.ready ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}

      {!started && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-black/60 via-black/15 to-black/10 text-center">
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="inline-flex h-14 items-center gap-2.5 rounded-full bg-white pr-7 pl-6 text-body-lg font-bold text-[#15141d] shadow-4 transition-transform duration-200 ease-standard hover:scale-[1.03] active:scale-[0.98]"
          >
            <Play size={20} fill="currentColor" aria-hidden="true" /> {startLabel}
          </button>
          {startHint && (
            <span className="text-body-sm font-medium text-white/90 [text-shadow:0_1px_8px_rgb(0_0_0/0.6)]">
              {startHint}
            </span>
          )}
        </div>
      )}

      {loading && (
        <div
          className="absolute inset-0 flex items-end justify-center bg-black/25 pb-6"
          aria-live="polite"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3.5 py-1.5 text-body-sm font-medium text-white backdrop-blur">
            <span className="size-2 animate-pulse-soft rounded-full bg-[#4fd8ef]" />
            Loading the game…
          </span>
        </div>
      )}

      {started && play.ready && !focused && !hinted && !error && (
        <button
          type="button"
          onClick={() => frame.current?.focus()}
          className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 animate-rise items-center gap-2 rounded-full bg-black/60 px-3.5 py-1.5 text-body-sm font-medium whitespace-nowrap text-white backdrop-blur hover:bg-black/70 sm:inline-flex"
        >
          <MousePointerClick size={15} aria-hidden="true" /> Click the game to play
        </button>
      )}

      {error && (
        <div
          role="alert"
          className="absolute inset-x-4 bottom-4 flex animate-rise items-center gap-3 rounded-lg bg-black/75 py-2.5 pr-2.5 pl-3.5 text-body-sm text-white backdrop-blur"
        >
          <TriangleAlert size={16} className="shrink-0 text-[#fbbf24]" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">The game hit a problem: {error.message}</span>
          <button
            type="button"
            onClick={() => files && play.run(files)}
            className="h-8 shrink-0 rounded-sm bg-white/15 px-3 font-semibold hover:bg-white/25"
          >
            Restart
          </button>
        </div>
      )}

      {!bare && started && play.ready && (
        <div
          className={cx(
            'absolute top-2 right-2 flex gap-1 rounded-md bg-black/55 p-1 backdrop-blur transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100',
            overlayOnPhoneOnly ? 'sm:hidden' : 'opacity-0 max-sm:opacity-100',
          )}
        >
          <IconButton
            label="Restart"
            size="sm"
            className="text-white hover:bg-white/15 hover:text-white"
            onClick={() => play.restart()}
          >
            <RotateCcw size={16} />
          </IconButton>
          <IconButton
            label="Full screen"
            size="sm"
            className="text-white hover:bg-white/15 hover:text-white"
            onClick={() => void goFullscreen(box.current)}
          >
            <Maximize2 size={16} />
          </IconButton>
        </div>
      )}
    </div>
  );
});
