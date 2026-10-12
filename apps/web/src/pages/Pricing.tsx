import { Check, KeyRound, Sparkles, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from '../components/SiteHeader';
import { ButtonLink, Card, cx } from '../ui';

const PLANS: { icon: ReactNode; name: string; price: string; blurb: string; points: string[]; featured?: boolean }[] = [
  {
    icon: <Zap size={18} />,
    name: 'Instant mode',
    price: 'Free',
    blurb: 'No AI needed. Picks a game and a look from your words in a second.',
    points: ['Unlimited games', 'Works offline', 'Tune, change the look and share'],
  },
  {
    icon: <Sparkles size={18} />,
    name: 'Degamed AI',
    price: 'Free daily allowance',
    blurb: 'Smarter changes by chat, with a small number of AI requests each day.',
    points: ['A few AI edits per day', 'Falls back to instant mode at the limit', 'No card needed'],
    featured: true,
  },
  {
    icon: <KeyRound size={18} />,
    name: 'Your own AI key',
    price: 'Free',
    blurb: 'Bring a Gemini, OpenAI or Anthropic key. You pay your provider directly.',
    points: ['No daily limit from us', 'Your key stays in your browser', 'Pick the model you like'],
  },
];

/** While in beta, everything is free. Paid plans will be announced here before they start. */
export function Pricing() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-center px-4 py-16 sm:px-6 sm:py-24">
        <span className="text-body-sm font-semibold text-brand-ink">Pricing</span>
        <h1 className="mt-3 text-center font-display text-[40px] leading-[1.05] font-bold tracking-[-0.03em] text-balance sm:text-[56px]">
          Free while we’re in beta
        </h1>
        <p className="mt-4 max-w-[560px] text-center text-body-lg text-balance text-muted">
          Make, play and share as many games as you like. If we ever add paid extras, we’ll tell you well before anything changes.
        </p>
        <div className="mt-14 grid w-full gap-5 md:grid-cols-3">
          {PLANS.map((p) => (
            <Card key={p.name} className={cx('relative flex flex-col gap-5 p-6', p.featured && 'border-brand shadow-[0_0_0_1px_var(--c-brand)]')}>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-md bg-brand-tint text-brand-ink">{p.icon}</span>
                <div className="flex flex-col">
                  <h2 className="text-subtitle font-semibold">{p.name}</h2>
                  <span className="text-body-sm font-semibold text-muted">{p.price}</span>
                </div>
              </div>
              <p className="text-body text-muted">{p.blurb}</p>
              <ul className="flex flex-col gap-2.5 text-body">
                {p.points.map((x) => (
                  <li key={x} className="flex items-start gap-2.5">
                    <Check size={16} className="mt-1 shrink-0 text-ok" aria-hidden="true" />
                    {x}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <ButtonLink to="/create" size="lg" className="mt-12">
          Start creating
        </ButtonLink>
      </main>
      <SiteFooter />
    </div>
  );
}
