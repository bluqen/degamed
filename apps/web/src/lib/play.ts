import { useCallback, useEffect, useRef, useState } from 'react';
import { parsePlayMessage, type HostToPlay, type PlayToHost, type ProjectFiles } from '@degamed/shared';
import { env } from './env';

export interface ConsoleLine {
  id: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  file?: string;
  at: number;
}

type Command = HostToPlay extends infer M ? (M extends unknown ? Omit<M, 'channel'> : never) : never;

/**
 * Drives the sandboxed player iframe: sends the project when the player is ready,
 * collects logs/errors/fps, and exposes play controls.
 */
export function usePlayFrame(
  files: ProjectFiles | null,
  { autoLoad = true, onHotkey }: { autoLoad?: boolean; onHotkey?: (key: 'F5' | 'F6' | 'F7' | 'F8') => void } = {},
) {
  const hotkey = useRef(onHotkey);
  hotkey.current = onHotkey;
  const frameEl = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  /** The last run. Sent again when a (new) player says it's ready, so runs survive reloads and early clicks. */
  const pending = useRef<ProjectFiles | null>(null);
  // A new iframe (e.g. after a layout change) starts loading again, so it isn't ready yet.
  const frameRef = useCallback((el: HTMLIFrameElement | null) => {
    if (el !== frameEl.current) setReady(false);
    frameEl.current = el;
  }, []);
  const [fps, setFps] = useState<number | null>(null);
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const nextId = useRef(0);
  const filesRef = useRef(files);
  filesRef.current = files;

  const post = useCallback((msg: Command) => {
    // The sandboxed frame has an opaque origin, so a specific targetOrigin would never match.
    // Only project files (never secrets) are sent.
    frameEl.current?.contentWindow?.postMessage({ channel: 'degamed', ...msg }, '*');
  }, []);

  const push = useCallback((line: Omit<ConsoleLine, 'id' | 'at'>) => {
    setLines((prev) => [...prev.slice(-199), { ...line, id: ++nextId.current, at: Date.now() }]);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // The sandbox has an opaque origin ("null"), so trust is based on the source window.
      if (event.source !== frameEl.current?.contentWindow) return;
      const msg: PlayToHost | null = parsePlayMessage(event.data);
      if (!msg) return;
      switch (msg.type) {
        case 'ready':
          setReady(true);
          if (pending.current) post({ type: 'load', files: pending.current });
          else if (autoLoad && filesRef.current) post({ type: 'load', files: filesRef.current });
          break;
        case 'fps':
          setFps(msg.fps);
          break;
        case 'hotkey':
          hotkey.current?.(msg.key);
          break;
        case 'log':
          push({ level: msg.level, message: msg.message, file: msg.source });
          break;
        case 'error':
          push({ level: 'error', message: msg.message, file: msg.file });
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [post, push, autoLoad]);

  /** Sends the current files to the player and restarts the game (or queues it until the player is ready). */
  const run = useCallback(
    (next?: ProjectFiles) => {
      const f = next ?? filesRef.current;
      if (!f) return;
      setLines([]);
      pending.current = f;
      if (ready) post({ type: 'load', files: f });
    },
    [post, ready],
  );

  return {
    frameRef,
    src: `${env.playOrigin}/`,
    ready,
    fps,
    lines,
    clearConsole: () => setLines([]),
    run,
    restart: () => post({ type: 'restart' }),
    pause: () => post({ type: 'pause' }),
    resume: () => post({ type: 'play' }),
    step: () => post({ type: 'step' }),
  };
}
