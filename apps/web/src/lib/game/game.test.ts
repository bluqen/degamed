import { describe, expect, it } from 'vitest';
import { buildGame, KITS, readSpec, themes } from '.';
import { decodeSpec, encodeSpec } from '../share';
import { humanize, level, plainLabel } from '../../studio/TunePanel';

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
  const spec = { kit: 'platformer', theme: 'rain-ruins', title: 'Robôt’s Quest', seed: 42, params: { speed: 200, enemies: false, difficulty: 'tricky' } };

  it('round-trips a spec, including non-ASCII titles', async () => {
    const code = await encodeSpec(spec);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeSpec(code)).toMatchObject(spec);
  });

  it('keeps links short by leaving out default params', async () => {
    const code = await encodeSpec(spec, { speed: 200, enemies: true, difficulty: 'tricky' });
    expect(code.length).toBeLessThan(120);
    expect(await decodeSpec(code)).toMatchObject({ ...spec, params: { enemies: false } });
  });

  it('still opens links made in the older format', async () => {
    const legacy = btoa(JSON.stringify({ k: 'platformer', t: 'rain-ruins', n: 'Old', s: 1 })).replace(/=+$/, '');
    expect(await decodeSpec(legacy)).toMatchObject({ kit: 'platformer', title: 'Old' });
  });

  it('rejects junk', async () => {
    expect(await decodeSpec('%%%')).toBeNull();
    expect(await decodeSpec('1abc')).toBeNull();
  });
});

describe('humanize', () => {
  it('turns keys and choices into friendly labels', () => {
    expect(humanize('relaxed')).toBe('Relaxed');
    expect(humanize('boss_rush')).toBe('Boss rush');
    expect(humanize('doubleJump')).toBe('Double jump');
  });
});

describe('tune labels', () => {
  it('describes slider positions in words', () => {
    expect(level(5, 0, 10, 5)).toBe('Normal');
    expect(level(1, 0, 10, 5)).toBe('Very low');
    expect(level(4, 0, 10, 5)).toBe('Low');
    expect(level(6, 0, 10, 5)).toBe('High');
    expect(level(10, 0, 10, 5)).toBe('Very high');
  });
  it('drops units from labels', () => {
    expect(plainLabel('Jump height (tiles)')).toBe('Jump height');
    expect(plainLabel('Level length (screens)')).toBe('Level length');
  });
});
