import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowRight, Dices, Gamepad2, MoreHorizontal, Sparkles, Trash2 } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { ThemeArtImage, ThemeCard } from '../components/ThemeCard';
import { Generating } from '../components/Generating';
import { createGame, encode, KITS, themes, type Progress, type ThemeArt } from '../lib/game';
import { currentAi, PROVIDER_LABEL } from '../lib/ai-settings';
import { listGames, newGameId, removeGame, saveGame, type GameEntry } from '../lib/library';
import { timeAgo } from '../lib/projects';
import { Button, Card, IconButton, Kbd, Menu, Tooltip, cx, useToast } from '../ui';

/** Hand-written starting points, one per look. Real themes without one get a generated line. */
const THEME_PROMPTS: Record<string, string> = {
  meadow: 'A cheerful platformer where a tiny knight collects coins on the way to the castle',
  'rain-ruins': 'A moody rain-soaked platformer where a little robot looks for its family',
  'ember-caves': 'A lava cave adventure where a fire sprite escapes before the volcano wakes up',
  'frost-peaks': 'A snowy mountain climb where a penguin races to the summit before sunset',
  'neon-night': 'A neon cyberpunk runner where a cat hacker dodges drones over the rooftops',
};

const EXAMPLES = [
  'A moody rain-soaked platformer where a little robot looks for its family',
  'A cosy forest game where a fox collects glowing mushrooms',
  'A neon city runner where a cat hacker dodges drones',
];

export const promptForTheme = (t: ThemeArt) => THEME_PROMPTS[t.id] ?? `A platformer set in ${t.name.toLowerCase()}: ${t.description.replace(/\.$/, '').toLowerCase()}`;

type Phase = { kind: 'idle' } | { kind: 'working'; progress: Progress[] } | { kind: 'error'; message: string };

