/**
 * Quick-action chips for the Studio chat. Every spec chip is checked against free instant mode,
 * so clicking one always works, instantly and at no cost, whichever provider is selected.
 */
import type { ProjectFiles } from '@degamed/shared';
import { getBackend } from './catalog';
import { instantEdit } from './instant';

const GENERIC = ['Make it harder', 'Add more enemies', 'Floatier jumps', 'Make it night', 'Make it faster'];

/** Creative chips that need a real model (they change code, not just the spec). */
const AI_CHIPS = ['Add a dash move', 'Enemies shoot back', 'Add a boss at the end', 'Add a secret area', 'Add a timer'];

export function suggestions(files: ProjectFiles, opts: { ai?: boolean } = {}): string[] {
  const backend = getBackend();
  const spec = backend.readSpec(files);
  if (!spec) return opts.ai ? [...GENERIC.slice(0, 4), AI_CHIPS[0]!] : GENERIC;
  const seed = spec.seed ?? 0;

  const works = (chip: string) => {
    const r = instantEdit(chip, spec, backend);
    return r.understood && JSON.stringify(r.spec) !== JSON.stringify(spec);
  };
  const first = (...chips: string[]) => chips.find(works);

  const others = backend.themes.filter((t) => t.id !== spec.theme);
  const rotated = others.length ? [...others.slice(seed % others.length), ...others.slice(0, seed % others.length)] : [];

  const picks = [
    first('Make it night', 'Make it day'),
    first('Make it harder', 'Make it easier'),
    first('Floatier jumps', 'Snappier jumps'),
    first('Add more enemies', 'Fewer enemies'),
    first(...rotated.map((t) => `Set it in the ${t.name}`)),
    first('Make it faster', 'Make the level longer', 'Add more coins', 'Add a double jump'),
  ].filter((c): c is string => !!c);

  if (opts.ai) picks.splice(Math.min(4, picks.length), 0, AI_CHIPS[seed % AI_CHIPS.length]!);
  const unique = [...new Set(picks)];
  for (const g of GENERIC) if (unique.length < 4 && !unique.includes(g)) unique.push(g);
  return unique.slice(0, 6);
}
