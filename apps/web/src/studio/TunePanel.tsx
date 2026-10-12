import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { KITS, type KitParam } from '../lib/game';
import { Button, EmptyState, Segmented, Select, Slider, Switch } from '../ui';
import type { Studio } from './useStudio';

/** "relaxed" → "Relaxed", "boss_rush" → "Boss rush". */
export function humanize(s: string): string {
  const t = s
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Plain words for a slider position, relative to the kit's default ("Normal"). */
export function level(v: number, min: number, max: number, def: number): string {
  if (v === def) return 'Normal';
  if (v < def) return (v - min) / Math.max(1e-9, def - min) < 0.5 ? 'Very low' : 'Low';
  return (v - def) / Math.max(1e-9, max - def) > 0.5 ? 'Very high' : 'High';
}

/** "Jump height (tiles)" → "Jump height": units are for engineers, not players. */
export const plainLabel = (label: string) => label.replace(/\s*\([^)]*\)\s*/g, ' ').trim();

/** Simple controls generated from the kit's params, grouped the way the kit suggests. */
export function TunePanel({
  studio,
  onOpenAdvanced,
}: {
  studio: Studio;
  onOpenAdvanced: () => void;
}) {
  const kit = studio.spec ? KITS.find((k) => k.id === studio.spec!.kit) : undefined;
  if (!studio.spec || !kit) {
    return (
      <EmptyState
        icon={<SlidersHorizontal size={22} />}
        title="Nothing to tune here"
        body="This game was built by hand, so it doesn’t have simple controls. You can still change everything in Advanced."
        action={
          <Button variant="secondary" onClick={onOpenAdvanced}>
            Open Advanced
          </Button>
        }
      />
    );
  }

  const groups = new Map<string, KitParam[]>();
  for (const p of kit.params)
    groups.set(p.group ?? 'Game', [...(groups.get(p.group ?? 'Game') ?? []), p]);
  const values = studio.draftParams ?? {};
  const defaults = Object.fromEntries(kit.params.map((p) => [p.key, p.default]));
  const changed = kit.params.some(
    (p) => values[p.key] !== undefined && values[p.key] !== p.default,
  );

  return (
    <div className="flex flex-col gap-7 p-5">
      {[...groups].map(([group, params]) => (
        <section key={group} aria-labelledby={`tune-${group}`} className="flex flex-col gap-4">
          <h3 id={`tune-${group}`} className="text-body-sm font-semibold text-muted">
            {group}
          </h3>
          <div className="flex flex-col gap-5">
            {params.map((p) => (
              <Control
                key={p.key}
                param={p}
                value={values[p.key] ?? p.default}
                onChange={(v) => studio.setParam(p.key, v, `Change ${plainLabel(p.label).toLowerCase()}`)}
              />
            ))}
          </div>
        </section>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-5">
        <Button
          variant="ghost"
          size="sm"
          icon={<RotateCcw size={15} />}
          disabled={!changed}
          onClick={() => studio.resetParams(defaults)}
        >
          Reset to defaults
        </Button>
        <button
          type="button"
          onClick={onOpenAdvanced}
          className="rounded-sm text-body-sm font-semibold text-brand-ink hover:underline"
        >
          More control in Advanced
        </button>
      </div>
    </div>
  );
}

function Control({
  param: p,
  value,
  onChange,
}: {
  param: KitParam;
  value: number | boolean | string;
  onChange: (v: number | boolean | string) => void;
}) {
  if (p.type === 'boolean')
    return <Switch label={plainLabel(p.label)} checked={Boolean(value)} onChange={onChange} />;
  if (p.type === 'choice') {
    const choices = p.choices ?? [];
    if (choices.length <= 4 && choices.every((c) => humanize(c).length <= 10))
      return (
        <div className="flex flex-col gap-2">
          <span className="text-body text-ink">{plainLabel(p.label)}</span>
          <Segmented
            label={plainLabel(p.label)}
            value={String(value)}
            options={choices.map((c) => ({ value: c, label: humanize(c) }))}
            onChange={onChange}
          />
        </div>
      );
    return (
      <label className="flex flex-col gap-2">
        <span className="text-body text-ink">{plainLabel(p.label)}</span>
        <Select value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {choices.map((c) => (
            <option key={c} value={c}>
              {humanize(c)}
            </option>
          ))}
        </Select>
      </label>
    );
  }
  const min = p.min ?? 0;
  const max = p.max ?? 100;
  const num = Number(value);
  // Show a friendly relative value: 100% is the kit's default.
  const def = Number(p.default) || 1;
  return (
    <Slider
      label={plainLabel(p.label)}
      value={num}
      min={min}
      max={max}
      step={p.step ?? (max - min > 20 ? 1 : 0.1)}
      onChange={onChange}
      format={(v) => level(v, min, max, def)}
    />
  );
}
