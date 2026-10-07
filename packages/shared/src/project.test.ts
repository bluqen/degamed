import { describe, expect, it } from 'vitest';
import { Entity, ProjectManifest, Scene, findDuplicateEntityIds } from './project';
import { parsePlayMessage } from './protocol';

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
