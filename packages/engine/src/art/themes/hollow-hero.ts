import { Palette } from '../core';
import type { HeroCostume } from '../hero';

/** A small horned vessel: bone-white mask, dark cloak, a needle-thin nail. */
export function hollowHeroCostume(): HeroCostume {
  const pal = new Palette();
  const [outline, outlineLit] = pal.ramp(['#03040a', '#1a2440']);
  const cloak = pal.ramp(['#0b0e1c', '#192037', '#283353', '#3f4f7a']);
  const legs = pal.ramp(['#0a0c16', '#161b2c']);
  const scarf = pal.ramp(['#141a30', '#232d4d', '#36456e']);
  const weapon = pal.ramp(['#3e4660', '#a9b4cc', '#f1f5ff']);
  const slash = pal.ramp(['#6f8fd0', '#cfe2ff', '#ffffff']);
  const [s, g, w] = pal.ramp(['#7d88a6', '#c3cbe0', '#f4f6fb']);
  const [eye, glint] = pal.ramp(['#05060c', '#8fe3ff']);
  const [flash] = pal.ramp(['#ffffff']);
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
      map: { w: w!, g: g!, s: s!, e: eye!, E: glint! },
      rows: [
        '.w......w.',
        '.ww....ww.',
        '..w....w..',
        '..ww..ww..',
        '..wwwwwww.',
        '.gwwwwwwww',
        'gwwEewEeww',
        'gwweeweeww',
        'gwweeweeww',
        'sgwwewweww',
        '.sggwwwwg.',
        '..ssggss..',
      ],
    },
    blink: { 6: 'gwwwwwwwww', 7: 'gwweeweeww', 8: 'gwwwwwwwww', 9: 'sgwwwwwwww' },
    hurtFace: { 6: 'gwweEwweEw', 7: 'gwwEewwEew', 8: 'gwweEwweEw', 9: 'sgwwwwwwww' },
    scarfLen: 6,
    scarfWidth: 3,
    scarfAt: [-2, 2],
    scarfKnot: false,
    cloakLen: 8,
    cloakTop: 3,
    cloakHem: 5,
    ragged: 1,
    legLen: 6,
  };
}
