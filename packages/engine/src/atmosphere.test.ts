import { describe, expect, it } from 'vitest';
import { ambientColor, applyMatrix, flickerAt, fogVeilAlphas, gradeMatrix, lookAheadStep, needsLightmap, pixelZoom, surfaceAt } from './atmosphere-math';
import { fontSafe, fontWidth, FONT_CHARS } from './font';
import { belowStripHeight, choosePlacement } from './touch';

describe('atmosphere maths', () => {
  it('an empty grade changes nothing; saturation 0 is grey; contrast spreads around mid grey', () => {
    const c: [number, number, number] = [0.2, 0.5, 0.8];
    applyMatrix(gradeMatrix({}), c).forEach((v, i) => expect(v).toBeCloseTo(c[i]!));
    const [r, g, b] = applyMatrix(gradeMatrix({ saturation: 0 }), c);
    expect(r).toBeCloseTo(g);
    expect(g).toBeCloseTo(b);
    const hi = applyMatrix(gradeMatrix({ contrast: 1.5 }), [0.8, 0.5, 0.2]);
    expect(hi[0]).toBeGreaterThan(0.8);
    expect(hi[1]).toBeCloseTo(0.5);
    expect(hi[2]).toBeLessThan(0.2);
  });

  it('tint shifts hue without darkening', () => {
    const [r, g, b] = applyMatrix(gradeMatrix({ tint: '#808080' }), [0.5, 0.5, 0.5]);
    expect([r, g, b].map((v) => +v.toFixed(3))).toEqual([0.5, 0.5, 0.5]);
  });

  it('ambient uses the hue of its colour and the brightness of its intensity', () => {
    expect(ambientColor(undefined)).toEqual([1, 1, 1]);
    const [r, g, b] = ambientColor({ ambient: { color: '#204080', intensity: 0.5 } });
    expect(b).toBeCloseTo(0.5);
    expect(r).toBeCloseTo(0.125);
    expect(g).toBeCloseTo(0.25);
    expect(needsLightmap({ ambient: { color: '#FFFFFF', intensity: 1 } })).toBe(false);
    expect(needsLightmap({ ambient: { color: '#FFFFFF', intensity: 0.6 } })).toBe(true);
  });

  it('flicker stays within range and is steady without flicker', () => {
    expect(flickerAt(3.2, 0)).toBe(1);
    for (let t = 0; t < 5; t += 0.07) {
      const f = flickerAt(t, 1, 4);
      expect(f).toBeGreaterThanOrEqual(0.44);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it('fog is thicker on far layers', () => {
    const a = fogVeilAlphas(4, 0.5);
    expect(a[0]).toBeGreaterThan(a[3]!);
    expect(Math.max(...fogVeilAlphas(7, 1))).toBeLessThanOrEqual(0.85);
  });

  it('prefers whole-number zoom for crisp pixels', () => {
    expect(pixelZoom(960, 540, 480, 270)).toBe(2);
    expect(pixelZoom(1000, 560, 480, 270)).toBe(2);
    expect(pixelZoom(844, 390, 480, 270)).toBeCloseTo(390 / 270);
    expect(pixelZoom(300, 200, 480, 270)).toBeCloseTo(0.625);
  });

  it('finds the highest surface for rain splashes', () => {
    const rects = [
      { x: 0, y: 200, width: 100, height: 16 },
      { x: 40, y: 150, width: 20, height: 16 },
    ];
    expect(surfaceAt(rects, 50, 0, 270)).toBe(150);
    expect(surfaceAt(rects, 10, 0, 270)).toBe(200);
    expect(surfaceAt(rects, 300, 0, 270)).toBeNull();
  });

  it('look-ahead eases towards the direction of travel', () => {
    let x = 0;
    for (let i = 0; i < 120; i++) x = lookAheadStep(x, 150, 40, 1 / 60);
    expect(x).toBeGreaterThan(35);
    for (let i = 0; i < 120; i++) x = lookAheadStep(x, -150, 40, 1 / 60);
    expect(x).toBeLessThan(-35);
  });
});

describe('pixel font', () => {
  it('upper-cases text and replaces characters it cannot draw', () => {
    expect(fontSafe('Coins: 3 ♥')).toBe('COINS: 3 ♥');
    expect(fontSafe('ü~')).toBe('??');
    expect(fontWidth('ABC')).toBe(3 * 6 + 1);
    expect(new Set(FONT_CHARS).size).toBe(FONT_CHARS.length);
  });
});

describe('touch placement', () => {
  it('puts controls under the game in portrait, in the bars on wide landscape, else over it', () => {
    expect(choosePlacement(390, 844, 480, 270)).toBe('below');
    expect(choosePlacement(844, 390, 480, 270)).toBe('sides');
    expect(choosePlacement(740, 390, 480, 270)).toBe('overlay');
    expect(belowStripHeight(390, 844)).toBeGreaterThanOrEqual(150);
    expect(belowStripHeight(390, 844)).toBeLessThanOrEqual(260);
  });
});
