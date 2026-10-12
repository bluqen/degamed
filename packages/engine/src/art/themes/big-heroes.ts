/**
 * Costumes for the big (round 2) heroes: a hand-drawn 14 px head per theme with blink and hurt
 * faces, plus hue-shifted ramps for cloak, legs, boots, hands, scarf and weapon.
 */
import { Palette } from '../core';
import type { BigCostume } from '../hero2';

/** Rain Ruins: a small pale creature with long ears, big dark eyes, a rust scarf and a tail. */
export function rainBig(): BigCostume {
  const pal = new Palette();
  const [outline, outlineLit] = pal.ramp(['#0b1315', '#253537']);
  const cloak = pal.ramp(['#3e4b4e', '#7b8783', '#bfc2b4', '#eceadd']);
  const [l0, l1] = pal.ramp(['#8f998f', '#c9cbbd']);
  const [b0, b1] = pal.ramp(['#6f7a72', '#a9ada0']);
  const [hand] = pal.ramp(['#dcdacb']);
  const scarf = pal.ramp(['#561c19', '#99331f', '#d4603a']);
  const weapon = pal.ramp(['#3a3128', '#b5a888', '#f2ead2']);
  const slash = pal.ramp(['#5f9d93', '#bdefe3', '#ffffff']);
  const [d, a, b, c] = pal.ramp(['#5d6a6a', '#9aa39c', '#d9d9cb', '#f6f4ea']);
  const [e, w] = pal.ramp(['#0b1315', '#ffffff']);
  const [flash] = pal.ramp(['#ffffff']);
  return {
    pal,
    outline: outline!,
    outlineLit: outlineLit!,
    cloak,
    legs: [l0!, l1!],
    boots: [b0!, b1!],
    hand: hand!,
    scarf,
    weapon,
    slash,
    flash: flash!,
    head: {
      anchorX: 6,
      map: { d: d!, a: a!, b: b!, c: c!, e: e!, w: w! },
      rows: [
        '...b......b...',
        '..bb.....bc...',
        '..abb...bbc...',
        '..abbbbbbbcc..',
        '.aabbbbbbbbcc.',
        '.abbbbbbbbbbc.',
        'aabbbbwebbwebc',
        'aabbbbeebbeebc',
        'aabbbbeebbeebb',
        '.aabbbbbbbbbb.',
        '..aabbbbbbbb..',
        '...daaaaaaa...',
      ],
    },
    blink: { 6: 'aabbbbbbbbbbbc', 7: 'aabbbbeebbeebc', 8: 'aabbbbbbbbbbbb' },
    hurtFace: { 6: 'aabbbbewbbewbc', 7: 'aabbbbbebbbebc', 8: 'aabbbbebbbebbb' },
    scarfLen: 9,
    scarfWidth: 3,
    scarfAt: [-1, -1],
    tail: { ramp: [a!, b!], len: 7 },
    weaponLen: 15,
    hemCut: 1,
    knot: true,
  };
}

/** Hollow Caverns: a horned bone mask with deep black eyes, dark cloak, cape tail and a nail. */
export function hollowBig(): BigCostume {
  const pal = new Palette();
  const [outline, outlineLit] = pal.ramp(['#03040a', '#1a2440']);
  const cloak = pal.ramp(['#0b0e1c', '#192037', '#29345a', '#43547f']);
  const [l0, l1] = pal.ramp(['#151a30', '#28304f']);
  const [b0, b1] = pal.ramp(['#07080f', '#11152a']);
  const [hand] = pal.ramp(['#232b49']);
  const scarf = pal.ramp(['#141a30', '#232d4d', '#36456e']);
  const weapon = pal.ramp(['#3e4660', '#a9b4cc', '#f1f5ff']);
  const slash = pal.ramp(['#6f8fd0', '#cfe2ff', '#ffffff']);
  const [s, g, w] = pal.ramp(['#7d88a6', '#c3cbe0', '#f4f6fb']);
  const [e, E] = pal.ramp(['#05060c', '#8fe3ff']);
  const [flash] = pal.ramp(['#ffffff']);
  return {
    pal,
    outline: outline!,
    outlineLit: outlineLit!,
    cloak,
    legs: [l0!, l1!],
    boots: [b0!, b1!],
    hand: hand!,
    scarf,
    weapon,
    slash,
    flash: flash!,
    head: {
      anchorX: 6,
      map: { s: s!, g: g!, w: w!, e: e!, E: E! },
      rows: [
        '..w........w..',
        '..ww......ww..',
        '...w......w...',
        '...ww....ww...',
        '....wwwwwww...',
        '..wwwwwwwwwww.',
        '.gwwwwwwwwwwww',
        '.gwwwEewwwEeww',
        'gwwweeewweeeww',
        'gwwweeewweeeww',
        'gwwwweewwweeww',
        'sgwwwwwwwwwwwg',
        '.sggwwwwwwwgg.',
        '..ssgggggggs..',
      ],
    },
    blink: { 7: '.gwwwwwwwwwwww', 8: 'gwwweeewweeeww', 9: 'gwwwwwwwwwwwww', 10: 'gwwwwwwwwwwwww' },
    hurtFace: { 7: '.gwwwwwwwwwwww', 8: 'gwwwEeewwEeeww', 9: 'gwwwweewwweeww', 10: 'gwwwwwwwwwwwww' },
    scarfLen: 7,
    scarfWidth: 4,
    scarfAt: [1, 1],
    weaponLen: 14,
  };
}

