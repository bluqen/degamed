/**
 * Free instant mode: no AI, no network. Keyword, synonym and intent matching turns a prompt into
 * a game spec, and a chat request into a spec change. Runs in well under a millisecond.
 */
import type { GameBackend, KitInfo, ThemeInfo } from './catalog';
import { sanitizeParams, type GameSpec, type KitParam } from './protocol';

// ---------------------------------------------------------------------------------------------
// Words

const STOP = new Set(
  'a an the and or of to in on at for with without from by into is it its it\'s this that game games make made where who which about my me i want some very really super so like little big small'.split(' '),
);

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\- ]+/g, ' ')
    .split(/\s+/)
    .flatMap((w) => [w, ...(w.includes('-') ? w.split('-') : [])])
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

/** Mood and setting concepts, each with the words that evoke it. */
const CONCEPTS: Record<string, string[]> = {
  dark: ['night', 'midnight', 'spooky', 'creepy', 'haunted', 'scary', 'horror', 'eerie', 'ghost', 'ghosts', 'gloomy', 'dark', 'darkness', 'shadow', 'shadows', 'cave', 'caves', 'cavern', 'caverns', 'underground', 'crypt', 'tomb', 'bones', 'skeleton', 'bug', 'bugs', 'insect', 'hollow', 'abyss', 'mysterious', 'gothic', 'halloween', 'spider', 'mine', 'mines'],
  rain: ['rain', 'rainy', 'raining', 'storm', 'stormy', 'wet', 'soaked', 'moody', 'melancholy', 'melancholic', 'sad', 'lonely', 'ruins', 'ruin', 'ruined', 'abandoned', 'overgrown', 'drizzle', 'flood', 'flooded', 'grey', 'gray', 'puddles', 'atmospheric', 'apocalypse', 'post-apocalyptic'],
  sunny: ['happy', 'cheerful', 'sunny', 'sunlit', 'bright', 'cute', 'cozy', 'cosy', 'wholesome', 'meadow', 'meadows', 'field', 'fields', 'grass', 'grassy', 'flower', 'flowers', 'spring', 'summer', 'farm', 'kid', 'kids', 'colorful', 'colourful', 'sweet', 'joyful', 'fun', 'hills', 'countryside', 'village', 'garden'],
  snow: ['snow', 'snowy', 'ice', 'icy', 'frozen', 'winter', 'cold', 'frost', 'frosty', 'arctic', 'mountain', 'mountains', 'christmas', 'penguin', 'glacier', 'blizzard'],
  fire: ['fire', 'lava', 'volcano', 'volcanic', 'hell', 'inferno', 'forge', 'molten', 'dragon', 'ember', 'embers', 'burning', 'hot', 'flames', 'magma', 'demon'],
  tech: ['neon', 'cyber', 'cyberpunk', 'city', 'robot', 'robots', 'futuristic', 'future', 'sci-fi', 'scifi', 'factory', 'machine', 'machines', 'android', 'laser', 'lasers', 'synth', 'synthwave', 'hacker', 'mech'],
  forest: ['forest', 'jungle', 'woods', 'woodland', 'tree', 'trees', 'fairy', 'elf', 'elves', 'mushroom', 'mushrooms', 'swamp', 'nature', 'moss', 'mossy', 'leaves'],
  water: ['ocean', 'sea', 'underwater', 'water', 'fish', 'beach', 'island', 'pirate', 'pirates', 'reef', 'coral', 'mermaid', 'shark', 'tide'],
  space: ['space', 'stars', 'star', 'alien', 'aliens', 'galaxy', 'planet', 'planets', 'moon', 'cosmic', 'astronaut', 'rocket', 'ufo', 'nebula', 'spaceship'],
  desert: ['desert', 'sand', 'sandy', 'pyramid', 'pyramids', 'egypt', 'dune', 'dunes', 'cactus', 'western', 'cowboy', 'oasis'],
  castle: ['castle', 'knight', 'knights', 'medieval', 'kingdom', 'king', 'queen', 'princess', 'dungeon', 'sword', 'wizard', 'magic', 'fortress', 'tower'],
};

