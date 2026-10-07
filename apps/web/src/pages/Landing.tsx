import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Code2, KeyRound, LayoutPanelLeft, MonitorSmartphone, Music, PenTool, Sparkles } from 'lucide-react';
import { SiteFooter, SiteHeader } from '../components/SiteHeader';
import { GameThumb, NeonCityScene } from '../components/GameArt';
import { ButtonLink } from '../components/Button';

const genres = ['Platformer', 'Space shooter', 'Cozy farming', 'Puzzle', 'Roguelike', 'Endless runner'];

const showcase = [
  { title: 'Neon Cat Heist', meta: 'Platformer · Python', kind: 'neon' as const },
  { title: 'Pastel Garden', meta: 'Cozy farming · JavaScript', kind: 'pastel' as const },
  { title: 'Starfall Drift', meta: 'Shooter · JavaScript', kind: 'space' as const },
  { title: 'Ink Samurai', meta: 'Action · Python', kind: 'ink' as const },
];

const steps = [
  ['Describe it', 'Type an idea and pick an art style. AI plans the game, writes the code, draws the vector art and composes the music.'],
  ['Refine it your way', 'Chat to change anything, or switch to Pro mode for the scene editor, inspector, Python or JS scripts, sprites and music.'],
  ['Ship it everywhere', 'Publish to a shareable link in one click, or export real builds for Windows, macOS, Linux and Android.'],
];

const features = [
  { icon: LayoutPanelLeft, title: 'Pro editor, simple when you want', body: 'Hierarchy, inspector, tilemaps and animation, with Simple mode a click away.' },
  { icon: Code2, title: 'JavaScript and Python', body: 'One degamed library in two languages, with full autocomplete.' },
  { icon: Music, title: 'Degamed Composer', body: 'Synths, drums, a piano roll and adaptive music that reacts to gameplay.' },
  { icon: PenTool, title: 'Gorgeous vector art', body: 'Crisp SVG sprites, glow, particles and parallax look great at any size.' },
  { icon: MonitorSmartphone, title: 'Export everywhere', body: 'Web, Windows, macOS, Linux and Android, packaged right in your browser.' },
  { icon: KeyRound, title: 'Bring your own AI key', body: 'Use your Anthropic, OpenAI or free Gemini key. It stays in your browser.' },
];

export function Landing() {
  const navigate = useNavigate();
  const [idea, setIdea] = useState('');

  const start = (e?: FormEvent, preset?: string) => {
    e?.preventDefault();
    const prompt = preset ?? idea.trim();
    navigate(prompt ? `/new?idea=${encodeURIComponent(prompt)}` : '/new');
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="mx-auto flex max-w-[1240px] flex-col items-center gap-5 px-6 pt-16 pb-10 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1.5 text-[13px] text-muted">
          <span className="size-2 rounded-full bg-ok" />
          Python scripting and the Degamed Composer are on the way
        </span>
        <h1 className="max-w-[900px] font-display text-5xl leading-[1.02] font-bold tracking-[-0.035em] sm:text-7xl">
          Make stunning 2D games. <span className="text-cyan">Just describe them.</span>
        </h1>
        <p className="max-w-[680px] text-lg leading-relaxed text-muted">
          An AI-powered game engine in your browser. Describe your idea and AI builds it, then keep going by hand in
          a pro editor with JavaScript or Python, music and vector art.
        </p>
        <form
          onSubmit={start}
          className="mt-3 flex w-full max-w-[760px] flex-wrap gap-2 rounded-2xl border border-line-strong bg-panel p-2 shadow-[0_20px_60px_rgba(107,78,255,0.18)]"
        >
          <label htmlFor="hero-idea" className="sr-only">
            Describe your game
          </label>
          <input
            id="hero-idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="A neon cyberpunk platformer where a cat hacks drones…"
            className="min-w-0 flex-1 bg-transparent px-3.5 py-3 text-[17px] text-white outline-none placeholder:text-muted"
          />
          <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-brand px-5 font-semibold text-white hover:bg-[#5A3DF0]">
            <Sparkles size={18} aria-hidden="true" />
            Build my game
          </button>
        </form>
        <div className="flex flex-wrap justify-center gap-2">
          {genres.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => start(undefined, `A ${g.toLowerCase()} game`)}
              className="rounded-full border border-line-strong px-3.5 py-2 text-sm text-ink-2 hover:text-white"
            >
              {g}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-6 pt-6 pb-16">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {showcase.map((g) => (
            <article key={g.title} className="overflow-hidden rounded-2xl border border-line bg-panel">
              {g.kind === 'neon' ? <NeonCityScene title={`${g.title} screenshot`} /> : <GameThumb kind={g.kind} title={`${g.title} screenshot`} />}
              <div className="flex flex-col gap-1 px-4 py-3.5">
                <strong>{g.title}</strong>
                <span className="text-[13px] text-muted">{g.meta}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 px-6 pb-16">
        {steps.map(([title, body], i) => (
          <div key={title} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-[#13151B] p-7">
            <span className="font-mono text-[13px] text-cyan">0{i + 1}</span>
            <h3 className="font-display text-2xl">{title}</h3>
            <p className="leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto flex max-w-[1240px] flex-col gap-6 px-6 pb-16">
        <div className="flex max-w-[720px] flex-col gap-2.5">
          <h2 className="font-display text-4xl tracking-tight sm:text-5xl">A real engine under the magic</h2>
          <p className="text-[17px] leading-relaxed text-muted">
            Everything the AI makes is yours to open and edit. Scenes, scripts, sprites and songs are all real files
            in a professional editor.
          </p>
        </div>
        <div className="flex flex-wrap overflow-hidden rounded-[18px] border border-line bg-panel">
          <div className="flex flex-[1_1_300px] flex-col gap-3 border-line p-5 text-sm sm:border-r">
            <span className="text-xs tracking-widest text-muted uppercase">AI Copilot</span>
            <span className="max-w-[85%] self-end rounded-[12px_12px_4px_12px] bg-line px-3 py-2.5">
              Make the drones shoot lasers at the cat
            </span>
            <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-panel-2 p-3">
              <span>Plan</span>
              <span className="text-ok">✓ Add Laser prefab with glow</span>
              <span className="text-ok">✓ drone.py: fire every 2s when near</span>
              <span className="text-ok">✓ Hurt flash and screen shake</span>
              <span className="text-warn">● Play-testing…</span>
            </div>
          </div>
          <div className="min-w-0 flex-[999_1_560px] bg-[#0B0618]">
            <NeonCityScene />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 px-6 pb-16">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex flex-col gap-2 rounded-2xl border border-line bg-panel p-6">
            <Icon size={28} className="text-cyan" strokeWidth={1.8} aria-hidden="true" />
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-[15px] leading-normal text-muted">{body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto flex max-w-[1240px] flex-col items-center gap-6 px-6 pb-20 text-center">
        <h2 className="font-display text-4xl tracking-tight sm:text-5xl">Start free. Upgrade when you ship.</h2>
        <ButtonLink to="/pricing" variant="outline">
          Compare plans
        </ButtonLink>
      </section>

      <SiteFooter />
    </div>
  );
}
