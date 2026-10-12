import { Palette } from '../core';
import type { HeroCostume } from '../hero';

export function rainHeroCostume(): HeroCostume {
  const pal = new Palette();
  const [outline, outlineLit] = pal.ramp(['#0b1315', '#253537']);
  const cloak = pal.ramp(['#4a585b', '#848f8b', '#c3c6b8', '#eceadd']);
  const legs = pal.ramp(['#2c3638', '#4a5655']);
  const scarf = pal.ramp(['#561c19', '#99331f', '#d4603a']);
  const weapon = pal.ramp(['#3a3128', '#b5a888', '#f2ead2']);
  const slash = pal.ramp(['#5f9d93', '#bdefe3', '#ffffff']);
  const [eye, glint] = pal.ramp(['#0b1315', '#ffffff']);
  const [flash] = pal.ramp(['#ffffff']);
  const [d, a, b, c] = cloak as [number, number, number, number];
  return {
    pal,
    outline: outline!,
    outlineLit: outlineLit!,
    cloak,
    legs,
    scarf,
    weapon,
    slash,
    flash: flash!,
    head: {
      anchorX: 4,
      map: { d, a, b, c, e: eye!, w: glint! },
      rows: [
        '.b.....b..',
        '.bb...bc..',
        '.abbbbbcc.',
        'abbbbbbbcc',
        'abbbbebbec',
        'abbbbebbec',
        'aabbbbbbbb',
        '.aabbbbbb.',
        '..daaaaa..',
      ],
    },
    blink: { 4: 'abbbbbbbbc', 5: 'abbbbebbec' },
    hurtFace: { 4: 'abbbbebbec', 5: 'abbbbbbbbc' },
    scarfLen: 7,
    scarfWidth: 2,
    scarfAt: [-2, 1],
    cloakLen: 9,
    cloakTop: 3,
    cloakHem: 5,
    ragged: 1,
    tail: { ramp: [a, b], len: 6 },
  };
}
