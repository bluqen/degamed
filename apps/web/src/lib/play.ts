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
export function usePlayFrame(files: ProjectFiles | null) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [fps, setFps] = useState<number | null>(null);
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const nextId = useRef(0);
  const filesRef = useRef(files);
  filesRef.current = files;

  const post = useCallback((msg: Command) => {
    // The sandboxed frame has an opaque origin, so a specific targetOrigin would never match.
    // Only project files (never secrets) are sent.
    frameRef.current?.contentWindow?.postMessage({ channel: 'degamed', ...msg }, '*');
  }, []);

  const push = useCallback((line: Omit<ConsoleLine, 'id' | 'at'>) => {
    setLines((prev) => [...prev.slice(-199), { ...line, id: ++nextId.current, at: Date.now() }]);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // The sandbox has an opaque origin ("null"), so trust is based on the source window.
      if (event.source !== frameRef.current?.contentWindow) return;
      const msg: PlayToHost | null = parsePlayMessage(event.data);
      if (!msg) return;
      switch (msg.type) {
        case 'ready':
          setReady(true);
          if (filesRef.current) post({ type: 'load', files: filesRef.current });
          break;
        case 'fps':
          setFps(msg.fps);
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
  }, [post, push]);

  /** Sends the current files to the player and restarts the game. */
  const run = useCallback(
    (next?: ProjectFiles) => {
      const f = next ?? filesRef.current;
      if (!f || !ready) return;
      setLines([]);
      post({ type: 'load', files: f });
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
  };
}