export function Create() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [prompt, setPrompt] = useState(params.get('prompt') ?? '');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [games, setGames] = useState<GameEntry[]>(listGames);
  const abort = useRef<AbortController | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const allThemes = useMemo(themes, []);
  const ai = useMemo(currentAi, []);

  useEffect(() => {
    document.title = 'Make a game · Degamed';
  }, []);

  const make = async (text = prompt) => {
    const idea = text.trim();
    if (!idea) {
      box.current?.focus();
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setPhase({ kind: 'working', progress: [] });
    window.scrollTo({ top: 0 });
    const t0 = Date.now();
    try {
      const result = await createGame({
        prompt: idea,
        settings: ai.settings,
        encode,
        signal: ctrl.signal,
        onProgress: (p) => setPhase((ph) => (ph.kind === 'working' ? { kind: 'working', progress: [...ph.progress, p] } : ph)),
      });
      // Instant mode can finish in a blink; let the steps land so the moment registers.
      const rest = 1600 - (Date.now() - t0);
      if (rest > 0) {
        setPhase((ph) => (ph.kind === 'working' ? { kind: 'working', progress: [...ph.progress, { stage: 'done', message: 'Ready to play' }] } : ph));
        await new Promise((r) => window.setTimeout(r, rest));
      }
      if (ctrl.signal.aborted) return;
      const id = newGameId();
      const ok = saveGame({ id, title: result.title, prompt: idea, kit: result.spec.kit, theme: result.spec.theme }, result.files);
      if (result.notice) toast({ tone: 'info', title: 'Made with free instant mode', body: result.notice, duration: 7000 });
      if (!ok) toast({ tone: 'error', title: 'This device is out of space', body: 'Your game will play, but delete an old game to keep it.' });
      navigate(`/editor/${id}`, { state: { fresh: true, summary: result.summary } });
    } catch (e) {
      if (ctrl.signal.aborted) {
        setPhase({ kind: 'idle' });
        return;
      }
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  };

  // Arriving from the landing page with ?prompt=…&go=1 starts right away.
  const started = useRef(false);
  useEffect(() => {
    if (!started.current && params.get('go') === '1' && prompt.trim()) {
      started.current = true;
      void make(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase.kind !== 'idle') {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <Generating
          prompt={prompt}
          progress={phase.kind === 'working' ? phase.progress : []}
          error={phase.kind === 'error' ? phase.message : null}
          onCancel={() => {
            abort.current?.abort();
            setPhase({ kind: 'idle' });
          }}
          onRetry={() => void make()}
          onEdit={() => {
            setPhase({ kind: 'idle' });
            window.setTimeout(() => box.current?.focus(), 0);
          }}
        />
      </div>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void make();
  };

  const surprise = () => {
    const pool = [...EXAMPLES, ...allThemes.map(promptForTheme)];
    const next = pool.filter((p) => p !== prompt)[Math.floor(Math.random() * (pool.length - 1))]!;
    setPrompt(next);
    box.current?.focus();
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="flex-1">
        {/* Describe */}
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-40 h-[520px] bg-[radial-gradient(60%_60%_at_50%_30%,var(--c-brand-tint-2),transparent_70%)] opacity-70" />
          <div className="relative mx-auto flex max-w-[760px] flex-col items-center px-4 pt-14 pb-12 text-center sm:px-6 sm:pt-20">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-caption font-semibold text-ink-2 shadow-1">
              <Sparkles size={13} className="text-brand-ink" aria-hidden="true" />
              Free to try · no sign-up
            </span>
            <h1 className="mt-5 font-display text-[40px] leading-[1.05] font-bold tracking-[-0.03em] text-balance sm:text-[56px]">What do you want to play?</h1>
            <p className="mt-4 max-w-[520px] text-body-lg text-muted text-pretty">Describe a game in a sentence. We’ll build it in under a minute, and you can change anything after.</p>

            <form onSubmit={submit} className="mt-9 w-full">
              <Card className="flex flex-col p-2 shadow-3 transition-shadow duration-200 focus-within:shadow-[var(--shadow-3),0_0_0_3px_var(--c-brand-tint-2)] focus-within:border-brand">
                <label htmlFor="prompt" className="sr-only">
                  Describe your game
                </label>
                <textarea
                  id="prompt"
                  ref={box}
                  value={prompt}
                  autoFocus
                  rows={3}
                  maxLength={600}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                      e.preventDefault();
                      void make();
                    }
                  }}
                  placeholder="A moody rain-soaked platformer where a little robot looks for its family…"
                  className="min-h-28 w-full resize-none bg-transparent px-3 pt-3 text-left text-body-lg text-ink placeholder:text-faint focus:outline-none focus-visible:outline-none"
                />
                <div className="flex flex-wrap items-center gap-2 border-t border-line px-1 pt-2">
                  <Button variant="ghost" size="sm" icon={<Dices size={16} />} onClick={surprise}>
                    Surprise me
                  </Button>
                  <Tooltip label="Change in Settings">
                    <Link to="/settings" className="hidden h-8 items-center gap-1.5 rounded-sm px-2 text-body-sm text-muted hover:bg-surface-2 hover:text-ink sm:inline-flex">
                      <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
                      {PROVIDER_LABEL[ai.settings.provider]}
                    </Link>
                  </Tooltip>
                  <span className="ml-auto hidden items-center gap-1 text-caption text-faint md:inline-flex">
                    <Kbd>Enter</Kbd> to make it
                  </span>
                  <Button type="submit" size="md" disabled={!prompt.trim()} iconEnd={<ArrowRight size={18} aria-hidden="true" />} className="max-sm:ml-auto">
                    Make my game
                  </Button>
                </div>
              </Card>
            </form>

            <div className="mt-5 flex w-full flex-col items-center gap-2.5">
              <span className="text-caption font-semibold text-muted">Or try one of these</span>
              <ul className="flex max-w-full flex-wrap justify-center gap-2">
                {EXAMPLES.map((ex) => (
                  <li key={ex} className="max-w-full">
                    <button
                      type="button"
                      onClick={() => {
                        setPrompt(ex);
                        box.current?.focus();
                      }}
                      className="max-w-full truncate rounded-full border border-line bg-surface px-3.5 py-1.5 text-body-sm text-ink-2 shadow-1 transition-colors hover:border-line-strong hover:text-ink"
                    >
                      {ex}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <div className="mx-auto flex max-w-[1200px] flex-col gap-16 px-4 pb-24 sm:px-6">
          {games.length > 0 && (
            <section aria-labelledby="your-games" className="flex flex-col gap-5">
              <SectionHead id="your-games" title="Your games" body="Saved on this device." />
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {games.slice(0, 8).map((g) => {
                  const theme = allThemes.find((t) => t.id === g.theme) ?? allThemes[0]!;
                  return (
                    <li key={g.id}>
                      <Card interactive className="group relative flex h-full flex-col overflow-hidden">
                        <div className="aspect-video overflow-hidden bg-stage">
                          <ThemeArtImage theme={theme} className="transition-transform duration-300 group-hover:scale-[1.04]" />
                        </div>
                        <div className="flex items-start gap-2 p-4">
                          <div className="flex min-w-0 flex-1 flex-col">
                            <Link to={`/editor/${g.id}`} className="truncate text-body font-semibold text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                              {g.title}
                            </Link>
                            <span className="text-body-sm text-muted">Edited {timeAgo(new Date(g.updatedAt).toISOString())}</span>
                          </div>
                          <div className="relative z-10">
                            <Menu
                              label={`${g.title} options`}
                              width={180}
                              trigger={
                                <IconButton label="More options" size="sm" aria-haspopup="menu">
                                  <MoreHorizontal size={18} />
                                </IconButton>
                              }
                              items={[
                                {
                                  label: 'Delete',
                                  icon: <Trash2 size={16} />,
                                  danger: true,
                                  onSelect: () => {
                                    removeGame(g.id);
                                    setGames(listGames());
                                    toast({ tone: 'info', title: `Deleted “${g.title}”` });
                                  },
                                },
                              ]}
                            />
                          </div>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-labelledby="looks" className="flex flex-col gap-5">
            <SectionHead id="looks" title="Start from a look" body="Every game is drawn in a hand-made art style. Pick one for ideas." />
            <ul className={cx('grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-5 sm:gap-y-6', allThemes.length % 3 === 0 ? 'lg:grid-cols-3' : allThemes.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
              {allThemes.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPrompt(promptForTheme(t));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      box.current?.focus({ preventScroll: true });
                    }}
                    className="group w-full rounded-xl text-left"
                  >
                    <ThemeCard theme={t} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="kinds" className="flex flex-col gap-5">
            <SectionHead id="kinds" title="Kinds of game" body="Mention one in your idea, or let us pick." />
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {KITS.map((k, i) => (
                <li key={k.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPrompt(`A ${k.name.toLowerCase()} where `);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      box.current?.focus({ preventScroll: true });
                    }}
                    className="w-full text-left"
                  >
                    <Card interactive className="flex items-center gap-4 p-3 pr-5">
                      <span className="size-16 shrink-0 overflow-hidden rounded-lg bg-stage">
                        <ThemeArtImage theme={allThemes[(i + 1) % allThemes.length]!} width={96} height={96} />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-2 text-body font-semibold text-ink">
                          <Gamepad2 size={16} className="text-brand-ink" aria-hidden="true" />
                          {k.name}
                        </span>
                        <span className="text-body-sm text-muted">{k.description}</span>
                      </span>
                    </Card>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}

function SectionHead({ id, title, body }: { id: string; title: string; body?: string }) {
  return (
    <div className={cx('flex flex-col gap-1')}>
      <h2 id={id} className="text-title font-bold tracking-[-0.01em]">
        {title}
      </h2>
      {body && <p className="text-body text-muted">{body}</p>}
    </div>
  );
}