/** Best theme id for a mood when it exists in the catalogue (the art team's named themes). */
const MOOD_THEME: Record<string, string> = { dark: 'hollow-caverns', rain: 'rain-ruins', sunny: 'sunlit-meadow' };

/** Genre words per kit id (adds to each kit's own keywords). */
const KIT_WORDS: Record<string, string[]> = {
  platformer: ['platformer', 'platforming', 'platform', 'platforms', 'jump', 'jumping', 'mario', 'celeste', 'side-scroller', 'sidescroller', 'scroller', 'metroidvania', 'hop', 'precision'],
  runner: ['runner', 'endless', 'auto-runner', 'autorunner', 'infinite', 'dash', 'escape', 'chase', 'flappy'],
  topdown: ['top-down', 'topdown', 'zelda', 'dungeon', 'crawler', 'rpg', 'explore', 'exploring', 'exploration', 'maze', 'overhead', 'roguelike', 'twin-stick', 'adventure'],
  shooter: ['shooter', 'shmup', 'shoot', 'shooting', 'shoot-em-up', 'spaceship', 'bullet', 'bullets', 'blaster', 'gun', 'guns', 'asteroids', 'invaders', 'galaga'],
  puzzle: ['puzzle', 'puzzles', 'sokoban', 'block', 'blocks', 'brain', 'logic'],
};

function conceptsOf(ws: string[]): Set<string> {
  const out = new Set<string>();
  for (const w of ws) for (const [c, list] of Object.entries(CONCEPTS)) if (list.includes(w)) out.add(c);
  return out;
}

function themeWords(t: ThemeInfo): string[] {
  return [...t.keywords.flatMap((k) => words(k)), ...words(t.id), ...words(t.name), ...words(t.description)].filter((w) => !STOP.has(w));
}

/** Scores every theme against some words. Higher is better. */
export function scoreThemes(themes: ThemeInfo[], ws: string[]): { theme: ThemeInfo; score: number }[] {
  const promptConcepts = conceptsOf(ws);
  const set = new Set(ws.filter((w) => !STOP.has(w)));
  return themes.map((theme) => {
    const tw = themeWords(theme);
    const keywords = new Set(theme.keywords.flatMap((k) => words(k)));
    let score = 0;
    for (const w of set) {
      if (keywords.has(w)) score += 3;
      else if (tw.includes(w)) score += 1;
    }
    const tc = conceptsOf(tw);
    for (const c of promptConcepts) {
      if (tc.has(c)) score += 2;
      if (MOOD_THEME[c] === theme.id) score += 2;
    }
    return { theme, score };
  });
}

function kitWords(k: KitInfo): string[] {
  return [...k.keywords.flatMap((w) => words(w)), ...(KIT_WORDS[k.id] ?? []), ...words(k.id), ...words(k.name)];
}

export function scoreKits(kits: KitInfo[], ws: string[]): { kit: KitInfo; score: number }[] {
  const joined = new Set([...ws, ...ws.slice(1).map((w, i) => `${ws[i]}-${w}`), ...ws.slice(1).map((w, i) => `${ws[i]}${w}`)]);
  return kits.map((kit) => {
    let score = 0;
    for (const w of new Set(kitWords(kit))) if (joined.has(w)) score += 3;
    return { kit, score };
  });
}

// ---------------------------------------------------------------------------------------------
// Knobs: generic intents mapped onto whatever params a kit has

export type Knob = 'difficulty' | 'enemies' | 'length' | 'jump' | 'gravity' | 'speed' | 'night' | 'pickups' | 'lives' | 'doubleJump';

const KNOB_PATTERNS: Record<Knob, RegExp> = {
  difficulty: /difficult|challenge/i,
  enemies: /enem|monster|foe|baddie/i,
  length: /length|level ?size|screens|distance|rooms|levels/i,
  jump: /^(?!.*double).*jump/i,
  gravity: /gravity|weight/i,
  speed: /speed|pace/i,
  night: /night|time of day|darkness/i,
  pickups: /coin|gem|pickup|collectible|star|orb/i,
  lives: /lives|health|hearts|hp\b/i,
  doubleJump: /double.?jump|air.?jump/i,
};

