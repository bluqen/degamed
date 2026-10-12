import { Palette } from '../core';
import type { HeroCostume } from '../hero';

/** A young climber: bouncing red-orange hair, blue jacket, brown boots. */
export function meadowHeroCostume(): HeroCostume {
  const pal = new Palette();
  const [outline, outlineLit] = pal.ramp(['#2a1a2e', '#5a3a4a']);
  const cloak = pal.ramp(['#1f2a63', '#2f4f9e', '#4a80d6', '#8cc0f5']);
  const legs = pal.ramp(['#3d2532', '#6b3f3a']);
  const hair = pal.ramp(['#7a1f2e', '#c4392f', '#ef6d3a']);
  const weapon = pal.ramp(['#5a4a5a', '#c9c2d0', '#ffffff']);
  const slash = pal.ramp(['#ffb36b', '#fff0c2', '#ffffff']);
  const [S, s, sl] = pal.ramp(['#c97a62', '#f2b48c', '#ffd9b8']);
  const [eye, blush] = pal.ramp(['#2a1a2e', '#ef7f7f']);
  const [flash] = pal.ramp(['#ffffff']);
  const [d, h, H] = hair as [number, number, number];
  return {
    pal,
    outline: outline!,
    outlineLit: outlineLit!,
    cloak,
    legs,
    scarf: hair,
    weapon,
    slash,
    flash: flash!,
    head: {
      anchorX: 4,
      map: { d, h, H, s: s!, S: S!, l: sl!, e: eye!, b: blush! },
      rows: [
        '...hhhh...',
        '.dhhHHHhh.',
        'dhhhhhHHhh',
        'dhhhhhhhhh',
        'dhhhhsshhh',
        'ddhhssssss',
        'ddhSsesses',
        'ddhSsesses',
        '.dhSssbssb',
        '..dSSSSSS.',
      ],
    },
    blink: { 6: 'ddhSssssss', 7: 'ddhSsesses' },
    hurtFace: { 6: 'ddhSssssss', 7: 'ddhSseesee' },
    scarfLen: 6,
    scarfWidth: 3,
    scarfAt: [-4, -6],
    scarfKnot: false,
    cloakLen: 8,
    cloakTop: 3,
    cloakHem: 4,
    ragged: 0,
  };
}
