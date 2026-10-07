import { describe, expect, it } from 'vitest';
import { ProjectManifest, Scene, findDuplicateEntityIds, type Entity } from '@degamed/shared';
import { compileScripts, listImports, resolvePath, rewriteImports, ScriptError } from './scripts';
import { InputState } from './input';
import { ditheredSky, rasterize, ridgeLayer, SPRITES } from './pixel';
import { createPlatformerTemplate } from './templates/platformer';

describe('script loading', () => {
  it('resolves relative paths', () => {
    expect(resolvePath('scripts/player.js', './enemy.js')).toBe('scripts/enemy.js');
    expect(resolvePath('scripts/ai/boss.js', '../util.js')).toBe('scripts/util.js');
    expect(() => resolvePath('player.js', '../../x.js')).toThrow('outside the project');
  });

  it('finds and rewrites static imports and re-exports', () => {
    const src = `import { Behaviour } from 'degamed';\nimport Enemy from "./enemy.js";\nexport { helper } from './util.js';\nimport './side.js';`;
    expect(listImports(src)).toEqual(['degamed', './enemy.js', './util.js', './side.js']);
    expect(rewriteImports(src, 'scripts/a.js', (s) => `X:${s}`)).toContain(`import Enemy from "X:./enemy.js"`);
  });

  it('compiles a dependency graph to module URLs', () => {
    const files = {
      'scripts/player.js': `import { Behaviour } from 'degamed';\nimport { speed } from './config.js';\nexport default class P extends Behaviour {}`,
      'scripts/config.js': `export const speed = 3;`,
    };
    const made: string[] = [];
    const urls = compileScripts(files, ['scripts/player.js'], 'blob:degamed', (code) => {
      made.push(code);
      return `blob:${made.length}`;
    });
    expect(urls.get('scripts/config.js')).toBe('blob:1');
    expect(urls.get('scripts/player.js')).toBe('blob:2');
    expect(made[1]).toContain(`from 'blob:degamed'`);
    expect(made[1]).toContain(`from 'blob:1'`);
  });

  it('reports missing files, bare imports and cycles with the file name', () => {
    const fake = () => 'blob:x';
    const bare = () => compileScripts({ 'a.js': `import x from 'lodash';` }, ['a.js'], 'd', fake);
    expect(bare).toThrow(ScriptError);
    expect(bare).toThrow(`Can't import "lodash"`);
    expect(() => compileScripts({ 'a.js': `import './b.js';` }, ['a.js'], 'd', fake)).toThrow('Cannot find b.js');
    expect(() =>
      compileScripts({ 'a.js': `import './b.js';`, 'b.js': `import './a.js';` }, ['a.js'], 'd', fake),
    ).toThrow('Circular import');
  });
});

describe('InputState', () => {
  it('maps actions, tracks just-pressed per frame and computes axes', () => {
    const input = new InputState({ jump: ['Space', 'KeyZ'] });
    input.press('KeyZ');
    expect(input.isPressed('jump')).toBe(true);
    expect(input.isDown('jump')).toBe(true);
    input.endFrame();
    expect(input.isPressed('jump')).toBe(false);
    expect(input.isDown('jump')).toBe(true);
    input.press('ArrowRight');
    expect(input.axis('horizontal')).toBe(1);
    input.press('KeyA');
    expect(input.axis('horizontal')).toBe(0);
    input.release('ArrowRight');
    expect(input.axis('horizontal')).toBe(-1);
    expect(input.isDown('Space')).toBe(false);
  });
});

describe('pixel art', () => {
  it('every starter sprite is a valid rectangular grid', () => {
    for (const [name, grid] of Object.entries(SPRITES)) {
      expect(() => rasterize(grid), name).not.toThrow();
    }
  });

  it('rejects ragged rows and unknown colours', () => {
    expect(() => rasterize({ rows: ['ab', 'a'], colors: { a: '#000000', b: '#ffffff' } })).toThrow('Row 1');
    expect(() => rasterize({ rows: ['az'], colors: { a: '#000000' } })).toThrow('Unknown pixel "z"');
  });

  it('dithered sky uses only the given colours', () => {
    const sky = ditheredSky(8, 16, ['#000000', '#FFFFFF']);
    const values = new Set<number>();
    for (let i = 0; i < sky.data.length; i += 4) values.add(sky.data[i]!);
    expect([...values].sort((a, b) => a - b)).toEqual([0, 255]);
  });

  it('ridge layers tile seamlessly left to right', () => {
    const r = ridgeLayer(64, 40, { base: 10, amplitude: 6, color: '#334455', rim: '#ffffff', seed: 3 });
    const top = (x: number) => {
      for (let y = 0; y < r.height; y++) if (r.data[(y * r.width + x) * 4 + 3]) return y;
      return r.height;
    };
    expect(Math.abs(top(0) - top(63))).toBeLessThanOrEqual(1);
  });
});

describe('platformer template', () => {
  const files = createPlatformerTemplate(() => 'data:image/png;base64,AAAA');

  it('produces a valid manifest and scene', () => {
    const manifest = ProjectManifest.parse(JSON.parse(files['project.json']!));
    const scene = Scene.parse(JSON.parse(files[manifest.startScene]!));
    expect(scene.entities.length).toBeGreaterThan(30);
    expect(findDuplicateEntityIds(scene.entities)).toEqual([]);
  });

  it('references only files that exist', () => {
    const scene = Scene.parse(JSON.parse(files['scenes/main.scene.json']!));
    const refs = new Set<string>(scene.parallax.map((l) => l.asset));
    const walk = (list: Entity[]) =>
      list.forEach((e) => {
        if (e.components.Sprite) refs.add(e.components.Sprite.asset);
        if (e.components.Script) refs.add(e.components.Script.src);
        walk(e.children);
      });
    walk(scene.entities);
    for (const ref of refs) expect(files[ref], ref).toBeDefined();
  });

  it('scripts only import degamed', () => {
    for (const [path, src] of Object.entries(files)) {
      if (path.endsWith('.js')) expect(listImports(src), path).toEqual(['degamed']);
    }
  });
});