export function paramsFor(kit: KitInfo, knob: Knob): KitParam[] {
  return kit.params.filter((p) => KNOB_PATTERNS[knob].test(`${p.key} ${p.label}`) || KNOB_PATTERNS[knob].test(p.key.replace(/([a-z])([A-Z])/g, '$1 $2')));
}

const currentLevel = (p: KitParam, value: unknown): number => {
  const v = value ?? p.default;
  if (p.type === 'number') {
    const min = p.min ?? 0;
    const max = p.max ?? min + 1;
    return max === min ? 0.5 : (Number(v) - min) / (max - min);
  }
  if (p.type === 'choice') {
    const list = p.choices ?? [];
    const i = list.findIndex((c) => c === v);
    return list.length > 1 ? Math.max(0, i) / (list.length - 1) : 0.5;
  }
  return v === true ? 1 : 0;
};

const valueAt = (p: KitParam, level: number): number | boolean | string => {
  const l = Math.min(1, Math.max(0, level));
  if (p.type === 'number') {
    const min = p.min ?? 0;
    const max = p.max ?? min + 1;
    return sanitizeParams({ [p.key]: min + l * (max - min) }, [p])['params'][p.key]!;
  }
  if (p.type === 'choice') {
    const list = p.choices ?? [String(p.default)];
    return list[Math.round(l * (list.length - 1))]!;
  }
  return l >= 0.5;
};

type Params = Record<string, number | boolean | string>;

/** Sets a knob to an absolute level (0..1) or moves it by a delta. Returns true if anything changed. */
function turn(kit: KitInfo, params: Params, knob: Knob, change: { to: number } | { by: number }): boolean {
  let changed = false;
  for (const p of paramsFor(kit, knob)) {
    const before = params[p.key] ?? p.default;
    let level = 'to' in change ? change.to : currentLevel(p, before) + change.by;
    // A choice must move at least one step when nudged.
    if (p.type === 'choice' && 'by' in change && (p.choices?.length ?? 0) > 1) {
      const n = p.choices!.length - 1;
      const i = Math.round(currentLevel(p, before) * n);
      level = (i + Math.sign(change.by) * Math.max(1, Math.round(Math.abs(change.by) * n))) / n;
    }
    const next = valueAt(p, level);
    if (next !== before) {
      params[p.key] = next;
      changed = true;
    }
  }
  return changed;
}

// ---------------------------------------------------------------------------------------------
// Prompt → spec

const NUMBER_WORDS: Record<string, number> = { no: 0, zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30 };
const NOUN_KNOB: [RegExp, Knob][] = [
  [/^(enem|monster|foe|baddie|slime)/, 'enemies'],
  [/^(level|screen|room|stage)/, 'length'],
  [/^(coin|gem|star|orb|pickup|collectible)/, 'pickups'],
  [/^(li[fv]e|heart|hp)/, 'lives'],
];

interface Rule {
  re: RegExp;
  knobs: [Knob, { to: number } | { by: number }][];
  say?: string;
}

