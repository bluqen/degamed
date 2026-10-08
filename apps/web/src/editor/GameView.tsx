import { useRef } from 'react';
import { Maximize2, Pause, Play, RotateCcw, Square, StepForward } from 'lucide-react';
import { useEd } from './state';
import { IconButton } from './ui';

/**
 * The running game. The player iframe stays mounted while other workspaces show,
 * so switching tabs doesn't restart it; this view just reveals it.
 */
export function GameView({ visible }: { visible: boolean }) {
  const ed = useEd();
  const stage = useRef<HTMLDivElement>(null);
  const { play, running } = ed;
  return (
    <div className={`min-h-0 flex-1 flex-col bg-[#08090C] ${visible ? 'flex' : 'hidden'}`}>
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[#1F222B] bg-[#13151B] px-2 text-[12px]">
        <IconButton label="Restart" shortcut="Ctrl+R" onClick={() => (running === 'stopped' ? ed.run('project') : play.restart())}>
          <RotateCcw size={14} />
        </IconButton>
        <IconButton label={running === 'paused' ? 'Resume' : 'Pause'} shortcut="F7" disabled={running === 'stopped'} onClick={ed.togglePause}>
          {running === 'paused' ? <Play size={14} /> : <Pause size={14} />}
        </IconButton>
        <IconButton label="Next frame" disabled={running !== 'paused'} onClick={() => play.step()}>
          <StepForward size={14} />
        </IconButton>
        <IconButton label="Stop" shortcut="F8" disabled={running === 'stopped'} onClick={ed.stop}>
          <Square size={13} />
        </IconButton>
        <span className="ml-2 text-muted">
          {running === 'stopped' ? 'Stopped' : running === 'paused' ? 'Paused' : 'Running'} · click the game to give it the keyboard
        </span>
        <span className={`ml-auto font-mono ${play.fps && play.fps < 50 ? 'text-warn' : 'text-ok'}`}>{running !== 'stopped' && play.fps ? `${play.fps} fps` : ''}</span>
        <IconButton label="Fullscreen" onClick={() => void stage.current?.requestFullscreen?.()}>
          <Maximize2 size={14} />
        </IconButton>
      </div>
      <div ref={stage} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
        <iframe
          ref={play.frameRef}
          src={play.src}
          title="Game"
          sandbox="allow-scripts"
          allow="autoplay; fullscreen; gamepad"
          className="absolute inset-0 h-full w-full border-0"
        />
        {!play.ready && <span className="pointer-events-none text-muted">Starting the player…</span>}
        {play.ready && running === 'stopped' && (
          <button
            type="button"
            onClick={() => ed.run('project')}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-ink"
          >
            <span className="flex size-16 items-center justify-center rounded-full bg-[#6B4EFF] shadow-[0_0_40px_rgba(107,78,255,.5)]">
              <Play size={26} fill="currentColor" />
            </span>
            <span className="text-[13px]">Run the game (F5)</span>
          </button>
        )}
      </div>
    </div>
  );
}
