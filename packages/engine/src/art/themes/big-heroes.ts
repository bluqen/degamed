/**
 * The original cast for the big (round 2) heroes. Each has a hand-drawn 14 px head with blink
 * and hurt faces, hue-shifted ramps and its own piece of secondary motion:
 *
 * - Pip, a small lantern robot: yellow dome, one big glowing eye, a springy antenna with a bulb,
 *   a patched tarp cape.
 * - Lumen, a moth lantern bearer: feathery antennae, big glowing eyes, a mantle of folded dusty
 *   wings with eyespots, a lantern swinging on a rope.
 * - Fen, a fox kid: big ears, white muzzle, green hooded tunic, a huge bushy tail.
 * - Ash, a forge warden: crested iron helm with a glowing visor, a flame plume, a verdigris cloak
 *   bright enough to stand out against hot brick.
 */
import { Palette } from '../core';
import { bigHeroSheet, type BigCostume } from '../hero2';
import type { HeroVariant, SpriteSheet } from '../types';

/** Pip: a small lantern robot in a tarp cape. */
export function robotBig(): BigCostume {
  const pal = new Palette();
  const [outline, outlineLit] = pal.ramp(['#0b1315', '#2b3a3a']);
  const cloak = pal.ramp(['#2a3328', '#4a5a40', '#6f8254', '#a2b47a']);
  const [l0, l1] = pal.ramp(['#4a5352', '#7d8784']);
  const [b0, b1] = pal.ramp(['#2e3433', '#59615e']);
  const [hand] = pal.ramp(['#8d9592']);
  const cable = pal.ramp(['#2e3433', '#59615e', '#8d9592']);
  const weapon = pal.ramp(['#3a3128', '#b5a888', '#f2ead2']);
  const slash = pal.ramp(['#4fb8c8', '#c4f4ff', '#ffffff']);
  const [o, y, Y] = pal.ramp(['#9a5a1a', '#e09a2a', '#ffd25a']);
  const [r] = pal.ramp(['#7a3a1a']);
  const [m, M] = pal.ramp(['#3e4544', '#7d8784']);
  const [g, E, W] = pal.ramp(['#0e2a30', '#3fe0e8', '#e8ffff']);
  const [bulb, bulbHi] = pal.ramp(['#ff5a3a', '#ffd0a0']);
  const [patch, stitch] = pal.ramp(['#5a4a32', '#c9b07a']);
  const [flash] = pal.ramp(['#ffffff']);
  return {
    pal,
    outline: outline!,
    outlineLit: outlineLit!,
    cloak,
    legs: [l0!, l1!],
    boots: [b0!, b1!],
    hand: hand!,
    scarf: cable,
    weapon,
    slash,
    flash: flash!,
    head: {
      anchorX: 6,
      map: { o: o!, y: y!, Y: Y!, r: r!, m: m!, M: M!, g: g!, E: E!, W: W! },
      rows: [
        '.....mMMm.....',
        '...yyyyyyYY...',
        '..yyyyyyyyYY..',
        '.oyyyyyyyyyYY.',
        '.oyyyyyggggyY.',
        'ooyyyyggEEEgyY',
        'ooyyyygEEWEEgy',
        'ooyryygEEEEEgy',
        'ooyyyyggEEEgyy',
        '.ooyyyyggggyy.',
        '.oMMMMMMMMMMM.',
        '..mmmmmmmmmm..',
      ],
    },
    blink: { 5: 'ooyyyyggggggyY', 6: 'ooyyyygEEEEEgy', 7: 'ooyryygggggggy', 8: 'ooyyyyggggggyy' },
    hurtFace: { 5: 'ooyyyyggEgEgyY', 6: 'ooyyyyggWEggyy', 7: 'ooyryyggEgEgyy', 8: 'ooyyyyggggggyy' },
    scarfLen: 6,
    scarfWidth: 1,
    chainRoot: 'head',
    chainAt: [7, 0],
    chainMode: 'up',
    chainTip: { rows: ['.b.', 'bBb', '.b.'], map: { b: bulb!, B: bulbHi! } },
    emblem: { rows: ['pppp', 'pspp', 'ppsp', 'pppp'], map: { p: patch!, s: stitch! }, dx: -4, dy: -3 },
    weaponLen: 12,
    hemCut: 1,
  };
}