const CREATE_RULES: Rule[] = [
  { re: /\b(very|super|really|extremely|insanely|crazy)\s+(hard|difficult|tough|challenging)\b|\b(brutal|insane|nightmare|punishing|souls-?like|masocore|impossible|hardcore)\b/, knobs: [['difficulty', { to: 1 }], ['enemies', { to: 0.85 }]] },
  { re: /\b(hard|difficult|tough|challenging)\b/, knobs: [['difficulty', { to: 0.75 }], ['enemies', { to: 0.65 }]] },
  { re: /\b(very|super|really)\s+easy\b|\b(toddler|baby|preschool)\b/, knobs: [['difficulty', { to: 0 }], ['enemies', { to: 0.1 }]] },
  { re: /\b(easy|relaxing|relaxed|chill|casual|cozy|cosy|gentle|kids?|beginners?|wholesome)\b/, knobs: [['difficulty', { to: 0.2 }], ['enemies', { to: 0.2 }]] },
  { re: /\b(no|without)\s+(enemies|monsters|foes)\b|\bpacifist\b|\bpeaceful\b/, knobs: [['enemies', { to: 0 }]] },
  { re: /\b(lots of|loads of|many|tons of|swarms? of|hordes? of|full of|packed with)\s+(enemies|monsters|foes|baddies)\b/, knobs: [['enemies', { to: 0.9 }]] },
  { re: /\b(short|quick|tiny|bite-sized|mini)\b/, knobs: [['length', { to: 0 }]] },
  { re: /\b(long|epic|huge|massive|sprawling|endless)\b/, knobs: [['length', { to: 0.9 }]] },
  { re: /\b(floaty|floating|low[- ]gravity|moon|feather|bouncy)\b/, knobs: [['gravity', { to: 0.15 }], ['jump', { to: 0.65 }]] },
  { re: /\b(heavy|weighty|high[- ]gravity)\b/, knobs: [['gravity', { to: 0.8 }]] },
  { re: /\b(fast|speedy|frantic|zippy|zoomy|fast-paced|speedrun)\b/, knobs: [['speed', { to: 0.8 }]] },
  { re: /\b(slow|sluggish|slow-paced)\b/, knobs: [['speed', { to: 0.2 }]] },
  { re: /\b(night|midnight|nighttime|night-time|moonlit|starry)\b/, knobs: [['night', { to: 1 }]] },
  { re: /\bdouble[- ]?jumps?\b/, knobs: [['doubleJump', { to: 1 }]] },
  { re: /\b(lots of|loads of|many|tons of|full of)\s+(coins|gems|stars|treasure|loot)\b/, knobs: [['pickups', { to: 0.9 }]] },
];

function applyCounts(kit: KitInfo, params: Params, text: string): void {
  const re = /\b(\d{1,3}|no|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty)\s+(?:\w+\s+)?(enem\w*|monsters?|foes?|baddies?|slimes?|levels?|screens?|rooms?|stages?|coins?|gems?|stars?|orbs?|lives|li[fv]es?|hearts?)\b/g;
  for (const m of text.matchAll(re)) {
    const n = /^\d+$/.test(m[1]!) ? Number(m[1]) : NUMBER_WORDS[m[1]!]!;
    const knob = NOUN_KNOB.find(([r]) => r.test(m[2]!))?.[1];
    if (!knob) continue;
    for (const p of paramsFor(kit, knob)) if (p.type === 'number') params[p.key] = sanitizeParams({ [p.key]: n }, [p]).params[p.key]!;
  }
}

/** Small deterministic hash so the same prompt always gives the same game. */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const HEROES = ['robot', 'cat', 'kitten', 'knight', 'fox', 'frog', 'girl', 'boy', 'ninja', 'wizard', 'witch', 'ghost', 'slime', 'astronaut', 'dragon', 'bird', 'bunny', 'rabbit', 'dog', 'puppy', 'princess', 'prince', 'pirate', 'alien', 'bear', 'mouse', 'bee', 'samurai', 'kid', 'owl', 'penguin', 'snail', 'duck', 'hedgehog', 'raccoon', 'mushroom', 'droid', 'android', 'explorer', 'thief', 'monk', 'squirrel', 'goblin', 'skeleton', 'hero', 'blob', 'cube', 'lantern', 'spirit', 'firefly', 'moth', 'turtle', 'axolotl', 'octopus', 'cyborg', 'viking'];

const ADJ: Record<string, string[]> = {
  dark: ['Hollow', 'Silent', 'Forgotten', 'Lantern', 'Deep'],
  rain: ['Rainlit', 'Drowned', 'Grey', 'Quiet', 'Rusted'],
  sunny: ['Bright', 'Sunny', 'Golden', 'Happy', 'Clover'],
  snow: ['Frostbitten', 'Winter', 'Pale', 'Frozen'],
  fire: ['Ember', 'Cinder', 'Molten', 'Ashen'],
  tech: ['Neon', 'Chrome', 'Static', 'Circuit'],
  forest: ['Mossy', 'Wild', 'Hidden', 'Thorn'],
  water: ['Tidal', 'Sunken', 'Salt', 'Coral'],
  space: ['Starbound', 'Orbital', 'Cosmic', 'Lunar'],
  desert: ['Sunbaked', 'Dusty', 'Mirage', 'Amber'],
  castle: ['Iron', 'Crowned', 'Old', 'Gilded'],
  none: ['Tiny', 'Brave', 'Lost', 'Last', 'Little'],
};
const HOME_GOALS = ['family', 'home', 'mom', 'mum', 'mother', 'dad', 'father', 'parents', 'friends', 'friend', 'way', 'pack', 'flock'];

