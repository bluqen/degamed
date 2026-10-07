import { useState } from 'react';
import { Check } from 'lucide-react';
import { SiteFooter, SiteHeader } from '../components/SiteHeader';
import { ButtonLink } from '../components/Button';

// Final prices are not decided yet. Edit these when they are.
const PRICES = {
  ngn: { symbol: '₦', creator: '[₦ PRICE]', pro: '[₦ PRICE]' },
  usd: { symbol: '$', creator: '$6', pro: '$18' },
};

const plans = [
  {
    name: 'Free',
    blurb: 'For learning and playing around',
    price: (c: keyof typeof PRICES) => `${PRICES[c].symbol}0`,
    cta: 'Start free',
    featured: false,
    perks: [
      'Unlimited AI with your own key',
      '30 trial messages on Degamed AI',
      'Web export and Windows (with splash)',
      '3 private projects',
      'Publish to the gallery',
      '500 MB uploads',
    ],
  },
  {
    name: 'Creator',
    blurb: 'For making and shipping games',
    price: (c: keyof typeof PRICES) => PRICES[c].creator,
    cta: 'Upgrade with Paystack',
    featured: true,
    perks: [
      'Everything in Free',
      'Monthly Degamed AI credits',
      'Windows, macOS, Linux and Android exports',
      'No splash screen or badge',
      'Unlimited private projects',
      'Sell on the marketplace and receive tips',
      '5 GB uploads',
    ],
  },
  {
    name: 'Pro',
    blurb: 'For studios and serious creators',
    price: (c: keyof typeof PRICES) => PRICES[c].pro,
    cta: 'Go Pro',
    featured: false,
    perks: [
      'Everything in Creator',
      'More credits, including the best models',
      'Custom domains for your games',
      'Player analytics',
      '3 team seats',
      'Play Store and iOS builds (coming soon)',
    ],
  },
];

export function Pricing() {
  const [currency, setCurrency] = useState<keyof typeof PRICES>('ngn');
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="mx-auto flex max-w-[1240px] flex-col items-center gap-4 px-6 pt-14 pb-6 text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">Pricing that grows with your games</h1>
        <p className="max-w-[640px] text-lg leading-relaxed text-muted">
          Bring your own AI key and Degamed is free forever. Upgrade for AI credits, native builds and selling your
          work.
        </p>
        <div role="group" aria-label="Currency" className="inline-flex rounded-xl border border-line bg-panel p-1">
          {(['ngn', 'usd'] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={currency === c}
              onClick={() => setCurrency(c)}
              className={`min-h-10 rounded-lg px-4 ${currency === c ? 'bg-brand font-semibold text-white' : 'text-muted'}`}
            >
              {c === 'ngn' ? '₦ Naira' : '$ USD'}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 px-6 pt-6 pb-20">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`relative flex flex-col gap-4 rounded-[18px] p-7 ${p.featured ? 'border-2 border-brand bg-[#17142A]' : 'border border-line bg-[#13151B]'}`}
          >
            {p.featured && (
              <span className="absolute -top-3 left-7 rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">
                Most popular
              </span>
            )}
            <div className="flex flex-col gap-1.5">
              <strong className="text-xl">{p.name}</strong>
              <span className="text-muted">{p.blurb}</span>
            </div>
            <div className="font-display text-4xl">
              {p.price(currency)}
              {p.name !== 'Free' && <span className="text-lg text-muted">/month</span>}
            </div>
            <ButtonLink to="/login" variant={p.featured ? 'primary' : 'outline'}>
              {p.cta}
            </ButtonLink>
            <ul className="flex flex-col gap-2.5 text-[15px] text-ink-2">
              {p.perks.map((perk) => (
                <li key={perk} className="flex gap-2">
                  <Check size={18} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" />
                  {perk}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <SiteFooter />
    </div>
  );
}
