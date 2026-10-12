import { describe, expect, it } from 'vitest';
import { Entity, ProjectManifest, Scene, findDuplicateEntityIds } from './project';
import { parseHostMessage, parsePlayMessage } from './protocol';

const manifest = {
  engine: 'degamed',
  engineVersion: '0.1.0',
  title: 'Neon Cat Heist',
  resolution: { width: 1280, height: 720 },
  artStyle: 'neon',
  palette: ['#140830', '#7C5CFF', '#22D3EE'],
  defaultLanguage: 'python',
  physics: { engine: 'arcade', gravity: { x: 0, y: 900 } },
  startScene: 'scenes/main.scene.json',
  input: { jump: ['Space', 'ArrowUp'] },
};

describe('ProjectManifest', () => {
  it('accepts a valid manifest', () => {
    expect(ProjectManifest.parse(manifest).title).toBe('Neon Cat Heist');
  });

  it('rejects bad palette colors', () => {
    const result = ProjectManifest.safeParse({ ...manifest, palette: ['purple', '#22D3EE'] });
    expect(result.success).toBe(false);
  });
});

describe('Scene', () => {
  const scene = {
    name: 'Main',
    entities: [
      {
        id: 'world',
        name: 'World',
        components: {},
        children: [
          {
            id: 'player',
            name: 'Player',
            components: {
              Transform: { position: { x: 240, y: 512 } },
              Script: { src: 'scripts/player.py', props: { speed: 220 } },
            },
          },
        ],
      },
    ],
  };

  it('parses nested entities and fills defaults', () => {
    const parsed = Scene.parse(scene);
    const player = parsed.entities[0]!.children[0]!;
    expect(player.active).toBe(true);
    expect(player.tags).toEqual([]);
    expect(player.components.Transform?.scale).toEqual({ x: 1, y: 1 });
  });

  it('rejects unknown components', () => {
    const bad = { id: 'x', name: 'X', components: { Spirte: { asset: 'cat.svg' } } };
    expect(Entity.safeParse(bad).success).toBe(false);
  });

  it('rejects scripts that are not .py or .js', () => {
    const bad = { id: 'x', name: 'X', components: { Script: { src: 'player.rb' } } };
    expect(Entity.safeParse(bad).success).toBe(false);
  });

  it('finds duplicate ids anywhere in the tree', () => {
    const parsed = Scene.parse({
      name: 'Dupes',
      entities: [
        { id: 'a', name: 'A', components: {}, children: [{ id: 'b', name: 'B', components: {} }] },
        { id: 'b', name: 'B again', components: {} },
      ],
    });
    expect(findDuplicateEntityIds(parsed.entities)).toEqual(['b']);
  });
});

describe('parsePlayMessage', () => {
  it('accepts our messages', () => {
    expect(parsePlayMessage({ channel: 'degamed', type: 'fps', fps: 60 })).toEqual({
      channel: 'degamed',
      type: 'fps',
      fps: 60,
    });
  });

  it('ignores foreign or malformed messages', () => {
    expect(parsePlayMessage({ type: 'fps', fps: 60 })).toBeNull();
    expect(parsePlayMessage('hello')).toBeNull();
    expect(
      parsePlayMessage({ channel: 'degamed', type: 'screenshot', requestId: '1', dataUrl: 'javascript:x' }),
    ).toBeNull();
  });
});

describe('Scene environment', () => {
  const base = { name: 'Night', entities: [] };

  it('is optional, so older scenes still load', () => {
    expect(Scene.parse(base).environment).toBeUndefined();
  });

  it('accepts a full atmosphere and fills defaults', () => {
    const scene = Scene.parse({
      ...base,
      environment: {
        ambient: { color: '#3A4466' },
        fog: { color: '#8899AA' },
        bloom: {},
        vignette: 0.4,
        grade: { contrast: 1.1, saturation: 0.8, tint: '#FFEEDD' },
        particles: [{ type: 'rain' }, { type: 'fireflies', density: 0.2, color: '#FFE08A' }],
      },
    });
    const env = scene.environment!;
    expect(env.ambient?.intensity).toBe(1);
    expect(env.fog?.density).toBe(0.3);
    expect(env.bloom?.strength).toBe(0.6);
    expect(env.particles?.[0]).toEqual({ type: 'rain', density: 0.5 });
  });

  it('rejects unknown particle types and out-of-range values', () => {
    expect(Scene.safeParse({ ...base, environment: { particles: [{ type: 'lava', density: 1 }] } }).success).toBe(false);
    expect(Scene.safeParse({ ...base, environment: { vignette: 2 } }).success).toBe(false);
    expect(Scene.safeParse({ ...base, environment: { ambient: { color: 'dark', intensity: 0.5 } } }).success).toBe(false);
  });
});

describe('Light component and camera feel', () => {
  it('fills light defaults', () => {
    const e = Entity.parse({ id: 'lamp', name: 'Lamp', components: { Light: { radius: 90 } } });
    expect(e.components.Light).toEqual({ color: '#FFE7B0', radius: 90, intensity: 1, flicker: 0, offset: { x: 0, y: 0 } });
  });

  it('keeps old cameras valid and adds look-ahead defaults', () => {
    const e = Entity.parse({ id: 'cam', name: 'Camera', components: { Camera: { follow: 'player' } } });
    expect(e.components.Camera).toMatchObject({ follow: 'player', zoom: 1, smoothing: 0.12, lookAhead: 0 });
  });
});

describe('Touch controls', () => {
  it('is optional and fills a jump button by default', () => {
    expect(ProjectManifest.parse(manifest).touch).toBeUndefined();
    const m = ProjectManifest.parse({ ...manifest, touch: {} });
    expect(m.touch).toEqual({ move: 'horizontal', buttons: [{ action: 'jump', label: 'A' }] });
  });
});

describe('Tilemap component', () => {
  it('accepts rows of terrain and needs ground and fill tiles', () => {
    const ok = Entity.safeParse({
      id: 'map',
      name: 'Level',
      components: { Tilemap: { tiles: { ground: 'a.png', fill: 'b.png' }, rows: ['....', '#==#', '####'] } },
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.components.Tilemap?.tileSize).toBe(16);
    const bad = Entity.safeParse({ id: 'map', name: 'Level', components: { Tilemap: { tiles: { ground: 'a.png' }, rows: ['#'] } } });
    expect(bad.success).toBe(false);
  });
});

describe('player protocol additions', () => {
  it('fps carries CPU ms and quality; host can send focus and input', () => {
    expect(parsePlayMessage({ channel: 'degamed', type: 'fps', fps: 58, ms: 2.1, quality: 2 })).not.toBeNull();
    expect(parsePlayMessage({ channel: 'degamed', type: 'fps', fps: 58 })).not.toBeNull();
    expect(parseHostMessage({ channel: 'degamed', type: 'input', action: 'jump', down: true })).not.toBeNull();
    expect(parseHostMessage({ channel: 'degamed', type: 'focus' })).not.toBeNull();
  });
});