const cap = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** "the robot" in "...where a little robot looks for its family" */
function heroOf(ws: string[]): string | undefined {
  return ws.find((w) => HEROES.includes(w));
}

function goalOf(text: string): string | undefined {
  const m = /\b(?:find|finds|finding|save|saves|saving|rescue|rescues|rescuing|look(?:s|ing)? for|search(?:es|ing)? for|seek(?:s|ing)?|reach(?:es|ing)?|return(?:s|ing)? to|get(?:s|ting)? back to|escape(?:s)?(?: from)?)\s+(?:(?:its|his|her|their|the|a|an|my|lost|missing|long-lost)\s+)*([a-z]+)/i.exec(text);
  return m?.[1]?.toLowerCase();
}

function explicitTitle(text: string): string | undefined {
  const m = /\b(?:called|named|titled)\s+["“']?([^"”'.,!?]{2,40})["”']?/i.exec(text) ?? /["“]([^"”]{2,40})["”]/.exec(text);
  if (!m) return undefined;
  const name = m[1]!.split(/\s+(?:about|where|with|in|on|that|who|which|featuring|starring|set|for)\b/i)[0]!.trim();
  return name ? cap(name) : undefined;
}

export function instantTitle(prompt: string, theme: ThemeInfo, seed: number): string {
  const given = explicitTitle(prompt);
  if (given) return given;
  const ws = words(prompt);
  const mood = [...conceptsOf(ws)][0] ?? [...conceptsOf(themeWords(theme))][0] ?? 'none';
  const adjs = ADJ[mood] ?? ADJ.none!;
  const adj = adjs[seed % adjs.length]!;
  const hero = heroOf(ws);
  const goal = goalOf(prompt);
  const place = theme.name.split(' ').at(-1) ?? theme.name;
  const options: string[] = [];
  if (hero) {
    const H = cap(hero);
    options.push(`The ${adj} ${H}`, `${H} of the ${place}`);
    if (goal && HOME_GOALS.includes(goal)) options.push(`${H}'s Long Way Home`, `Little ${H}, Far From Home`);
    else if (goal) options.push(`${H} and the ${adj} ${cap(goal)}`);
  } else {
    if (goal) options.push(`The ${adj} ${cap(goal)}`);
    options.push(`${adj} ${place}`, `Beyond the ${place}`);
  }
  return options[(seed >>> 3) % options.length]!;
}

export function instantStory(prompt: string, theme: ThemeInfo): string {
  const clause = /\b(?:where|about|in which|starring|following)\s+(.{6,140}?)(?:[.!?]|$)/i.exec(prompt)?.[1];
  if (clause && clause.trim().split(/\s+/).length >= 3) {
    const s = clause
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^((?:an?|the|one)\s+(?:[a-z-]+\s+)?[a-z-]+)\s+(?:who|that)\s+/i, '$1 ');
    const sentence = s.charAt(0).toUpperCase() + s.slice(1);
    return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
  }
  const hero = heroOf(words(prompt));
  return hero ? `A brave little ${hero} sets out across the ${theme.name}.` : `An adventure across the ${theme.name}.`;
}

export interface InstantResult {
  spec: GameSpec;
  /** What instant mode understood, for progress messages and tests. */
  notes: string[];
}

