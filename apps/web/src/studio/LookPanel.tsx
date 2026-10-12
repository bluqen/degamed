import { Palette } from 'lucide-react';
import { useMemo } from 'react';
import { ThemeCard } from '../components/ThemeCard';
import { themes } from '../lib/game';
import { EmptyState } from '../ui';
import type { Studio } from './useStudio';

/** Switch the game's art theme. Each card is real art from that theme. */
export function LookPanel({ studio }: { studio: Studio }) {
  const all = useMemo(themes, []);
  if (!studio.spec) {
    return <EmptyState icon={<Palette size={22} />} title="The look is fixed" body="This game was built by hand. Change its art in Advanced." />;
  }
  const current = all.find((t) => t.id === studio.spec!.theme);
  return (
    <div className="flex flex-col gap-4 p-5">
      <p className="text-body-sm text-muted">
        Now: <strong className="font-semibold text-ink">{current?.name ?? studio.spec.theme}</strong>. {current?.description}
      </p>
      <div role="radiogroup" aria-label="Look" className="grid grid-cols-2 gap-2">
        {all.map((t) => (
          <ThemeCard key={t.id} name="studio-theme" size="sm" theme={t} selected={t.id === studio.spec!.theme} onSelect={() => studio.setTheme(t.id, t.name)} />
        ))}
      </div>
    </div>
  );
}