/** Sunlit Meadow: a red-haired climber with a bouncing braid, blue jacket and brown boots. */
export function meadowBig(): BigCostume {
  const pal = new Palette();
  const [outline, outlineLit] = pal.ramp(['#2a1a2e', '#5a3a4a']);
  const cloak = pal.ramp(['#1b2558', '#2f4f9e', '#4a80d6', '#8cc0f5']);
  const [l0, l1] = pal.ramp(['#33243a', '#4d3652']);
  const [b0, b1] = pal.ramp(['#5a2f2a', '#8a4a35']);
  const [hand] = pal.ramp(['#f2b48c']);
  const hair = pal.ramp(['#7a1f2e', '#c4392f', '#ef6d3a']);
  const weapon = pal.ramp(['#5a4a5a', '#c9c2d0', '#ffffff']);
  const slash = pal.ramp(['#ffb36b', '#fff0c2', '#ffffff']);
  const [S, s, sl] = pal.ramp(['#c97a62', '#f2b48c', '#ffd9b8']);
  const [e, bl] = pal.ramp(['#2a1a2e', '#ef7f7f']);
  const [flash] = pal.ramp(['#ffffff']);
  const [d, h, H] = hair as [number, number, number];
  return {
    pal,
    outline: outline!,
    outlineLit: outlineLit!,
    cloak,
    legs: [l0!, l1!],
    boots: [b0!, b1!],
    hand: hand!,
    scarf: hair,
    weapon,
    slash,
    flash: flash!,
    head: {
      anchorX: 6,
      map: { d, h, H, s: s!, S: S!, l: sl!, e: e!, b: bl! },
      rows: [
        '....hhhhh.....',
        '..dhhHHHHh....',
        '.dhhhhhHHHh...',
        'dhhhhhhhhHHh..',
        'dhhhhhhhhhhhh.',
        'dhhhhhhhshhhh.',
        'ddhhhhhssshhss',
        'ddhhhSsssssssl',
        'ddhhhSssessess',
        'ddhhhSssessess',
        '.dhhhSsssbsssb',
        '..dhhSSsssssS.',
        '....SSSSSSS...',
      ],
    },
    blink: { 8: 'ddhhhSssssssss', 9: 'ddhhhSssessess' },
    hurtFace: { 8: 'ddhhhSsseesees', 9: 'ddhhhSssssssss' },
    scarfLen: 7,
    scarfWidth: 4,
    chainFromHead: [1, 2],
    weaponLen: 13,
    hemCut: 3,
  };
}

/** Ember Forge: a crested iron helm with a glowing visor and a flame plume. */
export function emberBig(): BigCostume {
  const pal = new Palette();
  const [outline, outlineLit] = pal.ramp(['#0a0508', '#3a1a14']);
  const cloak = pal.ramp(['#0b1c22', '#163a40', '#22585c', '#3f8580']);
  const [l0, l1] = pal.ramp(['#1c1216', '#33262a']);
  const [b0, b1] = pal.ramp(['#3a2e30', '#6e5a54']);
  const [hand] = pal.ramp(['#6e5a54']);
  const flame = pal.ramp(['#c2361a', '#ff8a2a', '#ffd76a']);
  const weapon = pal.ramp(['#3a2e30', '#b9a59a', '#fff3e0']);
  const slash = pal.ramp(['#e0561e', '#ffc35a', '#fff6d6']);
  const [m, M, h] = pal.ramp(['#4a3a3a', '#86705f', '#dcc3a6']);
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