/** Prompt → spec with no AI. Always returns a valid spec for the given backend. */
export function instantSpec(prompt: string, backend: Pick<GameBackend, 'kits' | 'themes'>): InstantResult {
  const text = prompt.toLowerCase();
  const ws = words(prompt);
  const seed = hash(prompt.trim().toLowerCase());
  const notes: string[] = [];

  const kits = scoreKits(backend.kits, ws).sort((a, b) => b.score - a.score);
  const kit = kits[0]!.score > 0 ? kits[0]!.kit : (backend.kits.find((k) => k.id === 'platformer') ?? backend.kits[0]!);
  notes.push(`kit:${kit.id}`);

  const themes = scoreThemes(backend.themes, ws).sort((a, b) => b.score - a.score);
  const top = themes[0]!.score;
  // No signal: pick a theme from the prompt's hash, so vague prompts still get variety.
  const theme = top > 0 ? themes.filter((t) => t.score === top)[seed % themes.filter((t) => t.score === top).length]!.theme : backend.themes[seed % backend.themes.length]!;
  notes.push(`theme:${theme.id}`);

  const params: Params = {};
  for (const rule of CREATE_RULES) {
    if (!rule.re.test(text)) continue;
    for (const [knob, change] of rule.knobs) {
      // Earlier (stronger) rules win: don't let "hard" override "very hard".
      if (paramsFor(kit, knob).some((p) => p.key in params)) continue;
      turn(kit, params, knob, change);
    }
  }
  applyCounts(kit, params, text);
  const changed = Object.fromEntries(Object.entries(params).filter(([k, v]) => kit.params.find((p) => p.key === k)?.default !== v));

  const spec: GameSpec = { kit: kit.id, theme: theme.id, title: instantTitle(prompt, theme, seed), story: instantStory(prompt, theme), seed: seed % 100000 };
  if (Object.keys(changed).length) spec.params = changed;
  return { spec, notes };
}

// ---------------------------------------------------------------------------------------------
// Chat request → spec change

const EDIT_RULES: Rule[] = [
  { re: /\b(much|way|a lot)\s+(harder|tougher|more difficult)\b/, knobs: [['difficulty', { by: 0.5 }], ['enemies', { by: 0.4 }]], say: 'Made it a lot harder' },
  { re: /\b(harder|tougher|more difficult|more challenging|more of a challenge)\b/, knobs: [['difficulty', { by: 0.25 }], ['enemies', { by: 0.2 }]], say: 'Made it harder' },
  { re: /\b(much|way|a lot)\s+easier\b/, knobs: [['difficulty', { by: -0.5 }], ['enemies', { by: -0.4 }]], say: 'Made it a lot easier' },
  { re: /\b(easier|less difficult|simpler|too hard|more forgiving)\b/, knobs: [['difficulty', { by: -0.25 }], ['enemies', { by: -0.2 }]], say: 'Made it easier' },
  { re: /\b(no|remove( all)?( the)?|get rid of( the)?)\s+(enemies|monsters|foes|baddies)\b/, knobs: [['enemies', { to: 0 }]], say: 'Removed the enemies' },
  { re: /\b(more|extra|add( more)?)\s+(enemies|monsters|foes|baddies|slimes)\b/, knobs: [['enemies', { by: 0.25 }]], say: 'Added more enemies' },
  { re: /\b(fewer|less)\s+(enemies|monsters|foes|baddies|slimes)\b/, knobs: [['enemies', { by: -0.25 }]], say: 'Removed some enemies' },
  { re: /\b(more|extra|add( more)?)\s+(coins|gems|stars|pickups|treasure|loot)\b/, knobs: [['pickups', { by: 0.3 }]], say: 'Added more coins' },
  { re: /\b(fewer|less)\s+(coins|gems|stars|pickups)\b/, knobs: [['pickups', { by: -0.3 }]], say: 'Removed some coins' },
  { re: /\b(float(y|ier)|low(er)? gravity|less gravity|moon gravity|slower fall)\b/, knobs: [['gravity', { by: -0.2 }]], say: 'Made the jumps floatier' },
  { re: /\b(heavier|more gravity|high(er)? gravity|snappier jumps?|less floaty)\b/, knobs: [['gravity', { by: 0.2 }]], say: 'Made the jumps snappier' },
  { re: /\b(higher|bigger)\s+jumps?\b|\bjump\s+higher\b/, knobs: [['jump', { by: 0.2 }]], say: 'Made the jumps higher' },
  { re: /\b(lower|smaller)\s+jumps?\b|\bjump\s+lower\b/, knobs: [['jump', { by: -0.2 }]], say: 'Made the jumps lower' },
  { re: /\b(faster|speed (it )?up|quicker|zippier)\b/, knobs: [['speed', { by: 0.2 }]], say: 'Sped things up' },
  { re: /\b(slower|slow (it )?down)\b/, knobs: [['speed', { by: -0.2 }]], say: 'Slowed things down' },
  { re: /\b(longer|bigger level|more levels?|extend)\b/, knobs: [['length', { by: 0.25 }]], say: 'Made the level longer' },
  { re: /\b(shorter|smaller level|fewer levels?)\b/, knobs: [['length', { by: -0.25 }]], say: 'Made the level shorter' },
  { re: /\b(night|midnight|nighttime|dark(er)?)\b/, knobs: [['night', { to: 1 }]], say: 'Turned it to night' },
  { re: /\b(day|daytime|daylight|morning|brighter)\b/, knobs: [['night', { to: 0 }]], say: 'Turned it to day' },
  { re: /\bdouble[- ]?jumps?\b/, knobs: [['doubleJump', { to: 1 }]], say: 'Added a double jump' },
  { re: /\b(more|extra)\s+(lives|hearts|health)\b/, knobs: [['lives', { by: 0.25 }]], say: 'Added more lives' },
];