/** Lumen: a moth lantern bearer. */
export function mothBig(): BigCostume {
  const pal = new Palette();
  const [outline, outlineLit] = pal.ramp(['#120a14', '#3a2a40']);
  const cloak = pal.ramp(['#3a2a40', '#6a5072', '#a0849e', '#d6c2cc']);
  const [l0, l1] = pal.ramp(['#2a1e30', '#4a3a52']);
  const [b0, b1] = pal.ramp(['#1e1624', '#3a2e42']);
  const [hand] = pal.ramp(['#d8c8b8']);
  const rope = pal.ramp(['#5a4630', '#8a6e48', '#b89868']);
  const weapon = pal.ramp(['#6a4a20', '#f0b040', '#fff0b0']);
  const slash = pal.ramp(['#e0a040', '#ffe0a0', '#fffaf0']);
  const [d, f, F] = pal.ramp(['#8a7c78', '#d8ccc0', '#f6f0e6']);
  const [a, A] = pal.ramp(['#6a5a50', '#c8b49a']);
  const [e, E, W] = pal.ramp(['#0e3a40', '#46d8d0', '#e0fffa']);
  const [spotO, spotI] = pal.ramp(['#4a2a1a', '#e0a040']);
  const [lg, lG, lW] = pal.ramp(['#a0601a', '#ffc04a', '#fff6c0']);
  const [lf] = pal.ramp(['#3a2a20']);
  const [flash] = pal.ramp(['#ffffff']);
  return {
    pal,
    outline: outline!,
    outlineLit: outlineLit!,
    cloak,
    legs: [l0!, l1!],
    boots: [b0!, b1!],
    hand: hand!,
    scarf: rope,
    weapon,
    slash,
    flash: flash!,
    head: {
      anchorX: 6,
      map: { d: d!, f: f!, F: F!, a: a!, A: A!, e: e!, E: E!, W: W! },
      rows: [
        'A..........A..',
        'aA.A.....AaA..',
        '.aaA....AaaA..',
        '..aaa..aaa....',
        '....affffa....',
        '...dfffFFFf...',
        '..dffffffFFf..',
        '.dffeEffffeEE.',
        'dfffEEffeEEWE.',
        'dfffEEffeEEEEf',
        'dffffeffeEEEEf',
        '.dfffffffeeef.',
        '..dFFfFFFfFF..',
        '...dFFFdFFd...',
      ],
    },
    blink: { 7: '.dffffffffffff', 8: 'dfffeeffeeeeef', 9: 'dfffffffffffff', 10: 'dfffffffffffff' },
    hurtFace: { 7: '.dffeEffffeEE.', 8: 'dfffEEffeEWEE.', 9: 'dfffeeffeeeeef', 10: 'dfffffffffffff' },
    scarfLen: 5,
    scarfWidth: 1,
    chainRoot: 'hand',
    chainAt: [0, 1],
    chainMode: 'hang',
    chainFront: true,
    chainTip: { rows: ['.f.', 'fff', 'gGg', 'GWG', 'gGg', 'fff'], map: { f: lf!, g: lg!, G: lG!, W: lW! } },
    emblem: { rows: ['.oo.', 'oiio', 'oiio', '.oo.'], map: { o: spotO!, i: spotI! }, dx: -6, dy: -4 },
    weaponLen: 11,
  };
}

/** Fen: a fox kid with a huge bushy tail. */
export function foxBig(): BigCostume {
  const pal = new Palette();
  const [outline, outlineLit] = pal.ramp(['#2a1a1e', '#5a3a2e']);
  const cloak = pal.ramp(['#1e4a2e', '#2f6e3e', '#4a9a50', '#86c870']);
  const [l0, l1] = pal.ramp(['#4a2e26', '#6e4434']);
  const [b0, b1] = pal.ramp(['#2e1e1e', '#4a3030']);
  const [hand] = pal.ramp(['#e07a32']);
  const tail = pal.ramp(['#a8461a', '#e07a32', '#ffaa5a']);
  const [tip] = pal.ramp(['#fff6ea']);
  const weapon = pal.ramp(['#5a3a20', '#b98a52', '#f0d8a0']);
  const slash = pal.ramp(['#ffb36b', '#fff0c2', '#ffffff']);
  const [r, o, O] = pal.ramp(['#a8461a', '#e07a32', '#ffaa5a']);
  const [w, W] = pal.ramp(['#e8d8c8', '#fffaf2']);
  const [i] = pal.ramp(['#f0a0a0']);
  const [n, e] = pal.ramp(['#1e1418', '#2a1a1e']);
  const [scarf] = pal.ramp(['#ffd25e']);
  const [flash] = pal.ramp(['#ffffff']);
  return {
    pal,
    outline: outline!,
    outlineLit: outlineLit!,
    cloak,
    legs: [l0!, l1!],
    boots: [b0!, b1!],
    hand: hand!,
    scarf: tail,
    weapon,
    slash,
    flash: flash!,
    head: {
      anchorX: 6,
      map: { r: r!, o: o!, O: O!, w: w!, W: W!, i: i!, n: n!, e: e!, s: scarf! },
      rows: [
        '..r.......r...',
        '..rr.....roO..',
        '..rir...rioO..',
        '..riroooorioO.',
        '..rooooooooOO.',
        '.roooooooooooO',
        'rrooooooeooo..',
        'rroooooeeoowW.',
        'rrooooowwWWWWW',
        '.rooowwwWWWWWn',
        '..rrwwwwWWW...',
        '...sssssss....',
      ],
    },
    blink: { 6: 'rrooooooooooo.', 7: 'rroooooeeoowW.' },
    hurtFace: { 6: 'rrooooooeooo..', 7: 'rrooooeooeowW.' },
    scarfLen: 8,
    scarfWidth: 4,
    chainRoot: 'hip',
    chainAt: [-4, 2],
    chainWidths: [3, 4, 5, 5, 5, 5, 4, 3, 2],
    chainTipColor: tip!,
    chainTipFrom: 0.72,
    weaponLen: 12,
    hemCut: 3,
  };
}

