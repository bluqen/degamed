/**
 * Degamed play sandbox.
 * Runs inside <iframe sandbox="allow-scripts"> on its own origin, so game code can never reach the
 * editor's cookies, storage or API. It talks to the editor only through postMessage.
 */
import { startGame, ScriptError, type GameHandle } from '@degamed/engine';
import { ENGINE_VERSION, parseHostMessage, type PlayToHost } from '@degamed/shared';

type Outgoing = PlayToHost extends infer M ? (M extends unknown ? Omit<M, 'channel'> : never) : never;

const container = document.getElementById('game')!;
const status = document.getElementById('status')!;
let game: GameHandle | null = null;
let loadToken = 0;

function send(message: Outgoing) {
  // An opaque-origin sandbox can't name its parent's origin, so '*' is required.
  // Messages never carry secrets: only logs, errors, fps and screenshots.
  parent.postMessage({ channel: 'degamed', ...message }, '*');
}

function showStatus(text: string | null) {
  status.textContent = text ?? '';
  status.style.display = text ? 'grid' : 'none';
}

const hooks = {
  log: (level: 'info' | 'warn' | 'error', message: string, source?: string) => send({ type: 'log', level, message, source }),
  error: (message: string, details: { stack?: string; file?: string; line?: number } = {}) =>
    send({ type: 'error', message, ...details }),
};

async function load(files: Record<string, string>) {
  const token = ++loadToken;
  game?.destroy();
  game = null;
  container.replaceChildren();
  showStatus('Loading…');
  try {
    const next = await startGame(container, files, hooks);
    if (token !== loadToken) return next.destroy();
    game = next;
    showStatus(null);
    container.focus();
  } catch (err) {
    const e = err as Error;
    showStatus(`This game couldn't start:\n${e.message}`);
    send({ type: 'error', message: e.message, stack: e.stack, file: err instanceof ScriptError ? err.file : undefined });
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== parent) return;
  const msg = parseHostMessage(event.data);
  if (!msg) return;
  switch (msg.type) {
    case 'load':
      void load(msg.files);
      break;
    case 'play':
      game?.resume();
      container.focus();
      break;
    case 'pause':
      game?.pause();
      break;
    case 'step':
      game?.step();
      break;
    case 'restart':
      game?.restart();
      container.focus();
      break;
    case 'screenshot':
      void game?.screenshot().then((dataUrl) => {
        if (dataUrl.startsWith('data:image/')) send({ type: 'screenshot', requestId: msg.requestId, dataUrl });
      });
      break;
  }
});

window.addEventListener('error', (e) => send({ type: 'error', message: String(e.message), file: e.filename || undefined, line: e.lineno || undefined }));
window.addEventListener('unhandledrejection', (e) => send({ type: 'error', message: String((e.reason as Error)?.message ?? e.reason) }));
container.addEventListener('pointerdown', () => container.focus());

// FPS reporting, once a second.
let frames = 0;
let last = performance.now();
const tick = (now: number) => {
  frames++;
  if (now - last >= 1000) {
    if (game) send({ type: 'fps', fps: Math.round((frames * 1000) / (now - last)) });
    frames = 0;
    last = now;
  }
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);

send({ type: 'ready', engineVersion: ENGINE_VERSION });
