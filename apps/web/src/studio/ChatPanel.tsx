import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowUp, RotateCcw, Sparkles, TriangleAlert, Undo2 } from 'lucide-react';
import { editGame, encode, suggestions, type ChatTurn } from '../lib/game';
import { currentAi, PROVIDER_LABEL } from '../lib/ai-settings';
import { IconButton, cx } from '../ui';
import type { Studio } from './useStudio';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  status?: 'pending' | 'error' | 'done';
  /** Undo depth right after this change, so "Undo" only shows while it's the latest. */
  undoable?: boolean;
  retry?: string;
}

let nextId = 0;

/** Change the game by talking to it. */
export function ChatPanel({ studio, intro }: { studio: Studio; intro: string }) {
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: ++nextId, role: 'assistant', text: intro, status: 'done' },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const abort = useRef<AbortController | null>(null);
  const ai = useMemo(currentAi, []);
  const chips = useMemo(() => suggestions(studio.files).slice(0, 4), [studio.files]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);
  useEffect(() => () => abort.current?.abort(), []);

  // Grow the box with its text, up to five lines.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [draft]);

  const send = async (text: string) => {
    const request = text.trim();
    if (!request || busy) return;
    setDraft('');
    setBusy(true);
    const pendingId = ++nextId;
    const history: ChatTurn[] = messages
      .filter((m) => m.status !== 'pending' && m.status !== 'error')
      .map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [
      ...m.map((x) => ({ ...x, undoable: false })),
      { id: ++nextId, role: 'user', text: request },
      { id: pendingId, role: 'assistant', text: 'Thinking…', status: 'pending' },
    ]);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const result = await editGame({
        files: studio.files,
        request,
        history,
        settings: ai.settings,
        encode,
        signal: ctrl.signal,
        onProgress: (p) =>
          setMessages((m) =>
            m.map((x) =>
              x.id === pendingId
                ? { ...x, text: /[.…!?]$/.test(p.message) ? p.message : `${p.message}…` }
                : x,
            ),
          ),
      });
      const changed = result.changed.length > 0;
      if (changed) studio.apply(result.files, request);
      setMessages((m) =>
        m.map((x) =>
          x.id === pendingId
            ? {
                ...x,
                text: result.notice ? `${result.summary} (${result.notice})` : result.summary,
                status: 'done',
                undoable: changed,
              }
            : x,
        ),
      );
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setMessages((m) =>
        m.map((x) =>
          x.id === pendingId
            ? {
                ...x,
                status: 'error',
                retry: request,
                text:
                  e instanceof Error
                    ? `That didn’t work: ${e.message}`
                    : 'That didn’t work. Please try again.',
              }
            : x,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={list}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5"
        aria-live="polite"
      >
        {messages.map((m) =>
          m.role === 'user' ? (
            <div
              key={m.id}
              className="ml-10 animate-rise self-end rounded-xl rounded-br-xs bg-brand px-3.5 py-2 text-body text-on-brand"
            >
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="flex animate-rise gap-3">
              <span
                className={cx(
                  'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
                  m.status === 'error' ? 'bg-bad-tint text-bad' : 'bg-brand-tint text-brand-ink',
                )}
                aria-hidden="true"
              >
                {m.status === 'error' ? (
                  <TriangleAlert size={14} />
                ) : (
                  <Sparkles
                    size={14}
                    className={m.status === 'pending' ? 'animate-pulse-soft' : ''}
                  />
                )}
              </span>
              <div className="flex min-w-0 flex-col items-start gap-2 pt-0.5">
                <p className={cx('text-body', m.status === 'pending' ? 'text-muted' : 'text-ink')}>
                  {m.text}
                </p>
                {m.undoable && studio.canUndo && (
                  <button
                    type="button"
                    onClick={studio.undo}
                    className="inline-flex h-7 items-center gap-1.5 rounded-sm px-2 text-body-sm font-semibold text-brand-ink hover:bg-brand-tint"
                  >
                    <Undo2 size={14} aria-hidden="true" /> Undo
                  </button>
                )}
                {m.retry && (
                  <button
                    type="button"
                    onClick={() => void send(m.retry!)}
                    className="inline-flex h-7 items-center gap-1.5 rounded-sm px-2 text-body-sm font-semibold text-brand-ink hover:bg-brand-tint"
                  >
                    <RotateCcw size={14} aria-hidden="true" /> Try again
                  </button>
                )}
              </div>
            </div>
          ),
        )}
      </div>

      <div className="shrink-0 border-t border-line bg-surface p-3 pt-3">
        {chips.length > 0 && !busy && (
          <ul
            className="-mx-3 mb-2.5 flex gap-2 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible"
            aria-label="Suggestions"
          >
            {chips.map((c) => (
              <li key={c} className="shrink-0">
                <button
                  type="button"
                  onClick={() => void send(c)}
                  className="h-8 rounded-full border border-line bg-surface px-3 text-body-sm font-medium whitespace-nowrap text-ink-2 transition-colors hover:border-brand hover:bg-brand-tint hover:text-brand-ink"
                >
                  {c}
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
          className="flex items-end gap-2 rounded-lg border border-line-strong bg-surface p-1.5 pl-3 transition-[border-color,box-shadow] duration-150 focus-within:border-brand focus-within:shadow-[0_0_0_3px_var(--c-brand-tint-2)]"
        >
          <label htmlFor="chat-input" className="sr-only">
            Describe a change
          </label>
          <textarea
            id="chat-input"
            ref={input}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            placeholder="Describe a change…"
            className="max-h-[132px] min-h-9 flex-1 resize-none bg-transparent py-1.5 text-body text-ink placeholder:text-faint focus:outline-none focus-visible:outline-none"
          />
          <IconButton
            type="submit"
            label="Send"
            variant="primary"
            size="sm"
            disabled={!draft.trim() || busy}
            tooltip={false}
            className="shadow-none"
          >
            <ArrowUp size={18} strokeWidth={2.5} />
          </IconButton>
        </form>
        <p className="mt-2 flex items-center gap-1.5 px-1 text-caption text-muted">
          <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
          {PROVIDER_LABEL[ai.settings.provider]}
          {ai.settings.provider === 'instant' && (
            <>
              <span aria-hidden="true">·</span>
              <Link to="/settings" className="font-semibold text-brand-ink hover:underline">
                Add an AI key for bigger changes
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