/** Ash: a forge warden with a crested helm and a flame plume. */
export function emberBig(): BigCostume {
  const pal = new Palette();
  const [outline, outlineLit] = pal.ramp(['#0a0508', '#a0521e']);
  // a light verdigris cloak so the hero stays well above the hot, dark brick in value
  const cloak = pal.ramp(['#1f5a5a', '#3a8a82', '#62b8a4', '#a8ecd2']);
  const [l0, l1] = pal.ramp(['#4a3a36', '#7a6458']);
  const [b0, b1] = pal.ramp(['#6e5a54', '#a48c7c']);
  const [hand] = pal.ramp(['#a48c7c']);
  const flame = pal.ramp(['#e0461a', '#ffa03a', '#ffe68a']);
  const weapon = pal.ramp(['#4a3a3a', '#d8c4b4', '#fff6e8']);
  const slash = pal.ramp(['#e0561e', '#ffc35a', '#fff6d6']);
  const [m, M, h] = pal.ramp(['#7a6458', '#b89c84', '#f4dcc0']);
  const [g, G] = pal.ramp(['#ff8a2a', '#fff0a0']);
  const [flash] = pal.ramp(['#ffffff']);
  return {
    pal,
    outline: outline!,
    outlineLit: outlineLit!,
    cloak,
    legs: [l0!, l1!],
    boots: [b0!, b1!],
    hand: hand!,
    scarf: flame,
    weapon,
    slash,
    flash: flash!,
    head: {
      anchorX: 6,
      map: { m: m!, M: M!, h: h!, g: g!, G: G! },
      rows: [
        '......hh......',
        '.....mMhm.....',
        '....mMMhMm....',
        '...mMMMhMMm...',
        '..mMMMMMMMMm..',
        '.mMMMMMMMMMMm.',
        '.mMMMMMMMMMMMm',
        'mmMMgGGGggggGg',
        'mmMMMMMMMMMMMm',
        'mmMMMMhMMhMMm.',
        '.mmMMMMMMMMm..',
        '..mmmmmmmmm...',
      ],
    },
    blink: { 7: 'mmMMgggggggggg' },
    hurtFace: { 7: 'mmMMGGGGGGGGGG' },
    headRim: [m!, M!],
    scarfLen: 9,
    scarfWidth: 3,
    chainFromHead: [6, 0],
    weaponLen: 15,
  };
}

/** The cast: every theme offers all of them (its own hero first), so prompts can pick one. */
export const CAST: { id: string; name: string; keywords: string[]; costume: () => BigCostume }[] = [
  { id: 'robot', name: 'Pip the lantern robot', keywords: ['robot', 'droid', 'android', 'machine', 'bot', 'mech', 'cyborg'], costume: robotBig },
  { id: 'moth', name: 'Lumen the moth', keywords: ['moth', 'bug', 'insect', 'butterfly', 'lantern', 'wings', 'beetle'], costume: mothBig },
  { id: 'fox', name: 'Fen the fox', keywords: ['fox', 'animal', 'critter', 'kid', 'child', 'cub', 'furry'], costume: foxBig },
  { id: 'warden', name: 'Ash the forge warden', keywords: ['knight', 'warrior', 'soldier', 'armor', 'armour', 'helmet', 'guard', 'hero'], costume: emberBig },
];

const sheets = new Map<string, SpriteSheet>();

/** The sprite sheet for a cast member, built once and shared by every theme. */
export function castSheet(id: string): SpriteSheet {
  let s = sheets.get(id);
  if (!s) {
    const c = CAST.find((x) => x.id === id) ?? CAST[0]!;
    s = bigHeroSheet(c.costume());
    sheets.set(id, s);
  }
  return s;
}

/** All cast members as hero variants, with `first` at the front. Sheets build on first access. */
export function castFor(first: string): HeroVariant[] {
  const order = [...CAST].sort((a, b) => (a.id === first ? -1 : b.id === first ? 1 : 0));
  return order.map((c) => {
    const v = { id: c.id, name: c.name, keywords: c.keywords } as HeroVariant;
    Object.defineProperty(v, 'sheet', { enumerable: true, get: () => castSheet(c.id) });
    return v;
  });
}