export interface InstantEdit {
  spec: GameSpec;
  summary: string;
  understood: boolean;
}

function themeSwitch(request: string, current: GameSpec, themes: ThemeInfo[]): ThemeInfo | undefined {
  const ws = words(request);
  const scored = scoreThemes(themes, ws)
    .filter((t) => t.theme.id !== current.theme)
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 3) return undefined;
  return best.theme;
}

/** Applies a chat request to a spec with no AI. `understood` is false if nothing matched. */
export function instantEdit(request: string, spec: GameSpec, backend: Pick<GameBackend, 'kits' | 'themes'>): InstantEdit {
  const text = request.toLowerCase();
  const said: string[] = [];
  let next: GameSpec = { ...spec, params: { ...spec.params } };

  // Rename: "call it Moonfall", "rename it to 'Moss & Rust'"
  const rename = /\b(?:call it|rename(?: it| the game)?(?: to)?|name it|title it|change the (?:title|name) to)\s+["“']?([^"”'\n]{1,48}?)["”']?\s*[.!]?$/i.exec(request);
  if (rename) {
    next.title = cap(rename[1]!.trim());
    said.push(`Renamed it to “${next.title}”`);
  }

  // Genre switch: "make it a shooter"
  const kitScores = scoreKits(backend.kits, words(request)).filter((k) => k.kit.id !== spec.kit).sort((a, b) => b.score - a.score);
  if (kitScores[0] && kitScores[0].score >= 3 && /\b(make it|turn it into|change it to|switch to|into)\b/.test(text)) {
    next = { ...next, kit: kitScores[0].kit.id, params: {} };
    said.push(`Turned it into a ${kitScores[0].kit.name.toLowerCase()}`);
  }

  const kit = backend.kits.find((k) => k.id === next.kit) ?? backend.kits[0]!;
  const params: Params = { ...next.params };
  const touched = new Set<Knob>();
  if (!rename) {
    for (const rule of EDIT_RULES) {
      if (!rule.re.test(text)) continue;
      if (rule.knobs.every(([k]) => paramsFor(kit, k).length === 0)) continue;
      // One rule per knob: "much harder" shouldn't also apply "harder".
      if (rule.knobs.some(([k]) => touched.has(k))) continue;
      let any = false;
      for (const [knob, change] of rule.knobs) {
        any = turn(kit, params, knob, change) || any;
        touched.add(knob);
      }
      if (any && rule.say) said.push(rule.say);
    }
  }

  // World switch: "make it snowy", "set it in a spooky cave" (night handled by a param above).
  // If the kit has no night setting, "make it night" falls through to a darker theme.
  if (!rename && !touched.has('night')) {
    const theme = themeSwitch(request, next, backend.themes);
    if (theme) {
      next.theme = theme.id;
      said.push(`Moved it to the ${theme.name}`);
    }
  }

  const clean = Object.fromEntries(Object.entries(params).filter(([k, v]) => kit.params.find((p) => p.key === k)?.default !== v));
  next.params = clean;
  if (!Object.keys(clean).length) delete next.params;
  return {
    spec: next,
    summary: said.length ? `${said.join('. ')}.` : '',
    understood: said.length > 0,
  };
}
