/**
 * Heroes: never promise a hero the art can't draw.
 *
 * A theme can list hero variants (`heroes`, from the art team's `ArtTheme.heroes`). When it doesn't,
 * the only hero we can vouch for is the one its `description` names. If the player asks for a
 * creature the chosen theme can't show, the title and story talk about "a little wanderer" instead.
 */
import type { ThemeInfo } from './catalog';
import { words } from './instant';

/** Creature kinds people ask for, with the words that mean them. */
const CREATURES: Record<string, string[]> = {
  robot: ['robot', 'robots', 'bot', 'droid', 'android', 'automaton', 'cyborg', 'mech'],
  cat: ['cat', 'cats', 'kitten', 'kitty', 'kitties'],
  bat: ['bat', 'bats'],
  fox: ['fox', 'foxes'],
  knight: ['knight', 'knights', 'paladin', 'warrior'],
  frog: ['frog', 'frogs', 'toad'],
  bird: ['bird', 'birds', 'owl', 'crow', 'sparrow', 'penguin', 'duck', 'chick'],
  rabbit: ['rabbit', 'rabbits', 'bunny', 'bunnies', 'hare'],
  dog: ['dog', 'dogs', 'puppy', 'pup'],
  mouse: ['mouse', 'mice', 'rat', 'hamster'],
  bear: ['bear', 'bears'],
  ghost: ['ghost', 'ghosts', 'spirit', 'phantom'],
  ninja: ['ninja', 'samurai'],
  wizard: ['wizard', 'witch', 'mage', 'sorcerer'],
  dragon: ['dragon', 'dragons'],
  alien: ['alien', 'aliens'],
  astronaut: ['astronaut', 'spaceman'],
  pirate: ['pirate', 'pirates'],
  princess: ['princess', 'prince', 'queen', 'king'],
  girl: ['girl', 'woman', 'lady', 'climber'],
  boy: ['boy', 'man', 'guy'],
  child: ['kid', 'child'],
  bug: ['beetle', 'ant', 'bee', 'moth', 'firefly', 'snail', 'insect'],
  creature: ['creature', 'critter'],
  turtle: ['turtle', 'tortoise'],
  squirrel: ['squirrel', 'hedgehog', 'raccoon'],
  axolotl: ['axolotl', 'lizard', 'salamander', 'gecko'],
  octopus: ['octopus', 'squid'],
  viking: ['viking'],
  monk: ['monk'],
  thief: ['thief', 'rogue'],
};

/** Words that describe any hero: always safe to use. */
const GENERIC = new Set(['hero', 'heroine', 'explorer', 'adventurer', 'wanderer', 'traveller', 'traveler', 'player']);

const KIND_OF = new Map<string, string>(Object.entries(CREATURES).flatMap(([kind, ws]) => ws.map((w) => [w, kind] as const)));

/** The first creature named in some text, e.g. "a little robot looks…" → robot. */
export function creatureIn(text: string): { word: string; kind: string } | undefined {
  for (const w of words(text)) {
    const kind = KIND_OF.get(w);
    if (kind) return { word: w, kind };
  }
  return undefined;
}

export interface HeroMatch {
  /** The hero variant id to put in the spec, when the theme lists variants. */
  id?: string;
}

/** Can this theme draw a hero of this kind? Returns the match, or null if it can't. */
export function heroFor(theme: ThemeInfo, kind: string): HeroMatch | null {
  const synonyms = new Set([kind, ...(CREATURES[kind] ?? [])]);
  if (theme.heroes?.length) {
    const hit = theme.heroes.find((h) => [h.id, h.name, ...h.keywords].flatMap((x) => words(x)).some((w) => synonyms.has(w)));
    return hit ? { id: hit.id } : null;
  }
  // No variant list: only the hero the description names is certain.
  return words(theme.description).some((w) => synonyms.has(w)) ? {} : null;
}

/**
 * Rewrites a title or story so it only names creatures the theme can draw. "A little robot looks
 * for its family" on a theme without a robot becomes "A little wanderer looks for its family".
 */
export function drawableText(text: string, theme: ThemeInfo): string {
  const out = text.replace(/[A-Za-z][A-Za-z'-]*/g, (token) => {
    const base = token.toLowerCase().replace(/'s$/, '');
    if (GENERIC.has(base)) return token;
    const kind = KIND_OF.get(base);
    if (!kind || heroFor(theme, kind)) return token;
    const plural = CREATURES[kind]!.indexOf(base) > 0 && /s$/.test(base) && !/ss$/.test(base);
    let swap = plural ? 'wanderers' : 'wanderer';
    if (token[0] === token[0]!.toUpperCase()) swap = swap[0]!.toUpperCase() + swap.slice(1);
    return token.toLowerCase().endsWith("'s") ? `${swap}'s` : swap;
  });
  // "an wanderer" → "a wanderer"
  return out.replace(/\b([Aa])n (wanderers?)\b/g, '$1 $2').replace(/\b([Aa])n ([A-Z]?[a-z]+ wanderer)\b/g, (m, a: string, rest: string) => (/^[aeiou]/i.test(rest) ? m : `${a} ${rest}`));
}
