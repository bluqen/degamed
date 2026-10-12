import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Check, Gamepad2, KeyRound, Link2, MessageCircle, Smartphone, Sparkles, Zap } from 'lucide-react';
import { SiteFooter, SiteHeader } from '../components/SiteHeader';
import { Stage } from '../components/Stage';
import { ThemeArtImage } from '../components/ThemeCard';
import { demoGame, themes } from '../lib/game';
import { themePreview } from '../lib/game/preview';
import { Button, ButtonLink, Card, Segmented, Slider, Switch, cx } from '../ui';

const EXAMPLES = ['A rainy platformer about a lost robot', 'A lava cave escape', 'A neon rooftop runner with a cat hacker'];

export function Landing() {
  const navigate = useNavigate();
  const [idea, setIdea] = useState('');
  const allThemes = useMemo(themes, []);
  const demoTheme = allThemes[0]!;
  const poster = useMemo(() => themePreview(demoTheme, 480, 270), [demoTheme]);

  useEffect(() => {
    document.title = 'Degamed: describe a game, play it, share it';
  }, []);

  const start = (e?: FormEvent, preset?: string) => {
    e?.preventDefault();
    const prompt = (preset ?? idea).trim();
    navigate(prompt ? `/create?prompt=${encodeURIComponent(prompt)}&go=1` : '/create');
  };

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(50%_55%_at_50%_0%,var(--c-brand-tint-2),transparent_75%)]" />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(30%_40%_at_80%_20%,var(--c-accent-tint),transparent_70%)] opacity-80" />
        <div className="mx-auto flex max-w-[1200px] flex-col items-center px-4 pt-16 text-center sm:px-6 sm:pt-24">
          <span className="inline-flex h-7 animate-rise items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-caption font-semibold text-ink-2 shadow-1">
            <Sparkles size={13} className="text-brand-ink" aria-hidden="true" />
            An AI game maker for everyone
          </span>
          <h1 className="mt-6 animate-rise font-display text-[48px] leading-[0.98] font-bold tracking-[-0.04em] text-balance sm:text-[80px] lg:text-[96px]">
            Describe it.{' '}
            <span className="bg-gradient-to-r from-[#7457ff] to-[#14b8d4] bg-clip-text text-transparent dark:from-[#9b85ff] dark:to-[#4fd8ef]">Play it.</span> Share it.
          </h1>
          <p className="mt-6 max-w-[620px] animate-rise text-body-lg text-balance text-muted sm:text-[19px] sm:leading-8">
            Type one sentence and play a game that looks like a real indie game in under a minute. Change it by chatting, then send a link anyone can play.
          </p>

          <form onSubmit={start} className="mt-9 flex w-full max-w-[640px] animate-rise flex-col gap-2 rounded-2xl border border-line bg-surface p-2 shadow-3 transition-shadow focus-within:border-brand focus-within:shadow-[var(--shadow-3),0_0_0_3px_var(--c-brand-tint-2)] sm:flex-row">
            <label htmlFor="hero-idea" className="sr-only">
              Describe your game
            </label>
            <input
              id="hero-idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="A moody platformer about a lost little robot"
              className="h-12 min-w-0 flex-1 bg-transparent px-3 text-body-lg text-ink placeholder:text-faint focus:outline-none focus-visible:outline-none"
            />
            <Button type="submit" size="lg" iconEnd={<ArrowRight size={18} aria-hidden="true" />}>
              Make my game
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => start(undefined, ex)}
                className="h-8 rounded-full border border-line bg-surface/70 px-3 text-body-sm text-ink-2 backdrop-blur transition-colors hover:border-line-strong hover:text-ink"
              >
                {ex}
              </button>
            ))}
          </div>
          <p className="mt-4 text-caption text-muted">Free · no sign-up · works on phones</p>

          {/* Live demo */}
          <div className="relative mt-14 w-full max-w-[1040px] pb-16 sm:mt-20">
            <div className="rounded-[22px] border border-line bg-surface p-2 shadow-4">
              <Stage files={demoGame} title="Demo game" poster={poster} autoStart={false} startLabel="Play the demo" startHint="A real game, running right here. No download." rounded className="rounded-[16px]" />
            </div>
            <FloatCard className="top-[18%] -left-6 hidden lg:flex xl:-left-24">
              <span className="self-end rounded-xl rounded-br-xs bg-brand px-3 py-1.5 text-body-sm text-on-brand">Make the jumps floatier</span>
              <span className="flex items-start gap-2 text-body-sm text-ink">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
                  <Sparkles size={11} aria-hidden="true" />
                </span>
                Done: jumps are higher and floatier.
              </span>
            </FloatCard>
            <FloatCard className="right-[-1.5rem] bottom-[22%] hidden w-60 lg:flex xl:-right-20">
              <span className="text-caption font-semibold text-muted">Tune</span>
              <MiniBar label="Jump height" pct={72} />
              <MiniBar label="Run speed" pct={48} />
            </FloatCard>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 sm:py-28">
          <SectionIntro eyebrow="How it works" title="From an idea to a game you can share" body="No code, no downloads, no art skills. If you can describe it, you can make it." />
          <ol className="mt-14 grid gap-6 md:grid-cols-3">
            <Step n={1} title="Describe it" body="Say what you want in plain words: the hero, the goal, the mood.">
              <div className="flex h-full flex-col justify-center gap-2 p-5">
                <div className="rounded-lg border border-line bg-surface p-3 text-left text-body-sm text-ink shadow-1">
                  A snowy mountain climb where a penguin races to the top
                  <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse-soft bg-brand" />
                </div>
                <div className="flex justify-end">
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-brand px-3 text-body-sm font-semibold text-on-brand">
                    Make my game <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </div>
              </div>
            </Step>
            <Step n={2} title="Play it" body="In under a minute you’re playing: real pixel art, light, weather and game feel.">
              <div className="relative h-full">
                <ThemeArtImage theme={allThemes[3] ?? demoTheme} />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-white/95 text-[#15141d] shadow-3">
                    <Gamepad2 size={22} aria-hidden="true" />
                  </span>
                </span>
              </div>
            </Step>
            <Step n={3} title="Share it" body="Send a link. Friends play on a phone or a computer, and can remix it.">
              <div className="flex h-full flex-col justify-center gap-3 p-5">
                <div className="flex items-center gap-2 rounded-lg border border-line bg-surface p-2 pl-3 shadow-1">
                  <Link2 size={15} className="shrink-0 text-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-left font-mono text-caption text-ink-2">degamed.app/p/penguin-peak</span>
                  <span className="inline-flex h-7 items-center gap-1 rounded-sm bg-ok-tint px-2 text-caption font-semibold text-ok">
                    <Check size={13} aria-hidden="true" /> Copied
                  </span>
                </div>
                <div className="flex items-center gap-2 text-body-sm text-muted">
                  <Smartphone size={15} aria-hidden="true" /> Touch controls on phones, built in
                </div>
              </div>
            </Step>
          </ol>
        </div>
      </section>

      {/* Art */}
      <section className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 sm:py-28">
        <SectionIntro eyebrow="Looks like a real game" title="Hand-made art styles, not clip art" body="Every game is drawn in a crafted pixel-art style with layered backgrounds, light and atmosphere. Switch styles any time." />
        <ul className="mt-12 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-6">
          {allThemes.slice(0, 5).map((t, i) => (
            <li key={t.id} className={cx('group overflow-hidden rounded-xl border border-line bg-surface shadow-1', i < 2 ? 'col-span-2 lg:col-span-3' : 'col-span-1 lg:col-span-2', i === 4 && 'max-lg:col-span-2')}>
              <div className="aspect-video overflow-hidden bg-stage">
                <ThemeArtImage theme={t} width={i < 2 ? 480 : 320} height={i < 2 ? 270 : 180} className="transition-transform duration-500 ease-standard group-hover:scale-[1.03]" />
              </div>
              <div className="flex flex-col gap-0.5 px-4 py-3">
                <span className="text-body font-semibold">{t.name}</span>
                <span className="line-clamp-1 text-body-sm text-muted">{t.description}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Change it */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-2 lg:gap-20">
          <div className="flex flex-col gap-6">
            <SectionIntro align="left" eyebrow="Change anything" title="Talk to your game" body="Ask for what you want and watch it change. Prefer knobs? Every game comes with simple controls for speed, jumps, enemies and more." />
            <ul className="flex flex-col gap-3 text-body text-ink-2">
              {['“Make it night-time and rainy”', '“Add more enemies near the end”', '“Make the hero faster”'].map((x) => (
                <li key={x} className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
                    <MessageCircle size={14} aria-hidden="true" />
                  </span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <TuneDemo />
        </div>
      </section>

      {/* Cost */}
      <section className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 sm:py-28">
        <SectionIntro eyebrow="Free to start" title="Make games without a bill" body="Use instant mode for free, forever. Want smarter changes? Bring your own AI key, and pay your provider directly." />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <Feature icon={<Zap size={18} />} title="Instant mode" body="Free and works offline. Picks a game and a look from your words in a second." />
          <Feature icon={<KeyRound size={18} />} title="Your own AI key" body="Add a Gemini, OpenAI or Anthropic key. It stays in your browser, never on our servers." />
          <Feature icon={<Smartphone size={18} />} title="Plays everywhere" body="Every game runs in the browser with touch controls, so a link is all anyone needs." />
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-6">
        <div className="relative flex flex-col items-center gap-6 overflow-hidden rounded-2xl bg-[#15121f] px-6 py-16 text-center text-white sm:py-20">
          <div aria-hidden="true" className="absolute inset-0">
            <ThemeArtImage theme={allThemes[4] ?? demoTheme} width={640} height={200} />
          </div>
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_45%,rgb(21_18_31/0.85),rgb(21_18_31/0.35))]" />
          <h2 className="relative font-display text-[36px] leading-[1.05] font-bold tracking-[-0.03em] text-balance sm:text-[52px]">Your first game is one sentence away</h2>
          <ButtonLink to="/create" size="lg" variant="inverse" className="relative" iconEnd={<ArrowRight size={18} aria-hidden="true" />}>
            Start creating
          </ButtonLink>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function FloatCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('absolute flex w-64 flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5 text-left shadow-4', className)}>{children}</div>;
}

function MiniBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex justify-between text-body-sm text-ink">
        {label}
        <span className="text-muted tabular-nums">{pct * 2}%</span>
      </span>
      <span className="relative h-1 rounded-full bg-surface-3">
        <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${pct}%` }} />
        <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_1px_3px_rgb(0_0_0/0.3)]" style={{ left: `${pct}%` }} />
      </span>
    </div>
  );
}

function SectionIntro({ eyebrow, title, body, align = 'center' }: { eyebrow: string; title: string; body: string; align?: 'center' | 'left' }) {
  return (
    <div className={cx('flex flex-col gap-3', align === 'center' ? 'mx-auto max-w-[640px] items-center text-center' : 'max-w-[520px]')}>
      <span className="text-body-sm font-semibold text-brand-ink">{eyebrow}</span>
      <h2 className="font-display text-[32px] leading-[1.1] font-bold tracking-[-0.03em] text-balance sm:text-[44px]">{title}</h2>
      <p className="text-body-lg text-muted text-pretty">{body}</p>
    </div>
  );
}

function Step({ n, title, body, children }: { n: number; title: string; body: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-5">
      <div className="aspect-[16/10] overflow-hidden rounded-xl border border-line bg-bg">{children}</div>
      <div className="flex gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-caption font-bold text-bg">{n}</span>
        <div className="flex flex-col gap-1">
          <h3 className="text-subtitle font-semibold">{title}</h3>
          <p className="text-body text-muted">{body}</p>
        </div>
      </div>
    </li>
  );
}

function Feature({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <Card className="flex flex-col gap-3 p-6">
      <span className="flex size-10 items-center justify-center rounded-md bg-brand-tint text-brand-ink">{icon}</span>
      <h3 className="text-subtitle font-semibold">{title}</h3>
      <p className="text-body text-muted">{body}</p>
    </Card>
  );
}

/** Real controls (not a picture of them) so the section feels alive. */
function TuneDemo() {
  const [jump, setJump] = useState(330);
  const [speed, setSpeed] = useState(150);
  const [enemies, setEnemies] = useState(true);
  const [mood, setMood] = useState('normal');
  const pct = (v: number, d: number) => (v === d ? 'Normal' : `${Math.round((v / d) * 100)}%`);
  return (
    <Card className="flex flex-col gap-6 p-6 shadow-3 sm:p-8">
      <div className="flex items-center justify-between">
        <h3 className="text-subtitle font-semibold">Tune</h3>
        <span className="text-caption text-muted">Try them</span>
      </div>
      <Slider label="Jump height" value={jump} min={200} max={520} step={10} onChange={setJump} format={(v) => pct(v, 330)} />
      <Slider label="Run speed" value={speed} min={80} max={280} step={10} onChange={setSpeed} format={(v) => pct(v, 150)} />
      <Switch label="Enemies" description="Slimes patrol the level" checked={enemies} onChange={setEnemies} />
      <div className="flex flex-col gap-2">
        <span className="text-body">Difficulty</span>
        <Segmented
          label="Difficulty"
          value={mood}
          onChange={setMood}
          options={[
            { value: 'relaxed', label: 'Relaxed' },
            { value: 'normal', label: 'Normal' },
            { value: 'tricky', label: 'Tricky' },
          ]}
        />
      </div>
    </Card>
  );
}
