import { Palette } from '../core';
import type { HeroCostume } from '../hero';

/** A helmed wanderer: iron helm with a glowing visor, a flame plume, a deep teal cloak. */
export function emberHeroCostume(): HeroCostume {
  const pal = new Palette();
  const [outline, outlineLit] = pal.ramp(['#0a0508', '#3a1a14']);
  const cloak = pal.ramp(['#0b1c22', '#163a40', '#22585c', '#3f8580']);
  const legs = pal.ramp(['#140c10', '#2e2226']);
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
    legs,
    scarf: flame,
    weapon,
    slash,
    flash: flash!,
    head: {
      anchorX: 4,
      map: { m: m!, M: M!, h: h!, g: g!, G: G! },
      rows: [
        '....hh....',
        '...mMhm...',
        '..mMMhMm..',
        '.mMMMhMMm.',
        '.mMMMMMMMm',
        'mmMMMMMMMM',
        'mmMgGGgggG',
        'mmMMMMMhMm',
        '.mmMMMMMm.',
        '..mmmmmm..',
      ],
    },
    blink: { 6: 'mmMggggggg' },
    hurtFace: { 6: 'mmMGGGGGGG' },
    headRim: [m!, M!],
    scarfLen: 7,
    scarfWidth: 3,
    scarfAt: [-1, -8],
    scarfKnot: false,
    cloakLen: 9,
    cloakTop: 3,
    cloakHem: 5,
    ragged: 1,
  };
}
