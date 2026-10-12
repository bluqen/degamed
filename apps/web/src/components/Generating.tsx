import { useEffect, useMemo, useState } from 'react';
import { Check, Pencil, RotateCcw, TriangleAlert } from 'lucide-react';
import type { Progress } from '../lib/game';
import { themes } from '../lib/game';
import { Button, cx } from '../ui';
import { ThemeArtImage } from './ThemeCard';

const STEPS: { stage: Progress['stage']; label: string; hint: string }[] = [
  {
    stage: 'understanding',
    label: 'Understanding your idea',
    hint: 'Who the hero is, what they want, and the mood.',
  },
  {
    stage: 'designing',
    label: 'Designing the world',
    hint: 'Choosing the kind of game, the look and the rules.',
  },
  {
    stage: 'building',
    label: 'Building the level',
    hint: 'Placing platforms, enemies, pickups and art.',
  },
  {
    stage: 'testing',
    label: 'Playtesting',
    hint: 'Making sure it can be finished and feels good.',
  },
];

const withEllipsis = (m: string) => (/[.…!?]$/.test(m) ? m : `${m}…`);

const order = (s: Progress['stage']) =>
  s === 'fixing' ? 3 : s === 'done' ? 4 : STEPS.findIndex((x) => x.stage === s);

/** The "making your game" screen, driven by createGame's progress stages. */
export function Generating({
  prompt,
  progress,
  error,
  onCancel,
  onRetry,
  onEdit,
}: {
  prompt: string;
  progress: Progress[];
  error: string | null;
  onCancel: () => void;
  onRetry: () => void;
  onEdit: () => void;
}) {
  const last = progress[progress.length - 1];
  const current = last ? order(last.stage) : 0;
  const pct = error
    ? 0
    : Math.min(100, ((current + (last?.stage === 'done' ? 0 : 0.5)) / STEPS.length) * 100);

  // While we wait, the frame cycles through real art from the themes.
  const art = useMemo(themes, []);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (error) return;
    const t = window.setInterval(() => setShown((n) => (n + 1) % art.length), 1600);
    return () => window.clearInterval(t);
  }, [art.length, error]);

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="flex max-w-md animate-rise flex-col items-center gap-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-bad-tint text-bad">
            <TriangleAlert size={26} aria-hidden="true" />
          </span>
          <h1 className="text-title-lg font-bold tracking-[-0.02em]">We couldn’t make that game</h1>
          <p className="text-body text-muted">
            {error} Nothing was lost; you can try again or change your idea.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" icon={<Pencil size={16} />} onClick={onEdit}>
              Change my idea
            </Button>
            <Button icon={<RotateCcw size={16} />} onClick={onRetry}>
              Try again
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 justify-center px-4 py-8 sm:py-10">
      <div className="flex w-full max-w-[560px] animate-rise flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-display text-title-lg font-bold tracking-[-0.02em] sm:text-[40px] sm:leading-[1.1]">
            Making your game
          </h1>
          <p className="mx-auto line-clamp-2 max-w-[520px] text-body text-muted">
            “{prompt.trim()}”
          </p>
        </div>

        <div className="relative aspect-video overflow-hidden rounded-xl bg-stage shadow-3">
          {art.map((t, i) => (
            <div
              key={t.id}
              className={cx(
                'absolute inset-0 transition-opacity duration-700',
                i === shown ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden="true"
            >
              <ThemeArtImage
                theme={t}
                className="scale-[1.06] blur-[1.5px] brightness-[0.7] saturate-[0.85]"
              />
            </div>
          ))}
          <div
            className="skeleton absolute inset-0 opacity-[0.12] mix-blend-screen"
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/70 to-transparent p-5 pt-14">
            <span className="text-body font-semibold text-white" aria-live="polite">
              {last?.stage === 'done'
                ? last.message.replace(/…$/, '')
                : withEllipsis(last?.message ?? 'Getting started')}
            </span>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-white/20"
              role="progressbar"
              aria-label="Progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pct)}
            >
              <div
                className="h-full rounded-full bg-white transition-[width] duration-500 ease-standard"
                style={{ width: `${Math.max(6, pct)}%` }}
              />
            </div>
          </div>
        </div>

        <ol className="flex flex-col gap-0.5">
          {STEPS.map((s, i) => {
            const state = i < current ? 'done' : i === current ? 'active' : 'todo';
            return (
              <li
                key={s.stage}
                className={cx(
                  'flex items-start gap-3.5 rounded-lg px-3 py-2 transition-colors duration-200',
                  state === 'active' && 'bg-surface shadow-1',
                )}
              >
                <span
                  className={cx(
                    'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-200',
                    state === 'done' && 'bg-brand text-on-brand',
                    state === 'active' && 'border-2 border-brand',
                    state === 'todo' && 'border-2 border-line-strong',
                  )}
                  aria-hidden="true"
                >
                  {state === 'done' && <Check size={14} strokeWidth={3} className="animate-pop" />}
                  {state === 'active' && (
                    <span className="size-2 animate-pulse-soft rounded-full bg-brand" />
                  )}
                </span>
                <span className="flex flex-col">
                  <span
                    className={cx(
                      'text-body font-semibold',
                      state === 'todo' ? 'text-muted' : 'text-ink',
                    )}
                  >
                    {s.label}
                    <span className="sr-only">
                      {state === 'done' ? ' (done)' : state === 'active' ? ' (in progress)' : ''}
                    </span>
                  </span>
                  {state === 'active' && (
                    <span className="animate-fade-in text-body-sm text-muted">{s.hint}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="flex justify-center">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </main>
  );
}
