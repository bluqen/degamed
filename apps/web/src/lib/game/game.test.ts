import { describe, expect, it } from 'vitest';
import { buildGame, KITS, readSpec, themes } from '.';
import { decodeSpec, encodeSpec } from '../share';
import { humanize } from '../../studio/TunePanel';

// A fake encoder: tests don't need real PNGs, only strings.
const encode = () => 'data:image/png;base64,AAAA';

describe('game adapter (engine kits + art themes)', () => {
  it('offers kits whose params the Tune panel can show', () => {
    expect(KITS.length).toBeGreaterThan(0);
    for (const p of KITS.flatMap((k) => k.params)) {
      expect(p.label).toMatch(/^[A-Z]/);
      if (p.type === 'number')
        expect(typeof p.min === 'number' && typeof p.max === 'number').toBe(true);
      if (p.type === 'choice') expect(p.choices).toContain(p.default);
    }
  });

  it('offers themes with art for previews', () => {
    expect(themes().length).toBeGreaterThan(0);
    const t = themes()[0]!;
    expect(t.layers.length).toBeGreaterThan(0);
    expect(t.sprites.hero.frameWidth).toBeGreaterThan(0);
  });

  it('builds a game whose spec reads back (what Tune and Look rely on)', () => {
    const theme = themes()[0]!.id;
    const files = buildGame({ kit: KITS[0]!.id, theme, title: 'Test', seed: 3 }, encode);
    const spec = readSpec(files)!;
    expect(spec.kit).toBe(KITS[0]!.id);
    expect(spec.theme).toBe(theme);
    expect(readSpec({ 'project.json': '{}' })).toBeNull();
  });
});

describe('share links', () => {
  it('round-trips a spec, including non-ASCII titles', () => {
    const spec = {
      kit: 'platformer',
      theme: 'rain-ruins',
      title: 'Robôt’s Quest',
      seed: 42,
      params: { speed: 200, enemies: false, difficulty: 'tricky' },
    };
    const code = encodeSpec(spec);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeSpec(code)).toMatchObject(spec);
  });

  it('rejects junk', () => {
    expect(decodeSpec('%%%')).toBeNull();
    expect(decodeSpec(encodeSpec({ kit: 'x', theme: 'y', title: 'z' }).slice(0, 5))).toBeNull();
  });
});

describe('humanize', () => {
  it('turns keys and choices into friendly labels', () => {
    expect(humanize('relaxed')).toBe('Relaxed');
    expect(humanize('boss_rush')).toBe('Boss rush');
    expect(humanize('doubleJump')).toBe('Double jump');
  });
});
