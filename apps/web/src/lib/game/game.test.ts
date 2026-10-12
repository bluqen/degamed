import { describe, expect, it } from 'vitest';
import { makeStubBuildGame, STUB_KITS, stubReadSpec } from './stub-kits';
import { stubThemes } from './stub-themes';
import { decodeSpec, encodeSpec } from '../share';
import { humanize } from '../../studio/TunePanel';

// A fake encoder: tests don't need real PNGs, only stable strings.
let n = 0;
const encode = () => `data:image/png;base64,${n++}`;
const build = makeStubBuildGame(stubThemes);

type Ent = { id: string; tags: string[]; components: { Script?: { src: string; props?: Record<string, unknown> } } };
const sceneOf = (files: Record<string, string>) => JSON.parse(files['scenes/main.scene.json']!) as { parallax: { factor: number }[]; background: string; entities: Ent[] };

describe('stub kit (stand-in for @degamed/engine/kits)', () => {
  it('stores the spec in the project and reads it back', () => {
    const files = build({ kit: 'platformer', theme: 'rain-ruins', title: 'Robot', seed: 3 }, encode);
    const spec = stubReadSpec(files)!;
    expect(spec.kit).toBe('platformer');
    expect(spec.theme).toBe('rain-ruins');
    expect(spec.params?.speed).toBe(150);
  });

  it('applies params to the game', () => {
    const files = build({ kit: 'platformer', theme: 'meadow', title: 'T', params: { speed: 240, enemies: false } }, encode);
    const scene = sceneOf(files);
    expect(scene.entities.some((e) => e.tags.includes('enemy'))).toBe(false);
    const player = scene.entities.find((e) => e.components.Script?.src === 'scripts/player.js')!;
    expect(player.components.Script!.props!.speed).toBe(240);
  });

  it('uses the theme art and keeps parallax factors valid', () => {
    const files = build({ kit: 'platformer', theme: 'ember-caves', title: 'T' }, encode);
    const scene = sceneOf(files);
    expect(scene.background).toBe(stubThemes().find((t) => t.id === 'ember-caves')!.background);
    expect(scene.parallax.length).toBeGreaterThan(0);
    expect(scene.parallax.every((l) => l.factor >= 0 && l.factor <= 1)).toBe(true);
  });

  it('falls back to the first theme for unknown ids', () => {
    const files = build({ kit: 'platformer', theme: 'nope', title: 'T' }, encode);
    expect(stubReadSpec(files)!.theme).toBe(stubThemes()[0]!.id);
  });

  it('reads no spec from hand-made projects', () => {
    expect(stubReadSpec({ 'project.json': '{}' })).toBeNull();
    expect(stubReadSpec({ 'game.spec.json': 'not json' })).toBeNull();
  });

  it('every param has a plain-English label and a valid default', () => {
    for (const p of STUB_KITS.flatMap((k) => k.params)) {
      expect(p.label).toMatch(/^[A-Z]/);
      if (p.type === 'number') expect(Number(p.default)).toBeGreaterThanOrEqual(p.min!);
      if (p.type === 'choice') expect(p.choices).toContain(p.default);
    }
  });
});

describe('share links', () => {
  it('round-trips a spec, including non-ASCII titles', () => {
    const spec = { kit: 'platformer', theme: 'rain-ruins', title: 'Robôt’s Quest', seed: 42, params: { speed: 200, enemies: false, difficulty: 'tricky' } };
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
